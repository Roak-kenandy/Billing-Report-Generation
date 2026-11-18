const crypto = require('crypto');
const {
    createConcurrentPool,
    fetchWithRetry,
} = require('../utils/bulkProcessingUtils');

const CSMS_BASE_URL = process.env.CSMS_BASE_URL || 'https://csms.medianet.mv/api';
const CSMS_LOGIN = process.env.CSMS_LOGIN;
const CSMS_SECRET = process.env.CSMS_SECRET;
const CSMS_API_CONCURRENCY = Number(process.env.CSMS_API_CONCURRENCY) || 5;
const CSMS_RETRY_ATTEMPTS = Number(process.env.CSMS_RETRY_ATTEMPTS) || 5;

const csmsRequestPool = createConcurrentPool(CSMS_API_CONCURRENCY);

const generateAuthToken = () => {
    if (!CSMS_LOGIN || !CSMS_SECRET) {
        throw new Error('CSMS_LOGIN and CSMS_SECRET must be configured');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const hash = crypto
        .createHash('sha1')
        .update(`${timestamp}${CSMS_LOGIN}${CSMS_SECRET}`)
        .digest('hex');

    return `${CSMS_LOGIN}:${timestamp}:${hash}`;
};

const csmsPost = async (path, payload, { requireSuccess = true } = {}) => csmsRequestPool(async () => {
    const response = await fetchWithRetry(
        `${CSMS_BASE_URL}${path}`,
        {
            method: 'POST',
            headers: {
                Authorization: generateAuthToken(),
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ data: payload }),
        },
        {
            retries: CSMS_RETRY_ATTEMPTS,
            onRetry: ({ attempt, error, url, status }) => {
                console.warn(`[CSMS] Retry ${attempt} for ${url}: ${error}${status ? ` (${status})` : ''}`);
            },
        }
    );

    const body = await response.json();

    if (requireSuccess && body.status !== 1) {
        throw new Error(body.message || `CSMS request failed (${path})`);
    }

    return body;
});

const getCustomerByAccountNumber = async (accountNumber) => {
    try {
        const body = await csmsPost('/Custom/Medianet/customerGetData', {
            account_number: Number(accountNumber),
        }, { requireSuccess: false });

        if (body.status !== 1 || !body.response?.viewers_id) {
            return null;
        }

        return body.response;
    } catch (error) {
        console.warn(`[CSMS] customerGetData failed for account ${accountNumber}: ${error.message}`);
        return null;
    }
};

const getCustomerSubscriptions = async (viewersId) => {
    const body = await csmsPost('/Subscription/getCustomerSubscriptionInfo', {
        viewers_id: Number(viewersId),
        where: [],
    });

    return Array.isArray(body.response) ? body.response : [];
};

const cancelSubscription = async (viewersBouquetsId) => csmsPost('/Subscription/cancelSubscription', {
    viewers_bouquets_id: Number(viewersBouquetsId),
});

module.exports = {
    generateAuthToken,
    getCustomerByAccountNumber,
    getCustomerSubscriptions,
    cancelSubscription,
};
