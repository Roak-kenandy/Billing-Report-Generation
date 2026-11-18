const mongoose = require('mongoose');
const { parse } = require('json2csv');
const { isMongoConnected } = require('../config/db');

const AGG_OPTS = { maxTimeMS: 600000, allowDiskUse: true };
const CACHE_TTL_MS = 10 * 60 * 1000;
const CONTACT_BATCH_SIZE = 2500;

const FIFA_FREE_PRODUCT = 'FIFA 2026 [FREE] - MTV';
const LAST_ACTIVE_CUTOFF = Math.floor(Date.parse('2026-07-30T23:59:59+05:00') / 1000);

const GROUP_LAST_ACTIVE = 'LAST_ACTIVE_ON_OR_BEFORE_2026_07_30';
const GROUP_FIFA_FREE = 'FIFA_FREE_NO_NEW_PACKAGE';

const GROUP_LABELS = {
    [GROUP_LAST_ACTIVE]: 'Last active on or before 30 Jul 2026',
    [GROUP_FIFA_FREE]: 'FIFA FREE - no new package',
};

const CSV_FIELDS = [
    'Group',
    'Account Number',
    'Name',
    'Contact Code',
    'Phone',
    'Tags',
    'Account State',
    'Last Active Date',
    'Last Package',
    'FIFA Free Start',
    'FIFA Free End',
    'Balance',
    'Dealer',
    'Atoll',
    'Island',
];

let cache = { builtAt: 0, rows: null, pending: null };

const assertMongoConnected = () => {
    if (!isMongoConnected()) {
        const err = new Error('MongoDB is not connected. This report requires CRM MongoDB.');
        err.statusCode = 503;
        throw err;
    }
};

const formatDate = (ts) => {
    const n = Number(ts);
    if (!Number.isFinite(n) || n <= 0) return '';
    return new Date((n + 5 * 3600) * 1000).toISOString().slice(0, 10);
};

const getCustomField = (fields, key) => {
    if (!Array.isArray(fields)) return '';
    const field = fields.find((item) => item?.key === key);
    return field?.value_label ?? field?.value ?? '';
};

const toNumber = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'object' && value.toString) return Number(value.toString()) || 0;
    return Number(value) || 0;
};

const aggregateCandidateContacts = async () => {
    const rows = await mongoose.connection.db.collection('Subscriptions').aggregate([
        {
            $project: {
                contact_id: 1,
                services: {
                    $map: {
                        input: {
                            $filter: {
                                input: { $ifNull: ['$services', []] },
                                as: 's',
                                cond: { $ne: ['$$s.state', 'DRAFT'] },
                            },
                        },
                        as: 's',
                        in: {
                            name: '$$s.product.name',
                            state: '$$s.state',
                            start: '$$s.service_terms.start_date',
                            end: '$$s.service_terms.end_date',
                            lastActive: {
                                $ifNull: [
                                    '$$s.latest_not_effective_date',
                                    { $ifNull: ['$$s.rated_up_to_date', '$$s.service_terms.end_date'] },
                                ],
                            },
                        },
                    },
                },
            },
        },
        {
            $project: {
                contact_id: 1,
                services: 1,
                hasEffective: { $in: ['EFFECTIVE', '$services.state'] },
                lastActive: { $max: '$services.lastActive' },
                hasFifa: { $in: [FIFA_FREE_PRODUCT, '$services.name'] },
            },
        },
        {
            $group: {
                _id: '$contact_id',
                hasEffective: { $max: '$hasEffective' },
                lastActive: { $max: '$lastActive' },
                hasFifa: { $max: '$hasFifa' },
                serviceLists: { $push: '$services' },
            },
        },
        {
            $match: {
                hasEffective: false,
                $or: [
                    { lastActive: { $gt: 0, $lte: LAST_ACTIVE_CUTOFF } },
                    { hasFifa: true },
                ],
            },
        },
        {
            $project: {
                lastActive: 1,
                hasFifa: 1,
                services: {
                    $reduce: { input: '$serviceLists', initialValue: [], in: { $concatArrays: ['$$value', '$$this'] } },
                },
            },
        },
        {
            $addFields: {
                fifaServices: {
                    $filter: { input: '$services', as: 's', cond: { $eq: ['$$s.name', FIFA_FREE_PRODUCT] } },
                },
            },
        },
        {
            $addFields: {
                fifaStart: { $min: '$fifaServices.start' },
                fifaEnd: { $max: '$fifaServices.end' },
            },
        },
        {
            $addFields: {
                tookNewPackage: {
                    $anyElementTrue: [{
                        $map: {
                            input: '$services',
                            as: 's',
                            in: {
                                $and: [
                                    { $ne: ['$$s.name', FIFA_FREE_PRODUCT] },
                                    { $gte: ['$$s.start', '$fifaStart'] },
                                ],
                            },
                        },
                    }],
                },
            },
        },
        {
            $addFields: {
                group: {
                    $switch: {
                        branches: [
                            {
                                case: { $and: ['$hasFifa', { $gt: ['$fifaStart', 0] }, { $not: ['$tookNewPackage'] }] },
                                then: GROUP_FIFA_FREE,
                            },
                            {
                                case: { $and: [{ $gt: ['$lastActive', 0] }, { $lte: ['$lastActive', LAST_ACTIVE_CUTOFF] }] },
                                then: GROUP_LAST_ACTIVE,
                            },
                        ],
                        default: null,
                    },
                },
            },
        },
        { $match: { group: { $ne: null } } },
        {
            $project: {
                group: 1,
                lastActive: 1,
                fifaStart: 1,
                fifaEnd: 1,
                lastPackages: {
                    $setUnion: [{
                        $map: {
                            input: {
                                $filter: {
                                    input: '$services',
                                    as: 's',
                                    cond: { $gte: ['$$s.lastActive', { $subtract: ['$lastActive', 86399] }] },
                                },
                            },
                            as: 's',
                            in: '$$s.name',
                        },
                    }],
                },
            },
        },
    ], AGG_OPTS).toArray();

    return rows;
};

