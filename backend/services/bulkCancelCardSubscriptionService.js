const xlsx = require('xlsx');
const fs = require('fs');
const {
    runWithConcurrency,
} = require('../utils/bulkProcessingUtils');
const csmsApiService = require('./csmsApiService');

const BULK_CANCEL_CONCURRENCY = Number(process.env.BULK_CANCEL_CONCURRENCY) || 3;
const BULK_CANCEL_SERVICE_CONCURRENCY = Number(process.env.BULK_CANCEL_SERVICE_CONCURRENCY) || 2;
const BULK_CANCEL_PREVIEW_LIMIT = Number(process.env.BULK_CANCEL_PREVIEW_LIMIT) || 100;
const BULK_CANCEL_RESULTS_LIMIT = Number(process.env.BULK_CANCEL_RESULTS_LIMIT) || 100;
const CANCEL_CARD_BOUQUET_NAME = process.env.CANCEL_CARD_BOUQUET_NAME || 'ICE XTRA - H';

const ACCOUNT_NUMBER_HEADERS = [
    'Account Number',
    'account_number',
    'account number',
    'AccountNumber',
    'Account No',
    'account no',
];

const normalizeAccountNumber = (value) => {
    if (value === null || value === undefined) return null;
    const normalized = String(value).replace(/'/g, '').trim();
    return normalized || null;
};

const getAccountNumberFromRow = (row) => {
    for (const header of ACCOUNT_NUMBER_HEADERS) {
        if (row[header] !== undefined && row[header] !== null && row[header] !== '') {
            return normalizeAccountNumber(row[header]);
        }
    }

    const firstValue = Object.values(row)[0];
    return normalizeAccountNumber(firstValue);
};

const parseAccountNumbersFromFile = (filePath, mimetype) => {
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
            .map(getAccountNumberFromRow)
            .filter(Boolean)
    )];
};

const isCancellableBouquet = (subscription) => (
    subscription.bouquets_name === CANCEL_CARD_BOUQUET_NAME
    && (subscription.viewers_bouquets_cancelled_on === null
        || subscription.viewers_bouquets_cancelled_on === undefined)
);

const getCancellableBouquets = (subscriptions) => (
    subscriptions.filter(isCancellableBouquet)
);

const mapBouquetPreview = (bouquet) => ({
    viewers_bouquets_id: bouquet.viewers_bouquets_id,
    bouquets_name: bouquet.bouquets_name,
    products_name: bouquet.products_name,
    viewers_bouquets_active_from: bouquet.viewers_bouquets_active_from,
    viewers_bouquets_active_to: bouquet.viewers_bouquets_active_to,
});

const buildAccountCancellationPreview = async (accountNumber) => {
    const result = {
        account_number: accountNumber,
        viewers_id: null,
        viewers_name: null,
        subscriptions: [],
        status: 'ready',
        errors: [],
    };

    try {
        const customer = await csmsApiService.getCustomerByAccountNumber(accountNumber);

        if (!customer?.viewers_id) {
            result.status = 'account_not_found';
            result.errors.push('Customer not found for account number');
            return result;
        }

        result.viewers_id = customer.viewers_id;
        result.viewers_name = customer.viewers_name || null;

        const subscriptions = await csmsApiService.getCustomerSubscriptions(customer.viewers_id);
        const cancellable = getCancellableBouquets(subscriptions);

        result.subscriptions = cancellable.map(mapBouquetPreview);

        if (cancellable.length === 0) {
            result.status = 'no_subscriptions_to_cancel';
        }
    } catch (error) {
        result.status = 'error';
        result.errors.push(error.message);
    }

    return result;
};

const cancelBouquetWithConcurrency = async (bouquets) => runWithConcurrency(
    bouquets,
    BULK_CANCEL_SERVICE_CONCURRENCY,
    async (bouquet) => {
        try {
            await csmsApiService.cancelSubscription(bouquet.viewers_bouquets_id);
            return {
                ...bouquet,
                cancelled: true,
            };
        } catch (error) {
            return {
                ...bouquet,
                cancelled: false,
                error: error.message,
            };
        }
    }
);

