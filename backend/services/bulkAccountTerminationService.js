const xlsx = require('xlsx');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { parse } = require('json2csv');
const { chunkArray, sleep, runWithConcurrency } = require('../utils/bulkProcessingUtils');
const BulkOperationReport = require('../models/bulkOperationReports');

const CRM_BASE_URL = process.env.CRM_BASE_URL;
const CRM_API_KEY = process.env.CRM_API_KEY;

const ACCOUNT_CONCURRENCY = Number(process.env.BULK_TERMINATE_ACCOUNT_CONCURRENCY) || 4;
const CRM_RETRY_ATTEMPTS = Number(process.env.BULK_TERMINATE_RETRY_ATTEMPTS) || 6;
const CRM_MAX_RPS = Number(process.env.BULK_TERMINATE_CRM_MAX_RPS) || 8;
const CRM_MIN_RPS = 1;
const CRM_MAX_IN_FLIGHT = Number(process.env.BULK_TERMINATE_CRM_MAX_IN_FLIGHT) || 4;
const CRM_REQUEST_TIMEOUT_MS = 30 * 1000;
const CRM_RAMP_UP_AFTER = 25;
const CRM_CIRCUIT_THRESHOLD = 10;
const CRM_COOLDOWN_MS = 60 * 1000;
const JOB_AUTO_STOP_AFTER_CRM_FAILURES = 50;
const TERMINATION_REASON = process.env.ACCOUNT_TERMINATION_REASON || 'INACTIVITY';
const OPERATION_TYPE = 'Bulk Account Termination';
const MONGO_BATCH_SIZE = 5000;
const PREVIEW_ROWS_LIMIT = 200;
const PREVIEW_TTL_MS = 6 * 60 * 60 * 1000;
const JOB_TTL_MS = 24 * 60 * 60 * 1000;
const RECENT_RESULTS_LIMIT = 50;
const PROGRESS_SAVE_EVERY = 100;
const MIN_BALANCE = 0.01;

// Services in these states are already closed and need no cancellation.
const CLOSED_SERVICE_STATES = ['CANCELLED', 'SWAPPED'];
// An EFFECTIVE package means the customer is still paying/using the service – never terminate.
// Accounts with any non-zero balance are also never terminated (CRM.COM discards the balance on termination).
const BLOCKING_SERVICE_STATES = ['EFFECTIVE'];
const RENTED_DEVICE_STATES = ['RENTED'];

const STATUS = {
    READY: 'ready',
    HAS_BALANCE: 'has_balance',
    HAS_EFFECTIVE_PACKAGE: 'has_effective_package',
    HAS_RENTED_DEVICE: 'has_rented_device',
    ALREADY_TERMINATED: 'already_terminated',
    NOT_FOUND: 'not_found',
    MISMATCH: 'account_contact_mismatch',
    AMBIGUOUS: 'ambiguous_account_number',
};

const OUTCOME = {
    TERMINATED: 'terminated',
    SKIPPED: 'skipped',
    FAILED: 'failed',
};

const previews = new Map();
const jobs = new Map();

const purgeExpired = () => {
    const now = Date.now();
    for (const [id, preview] of previews) {
        if (now - preview.createdAt > PREVIEW_TTL_MS) previews.delete(id);
    }
    for (const [id, job] of jobs) {
        if (job.finishedAt && now - job.finishedAt > JOB_TTL_MS) jobs.delete(id);
    }
};

const newId = () => crypto.randomBytes(8).toString('hex');

const toNumber = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const n = Number(value.toString());
    return Number.isFinite(n) ? n : 0;
};

// ---------- File parsing ----------

const HEADER_ALIASES = {
    accountNumber: ['account number', 'account_number', 'accountnumber', 'account no'],
    contactCode: ['contact code', 'contact_code', 'contactcode', 'customer code', 'barcode'],
    name: ['name', 'customer name'],
    group: ['group'],
};

const normalizeHeader = (header) => String(header).trim().toLowerCase().replace(/\s+/g, ' ');

const cleanValue = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
    return String(value).replace(/^'+/, '').trim();
};

