const mongoose = require('mongoose');
const { parse } = require('json2csv');
const { isMongoConnected } = require('../config/db');

const AGG_OPTS = { maxTimeMS: 600000, allowDiskUse: true };
const CONTACT_BATCH_SIZE = 2500;
const OTT_TAG = 'OTT';

const CSV_FIELDS = [
    'Match',
    'Account Number',
    'Name',
    'Contact Code',
    'Phone',
    'Tags',
    'Account State',
    'Registered Date',
    'First Activation Date',
    'Packages In Range',
    'Package Amounts',
    'Balance',
    'Dealer',
    'Atoll',
    'Island',
];

const assertMongoConnected = () => {
    if (!isMongoConnected()) {
        const err = new Error('MongoDB is not connected. This report requires CRM MongoDB.');
        err.statusCode = 503;
        throw err;
    }
};

const toMaldivesDay = (value) => {
    const str = String(value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const ms = Date.parse(str);
    if (Number.isNaN(ms)) return null;
    return new Date(ms + 5 * 3600 * 1000).toISOString().slice(0, 10);
};

const maldivesDayStart = (value) => {
    const day = toMaldivesDay(value);
    return day ? Math.floor(Date.parse(`${day}T00:00:00+05:00`) / 1000) : undefined;
};

const maldivesDayEnd = (value) => {
    const start = maldivesDayStart(value);
    return start === undefined ? undefined : start + 86399;
};

const formatDate = (ts) => {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return '';
    return new Date((n + 5 * 3600) * 1000).toISOString().slice(0, 10);
};

const toNumber = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'object' && value.toString) return Number(value.toString()) || 0;
    return Number(value) || 0;
};

const formatMvr = (value) => `MVR ${toNumber(value).toFixed(2)}`;

const getCustomField = (fields, key) => {
    if (!Array.isArray(fields)) return '';
    const field = fields.find((item) => item?.key === key);
    return field?.value_label ?? field?.value ?? '';
};

const getPhone = (phone) => {
    if (Array.isArray(phone)) return phone[0] || '';
    return phone || '';
};

const parseDateRange = (startDate, endDate) => {
    const start = maldivesDayStart(startDate);
    const end = maldivesDayEnd(endDate);
    if (start === undefined || end === undefined) {
        const err = new Error('Start date and end date are required (YYYY-MM-DD).');
        err.statusCode = 400;
        throw err;
    }
    if (start > end) {
        const err = new Error('Start date must be on or before end date.');
        err.statusCode = 400;
        throw err;
    }
    return { start, end };
};

const findOttContactIdsRegistered = async (start, end) => {
    return mongoose.connection.db.collection('ContactProfiles').distinct('contact_id', {
        'tags.name': OTT_TAG,
        'profile.registration_date': { $gte: start, $lte: end },
    });
};

const findOttContactIdsSubscribed = async (start, end) => {
    const rows = await mongoose.connection.db.collection('Subscriptions').aggregate([
        { $match: { 'services.service_terms.start_date': { $gte: start, $lte: end } } },
        { $unwind: '$services' },
        {
            $match: {
                'services.state': { $ne: 'DRAFT' },
                'services.service_terms.start_date': { $gte: start, $lte: end },
            },
        },
        { $group: { _id: '$contact_id' } },
        {
            $lookup: {
                from: 'ContactProfiles',
                localField: '_id',
                foreignField: 'contact_id',
                as: 'contact',
            },
        },
        { $match: { 'contact.tags.name': OTT_TAG } },
        { $project: { _id: 1 } },
    ], AGG_OPTS).toArray();

    return rows.map((row) => row._id).filter(Boolean);
};

