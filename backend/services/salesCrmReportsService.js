const mongoose = require('mongoose');
const { parse } = require('json2csv');
const { isMongoConnected } = require('../config/db');

const AGG_OPTS = { maxTimeMS: 600000, allowDiskUse: true };

const CONTACT_PROJECTION = {
    contact_id: 1,
    account: 1,
    profile: 1,
    location: 1,
    custom_fields: 1,
    tags: 1,
    phone: 1,
    submited_by_user_name: 1,
    created_by_user_name: 1,
};

const DEVICE_LOOKUP = {
    $lookup: {
        from: 'Devices',
        let: { cid: '$_id' },
        pipeline: [
            { $match: { $expr: { $eq: ['$ownership.id', '$$cid'] } } },
            { $limit: 1 },
            {
                $project: {
                    electronic_id: 1,
                    serial_number: 1,
                    'provisioning.serial_number': 1,
                    'product.name': 1,
                    custom_fields: 1,
                },
            },
        ],
        as: 'devices',
    },
};

const assertMongoConnected = () => {
    if (!isMongoConnected()) {
        const err = new Error('MongoDB is not connected. These reports require CRM MongoDB Atlas.');
        err.statusCode = 503;
        throw err;
    }
};

const requireDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) {
        const err = new Error('startDate and endDate are required');
        err.statusCode = 400;
        throw err;
    }
};

const getDateRangeTimestamps = (startDate, endDate) => {
    const startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
    const endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);
    return { startTimestamp, endTimestamp };
};

const formatCsvDate = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const ts = Number(value);
    if (!Number.isFinite(ts) || ts <= 0) return '';
    const date = new Date(ts * 1000);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const formatLegacyDate = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const ts = Number(value);
    if (!Number.isFinite(ts) || ts <= 0) return '';
    const date = new Date(ts * 1000);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const getCustomField = (fields, key) => {
    if (!Array.isArray(fields)) return '';
    const field = fields.find((item) => item?.key === key);
    return field?.value_label ?? field?.value ?? '';
};

const normalizePhone = (phone) => {
    if (Array.isArray(phone)) return phone.filter(Boolean).join(',');
    return phone ? String(phone) : '';
};

const normalizeElectronicId = (value) => String(value || '').replace(/:/g, '');

const getDeviceFields = (devices) => {
    const device = Array.isArray(devices) && devices.length > 0 ? devices[0] : null;
    if (!device) {
        return {
            smartcardId: '',
            settopboxId: '',
            barcode: '',
            clientId: '',
            stbType: '',
            smartLabsId: '',
            smartLabsSerial: '',
        };
    }

    const deviceFields = device.custom_fields || [];
    return {
        smartcardId: normalizeElectronicId(device.electronic_id)
            || getCustomField(deviceFields, 'smartcard_id')
            || getCustomField(deviceFields, 'smartcard'),
        settopboxId: device.provisioning?.serial_number || device.serial_number || '',
        barcode: getCustomField(deviceFields, 'code') || getCustomField(deviceFields, 'barcode') || '',
        clientId: getCustomField(deviceFields, 'client_id') || '',
        stbType: device.product?.name || '',
        smartLabsId: getCustomField(deviceFields, 'smartlabs_id') || '',
        smartLabsSerial: getCustomField(deviceFields, 'smartlabs_serial') || '',
    };
};

const getAreaFromTags = (tags) => {
    if (!Array.isArray(tags)) return '';
    return tags.map((tag) => tag?.name).filter(Boolean).join(',');
};

const getBalance = (account) => {
    if (!account) return 0;
    const balance = account.balance;
    if (Array.isArray(balance)) return Number(balance[0]) || 0;
    return Number(balance) || 0;
};

const buildContactMatchAfterLookup = ({ search, atoll, island }) => {
    const match = {};
    if (atoll) match['contact.location.province'] = atoll;
    if (island) match['contact.location.city'] = island;
    if (search) {
        match.$or = [
            { 'contact.profile.name': { $regex: search, $options: 'i' } },
            { 'contact.account.number': { $regex: search, $options: 'i' } },
            { 'contact.profile.code': { $regex: search, $options: 'i' } },
        ];
    }
    return match;
};

const ACTIVE_SERVICE_STATES = ['EFFECTIVE', 'ACTIVE'];

const buildActiveServiceElemMatch = (startTimestamp, endTimestamp) => ({
    state: 'EFFECTIVE',
    'service_terms.start_date': { $lte: endTimestamp },
    'service_terms.end_date': { $gte: startTimestamp },
});