const parseRowsFromBuffer = (buffer, originalName = '') => {
    const isCsv = originalName.toLowerCase().endsWith('.csv');
    const workbook = isCsv
        ? xlsx.read(buffer.toString('utf8'), { type: 'string', raw: true })
        : xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '', raw: true });

    const rows = [];
    const seen = new Set();
    for (const raw of rawRows) {
        const fields = {};
        for (const [key, value] of Object.entries(raw)) {
            const header = normalizeHeader(key);
            for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
                if (fields[field] === undefined && aliases.includes(header)) {
                    fields[field] = cleanValue(value);
                }
            }
        }

        const accountNumber = (fields.accountNumber || '').toUpperCase();
        const contactCode = fields.contactCode || '';
        if (!accountNumber && !contactCode) continue;

        const key = contactCode ? `C:${contactCode}` : `A:${accountNumber}`;
        if (seen.has(key)) continue;
        seen.add(key);

        rows.push({
            input_account_number: accountNumber,
            input_contact_code: contactCode,
            input_name: fields.name || '',
            group: fields.group || '',
        });
    }
    return rows;
};

// ---------- Preview (MongoDB snapshot – fast) ----------

const fetchProfiles = async (rows) => {
    const db = mongoose.connection.db;
    const codes = [...new Set(rows.map((r) => r.input_contact_code).filter(Boolean))];
    const numbers = [...new Set(rows.map((r) => r.input_account_number).filter(Boolean))];
    const projection = {
        contact_id: 1,
        'profile.code': 1,
        'account.id': 1,
        'account.number': 1,
        'account.life_cycle_state': 1,
        'account.balance': 1,
        'demographics.first_name': 1,
        'demographics.last_name': 1,
    };

    const queries = [
        ...chunkArray(codes, MONGO_BATCH_SIZE).map((batch) => ({ 'profile.code': { $in: batch } })),
        ...chunkArray(numbers, MONGO_BATCH_SIZE).map((batch) => ({ 'account.number': { $in: batch } })),
    ];
    const results = await Promise.all(
        queries.map((query) => db.collection('ContactProfiles').find(query, { projection }).toArray())
    );

    const byCode = new Map();
    const byNumber = new Map();
    for (const profile of results.flat()) {
        const code = cleanValue(profile.profile?.code);
        if (code) byCode.set(code, profile);
        const number = String(profile.account?.number || '').toUpperCase();
        if (number) {
            const list = byNumber.get(number) || new Map();
            list.set(profile.contact_id, profile);
            byNumber.set(number, list);
        }
    }
    return { byCode, byNumber };
};

const fetchServiceAndDeviceFacts = async (contactIds) => {
    const db = mongoose.connection.db;
    const facts = new Map(contactIds.map((id) => [id, { servicesToCancel: 0, effective: 0, rentedDevices: 0 }]));

    await Promise.all(chunkArray(contactIds, MONGO_BATCH_SIZE).map(async (batch) => {
        const [serviceStates, rented] = await Promise.all([
            db.collection('Subscriptions').aggregate([
                { $match: { contact_id: { $in: batch } } },
                { $unwind: '$services' },
                { $group: { _id: { contact_id: '$contact_id', state: '$services.state' }, n: { $sum: 1 } } },
            ], { allowDiskUse: true }).toArray(),
            db.collection('Devices').aggregate([
                { $match: { 'ownership.id': { $in: batch }, state: { $in: RENTED_DEVICE_STATES } } },
                { $group: { _id: '$ownership.id', n: { $sum: 1 } } },
            ]).toArray(),
        ]);

        for (const { _id, n } of serviceStates) {
            const fact = facts.get(_id.contact_id);
            if (!fact) continue;
            const state = String(_id.state || '').toUpperCase();
            if (BLOCKING_SERVICE_STATES.includes(state)) fact.effective += n;
            else if (!CLOSED_SERVICE_STATES.includes(state)) fact.servicesToCancel += n;
        }
        for (const { _id, n } of rented) {
            const fact = facts.get(_id);
            if (fact) fact.rentedDevices = n;
        }
    }));

    return facts;
};

