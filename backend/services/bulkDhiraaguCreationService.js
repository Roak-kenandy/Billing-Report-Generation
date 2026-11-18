const xlsx = require('xlsx');
const fs = require('fs');
const { runWithConcurrency } = require('../utils/bulkProcessingUtils');
const DhiraaguCrmService = require('./dhiraaguCrmService');

const BULK_CONCURRENCY = Number(process.env.BULK_DHIRAAGU_CONCURRENCY) || 2;
const BULK_PREVIEW_LIMIT = Number(process.env.BULK_CANCEL_PREVIEW_LIMIT) || 100;
const BULK_RESULTS_LIMIT = Number(process.env.BULK_CANCEL_RESULTS_LIMIT) || 100;

const PHONE_HEADERS = [
    'Phone Number',
    'phone_number',
    'Phone',
    'MSISDN',
    'mobile',
    'Mobile',
    'phone',
];

const dhiraaguCrmService = new DhiraaguCrmService();

const normalizePhoneNumber = (value) => {
    if (value === null || value === undefined) return null;
    const normalized = String(value).replace(/'/g, '').replace(/\D/g, '').trim();
    return normalized || null;
};

const getPhoneFromRow = (row) => {
    for (const header of PHONE_HEADERS) {
        if (row[header] !== undefined && row[header] !== null && row[header] !== '') {
            return normalizePhoneNumber(row[header]);
        }
    }

    const firstValue = Object.values(row)[0];
    return normalizePhoneNumber(firstValue);
};

const parsePhoneNumbersFromFile = (filePath, mimetype) => {
    const isCsv = mimetype === 'text/csv'
        || mimetype === 'application/csv'
        || mimetype === 'application/vnd.ms-excel'
        || filePath.endsWith('.csv');

    const workbook = isCsv
        ? xlsx.read(fs.readFileSync(filePath, 'utf8'), { type: 'string' })
        : xlsx.readFile(filePath);

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    return [...new Set(
        data
            .map(getPhoneFromRow)
            .filter(Boolean)
    )];
};

const processPhonesWithConcurrency = async (phoneNumbers, handler, label) => {
    let processedCount = 0;

    return runWithConcurrency(phoneNumbers, BULK_CONCURRENCY, async (phoneNumber) => {
        try {
            return await handler(phoneNumber);
        } catch (error) {
            return {
                phone_number: phoneNumber,
                status: 'error',
                success: false,
                errors: [error.message],
            };
        } finally {
            processedCount += 1;
            if (processedCount % 50 === 0 || processedCount === phoneNumbers.length) {
                console.log(`[Dhiraagu Bulk] ${label}: ${processedCount}/${phoneNumbers.length} phones processed`);
            }
        }
    });
};

const summarizePreview = (preview) => ({
    total_phones: preview.length,
    ready_new_users: preview.filter((item) => item.status === 'ready_new_user').length,
    ready_existing_users: preview.filter((item) => item.status === 'ready_existing_user').length,
    already_has_videoclub: preview.filter((item) => item.status === 'already_has_videoclub').length,
    missing_account: preview.filter((item) => item.status === 'existing_contact_missing_account').length,
    invalid_phones: preview.filter((item) => item.status === 'invalid_phone').length,
    phones_with_errors: preview.filter((item) => item.status === 'error').length,
    phones_to_process: preview.filter((item) => [
        'ready_new_user',
        'ready_existing_user',
        'existing_contact_missing_account',
    ].includes(item.status)).length,
});

const truncateList = (items, limit) => {
    if (items.length <= limit) {
        return {
            items,
            truncated: false,
            total: items.length,
        };
    }

    return {
        items: items.slice(0, limit),
        truncated: true,
        total: items.length,
    };
};

const processDhiraaguBulkPreview = async (filePath, mimetype) => {
    dhiraaguCrmService.assertConfig();

    const phoneNumbers = parsePhoneNumbersFromFile(filePath, mimetype);

    if (phoneNumbers.length === 0) {
        throw new Error('No phone numbers found in the uploaded file');
    }

    const preview = await processPhonesWithConcurrency(
        phoneNumbers,
        (phoneNumber) => dhiraaguCrmService.previewRegistration(phoneNumber),
        'Preview'
    );

    const summary = summarizePreview(preview);
    const plan = dhiraaguCrmService.getVideoclubPlan();
    const { items, truncated, total } = truncateList(preview, BULK_PREVIEW_LIMIT);

    return {
        ...summary,
        plan: plan.displayName,
        price: plan.priceAmount,
        preview: items,
        preview_truncated: truncated,
        preview_total: total,
        preview_limit: BULK_PREVIEW_LIMIT,
        processing: {
            phone_concurrency: BULK_CONCURRENCY,
        },
    };
};

const processDhiraaguBulkCreation = async (filePath, mimetype) => {
    dhiraaguCrmService.assertConfig();

    const phoneNumbers = parsePhoneNumbersFromFile(filePath, mimetype);

    if (phoneNumbers.length === 0) {
        throw new Error('No phone numbers found in the uploaded file');
    }

    const results = await processPhonesWithConcurrency(
        phoneNumbers,
        (phoneNumber) => dhiraaguCrmService.registerVideoclubUser(phoneNumber),
        'Create'
    );

    const { items, truncated, total } = truncateList(results, BULK_RESULTS_LIMIT);
    const plan = dhiraaguCrmService.getVideoclubPlan();

    return {
        total_phones: results.length,
        total_created: results.filter((item) => item.success && !item.skipped).length,
        total_skipped: results.filter((item) => item.skipped).length,
        total_errors: results.filter((item) => !item.success && !item.skipped).length,
        plan: plan.displayName,
        price: plan.priceAmount,
        results: items,
        results_truncated: truncated,
        results_total: total,
        results_limit: BULK_RESULTS_LIMIT,
        processing: {
            phone_concurrency: BULK_CONCURRENCY,
        },
    };
};

module.exports = {
    parsePhoneNumbersFromFile,
    processDhiraaguBulkPreview,
    processDhiraaguBulkCreation,
};
