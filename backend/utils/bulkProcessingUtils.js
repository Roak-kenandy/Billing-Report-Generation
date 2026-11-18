const retry = require('async-retry');

const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const runWithConcurrency = async (items, concurrency, handler) => {
    if (items.length === 0) {
        return [];
    }

    const results = new Array(items.length);
    let nextIndex = 0;

    const worker = async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await handler(items[currentIndex], currentIndex);
        }
    };

    const workerCount = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
};

const isRetryableStatus = (status) => [408, 429, 500, 502, 503, 504].includes(status);

const createConcurrentPool = (limit) => {
    let activeCount = 0;
    const waitQueue = [];

    const runNext = () => {
        if (activeCount >= limit || waitQueue.length === 0) {
            return;
        }

        activeCount += 1;
        const { task, resolve, reject } = waitQueue.shift();

        Promise.resolve()
            .then(task)
            .then(resolve, reject)
            .finally(() => {
                activeCount -= 1;
                runNext();
            });
    };

    return (task) => new Promise((resolve, reject) => {
        waitQueue.push({ task, resolve, reject });
        runNext();
    });
};

const createRateLimitedExecutor = (minDelayMs = 0) => {
    let chain = Promise.resolve();
    let lastRunAt = 0;

    return (task) => {
        chain = chain.then(async () => {
            if (minDelayMs > 0) {
                const waitMs = minDelayMs - (Date.now() - lastRunAt);
                if (waitMs > 0) {
                    await sleep(waitMs);
                }
            }

            const result = await task();
            lastRunAt = Date.now();
            return result;
        });

        return chain;
    };
};

const fetchWithRetry = async (url, options = {}, retryOptions = {}) => {
    const {
        retries = 3,
        minTimeout = 1000,
        maxTimeout = 10000,
        onRetry,
    } = retryOptions;

    return retry(async (bail, attempt) => {
        let response;

        try {
            response = await fetch(url, options);
        } catch (error) {
            if (attempt >= retries) {
                bail(error);
                return;
            }

            if (onRetry) {
                onRetry({ attempt, error: error.message, url });
            }

            throw error;
        }

        if (response.ok) {
            return response;
        }

        const retryable = isRetryableStatus(response.status);
        const error = new Error(`CRM request failed (${response.status})`);

        if (!retryable || attempt >= retries) {
            bail(error);
            return;
        }

        if (onRetry) {
            onRetry({ attempt, error: error.message, url, status: response.status });
        }

        throw error;
    }, {
        retries,
        minTimeout,
        maxTimeout,
        factor: 2,
        randomize: true,
    });
};

module.exports = {
    chunkArray,
    sleep,
    runWithConcurrency,
    createConcurrentPool,
    createRateLimitedExecutor,
    fetchWithRetry,
    isRetryableStatus,
};