const resolveRow = (row, { byCode, byNumber }) => {
    if (row.input_contact_code) {
        const profile = byCode.get(row.input_contact_code);
        if (!profile) return { error: STATUS.NOT_FOUND, message: `Contact code ${row.input_contact_code} not found` };
        const number = String(profile.account?.number || '').toUpperCase();
        if (row.input_account_number && number && number !== row.input_account_number) {
            return {
                error: STATUS.MISMATCH,
                message: `Contact code ${row.input_contact_code} belongs to account ${number}, not ${row.input_account_number}`,
            };
        }
        return { profile };
    }

    const matches = byNumber.get(row.input_account_number);
    if (!matches || matches.size === 0) {
        return { error: STATUS.NOT_FOUND, message: `Account ${row.input_account_number} not found` };
    }
    if (matches.size > 1) {
        return {
            error: STATUS.AMBIGUOUS,
            message: `Account number ${row.input_account_number} is shared by ${matches.size} contacts – add the Contact Code column`,
        };
    }
    return { profile: [...matches.values()][0] };
};

const buildPreviewRows = async (rows) => {
    const lookups = await fetchProfiles(rows);
    const resolved = rows.map((row) => ({ row, ...resolveRow(row, lookups) }));
    const contactIds = [...new Set(resolved.filter((r) => r.profile).map((r) => r.profile.contact_id))];
    const facts = await fetchServiceAndDeviceFacts(contactIds);

    return resolved.map(({ row, profile, error, message }) => {
        const base = {
            ...row,
            account_number: row.input_account_number,
            contact_code: row.input_contact_code,
            name: row.input_name,
            contact_id: null,
            account_id: null,
            account_state: null,
            balance: null,
            services_to_cancel: 0,
            effective_services: 0,
            rented_devices: 0,
            status: error || STATUS.READY,
            message: message || '',
        };
        if (!profile) return base;

        const fact = facts.get(profile.contact_id) || { servicesToCancel: 0, effective: 0, rentedDevices: 0 };
        const balance = toNumber(profile.account?.balance);
        const accountState = String(profile.account?.life_cycle_state || '').toUpperCase();
        const result = {
            ...base,
            account_number: profile.account?.number || row.input_account_number,
            contact_code: cleanValue(profile.profile?.code) || row.input_contact_code,
            name: [profile.demographics?.first_name, profile.demographics?.last_name].filter(Boolean).join(' ') || row.input_name,
            contact_id: profile.contact_id,
            account_id: profile.account?.id || null,
            account_state: accountState || null,
            balance,
            services_to_cancel: fact.servicesToCancel,
            effective_services: fact.effective,
            rented_devices: fact.rentedDevices,
        };

        if (!result.account_id) {
            result.status = STATUS.NOT_FOUND;
            result.message = 'Contact has no CRM account';
        } else if (accountState === 'TERMINATED') {
            result.status = STATUS.ALREADY_TERMINATED;
        } else if (fact.effective > 0) {
            result.status = STATUS.HAS_EFFECTIVE_PACKAGE;
            result.message = `${fact.effective} EFFECTIVE package(s) – customer is active`;
        } else if (fact.rentedDevices > 0) {
            result.status = STATUS.HAS_RENTED_DEVICE;
            result.message = `${fact.rentedDevices} rented device(s) must be returned first`;
        } else if (Math.abs(balance) >= MIN_BALANCE) {
            result.status = STATUS.HAS_BALANCE;
            result.message = `Balance ${balance.toFixed(2)} – accounts with a balance are not terminated`;
        }
        return result;
    });
};

const summarizePreview = (rows) => {
    const count = (status) => rows.filter((r) => r.status === status).length;
    const withBalance = rows.filter((r) => r.status === STATUS.HAS_BALANCE);
    return {
        total_rows: rows.length,
        ready: count(STATUS.READY),
        has_balance: withBalance.length,
        has_balance_total: Number(withBalance.reduce((sum, r) => sum + (r.balance || 0), 0).toFixed(2)),
        has_effective_package: count(STATUS.HAS_EFFECTIVE_PACKAGE),
        has_rented_device: count(STATUS.HAS_RENTED_DEVICE),
        already_terminated: count(STATUS.ALREADY_TERMINATED),
        not_found: count(STATUS.NOT_FOUND),
        mismatch: count(STATUS.MISMATCH),
        ambiguous: count(STATUS.AMBIGUOUS),
        services_to_cancel: rows
            .filter((r) => r.status === STATUS.READY)
            .reduce((sum, r) => sum + r.services_to_cancel, 0),
    };
};

