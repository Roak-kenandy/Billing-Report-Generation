const mongoose = require('mongoose');
const { parse } = require('json2csv');
const { isMongoConnected } = require('../config/db');

const AGG_OPTS = { maxTimeMS: 600000, allowDiskUse: true };

const DEFAULT_ORGANIZATION_NAME = 'Maldives National Defence Force';

const assertMongoConnected = () => {
    if (!isMongoConnected()) {
        const err = new Error('MongoDB is not connected. This report requires CRM MongoDB.');
        err.statusCode = 503;
        throw err;
    }
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildOrganizationNameRegex = (organizationName) => {
    const trimmed = String(organizationName || DEFAULT_ORGANIZATION_NAME).trim();
    return new RegExp(`^${escapeRegex(trimmed)}\\.?$`, 'i');
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

const formatServiceDate = (value) => {
    const ts = Number(value);
    if (!Number.isFinite(ts) || ts <= 0) return '';
    const date = new Date(ts * 1000);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
};

const summarizeSubscription = (subscription) => {
    const services = subscription?.services || [];
    if (!services.length) {
        return {
            packages: '',
            packageStates: '',
            subscriptionStart: '',
            subscriptionEnd: '',
            effectiveCount: 0,
        };
    }

    const packages = [];
    const states = [];
    let minStart = null;
    let maxEnd = null;
    let effectiveCount = 0;

    services.forEach((service) => {
        const productName = service?.product?.name || '';
        const state = service?.state || '';
        if (productName) {
            packages.push(state ? `${productName} (${state})` : productName);
        }
        if (state) states.push(state);
        if (state === 'EFFECTIVE' || state === 'ACTIVE') effectiveCount += 1;

        const start = Number(service?.service_terms?.start_date);
        const end = Number(service?.service_terms?.end_date);
        if (Number.isFinite(start) && start > 0) {
            minStart = minStart === null ? start : Math.min(minStart, start);
        }
        if (Number.isFinite(end) && end > 0) {
            maxEnd = maxEnd === null ? end : Math.max(maxEnd, end);
        }
    });

    return {
        packages: packages.join(', '),
        packageStates: [...new Set(states)].join(', '),
        subscriptionStart: formatServiceDate(minStart),
        subscriptionEnd: formatServiceDate(maxEnd),
        effectiveCount,
    };
};

const mapDeviceRow = (contact, device, subscriptionSummary, deviceIndex, deviceCount) => {
    const deviceFields = device?.custom_fields || [];
    return {
        Name: contact.profile?.name || '',
        'Contact Code': contact.profile?.code || '',
        'Account Number': contact.account?.number || '',
        Phone: normalizePhone(contact.phone),
        Packages: subscriptionSummary.packages,
        'Package States': subscriptionSummary.packageStates,
        'Active Packages Count': subscriptionSummary.effectiveCount,
        'Subscription Start': subscriptionSummary.subscriptionStart,
        'Subscription End': subscriptionSummary.subscriptionEnd,
        'Device #': device ? deviceIndex + 1 : '',
        'Total Devices On Account': deviceCount,
        'STB Type': device?.product?.name || '',
        'Smartcard ID': device
            ? normalizeElectronicId(device.electronic_id)
            || getCustomField(deviceFields, 'smartcard_id')
            || getCustomField(deviceFields, 'smartcard')
            : '',
        'Settopbox Serial': device
            ? (device.provisioning?.serial_number || device.serial_number || '')
            : '',
        Barcode: device
            ? (getCustomField(deviceFields, 'code') || getCustomField(deviceFields, 'barcode') || '')
            : '',
        'Client ID': device ? getCustomField(deviceFields, 'client_id') : '',
        Atoll: contact.location?.province || '',
        Island: contact.location?.city || '',
        'Inst. Address': contact.location?.address_name || '',
    };
};

const buildContactPipeline = (nameRegex) => [
    {
        $match: {
            'profile.name': nameRegex,
        },
    },
    { $sort: { 'account.number': 1 } },
    {
        $lookup: {
            from: 'Subscriptions',
            localField: 'contact_id',
            foreignField: 'contact_id',
            as: 'subscriptionDoc',
        },
    },
    {
        $addFields: {
            subscriptionDoc: { $arrayElemAt: ['$subscriptionDoc', 0] },
        },
    },
    {
        $lookup: {
            from: 'Devices',
            localField: 'contact_id',
            foreignField: 'ownership.id',
            as: 'devices',
        },
    },
    {
        $addFields: {
            deviceCount: { $size: { $ifNull: ['$devices', []] } },
            devices: {
                $cond: [
                    { $gt: [{ $size: { $ifNull: ['$devices', []] } }, 0] },
                    '$devices',
                    [null],
                ],
            },
        },
    },
    { $unwind: '$devices' },
    {
        $project: {
            contact_id: 1,
            profile: 1,
            account: 1,
            phone: 1,
            location: 1,
            subscriptionDoc: 1,
            devices: 1,
            deviceCount: 1,
        },
    },
];

const exportOrganizationDeviceReport = async (filters) => {
    assertMongoConnected();

    const organizationName = filters.organizationName || DEFAULT_ORGANIZATION_NAME;
    const nameRegex = buildOrganizationNameRegex(organizationName);
    const page = parseInt(filters.page, 10) || 1;
    const limit = Math.min(parseInt(filters.limit, 10) || 25, 500);
    const isCsv = filters.format === 'csv';

    const basePipeline = buildContactPipeline(nameRegex);

    if (isCsv) {
        const rows = await mongoose.connection.db.collection('ContactProfiles')
            .aggregate(basePipeline, AGG_OPTS)
            .toArray();

        const deviceCounterByContact = {};
        const indexedResults = rows.map((row) => {
            const cid = row.contact_id;
            deviceCounterByContact[cid] = (deviceCounterByContact[cid] || 0) + 1;
            const subscriptionSummary = summarizeSubscription(row.subscriptionDoc);
            const mapped = mapDeviceRow(
                row,
                row.devices,
                subscriptionSummary,
                deviceCounterByContact[cid] - 1,
                row.deviceCount || 0,
            );
            return mapped;
        });

        return {
            isCsv: true,
            csv: parse(indexedResults),
            data: indexedResults,
        };
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
                ],
            },
        },
    ];

    const [facetResult] = await mongoose.connection.db.collection('ContactProfiles')
        .aggregate(pipeline, AGG_OPTS)
        .toArray();

    const total = facetResult?.meta?.[0]?.total || 0;
    const pageRows = facetResult?.data || [];

    const deviceCounterByContact = {};
    const results = pageRows.map((row) => {
        const cid = row.contact_id;
        deviceCounterByContact[cid] = (deviceCounterByContact[cid] || 0) + 1;
        const subscriptionSummary = summarizeSubscription(row.subscriptionDoc);
        return mapDeviceRow(
            row,
            row.devices,
            subscriptionSummary,
            deviceCounterByContact[cid] - 1,
            row.deviceCount || 0,
        );
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
        organizationName,
    };
};

module.exports = {
    exportOrganizationDeviceReport,
    DEFAULT_ORGANIZATION_NAME,
};