const fetchContacts = async (contactIds) => {
    const contactsById = new Map();
    const collection = mongoose.connection.db.collection('ContactProfiles');
    const batches = [];
    for (let i = 0; i < contactIds.length; i += CONTACT_BATCH_SIZE) {
        batches.push(contactIds.slice(i, i + CONTACT_BATCH_SIZE));
    }

    await Promise.all(batches.map(async (batch) => {
        const contacts = await collection.find(
            { contact_id: { $in: batch }, 'tags.name': OTT_TAG },
            {
                projection: {
                    _id: 0,
                    contact_id: 1,
                    'account.number': 1,
                    'account.balance': 1,
                    'account.life_cycle_state': 1,
                    'demographics.first_name': 1,
                    'demographics.last_name': 1,
                    'profile.code': 1,
                    'profile.registration_date': 1,
                    phone: 1,
                    'tags.name': 1,
                    custom_fields: { $elemMatch: { key: 'service_provider' } },
                    'location.province': 1,
                    'location.city': 1,
                },
            }
        ).toArray();
        contacts.forEach((contact) => contactsById.set(contact.contact_id, contact));
    }));

    return contactsById;
};

const fetchSubscriptionDetails = async (contactIds, start, end) => {
    const byContact = new Map();
    const collection = mongoose.connection.db.collection('Subscriptions');
    const batches = [];
    for (let i = 0; i < contactIds.length; i += CONTACT_BATCH_SIZE) {
        batches.push(contactIds.slice(i, i + CONTACT_BATCH_SIZE));
    }

    await Promise.all(batches.map(async (batch) => {
        const docs = await collection.find(
            { contact_id: { $in: batch } },
            {
                projection: {
                    contact_id: 1,
                    first_activation_date: 1,
                    'services.state': 1,
                    'services.product.name': 1,
                    'services.price_terms.price': 1,
                    'services.service_terms.start_date': 1,
                    'services.service_terms.end_date': 1,
                },
            }
        ).toArray();

        for (const doc of docs) {
            const current = byContact.get(doc.contact_id) || {
                firstActivation: null,
                packagesInRange: [],
            };
            if (doc.first_activation_date) {
                current.firstActivation = current.firstActivation == null
                    ? doc.first_activation_date
                    : Math.min(current.firstActivation, doc.first_activation_date);
            }
            for (const svc of doc.services || []) {
                if (!svc || svc.state === 'DRAFT') continue;
                const svcStart = Number(svc.service_terms?.start_date) || 0;
                if (svcStart < start || svcStart > end) continue;
                current.packagesInRange.push({
                    name: svc.product?.name || 'Unknown',
                    state: svc.state,
                    price: toNumber(svc.price_terms?.price),
                    start: svcStart,
                    end: Number(svc.service_terms?.end_date) || 0,
                });
            }
            byContact.set(doc.contact_id, current);
        }
    }));

    for (const details of byContact.values()) {
        details.packagesInRange.sort((a, b) => b.start - a.start);
    }

    return byContact;
};

const buildMatchLabel = (registered, subscribed) => {
    if (registered && subscribed) return 'Registered & Subscribed';
    if (registered) return 'Registered';
    if (subscribed) return 'Subscribed';
    return '';
};