const createPreview = async (buffer, originalName) => {
    purgeExpired();
    const rows = parseRowsFromBuffer(buffer, originalName);
    if (rows.length === 0) {
        const err = new Error('No rows with "Account Number" or "Contact Code" found in the file');
        err.statusCode = 400;
        throw err;
    }

    const previewRows = await buildPreviewRows(rows);
    const id = newId();
    const summary = summarizePreview(previewRows);
    previews.set(id, { id, fileName: originalName, createdAt: Date.now(), rows: previewRows, summary });

    return {
        preview_id: id,
        file_name: originalName,
        termination_reason: TERMINATION_REASON,
        summary,
        rows: previewRows.slice(0, PREVIEW_ROWS_LIMIT),
        rows_truncated: previewRows.length > PREVIEW_ROWS_LIMIT,
    };
};

const PREVIEW_CSV_FIELDS = [
    { label: 'Group', value: 'group' },
    { label: 'Account Number', value: 'account_number' },
    { label: 'Contact Code', value: 'contact_code' },
    { label: 'Name', value: 'name' },
    { label: 'Account State', value: 'account_state' },
    { label: 'Balance', value: 'balance' },
    { label: 'Services To Cancel', value: 'services_to_cancel' },
    { label: 'Effective Packages', value: 'effective_services' },
    { label: 'Rented Devices', value: 'rented_devices' },
    { label: 'Status', value: 'status' },
    { label: 'Message', value: 'message' },
];

const getPreviewCsv = (previewId) => {
    const preview = previews.get(previewId);
    if (!preview) return null;
    return parse(preview.rows, { fields: PREVIEW_CSV_FIELDS });
};

// ---------- CRM API (live execution) ----------

const crmHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    api_key: CRM_API_KEY,
};

// Shared CRM throttle: every request from every job goes through it, so the CRM API never
// sees more than CRM_MAX_RPS requests/second or CRM_MAX_IN_FLIGHT parallel requests.
// It halves the rate when CRM throttles (429/503) and pauses entirely when CRM keeps failing.
const throttle = {
    rps: CRM_MAX_RPS,
    inFlight: 0,
    waiters: [],
    nextSlotAt: 0,
    pausedUntil: 0,
    consecutiveFailures: 0,
    successStreak: 0,
    stats: { requests: 0, throttled: 0, cooldowns: 0 },
};

const slowDown = (pauseMs, reason) => {
    throttle.rps = Math.max(CRM_MIN_RPS, throttle.rps / 2);
    throttle.successStreak = 0;
    throttle.pausedUntil = Math.max(throttle.pausedUntil, Date.now() + pauseMs);
    console.warn(`[Bulk Account Termination] CRM ${reason} – pausing ${Math.round(pauseMs / 1000)}s, rate now ${throttle.rps.toFixed(1)} req/s`);
};

const acquireSlot = async () => {
    while (throttle.inFlight >= CRM_MAX_IN_FLIGHT) {
        await new Promise((resolve) => throttle.waiters.push(resolve));
    }
    throttle.inFlight += 1;
    for (;;) {
        const now = Date.now();
        const start = Math.max(now, throttle.nextSlotAt, throttle.pausedUntil);
        if (start <= now) break;
        await sleep(start - now);
    }
    throttle.nextSlotAt = Date.now() + 1000 / throttle.rps;
    throttle.stats.requests += 1;
};

const releaseSlot = () => {
    throttle.inFlight -= 1;
    const next = throttle.waiters.shift();
    if (next) next();
};

const recordSuccess = () => {
    throttle.consecutiveFailures = 0;
    throttle.successStreak += 1;
    if (throttle.successStreak >= CRM_RAMP_UP_AFTER && throttle.rps < CRM_MAX_RPS) {
        throttle.rps = Math.min(CRM_MAX_RPS, throttle.rps + 1);
        throttle.successStreak = 0;
    }
};

const recordThrottled = (retryAfterHeader) => {
    throttle.stats.throttled += 1;
    const retryAfterMs = Number(retryAfterHeader) * 1000;
    slowDown(Number.isFinite(retryAfterMs) && retryAfterMs > 0 ? retryAfterMs : 10000, 'throttled the request');
};