const buildActiveServiceMatch = (startTimestamp, endTimestamp) => ({
    'services.state': 'EFFECTIVE',
    'services.service_terms.start_date': { $lte: endTimestamp },
    'services.service_terms.end_date': { $gte: startTimestamp },
});

const buildDisconnectedServiceElemMatch = (startTimestamp, endTimestamp) => ({
    state: 'NOT_EFFECTIVE',
    $or: [
        {
            last_deactivated_on: {
                $gte: startTimestamp,
                $lte: endTimestamp,
            },
        },
        {
            $and: [
                {
                    $or: [
                        { last_deactivated_on: { $exists: false } },
                        { last_deactivated_on: null },
                        { last_deactivated_on: 0 },
                    ],
                },
                {
                    'service_terms.end_date': {
                        $gte: startTimestamp,
                        $lte: endTimestamp,
                    },
                },
            ],
        },
    ],
});

const buildDisconnectedServiceMatch = (startTimestamp, endTimestamp) => ({
    'services.state': 'NOT_EFFECTIVE',
    $or: [
        {
            'services.last_deactivated_on': {
                $gte: startTimestamp,
                $lte: endTimestamp,
            },
        },
        {
            $and: [
                {
                    $or: [
                        { 'services.last_deactivated_on': { $exists: false } },
                        { 'services.last_deactivated_on': null },
                        { 'services.last_deactivated_on': 0 },
                    ],
                },
                {
                    'services.service_terms.end_date': {
                        $gte: startTimestamp,
                        $lte: endTimestamp,
                    },
                },
            ],
        },
    ],
});

const buildGroupedActivePipeline = ({
    startTimestamp,
    endTimestamp,
    search,
    atoll,
    island,
}) => {
    const pipeline = [
        {
            $match: {
                services: {
                    $elemMatch: buildActiveServiceElemMatch(startTimestamp, endTimestamp),
                },
            },
        },
        { $unwind: '$services' },
        { $match: buildActiveServiceMatch(startTimestamp, endTimestamp) },
        {
            $group: {
                _id: '$contact_id',
                services: {
                    $push: {
                        product_name: '$services.product.name',
                        price: '$services.price_terms.price',
                        start_date: '$services.service_terms.start_date',
                        end_date: '$services.service_terms.end_date',
                        rated_up_to_date: '$services.rated_up_to_date',
                        last_activated_on: '$services.last_activated_on',
                        last_deactivated_on: '$services.last_deactivated_on',
                    },
                },
            },
        },
        {
            $lookup: {
                from: 'ContactProfiles',
                localField: '_id',
                foreignField: 'contact_id',
                as: 'contact',
                pipeline: [{ $project: CONTACT_PROJECTION }],
            },
        },
        { $unwind: '$contact' },
    ];

    const contactMatch = buildContactMatchAfterLookup({ search, atoll, island });
    if (Object.keys(contactMatch).length > 0) {
        pipeline.push({ $match: contactMatch });
    }

    pipeline.push({ $sort: { 'contact.account.number': 1 } });
    return pipeline;
};

const buildGroupedDisconnectedPipeline = ({
    startTimestamp,
    endTimestamp,
    search,
    atoll,
    island,
}) => {
    const pipeline = [
        {
            $match: {
                services: {
                    $not: {
                        $elemMatch: { state: { $in: ACTIVE_SERVICE_STATES } },
                    },
                },
            },
        },
        {
            $match: {
                services: {
                    $elemMatch: buildDisconnectedServiceElemMatch(startTimestamp, endTimestamp),
                },
            },
        },
        { $unwind: '$services' },
        { $match: buildDisconnectedServiceMatch(startTimestamp, endTimestamp) },
        {
            $group: {
                _id: '$contact_id',
                services: {
                    $push: {
                        product_name: '$services.product.name',
                        price: '$services.price_terms.price',
                        start_date: '$services.service_terms.start_date',
                        end_date: '$services.service_terms.end_date',
                        rated_up_to_date: '$services.rated_up_to_date',
                        last_activated_on: '$services.last_activated_on',
                        last_deactivated_on: '$services.last_deactivated_on',
                    },
                },
            },
        },
        {
            $lookup: {
                from: 'ContactProfiles',
                localField: '_id',
                foreignField: 'contact_id',
                as: 'contact',
                pipeline: [{ $project: CONTACT_PROJECTION }],
            },
        },
        { $unwind: '$contact' },
    ];

    const contactMatch = buildContactMatchAfterLookup({ search, atoll, island });
    if (Object.keys(contactMatch).length > 0) {
        pipeline.push({ $match: contactMatch });
    }

    pipeline.push({ $sort: { 'contact.account.number': 1 } });
    return pipeline;
};

