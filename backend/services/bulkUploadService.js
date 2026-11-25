const xlsx = require('xlsx');
const fs = require('fs');
const mongoose = require('mongoose');
const BulkOperationReports = require('../models/bulkOperationReports');
const UserLoginReports = require('../models/UserLoginReports');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const {
    chunkArray,
    runWithConcurrency,
    createConcurrentPool,
    fetchWithRetry,
} = require('../utils/bulkProcessingUtils');
const { isMongoConnected } = require('../config/db');
const { authenticateCrmOnlyDevLogin } = require('../utils/crmOnlyAuth');

const CRM_BASE_URL = process.env.CRM_BASE_URL;
const CRM_API_KEY = process.env.CRM_API_KEY;

const BULK_CANCEL_CONCURRENCY = Number(process.env.BULK_CANCEL_CONCURRENCY) || 3;
const BULK_CANCEL_CRM_CONCURRENCY = Number(process.env.BULK_CANCEL_CRM_CONCURRENCY) || 5;
const BULK_CANCEL_SERVICE_CONCURRENCY = Number(process.env.BULK_CANCEL_SERVICE_CONCURRENCY) || 2;
const BULK_CANCEL_MONGO_BATCH_SIZE = Number(process.env.BULK_CANCEL_MONGO_BATCH_SIZE) || 500;
const BULK_CANCEL_PREVIEW_LIMIT = Number(process.env.BULK_CANCEL_PREVIEW_LIMIT) || 100;
const BULK_CANCEL_RESULTS_LIMIT = Number(process.env.BULK_CANCEL_RESULTS_LIMIT) || 100;
const BULK_CANCEL_RETRY_ATTEMPTS = Number(process.env.BULK_CANCEL_RETRY_ATTEMPTS) || 5;

const crmHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    api_key: CRM_API_KEY,
};

const crmRequestPool = createConcurrentPool(BULK_CANCEL_CRM_CONCURRENCY);

const CONTACT_CODE_HEADERS = ['Contact Code', 'contactcode', 'contact_code', 'ContactCode'];

const normalizeContactCode = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(Math.trunc(value));
    }
    return String(value).replace(/'/g, '').trim();
};

const getContactCodeFromRow = (row) => {
    for (const header of CONTACT_CODE_HEADERS) {
        if (row[header] !== undefined && row[header] !== null && row[header] !== '') {
            return normalizeContactCode(row[header]);
        }
    }

    const firstValue = Object.values(row)[0];
    return normalizeContactCode(firstValue);
};

const parseContactCodesFromFile = (filePath, mimetype) => {
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
            .map(getContactCodeFromRow)
            .filter(Boolean)
    )];
};

const lookupContactByCodeFromCrm = async (contactCode) => {
    const normalizedCode = normalizeContactCode(contactCode);
    if (!normalizedCode) {
        return null;
    }

    const query = new URLSearchParams({
        size: '10',
        page: '1',
        include_metrics: 'true',
        search_value: normalizedCode,
        include_total: 'true',
    });

    const data = await fetchCrmJson(
        `${CRM_BASE_URL}/contacts?${query.toString()}`,
        { method: 'GET' }
    );

    const contacts = data.content || [];
    const exactMatch = contacts.find(
        (contact) => normalizeContactCode(contact.code) === normalizedCode
    );

    return exactMatch || null;
};

const resolveContactIdsFromCrm = async (contactCodes) => runWithConcurrency(
    contactCodes,
    BULK_CANCEL_CRM_CONCURRENCY,
    async (code) => {
        try {
            const contact = await lookupContactByCodeFromCrm(code);

            return {
                contact_code: code,
                contact_id: contact?.id || null,
                contact_name: contact?.name || null,
            };
        } catch (error) {
            console.warn(`[Bulk Cancel] CRM lookup failed for contact code ${code}: ${error.message}`);
            return {
                contact_code: code,
                contact_id: null,
                contact_name: null,
            };
        }
    }
);