const recordFailure = () => {
    throttle.consecutiveFailures += 1;
    throttle.successStreak = 0;
    if (throttle.consecutiveFailures >= CRM_CIRCUIT_THRESHOLD) {
        throttle.consecutiveFailures = 0;
        throttle.stats.cooldowns += 1;
        slowDown(CRM_COOLDOWN_MS, 'is failing repeatedly');
    }
};

const throttleView = () => ({
    crm_rate_per_second: Number(throttle.rps.toFixed(1)),
    crm_max_rate_per_second: CRM_MAX_RPS,
    crm_paused_until: throttle.pausedUntil > Date.now() ? throttle.pausedUntil : null,
    crm_requests: throttle.stats.requests,
    crm_throttled: throttle.stats.throttled,
    crm_cooldowns: throttle.stats.cooldowns,
});

const buildCrmError = (status, data) => {
    const parameters = Array.isArray(data.parameters) ? data.parameters.filter(Boolean).join('; ') : '';
    const message = data.message || data.error || `CRM request failed (${status})`;
    const error = new Error(parameters ? `${message} (${parameters})` : message);
    error.status = status;
    return error;
};

const retryDelay = (attempt) => Math.min(2000 * 2 ** attempt, 60000);

/**
 * Writes (PUT/POST) are never blindly retried after a timeout or 5xx because CRM may already have
 * applied them; such errors are flagged `uncertain` so the caller re-reads the state instead.
 * 429/503 mean CRM rejected the request without processing it, so those are retried for writes too.
 */