const buildGroupedServicePipeline = ({
    reportType,
    startTimestamp,
    endTimestamp,
    search,
    atoll,
    island,
}) => {
    if (reportType === 'disconnected') {
        return buildGroupedDisconnectedPipeline({
            startTimestamp,
            endTimestamp,
            search,
            atoll,
            island,
        });
    }

    return buildGroupedActivePipeline({
        startTimestamp,
        endTimestamp,
        search,
        atoll,
        island,
    });
};

const mapGroupedEntry = (row) => ({
    contact_id: row._id,
    account: row.contact?.account,
    profile: row.contact?.profile,
    location: row.contact?.location || {},
    custom_fields: row.contact?.custom_fields || [],
    tags: row.contact?.tags || [],
    phone: row.contact?.phone,
    devices: row.devices || [],
    services: row.services || [],
});

const mapActiveSubscriptionRow = (entry) => {
    const devices = getDeviceFields(entry.devices);
    const packages = [];
    const prices = [];
    let priceSum = 0;
    const subscribedDates = [];
    const disconnectionDates = [];

    entry.services.forEach((service) => {
        packages.push(service?.product_name || '');
        const price = Number(service?.price) || 0;
        prices.push(price);
        priceSum += price;
        subscribedDates.push(formatLegacyDate(service?.start_date));
        disconnectionDates.push(formatLegacyDate(service?.rated_up_to_date || service?.end_date));
    });

    return {
        Account: entry.account?.number || '',
        Name: entry.profile?.name || '',
        NIC: getCustomField(entry.custom_fields, 'id_number') || getCustomField(entry.custom_fields, 'id _number'),
        'Customer Type': entry.profile?.type || '',
        'Customers dealer': getCustomField(entry.custom_fields, 'service_provider'),
        'Smartcard ID': devices.smartcardId,
        'Settopbox ID': devices.settopboxId,
        Barcode: devices.barcode,
        'Client ID': devices.clientId || getCustomField(entry.custom_fields, 'customer_code'),
        'STB Type': devices.stbType,
        'Available credit': getBalance(entry.account),
        Contact: normalizePhone(entry.phone),
        Area: getAreaFromTags(entry.tags),
        Atoll: entry.location?.province || '',
        Island: entry.location?.city || '',
        Ward: entry.location?.address_line1 || '',
        Street: entry.location?.address_line2 || '',
        'Inst. Address': entry.location?.address_name || '',
        Floor: getCustomField(entry.custom_fields, 'floor'),
        Apartment: getCustomField(entry.custom_fields, 'apartment'),
        Packages: packages.join(','),
        'Package price': prices.join(','),
        'Price Sum': priceSum,
        'Subscribed dates': subscribedDates.join(','),
        'Disconnection dates': disconnectionDates.join(','),
        'Registered date': formatLegacyDate(entry.profile?.registration_date),
    };
};

const mapDisconnectedRow = (entry) => {
    const devices = getDeviceFields(entry.devices);
    const sortedServices = [...entry.services].sort((a, b) => {
        const aDate = Number(a?.start_date || a?.last_activated_on || 0);
        const bDate = Number(b?.start_date || b?.last_activated_on || 0);
        return aDate - bDate;
    });

    const base = sortedServices[0];
    const addon = sortedServices.slice(1);

    return {
        Account: entry.account?.number || '',
        Name: entry.profile?.name || '',
        NIC: getCustomField(entry.custom_fields, 'id_number') || getCustomField(entry.custom_fields, 'id _number'),
        'Customer Dealer': getCustomField(entry.custom_fields, 'service_provider'),
        'Customer Type': entry.profile?.type || '',
        'Smartcard ID': devices.smartcardId,
        'Settopbox ID': devices.settopboxId,
        Barcode: devices.barcode,
        'Client ID': devices.clientId || getCustomField(entry.custom_fields, 'customer_code'),
        'STB Type': devices.stbType,
        'Available credit': getBalance(entry.account),
        Contact: normalizePhone(entry.phone),
        Area: getAreaFromTags(entry.tags),
        Atoll: entry.location?.province || '',
        Island: entry.location?.city || '',
        Ward: entry.location?.address_line1 || '',
        Street: entry.location?.address_line2 || '',
        'Inst. Address': entry.location?.address_name || '',
        Floor: getCustomField(entry.custom_fields, 'floor'),
        Apartment: getCustomField(entry.custom_fields, 'apartment'),
        'Base package': base?.product_name || '',
        'Base last active date': formatCsvDate(base?.last_deactivated_on || base?.last_activated_on || base?.end_date),
        'Addon package': addon.map((service) => service?.product_name).filter(Boolean).join(','),
        'Addon last active date': addon.map((service) => formatCsvDate(
            service?.last_deactivated_on || service?.last_activated_on || service?.end_date
        )).filter(Boolean).join(','),
        'Registered date': formatCsvDate(entry.profile?.registration_date),
    };
};