const executeAccountCancellation = async (preview) => {
    const result = {
        account_number: preview.account_number,
        viewers_id: preview.viewers_id,
        viewers_name: preview.viewers_name,
        cancelled_subscriptions: [],
        skipped: [],
        errors: [...(preview.errors || [])],
    };

    if (preview.status !== 'ready' || preview.subscriptions.length === 0) {
        return result;
    }

    const cancellationResults = await cancelBouquetWithConcurrency(preview.subscriptions);

    cancellationResults.forEach((item) => {
        if (item.cancelled) {
            result.cancelled_subscriptions.push({
                viewers_bouquets_id: item.viewers_bouquets_id,
                bouquets_name: item.bouquets_name,
                products_name: item.products_name,
            });
        } else {
            result.errors.push(
                `Failed to cancel bouquet ${item.viewers_bouquets_id}: ${item.error}`
            );
        }
    });

    return result;
};

const processAccountsWithConcurrency = async (accountNumbers, handler, label) => {
    let processedCount = 0;

    return runWithConcurrency(accountNumbers, BULK_CANCEL_CONCURRENCY, async (accountNumber) => {
        try {
            return await handler(accountNumber);
        } catch (error) {
            return {
                account_number: accountNumber,
                viewers_id: null,
                viewers_name: null,
                subscriptions: [],
                cancelled_subscriptions: [],
                skipped: [],
                status: 'error',
                errors: [error.message],
            };
        } finally {
            processedCount += 1;
            if (processedCount % 100 === 0 || processedCount === accountNumbers.length) {
                console.log(`[Cancel Card Subscription] ${label}: ${processedCount}/${accountNumbers.length} accounts processed`);
            }
        }
    });
};

const summarizePreview = (preview) => ({
    total_accounts: preview.length,
    accounts_with_subscriptions_to_cancel: preview.filter((item) => item.subscriptions.length > 0).length,
    total_subscriptions_to_cancel: preview.reduce(
        (sum, item) => sum + item.subscriptions.length,
        0
    ),
    accounts_not_found: preview.filter((item) => item.status === 'account_not_found').length,
    accounts_with_no_subscriptions: preview.filter((item) => item.status === 'no_subscriptions_to_cancel').length,
    accounts_with_errors: preview.filter((item) => item.status === 'error').length,
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

const processCancelCardSubscriptionsPreview = async (filePath, mimetype) => {
    const accountNumbers = parseAccountNumbersFromFile(filePath, mimetype);

    if (accountNumbers.length === 0) {
        throw new Error('No account numbers found in the uploaded file');
    }

    const preview = await processAccountsWithConcurrency(
        accountNumbers,
        buildAccountCancellationPreview,
        'Preview'
    );

    const summary = summarizePreview(preview);
    const { items, truncated, total } = truncateList(preview, BULK_CANCEL_PREVIEW_LIMIT);

    return {
        ...summary,
        bouquet_filter: CANCEL_CARD_BOUQUET_NAME,
        preview: items,
        preview_truncated: truncated,
        preview_total: total,
        preview_limit: BULK_CANCEL_PREVIEW_LIMIT,
        processing: {
            account_concurrency: BULK_CANCEL_CONCURRENCY,
            subscription_concurrency: BULK_CANCEL_SERVICE_CONCURRENCY,
        },
    };
};

const processCancelCardSubscriptions = async (filePath, mimetype) => {
    const accountNumbers = parseAccountNumbersFromFile(filePath, mimetype);

    if (accountNumbers.length === 0) {
        throw new Error('No account numbers found in the uploaded file');
    }

    const results = await processAccountsWithConcurrency(
        accountNumbers,
        async (accountNumber) => {
            const preview = await buildAccountCancellationPreview(accountNumber);
            return executeAccountCancellation(preview);
        },
        'Cancel'
    );

    const { items, truncated, total } = truncateList(results, BULK_CANCEL_RESULTS_LIMIT);

    return {
        total_accounts: results.length,
        total_cancelled: results.reduce(
            (sum, item) => sum + (item?.cancelled_subscriptions?.length || 0),
            0
        ),
        total_errors: results.reduce(
            (sum, item) => sum + (item?.errors?.length || 0),
            0
        ),
        accounts_not_found: results.filter((item) => !item.viewers_id && item.errors?.length).length,
        bouquet_filter: CANCEL_CARD_BOUQUET_NAME,
        results: items,
        results_truncated: truncated,
        results_total: total,
        results_limit: BULK_CANCEL_RESULTS_LIMIT,
        processing: {
            account_concurrency: BULK_CANCEL_CONCURRENCY,
            subscription_concurrency: BULK_CANCEL_SERVICE_CONCURRENCY,
        },
    };
};

module.exports = {
    parseAccountNumbersFromFile,
    processCancelCardSubscriptionsPreview,
    processCancelCardSubscriptions,
};