const buildRows = async (start, end) => {
    const [registeredIds, subscribedIds] = await Promise.all([
        findOttContactIdsRegistered(start, end),
        findOttContactIdsSubscribed(start, end),
    ]);

    const registeredSet = new Set(registeredIds);
    const subscribedSet = new Set(subscribedIds);
    const contactIds = [...new Set([...registeredIds, ...subscribedIds])];

    const [contactsById, subscriptionsById] = await Promise.all([
        fetchContacts(contactIds),
        fetchSubscriptionDetails(contactIds, start, end),
    ]);

    const rows = [];
    for (const contactId of contactIds) {
        const contact = contactsById.get(contactId);
        if (!contact) continue;

        const registered = registeredSet.has(contactId);
        const subscribed = subscribedSet.has(contactId);
        const sub = subscriptionsById.get(contactId) || { firstActivation: null, packagesInRange: [] };
        const name = [contact.demographics?.first_name, contact.demographics?.last_name]
            .filter(Boolean)
            .join(' ')
            .trim();

        rows.push({
            Match: buildMatchLabel(registered, subscribed),
            'Account Number': contact.account?.number || '',
            Name: name || contact.profile?.name || '',
            'Contact Code': contact.profile?.code || '',
            Phone: getPhone(contact.phone),
            Tags: Array.isArray(contact.tags) ? contact.tags.map((t) => t?.name).filter(Boolean).join(', ') : '',
            'Account State': contact.account?.life_cycle_state || '',
            'Registered Date': formatDate(contact.profile?.registration_date),
            'First Activation Date': formatDate(sub.firstActivation),
            'Packages In Range': sub.packagesInRange
                .map((pkg) => `${pkg.name} [${pkg.state}] (${formatDate(pkg.start)} to ${formatDate(pkg.end)})`)
                .join('; '),
            'Package Amounts': sub.packagesInRange
                .map((pkg) => `${pkg.name}: ${formatMvr(pkg.price)}`)
                .join('; '),
            Balance: toNumber(contact.account?.balance),
            Dealer: getCustomField(contact.custom_fields, 'service_provider'),
            Atoll: contact.location?.province || '',
            Island: contact.location?.city || '',
            _registered: registered,
            _subscribed: subscribed,
            _sortRegistered: Number(contact.profile?.registration_date) || 0,
            _sortSubscribed: sub.packagesInRange[0]?.start || Number(sub.firstActivation) || 0,
        });
    }

    rows.sort((a, b) => {
        const aDate = Math.max(a._sortRegistered, a._sortSubscribed);
        const bDate = Math.max(b._sortRegistered, b._sortSubscribed);
        return bDate - aDate;
    });

    return {
        rows,
        summary: {
            total: rows.length,
            registered: rows.filter((row) => row._registered).length,
            subscribed: rows.filter((row) => row._subscribed).length,
            both: rows.filter((row) => row._registered && row._subscribed).length,
            tag: OTT_TAG,
            startDate: formatDate(start),
            endDate: formatDate(end),
        },
    };
};

const exportOttTagReport = async (filters = {}) => {
    assertMongoConnected();
    const { start, end } = parseDateRange(filters.startDate, filters.endDate);
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.max(1, parseInt(filters.limit, 10) || 20);
    const format = filters.format || 'json';
    const matchFilter = String(filters.match || '').toLowerCase();
    const search = String(filters.search || '').trim().toLowerCase();

    const { rows: allRows, summary } = await buildRows(start, end);

    let rows = allRows;
    if (matchFilter === 'registered') rows = rows.filter((row) => row._registered && !row._subscribed);
    else if (matchFilter === 'subscribed') rows = rows.filter((row) => row._subscribed && !row._registered);
    else if (matchFilter === 'both') rows = rows.filter((row) => row._registered && row._subscribed);

    if (search) {
        rows = rows.filter((row) => {
            const haystack = [
                row['Account Number'],
                row.Name,
                row['Contact Code'],
                row.Phone,
                row.Tags,
                row.Dealer,
                row.Atoll,
                row.Island,
                row['Packages In Range'],
            ].join(' ').toLowerCase();
            return haystack.includes(search);
        });
    }

    const cleanRows = rows.map(({ _registered, _subscribed, _sortRegistered, _sortSubscribed, ...row }) => row);

    if (format === 'csv') {
        return {
            isCsv: true,
            csv: parse(cleanRows, { fields: CSV_FIELDS }),
            summary: { ...summary, filtered: cleanRows.length },
        };
    }

    const totalItems = cleanRows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const startIdx = (page - 1) * limit;

    return {
        data: cleanRows.slice(startIdx, startIdx + limit),
        summary: { ...summary, filtered: totalItems },
        pagination: {
            page,
            limit,
            totalItems,
            totalPages,
        },
    };
};

module.exports = {
    exportOttTagReport,
    OTT_TAG,
};