const resolveContactIdsFromProfiles = async (contactCodes) => {
    if (isMongoConnected()) {
        const uniqueCodes = [...new Set(contactCodes)];
        const contactProfilesCollection = mongoose.connection.db.collection('ContactProfiles');
        const contactMap = new Map();

        const codeBatches = chunkArray(uniqueCodes, BULK_CANCEL_MONGO_BATCH_SIZE);

        for (const batch of codeBatches) {
            const profiles = await contactProfilesCollection.find({
                'profile.code': { $in: batch },
            }).toArray();

            profiles.forEach((profile) => {
                contactMap.set(normalizeContactCode(profile.profile?.code), {
                    contact_id: profile.profile?.id || profile.contact_id,
                    contact_name: profile.profile?.name || null,
                });
            });
        }

        return contactCodes.map((code) => ({
            contact_code: code,
            contact_id: contactMap.get(code)?.contact_id || null,
            contact_name: contactMap.get(code)?.contact_name || null,
        }));
    }

    return resolveContactIdsFromCrm(contactCodes);
};

const fetchCrmJson = async (url, options = {}) => {
    const response = await crmRequestPool(() => fetchWithRetry(url, {
        ...options,
        headers: crmHeaders,
    }, {
        retries: BULK_CANCEL_RETRY_ATTEMPTS,
        minTimeout: 2000,
        maxTimeout: 15000,
        onRetry: ({ attempt, status, url: retryUrl }) => {
            console.warn(`CRM retry ${attempt} for ${retryUrl}${status ? ` (${status})` : ''}`);
        },
    }));

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        const message = data.message || data.error || `CRM request failed (${response.status})`;
        throw new Error(message);
    }

    return data;
};

const fetchAllCrmPages = async (buildUrl) => {
    let page = 1;
    let hasMore = true;
    const allContent = [];

    while (hasMore) {
        const data = await fetchCrmJson(buildUrl(page));
        allContent.push(...(data.content || []));
        hasMore = Boolean(data.paging?.has_more);
        page += 1;
    }

    return allContent;
};

const CANCELLABLE_SERVICE_STATES = ['NOT_EFFECTIVE', 'DRAFT'];