const fetchGroupedServiceReport = async (filters, reportType, mapRow) => {
    requireDateRange(filters.startDate, filters.endDate);
    const { startTimestamp, endTimestamp } = getDateRangeTimestamps(filters.startDate, filters.endDate);
    const page = parseInt(filters.page, 10) || 1;
    const limit = parseInt(filters.limit, 10) || 10;
    const isCsv = filters.format === 'csv';

    const basePipeline = buildGroupedServicePipeline({
        reportType,
        startTimestamp,
        endTimestamp,
        search: filters.search,
        atoll: filters.atoll,
        island: filters.island,
    });

    if (isCsv) {
        const pipeline = [...basePipeline, DEVICE_LOOKUP];
        const rows = await mongoose.connection.db.collection('Subscriptions')
            .aggregate(pipeline, AGG_OPTS).toArray();
        const results = rows.map((row) => mapRow(mapGroupedEntry(row)));
        return { isCsv: true, csv: parse(results), data: results };
    }

    const skip = (page - 1) * limit;
    const pipeline = [
        ...basePipeline,
        {
            $facet: {
                meta: [{ $count: 'total' }],
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    DEVICE_LOOKUP,
                ],
            },
        },
    ];

    const [facetResult] = await mongoose.connection.db.collection('Subscriptions')
        .aggregate(pipeline, AGG_OPTS).toArray();

    const total = facetResult?.meta?.[0]?.total || 0;
    const results = (facetResult?.data || []).map((row) => mapRow(mapGroupedEntry(row)));

    return {
        isCsv: false,
        data: results,
        pagination: {
            totalItems: total,
            totalPages: Math.ceil(total / limit) || 1,
            currentPage: page,
            pageSize: limit,
        },
    };
};

const exportActiveSubscriptionReport = async (filters) => {
    assertMongoConnected();
    return fetchGroupedServiceReport(filters, 'active', mapActiveSubscriptionRow);
};

const exportDisconnectedReport = async (filters) => {
    assertMongoConnected();
    return fetchGroupedServiceReport(filters, 'disconnected', mapDisconnectedRow);
};