const fetchActiveContacts = async (contactIds) => {
    const contactsById = new Map();
    const collection = mongoose.connection.db.collection('ContactProfiles');
    const batches = [];
    for (let i = 0; i < contactIds.length; i += CONTACT_BATCH_SIZE) {
        batches.push(contactIds.slice(i, i + CONTACT_BATCH_SIZE));
    }
    await Promise.all(batches.map(async (batch) => {
        const contacts = await collection.find(
            { contact_id: { $in: batch }, 'account.life_cycle_state': 'ACTIVE' },
            {
                projection: {
                    _id: 0,
                    contact_id: 1,
                    'account.number': 1,
                    'account.balance': 1,
                    'account.life_cycle_state': 1,
                    'profile.name': 1,
                    'profile.code': 1,
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

const buildRows = async () => {
    const candidates = await aggregateCandidateContacts();
    const contactsById = await fetchActiveContacts(candidates.map((entry) => entry._id));

    const rows = [];
    candidates.forEach((entry) => {
        const contact = contactsById.get(entry._id);
        if (!contact) return;

        const { group } = entry;
        const lastPackages = (entry.lastPackages || []).filter(Boolean);

        rows.push({
            groupKey: group,
            Group: GROUP_LABELS[group],
            'Account Number': contact.account?.number || '',
            Name: contact.profile?.name || '',
            'Contact Code': contact.profile?.code || '',
            Phone: Array.isArray(contact.phone) ? contact.phone.filter(Boolean).join(',') : (contact.phone || ''),
            Tags: (contact.tags || []).map((tag) => tag?.name).filter(Boolean).join(','),
            'Account State': contact.account?.life_cycle_state || '',
            'Last Active Date': formatDate(entry.lastActive),
            'Last Package': lastPackages.join(', '),
            'FIFA Free Start': formatDate(entry.fifaStart),
            'FIFA Free End': formatDate(entry.fifaEnd),
            Balance: toNumber(contact.account?.balance),
            Dealer: getCustomField(contact.custom_fields, 'service_provider'),
            Atoll: contact.location?.province || '',
            Island: contact.location?.city || '',
        });
    });

    rows.sort((a, b) => a['Account Number'].localeCompare(b['Account Number'], undefined, { numeric: true }));
    return rows;
};

const getRows = async (refresh) => {
    const fresh = cache.rows && Date.now() - cache.builtAt < CACHE_TTL_MS;
    if (fresh && !refresh) return cache.rows;
    if (cache.pending) return cache.pending;

    cache.pending = buildRows()
        .then((rows) => {
            cache = { builtAt: Date.now(), rows, pending: null };
            return rows;
        })
        .catch((error) => {
            cache.pending = null;
            throw error;
        });
    return cache.pending;
};

const exportInactiveCustomerGroupsReport = async (filters) => {
    assertMongoConnected();
    const page = parseInt(filters.page, 10) || 1;
    const limit = parseInt(filters.limit, 10) || 20;
    const isCsv = filters.format === 'csv';

    const allRows = await getRows(filters.refresh === 'true');

    let rows = allRows;
    if (filters.group === GROUP_LAST_ACTIVE || filters.group === GROUP_FIFA_FREE) {
        rows = rows.filter((row) => row.groupKey === filters.group);
    }
    if (filters.search && filters.search.trim()) {
        const term = filters.search.trim().toLowerCase();
        rows = rows.filter((row) => (
            row['Account Number'].toLowerCase().includes(term)
            || row.Name.toLowerCase().includes(term)
            || String(row['Contact Code']).toLowerCase().includes(term)
            || String(row.Phone).toLowerCase().includes(term)
        ));
    }

    const summary = {
        [GROUP_LAST_ACTIVE]: allRows.filter((row) => row.groupKey === GROUP_LAST_ACTIVE).length,
        [GROUP_FIFA_FREE]: allRows.filter((row) => row.groupKey === GROUP_FIFA_FREE).length,
        generatedAt: new Date(cache.builtAt).toISOString(),
    };

    const strip = ({ groupKey, ...rest }) => rest;

    if (isCsv) {
        return { isCsv: true, csv: parse(rows.map(strip), { fields: CSV_FIELDS }) };
    }

    return {
        isCsv: false,
        data: rows.slice((page - 1) * limit, page * limit).map(strip),
        summary,
        pagination: {
            totalItems: rows.length,
            totalPages: Math.ceil(rows.length / limit) || 1,
            currentPage: page,
            pageSize: limit,
        },
    };
};

module.exports = {
    exportInactiveCustomerGroupsReport,
    GROUP_LAST_ACTIVE,
    GROUP_FIFA_FREE,
};