const parseNumericBalance = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'object' && value.$numberDecimal) {
        return Number(value.$numberDecimal);
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const getAccountBalances = (account) => {
    const balanceFields = [
        'balance',
        'current_balance',
        'account_balance',
        'available_balance',
        'outstanding_balance',
        'ar_balance',
        'overdue_amount',
    ];

    const balances = balanceFields.map((field) => parseNumericBalance(account?.[field]));
    const total = balances.reduce((sum, amount) => sum + Math.abs(amount), 0);

    return {
        totalAbsoluteBalance: total,
        primaryBalance: parseNumericBalance(account?.balance),
        overdueAmount: parseNumericBalance(account?.overdue_amount),
    };
};

const isZeroBalanceAccount = (account) => {
    const { totalAbsoluteBalance } = getAccountBalances(account);
    return totalAbsoluteBalance < 0.01;
};

const fetchAccountById = async (accountId) => fetchCrmJson(`${CRM_BASE_URL}/accounts/${accountId}`);

const getPrimaryAccountIdForContact = async (contactId) => {
    const data = await fetchCrmJson(`${CRM_BASE_URL}/contacts/${contactId}/accounts?size=50&page=1`);
    const accounts = data.content || [];
    if (accounts.length === 0) {
        return null;
    }

    const primary = accounts.find((account) => account.is_primary);
    return (primary || accounts[0]).id;
};

const getContactSubscriptions = async (contactId) => {
    return fetchAllCrmPages((page) =>
        `${CRM_BASE_URL}/contacts/${contactId}/subscriptions?size=100&page=${page}&include_terms=true&include_billing_info=true&include_future_info=true`
    );
};

const getSubscriptionServices = async (contactId, subscriptionId) => {
    return fetchAllCrmPages((page) =>
        `${CRM_BASE_URL}/contacts/${contactId}/services?size=100&page=${page}&subscription_id=${subscriptionId}&include_future_info=true`
    );
};

const getCancellableServices = (services) =>
    services.filter((service) => CANCELLABLE_SERVICE_STATES.includes(service.state));

const cancelService = async (serviceId) => {
    return fetchCrmJson(`${CRM_BASE_URL}/services/${serviceId}`, {
        method: 'PUT',
        body: JSON.stringify({
            action: 'CANCEL',
            category_id: null,
            scheduled_date: null,
        }),
    });
};

const buildContactCancellationPreview = async (contact) => {
    const contactPreview = {
        contact_code: contact.contact_code,
        contact_id: contact.contact_id,
        contact_name: contact.contact_name,
        account_id: null,
        account_number: null,
        balance: null,
        status: contact.contact_id ? 'ready' : 'contact_not_found',
        subscriptions: [],
        errors: [],
    };

    if (!contact.contact_id) {
        return contactPreview;
    }

    try {
        const accountId = await getPrimaryAccountIdForContact(contact.contact_id);

        if (!accountId) {
            contactPreview.status = 'account_not_found';
            contactPreview.errors.push('No CRM account linked to this contact');
            return contactPreview;
        }

        contactPreview.account_id = accountId;

        const account = await fetchAccountById(accountId);
        const { primaryBalance, overdueAmount } = getAccountBalances(account);

        contactPreview.account_number = account?.number || null;
        contactPreview.balance = primaryBalance;

        if (!isZeroBalanceAccount(account)) {
            contactPreview.status = 'has_balance';
            contactPreview.errors.push(
                `Account balance must be zero (balance: ${primaryBalance}, overdue: ${overdueAmount})`
            );
            return contactPreview;
        }
    } catch (error) {
        contactPreview.status = 'error';
        contactPreview.errors.push(error.message);
        return contactPreview;
    }

    try {
        const subscriptions = await getContactSubscriptions(contact.contact_id);

        for (const subscription of subscriptions) {
            const services = await getSubscriptionServices(contact.contact_id, subscription.id);
            const cancellableServices = getCancellableServices(services);

            if (cancellableServices.length === 0) {
                continue;
            }

            contactPreview.subscriptions.push({
                subscription_id: subscription.id,
                subscription_code: subscription.code,
                state: subscription.state,
                services: cancellableServices.map((service) => ({
                    service_id: service.id,
                    product_name: service.product?.name || null,
                    sku: service.product?.sku || null,
                    state: service.state,
                })),
            });
        }
    } catch (error) {
        contactPreview.status = 'error';
        contactPreview.errors.push(error.message);
    }

    return contactPreview;
};

const executeContactCancellation = async (contactPreview) => {
    const contactResult = {
        contact_code: contactPreview.contact_code,
        contact_id: contactPreview.contact_id,
        contact_name: contactPreview.contact_name,
        cancelled_services: [],
        skipped: [],
        errors: [...(contactPreview.errors || [])],
    };

    if (
        !contactPreview.contact_id
        || contactPreview.status === 'error'
        || contactPreview.status === 'has_balance'
        || contactPreview.status === 'account_not_found'
    ) {
        return contactResult;
    }

    const cancelTasks = [];

    for (const subscription of contactPreview.subscriptions) {
        for (const service of subscription.services) {
            cancelTasks.push({ subscription, service });
        }
    }

    await runWithConcurrency(cancelTasks, BULK_CANCEL_SERVICE_CONCURRENCY, async ({ subscription, service }) => {
        try {
            await cancelService(service.service_id);
            contactResult.cancelled_services.push({
                subscription_id: subscription.subscription_id,
                subscription_code: subscription.subscription_code,
                service_id: service.service_id,
                product_name: service.product_name,
                sku: service.sku,
                state: service.state,
            });
        } catch (error) {
            contactResult.errors.push({
                subscription_id: subscription.subscription_id,
                service_id: service.service_id,
                error: error.message,
            });
        }
    });

    return contactResult;
};

const processContactsWithConcurrency = async (contacts, handler, label) => {
    let processedCount = 0;

    return runWithConcurrency(contacts, BULK_CANCEL_CONCURRENCY, async (contact, index) => {
        try {
            return await handler(contact, index);
        } catch (error) {
            return {
                contact_code: contact.contact_code,
                contact_id: contact.contact_id,
                contact_name: contact.contact_name,
                cancelled_services: [],
                skipped: [],
                errors: [error.message],
            };
        } finally {
            processedCount += 1;
            if (processedCount % 100 === 0 || processedCount === contacts.length) {
                console.log(`[Bulk Cancel] ${label}: ${processedCount}/${contacts.length} contacts processed`);
            }
        }
    });
};

const summarizeCancellationPreview = (preview) => ({
    total_contacts: preview.length,
    contacts_with_services_to_cancel: preview.filter((item) => item.subscriptions.length > 0).length,
    total_services_to_cancel: preview.reduce(
        (sum, item) => sum + item.subscriptions.reduce(
            (subscriptionSum, subscription) => subscriptionSum + subscription.services.length,
            0
        ),
        0
    ),
    contacts_not_found: preview.filter((item) => item.status === 'contact_not_found').length,
    contacts_with_balance: preview.filter((item) => item.status === 'has_balance').length,
    contacts_account_not_found: preview.filter((item) => item.status === 'account_not_found').length,
    contacts_with_errors: preview.filter((item) => item.status === 'error').length,
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

const processCancelSubscriptionsPreview = async (filePath, mimetype) => {
    const contactCodes = parseContactCodesFromFile(filePath, mimetype);

    if (contactCodes.length === 0) {
        throw new Error('No contact codes found in the uploaded file');
    }

    const contacts = await resolveContactIdsFromProfiles(contactCodes);
    const preview = await processContactsWithConcurrency(
        contacts,
        buildContactCancellationPreview,
        'Preview'
    );

    const summary = summarizeCancellationPreview(preview);
    const { items, truncated, total } = truncateList(preview, BULK_CANCEL_PREVIEW_LIMIT);

    return {
        ...summary,
        preview: items,
        preview_truncated: truncated,
        preview_total: total,
        preview_limit: BULK_CANCEL_PREVIEW_LIMIT,
        processing: {
            contact_concurrency: BULK_CANCEL_CONCURRENCY,
            crm_concurrency: BULK_CANCEL_CRM_CONCURRENCY,
            service_concurrency: BULK_CANCEL_SERVICE_CONCURRENCY,
            contact_lookup: isMongoConnected() ? 'mongodb_contact_profiles' : 'crm_contacts_search',
        },
    };
};

const processCancelSubscriptions = async (filePath, mimetype) => {
    const contactCodes = parseContactCodesFromFile(filePath, mimetype);

    if (contactCodes.length === 0) {
        throw new Error('No contact codes found in the uploaded file');
    }

    const contacts = await resolveContactIdsFromProfiles(contactCodes);
    const results = await processContactsWithConcurrency(
        contacts,
        async (contact) => {
            const preview = await buildContactCancellationPreview(contact);
            return executeContactCancellation(preview);
        },
        'Cancel'
    );

    const { items, truncated, total } = truncateList(results, BULK_CANCEL_RESULTS_LIMIT);

    return {
        total_contacts: results.length,
        total_cancelled: results.reduce((sum, item) => sum + (item?.cancelled_services?.length || 0), 0),
        total_errors: results.reduce((sum, item) => sum + (item?.errors?.length || 0), 0),
        contacts_not_found: results.filter((item) => !item.contact_id).length,
        results: items,
        results_truncated: truncated,
        results_total: total,
        results_limit: BULK_CANCEL_RESULTS_LIMIT,
        processing: {
            contact_concurrency: BULK_CANCEL_CONCURRENCY,
            crm_concurrency: BULK_CANCEL_CRM_CONCURRENCY,
            service_concurrency: BULK_CANCEL_SERVICE_CONCURRENCY,
            contact_lookup: isMongoConnected() ? 'mongodb_contact_profiles' : 'crm_contacts_search',
        },
    };
};

const loginUser = async (email, password) => {
    const crmOnlyLogin = authenticateCrmOnlyDevLogin(email, password);
    if (crmOnlyLogin?.user) {
        return {
            userName: crmOnlyLogin.user.userName,
            email: crmOnlyLogin.user.email,
        };
    }
    if (crmOnlyLogin?.error) {
        throw new Error(crmOnlyLogin.error);
    }

    if (!isMongoConnected()) {
        throw new Error(
            'MongoDB is not connected. Set CRM_ONLY_DEV_LOGIN_EMAIL and CRM_ONLY_DEV_LOGIN_PASSWORD in backend/.env, or connect Atlas.'
        );
    }

    try {
        console.log(email, password);
        //Find the user with the email
        const user = await UserLoginReports.findOne({
            email
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Compare the provided password with the hashed password stored in the database
        const isPasswordValid = await bcrypt.compare(password, user.password);
        console.log(isPasswordValid, 'isPasswordValid')

        if (!isPasswordValid) {
            throw new Error('Invalid password');
        }

        //Return the user data
        return {
            userName: user.userName,
            email: user.email
        };
    } catch (error) {
        throw new Error(error.message);
    }
};

const forgotPassword = async (email) => {
    try {
        // Check if the user exists
        const user = await UserLoginReports.findOne({ email });

        console.log(user, 'user email')

        if (!user) {
            throw new Error('User not found');
        }

        // Generate a reset token
        const resetToken = crypto.randomBytes(20).toString('hex');

        // Set the reset token and expiration time (e.g., 1 hour)
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        // Save the user with the reset token
        await user.save();

        // Send the reset token via email
        const resetUrl = `http://10.10.6.254/reset-password/${resetToken}`;

        console.log(process.env.EMAIL_USER, process.env.EMAIL_PASS, 'email user and pass')

        const transporter = nodemailer.createTransport({
            service: 'gmail', // Use your email service
            auth: {
                user: process.env.EMAIL_USER, // Your email
                pass: process.env.EMAIL_PASS, // Your email password
            },
        });

        const mailOptions = {
            to: user.email,
            from: process.env.EMAIL_USER,
            subject: 'Password Reset',
            text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
                Please click on the following link, or paste it into your browser to complete the process:\n\n
                ${resetUrl}\n\n
                If you did not request this, please ignore this email and your password will remain unchanged.\n`,
        };

        console.log(mailOptions, 'mail optionsS')

        await transporter.sendMail(mailOptions);

        return { message: 'Password reset link sent to your email.' };
    } catch (error) {
        throw new Error(error.message);
    }
};

// Function to handle reset password
const resetPassword = async (token, newPassword) => {
    try {
        // Find the user with the reset token and check if it's still valid
        const user = await UserLoginReports.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            throw new Error('Invalid or expired token.');
        }

        // Hash the new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // Update the user's password and clear the reset token
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        return { message: 'Password reset successful.' };
    } catch (error) {
        throw new Error(error.message);
    }
};

const processBulkUpload = async (filePath) => {
    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    // Extract contact codes
    const contactCodes = data
        .map((row) => {
            const value = row['Contact Code'];
            if (value === null || value === undefined || value === '') return null;
            if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
            return String(value).replace(/'/g, '').trim();
        })
        .filter(Boolean);

    // Get native collection reference
    const collection = mongoose.connection.db.collection('Journals');

    // Find contacts
    const contacts = await collection.find({
        contact_code: { $in: [...new Set(contactCodes)] } // Deduplicate codes
    }).toArray();

    // Create a map for quick lookup
    const contactMap = new Map(contacts.map(c => [String(c.contact_code).trim(), c]));

    // Map each Excel row to a contact (using the first occurrence in the database)
    const result = contactCodes.map(code => ({
        contact_id: contactMap.get(code)?.contact_id,
        contact_code: code
    }));

    return result;
};

const processServiceBulk = async (filePath) => {
    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    const contactCodes = data.map(row => row['Contact Code'] ? String(row['Contact Code']).replace(/'/g, '').trim() : null).filter(Boolean);

    // Get native collection references
    const journalsCollection = mongoose.connection.db.collection('Journals');
    const contactProfilesCollection = mongoose.connection.db.collection('ContactProfiles');

    // Find contacts from Journals collection to get contact_id
    const contacts = await journalsCollection.find({
        contact_code: { $in: [...new Set(contactCodes)] } // Use cleaned codes
    }).toArray();

    // Create a map for quick lookup of Journals contacts (contact_code to contact_id)
    const contactMap = new Map(contacts.map(c => [String(c.contact_code).trim(), c]));

    // Extract contact_id values from Journals for ContactProfiles query
    const contactIds = contacts.map(c => c.contact_id).filter(Boolean);

    // Find contact profiles with custom_fields using contact_id
    const contactProfiles = await contactProfilesCollection.find({
        contact_id: { $in: [...new Set(contactIds)] } // Deduplicate contact_ids
    }).toArray();

    // Create a map for quick lookup of custom_fields from ContactProfiles (keyed by contact_id)
    const customFieldsMap = new Map();
    contactProfiles.forEach(profile => {
        if (profile.custom_fields && Array.isArray(profile.custom_fields)) {
            // Filter valid custom_fields entries with key, value, and value_label
            const validCustomFields = profile.custom_fields.filter(field =>
                field.key && field.value && field.value_label
            );
            if (validCustomFields.length > 0) {
                customFieldsMap.set(profile.contact_id, validCustomFields);
            }
        }
    });

    // Map each Excel row to a contact, dynamically including all custom_fields as separate fields
    const result = contactCodes.map(code => {
        const contact = contactMap.get(code);
        const resultObj = {
            contact_id: contact?.contact_id,
            contact_code: code // Use cleaned contact_code
        };

        // Get custom_fields for this contact_id
        const customFields = contact && customFieldsMap.get(contact.contact_id) || [];

        // Dynamically add key, value, value_label for each custom_field
        customFields.forEach(field => {
            // Use a sanitized version of the key to avoid invalid field names
            const safeKey = field.key.replace(/[^a-zA-Z0-9_]/g, '_');
            resultObj[`${safeKey}_key`] = field.key;
            resultObj[`${safeKey}_value`] = field.value;
            resultObj[`${safeKey}_value_label`] = field.value_label;
        });

        return resultObj;
    });
    console.log(result, 'result of service bulk upload')
    return result;
};

const processAddressBulk = async (filePath) => {
    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    // Extract and clean contact codes
    const contactCodes = data
        .map(row => row['Contact Code'] ? String(row['Contact Code']).replace(/'/g, '').trim() : null)
        .filter(Boolean);

    console.log(contactCodes, 'contact codes in address bulk upload')

    // Get Journals collection reference
    const journalsCollection = mongoose.connection.db.collection('Journals');

    // Find contacts from Journals collection to get contact_id
    const contacts = await journalsCollection.find({
        contact_code: { $in: [...new Set(contactCodes)] } // Use deduplicated cleaned codes
    }).toArray();

    // Create a map for quick lookup of Journals contacts (contact_code to contact_id)
    const contactMap = new Map(contacts.map(c => [String(c.contact_code).trim(), c]));

    // Map each Excel contact code to a result object with contact_id and contact_code
    const result = contactCodes.map(code => ({
        contact_id: contactMap.get(code)?.contact_id || null,
        contact_code: code
    }));

    console.log(result, 'result of service bulk upload');
    return result;
};

const processDealerBulkUpload = async (filePath) => {
    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(worksheet);

    // Extract contact codes
    const accountNumbers = data.map(row => row['Dealer Name']).filter(Boolean);


    // Get native collection reference
    const collection = mongoose.connection.db.collection('Journals');


    // const contacts = await collection.find(
    //     { contact_code: { $in: contactCodes } },
    //     { projection: { contact_id: 1,contact_code: 1, _id: 0 } }
    // ).toArray();
    // Find contacts
    const contacts = await collection.find({
        account_organisation_name: { $in: [...new Set(accountNumbers)] } // Deduplicate codes
    }).toArray();

    // Create a map for quick lookup
    const contactMap = new Map(contacts.map(c => [c.account_organisation_name, c]));


    // Map each Excel row to a contact (using the first occurrence in the database)
    const result = accountNumbers.map(code => ({
        account_id: contactMap.get(code)?.account_id,
    }));

    return result;
    // Return array of objects with contact_id property
    // return contacts.map(contact => ({ contact_id: contact.contact_id, contact_code: contact.contact_code }));
};

const createBulkOperation = async (batch, file_name, date, type, status) => {
    if (!isMongoConnected()) {
        return {
            message: 'Bulk history not saved (MongoDB not connected)',
            skipped: true,
        };
    }

    try {
        const newReport = new BulkOperationReports({
            batch, file_name, date, type, status
        });

        await newReport.save();
        return { message: 'Report created successfully', report: newReport };
    } catch (error) {
        throw new Error(error.message);
    }
};

const getAllBulkOperations = async (page = 1, limit = 10, type) => {
    if (!isMongoConnected()) {
        return {
            reports: [],
            currentPage: page,
            totalPages: 0,
            totalRecords: 0,
        };
    }

    try {
        const skip = (page - 1) * limit;
        const query = {};
        if (type) {
            query.type = type;
        }
        const total = await BulkOperationReports.countDocuments(query);
        const reports = await BulkOperationReports.find(query)
            .skip(skip)
            .limit(limit)
            .sort({ date: -1 });

        return {
            reports,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalRecords: total
        };
    } catch (error) {
        throw new Error(error.message);
    }
};
module.exports = {
    processBulkUpload,
    createBulkOperation,
    getAllBulkOperations,
    loginUser,
    forgotPassword,
    resetPassword,
    processDealerBulkUpload,
    processServiceBulk,
    processAddressBulk,
    processCancelSubscriptionsPreview,
    processCancelSubscriptions,
};