const crmRequest = async (method, path, body) => {
    const isRead = method === 'GET';

    for (let attempt = 1; ; attempt += 1) {
        await acquireSlot();
        let response;
        let data;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CRM_REQUEST_TIMEOUT_MS);
        try {
            response = await fetch(`${CRM_BASE_URL}${path}`, {
                method,
                headers: crmHeaders,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            data = await response.json().catch(() => ({}));
        } catch (networkError) {
            recordFailure();
            const reason = networkError.name === 'AbortError' ? 'timed out' : networkError.message;
            if (!isRead) {
                const error = new Error(`CRM did not respond (${reason})`);
                error.uncertain = true;
                throw error;
            }
            if (attempt >= CRM_RETRY_ATTEMPTS) throw new Error(`CRM did not respond (${reason})`);
            await sleep(retryDelay(attempt));
            continue;
        } finally {
            clearTimeout(timer);
            releaseSlot();
        }

        if (response.ok) {
            recordSuccess();
            return data;
        }

        if (response.status === 429 || response.status === 503) {
            recordThrottled(response.headers.get('retry-after'));
            if (attempt < CRM_RETRY_ATTEMPTS) continue;
            throw buildCrmError(response.status, data);
        }

        if (response.status >= 500 || response.status === 408) {
            recordFailure();
            const error = buildCrmError(response.status, data);
            if (!isRead) {
                error.uncertain = true;
                throw error;
            }
            if (attempt < CRM_RETRY_ATTEMPTS) {
                await sleep(retryDelay(attempt));
                continue;
            }
            throw error;
        }

        // 4xx business errors: CRM is healthy, the request itself was rejected.
        recordSuccess();
        throw buildCrmError(response.status, data);
    }
};

const crmGetAll = async (path) => {
    const separator = path.includes('?') ? '&' : '?';
    const items = [];
    for (let page = 1; ; page += 1) {
        const data = await crmRequest('GET', `${path}${separator}size=100&page=${page}`);
        items.push(...(data.content || []));
        if (!data.paging?.has_more) return items;
    }
};

const executeAccount = async (row) => {
    const result = {
        group: row.group,
        account_number: row.account_number,
        contact_code: row.contact_code,
        name: row.name,
        account_id: row.account_id,
        contact_id: row.contact_id,
        balance: row.balance,
        cancelled_services: [],
        outcome: OUTCOME.FAILED,
        reason: '',
        message: '',
    };
    const skip = (reason, message = '') => Object.assign(result, { outcome: OUTCOME.SKIPPED, reason, message });

    try {
        const account = await crmRequest('GET', `/accounts/${row.account_id}`);
        result.balance = toNumber(account.balance);
        if (String(account.state || '').toUpperCase() === 'TERMINATED') {
            return skip(STATUS.ALREADY_TERMINATED);
        }
        if (Math.abs(result.balance) >= MIN_BALANCE) {
            return skip(STATUS.HAS_BALANCE, `Balance ${result.balance.toFixed(2)}`);
        }

        const services = await crmGetAll(`/contacts/${row.contact_id}/services`);
        const effective = services.filter((s) => BLOCKING_SERVICE_STATES.includes(String(s.state || '').toUpperCase()));
        if (effective.length > 0) {
            return skip(
                STATUS.HAS_EFFECTIVE_PACKAGE,
                effective.map((s) => s.product?.name || s.id).join(', ')
            );
        }

        const toCancel = services.filter((s) => !CLOSED_SERVICE_STATES.includes(String(s.state || '').toUpperCase()));
        for (const service of toCancel) {
            try {
                await crmRequest('PUT', `/services/${service.id}`, { action: 'CANCEL' });
            } catch (error) {
                const cancelledAnyway = error.uncertain && await isServiceCancelled(row.contact_id, service.id);
                if (!cancelledAnyway) {
                    result.reason = 'service_cancel_failed';
                    result.message = `Could not cancel ${service.product?.name || service.id} (${service.state}): ${error.message}`;
                    return result;
                }
            }
            result.cancelled_services.push(`${service.product?.name || service.id} (${service.state})`);
        }

        try {
            await crmRequest('POST', `/accounts/${row.account_id}/actions`, {
                state: 'TERMINATED',
                termination_reason: TERMINATION_REASON,
            });
        } catch (error) {
            if (!(error.uncertain && await isAccountTerminated(row.account_id))) throw error;
        }
        result.outcome = OUTCOME.TERMINATED;
        return result;
    } catch (error) {
        result.reason = result.reason || 'crm_error';
        result.message = error.message || 'Unknown CRM error';
        result.crm_unavailable = Boolean(error.uncertain || !error.status || error.status >= 500 || error.status === 429);
        return result;
    }
};

const isServiceCancelled = async (contactId, serviceId) => {
    try {
        const services = await crmGetAll(`/contacts/${contactId}/services`);
        const service = services.find((s) => s.id === serviceId);
        return !service || CLOSED_SERVICE_STATES.includes(String(service.state || '').toUpperCase());
    } catch {
        return false;
    }
};

const isAccountTerminated = async (accountId) => {
    try {
        const account = await crmRequest('GET', `/accounts/${accountId}`);
        return String(account.state || '').toUpperCase() === 'TERMINATED';
    } catch {
        return false;
    }
};

// ---------- Jobs ----------

const jobView = (job, { includeRecent = true } = {}) => ({
    job_id: job.id,
    file_name: job.fileName,
    status: job.status,
    started_by: job.startedBy,
    started_at: job.startedAt,
    finished_at: job.finishedAt || null,
    total: job.total,
    processed: job.processed,
    terminated: job.counts.terminated,
    skipped: job.counts.skipped,
    failed: job.counts.failed,
    services_cancelled: job.counts.servicesCancelled,
    error: job.error || null,
    ...throttleView(),
    ...(includeRecent ? { recent_results: job.results.slice(-RECENT_RESULTS_LIMIT).reverse() } : {}),
});

const saveJobRecord = async (job) => {
    if (mongoose.connection.readyState !== 1) return;
    const summary = jobView(job, { includeRecent: false });
    const status = job.status === 'running' || job.status === 'stopping' ? 'Running'
        : job.status === 'stopped' ? 'Stopped'
            : job.status === 'failed' ? 'Failed' : 'Completed';
    try {
        await BulkOperationReport.updateOne(
            { batch: job.batch },
            {
                $set: {
                    batch: job.batch,
                    file_name: job.fileName,
                    date: Math.floor(job.startedAt / 1000),
                    type: OPERATION_TYPE,
                    status,
                    summary,
                },
            },
            { upsert: true }
        );
    } catch (error) {
        console.error('[Bulk Account Termination] Failed to save job record:', error.message);
    }
};

const runJob = async (job, rows) => {
    let sinceSave = 0;
    let consecutiveCrmFailures = 0;
    try {
        await runWithConcurrency(rows, ACCOUNT_CONCURRENCY, async (row) => {
            if (job.status === 'stopping') return;
            const result = await executeAccount(row);
            job.results.push(result);
            job.processed += 1;
            job.counts[result.outcome] += 1;
            job.counts.servicesCancelled += result.cancelled_services.length;

            consecutiveCrmFailures = result.crm_unavailable ? consecutiveCrmFailures + 1 : 0;
            if (consecutiveCrmFailures >= JOB_AUTO_STOP_AFTER_CRM_FAILURES && job.status === 'running') {
                job.status = 'stopping';
                job.error = `Stopped automatically: CRM API failed for ${consecutiveCrmFailures} accounts in a row. `
                    + 'Re-upload the results CSV later – already terminated accounts are skipped.';
                console.error(`[Bulk Account Termination] ${job.id}: ${job.error}`);
            }

            sinceSave += 1;
            if (sinceSave >= PROGRESS_SAVE_EVERY) {
                sinceSave = 0;
                console.log(`[Bulk Account Termination] ${job.id}: ${job.processed}/${job.total}`);
                saveJobRecord(job);
            }
        });
        job.status = job.status === 'stopping' ? 'stopped' : 'completed';
    } catch (error) {
        job.status = 'failed';
        job.error = error.message;
    } finally {
        job.finishedAt = Date.now();
        console.log(`[Bulk Account Termination] ${job.id} ${job.status}: ${JSON.stringify(job.counts)}`);
        await saveJobRecord(job);
    }
};

const startJob = async ({ previewId, startedBy = '' }) => {
    purgeExpired();
    const preview = previews.get(previewId);
    if (!preview) {
        const err = new Error('Preview expired or not found. Upload the file again.');
        err.statusCode = 404;
        throw err;
    }
    const running = [...jobs.values()].find((j) => j.status === 'running' || j.status === 'stopping');
    if (running) {
        const err = new Error(`Another termination job (${running.id}) is still running`);
        err.statusCode = 409;
        throw err;
    }

    const eligible = preview.rows.filter((r) => r.status === STATUS.READY);
    if (eligible.length === 0) {
        const err = new Error('No eligible accounts to terminate in this preview');
        err.statusCode = 400;
        throw err;
    }

    const id = newId();
    const job = {
        id,
        batch: `TERM-${id.slice(0, 8).toUpperCase()}`,
        previewId,
        fileName: preview.fileName,
        startedBy,
        startedAt: Date.now(),
        finishedAt: null,
        status: 'running',
        total: eligible.length,
        processed: 0,
        counts: { terminated: 0, skipped: 0, failed: 0, servicesCancelled: 0 },
        results: [],
    };
    jobs.set(id, job);
    previews.delete(previewId);
    await saveJobRecord(job);
    runJob(job, eligible);
    return jobView(job);
};

const getJob = (jobId) => {
    const job = jobs.get(jobId);
    return job ? jobView(job) : null;
};

const listJobs = () => [...jobs.values()]
    .sort((a, b) => b.startedAt - a.startedAt)
    .map((job) => jobView(job, { includeRecent: false }));

const stopJob = (jobId) => {
    const job = jobs.get(jobId);
    if (!job) return null;
    if (job.status === 'running') job.status = 'stopping';
    return jobView(job);
};

const RESULT_CSV_FIELDS = [
    { label: 'Group', value: 'group' },
    { label: 'Account Number', value: 'account_number' },
    { label: 'Contact Code', value: 'contact_code' },
    { label: 'Name', value: 'name' },
    { label: 'Balance', value: 'balance' },
    { label: 'Outcome', value: 'outcome' },
    { label: 'Reason', value: 'reason' },
    { label: 'Message', value: 'message' },
    { label: 'Cancelled Services', value: (row) => row.cancelled_services.join('; ') },
];

const getJobResultsCsv = (jobId) => {
    const job = jobs.get(jobId);
    if (!job) return null;
    return parse(job.results, { fields: RESULT_CSV_FIELDS });
};

module.exports = {
    createPreview,
    getPreviewCsv,
    startJob,
    getJob,
    listJobs,
    stopJob,
    getJobResultsCsv,
    OPERATION_TYPE,
};