const exportNewConnectionReport = async (filters) => {
    assertMongoConnected();
    requireDateRange(filters.startDate, filters.endDate);
    const { startTimestamp, endTimestamp } = getDateRangeTimestamps(filters.startDate, filters.endDate);
    const page = parseInt(filters.page, 10) || 1;
    const limit = parseInt(filters.limit, 10) || 10;
    const isCsv = filters.format === 'csv';

    const matchStage = {
        'profile.registration_date': {
            $gte: startTimestamp,
            $lte: endTimestamp,
        },
    };

    if (filters.atoll) matchStage['location.province'] = filters.atoll;
    if (filters.island) matchStage['location.city'] = filters.island;
    if (filters.search) {
        matchStage.$or = [
            { 'profile.name': { $regex: filters.search, $options: 'i' } },
            { 'account.number': { $regex: filters.search, $options: 'i' } },
            { 'profile.code': { $regex: filters.search, $options: 'i' } },
        ];
    }

    const basePipeline = [
        { $match: matchStage },
        { $sort: { 'profile.registration_date': -1 } },
        { $project: CONTACT_PROJECTION },
    ];

    if (isCsv) {
        const pipeline = [
            ...basePipeline,
            {
                $lookup: {
                    from: 'Devices',
                    let: { cid: '$contact_id' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$ownership.id', '$$cid'] } } },
                        { $limit: 1 },
                        {
                            $project: {
                                electronic_id: 1,
                                serial_number: 1,
                                'provisioning.serial_number': 1,
                                'product.name': 1,
                                custom_fields: 1,
                            },
                        },
                    ],
                    as: 'devices',
                },
            },
        ];
        const contacts = await mongoose.connection.db.collection('ContactProfiles')
            .aggregate(pipeline, AGG_OPTS).toArray();
        const results = contacts.map((contact) => {
            const devices = getDeviceFields(contact.devices);
            return {
                'Cust code': contact.profile?.code || '',
                'Account no': contact.account?.number || '',
                Name: contact.profile?.name || '',
                NIC: getCustomField(contact.custom_fields, 'id_number') || getCustomField(contact.custom_fields, 'id _number'),
                Contact: normalizePhone(contact.phone),
                Atoll: contact.location?.province || '',
                Island: contact.location?.city || '',
                Ward: contact.location?.address_line1 || '',
                Street: contact.location?.address_line2 || '',
                'Inst. Address': contact.location?.address_name || '',
                Area: getAreaFromTags(contact.tags),
                Type: contact.profile?.type || '',
                'Registered date': formatCsvDate(contact.profile?.registration_date),
                Dealer: getCustomField(contact.custom_fields, 'service_provider'),
                'Smart Card': devices.smartcardId,
                'STB number': devices.settopboxId,
                Barcode: devices.barcode,
                'Client ID': devices.clientId || getCustomField(contact.custom_fields, 'customer_code'),
                'SmartLabs ID': devices.smartLabsId,
                'SmartLabs Serial': devices.smartLabsSerial,
                'STB type': devices.stbType,
                'Created user': contact.submited_by_user_name || contact.created_by_user_name || '',
            };
        });
        return { isCsv: true, csv: parse(results), data: results };
    }

    const skip = (page - 1) * limit;
    const pipeline = [
        ...basePipeline,
        {
            $facet: {
                meta: [{ $count: 'total' }],
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: 'Devices',
                            let: { cid: '$contact_id' },
                            pipeline: [
                                { $match: { $expr: { $eq: ['$ownership.id', '$$cid'] } } },
                                { $limit: 1 },
                                {
                                    $project: {
                                        electronic_id: 1,
                                        serial_number: 1,
                                        'provisioning.serial_number': 1,
                                        'product.name': 1,
                                        custom_fields: 1,
                                    },
                                },
                            ],
                            as: 'devices',
                        },
                    },
                ],
            },
        },
    ];

    const [facetResult] = await mongoose.connection.db.collection('ContactProfiles')
        .aggregate(pipeline, AGG_OPTS).toArray();

    const total = facetResult?.meta?.[0]?.total || 0;
    const results = (facetResult?.data || []).map((contact) => {
        const devices = getDeviceFields(contact.devices);
        return {
            'Cust code': contact.profile?.code || '',
            'Account no': contact.account?.number || '',
            Name: contact.profile?.name || '',
            NIC: getCustomField(contact.custom_fields, 'id_number') || getCustomField(contact.custom_fields, 'id _number'),
            Contact: normalizePhone(contact.phone),
            Atoll: contact.location?.province || '',
            Island: contact.location?.city || '',
            Ward: contact.location?.address_line1 || '',
            Street: contact.location?.address_line2 || '',
            'Inst. Address': contact.location?.address_name || '',
            Area: getAreaFromTags(contact.tags),
            Type: contact.profile?.type || '',
            'Registered date': formatCsvDate(contact.profile?.registration_date),
            Dealer: getCustomField(contact.custom_fields, 'service_provider'),
            'Smart Card': devices.smartcardId,
            'STB number': devices.settopboxId,
            Barcode: devices.barcode,
            'Client ID': devices.clientId || getCustomField(contact.custom_fields, 'customer_code'),
            'SmartLabs ID': devices.smartLabsId,
            'SmartLabs Serial': devices.smartLabsSerial,
            'STB type': devices.stbType,
            'Created user': contact.submited_by_user_name || contact.created_by_user_name || '',
        };
    });

    return {
        isCsv: false,
        data: results,
        pagination: {
            totalItems: total,
            totalPages: Math.ceil(total / limit) || 1,
            currentPage: page,
            pageSize: limit,
        },
    };
};

module.exports = {
    exportActiveSubscriptionReport,
    exportDisconnectedReport,
    exportNewConnectionReport,
};
