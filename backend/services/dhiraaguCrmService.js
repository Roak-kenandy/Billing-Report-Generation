const crypto = require('crypto');
const { createConcurrentPool } = require('../utils/bulkProcessingUtils');

const VIDEOCLUB_3M_PLAN = {
    id: 'videoclub_3m',
    title: 'Videoclub 3 Months',
    priceAmount: Number(process.env.VIDEOCLUB_3M_PRICE) || 280,
    product_id: process.env.VIDEOCLUB_3M_PRODUCT_ID || 'c5297980-9b19-4fc5-acd8-a77046434dda',
    price_term_id: process.env.VIDEOCLUB_3M_PRICE_TERM_ID || '0ee6ca06-60d5-4fe2-bf2d-4b6ad676ee8a',
    displayName: 'OTT VIDEOCLUB (3m)',
};

const MOBILE_TAG_NAME = 'Dhiraagu OTT';
const PAYMENT_TYPE_ID = process.env.DHIRAAGU_PAYMENT_TYPE_ID || 'a3afdee8-3596-4e3a-8df4-1ddc99f86107';

class DhiraaguCrmService {
    constructor() {
        this.API_KEY = process.env.CRM_API_KEY;
        this.CRM_BASE_URL = process.env.CRM_BASE_URL;
        this.DEFAULT_TAG_ID = process.env.DEFAULT_TAG_ID;
        this.DEVICE_PRODUCT_ID = process.env.DEVICE_PRODUCT_ID;
        this.CLASSIFICATION_ID = process.env.CLASSIFICATION_ID;
        this.CURRENCY_CODE = process.env.CURRENCY_CODE || 'MVR';
        this.PAYMENT_TERMS_ID = process.env.PAYMENT_TERMS_ID;

        this.crmHeaders = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            api_key: this.API_KEY,
        };

        this.crmRequestPool = createConcurrentPool(
            Number(process.env.DHIRAAGU_CRM_CONCURRENCY) || 3
        );
    }

    assertConfig() {
        const missing = [];
        if (!this.API_KEY) missing.push('CRM_API_KEY');
        if (!this.CRM_BASE_URL) missing.push('CRM_BASE_URL');
        if (!this.DEFAULT_TAG_ID) missing.push('DEFAULT_TAG_ID');
        if (!this.DEVICE_PRODUCT_ID) missing.push('DEVICE_PRODUCT_ID');
        if (!this.CLASSIFICATION_ID) missing.push('CLASSIFICATION_ID');
        if (!this.PAYMENT_TERMS_ID) missing.push('PAYMENT_TERMS_ID');

        if (missing.length) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
    }

    getVideoclubPlan() {
        return { ...VIDEOCLUB_3M_PLAN };
    }

    async handleResponse(response, context) {
        const text = await response.text();

        if (!response.ok) {
            throw new Error(`${context} failed: ${text}`);
        }

        try {
            return text ? JSON.parse(text) : {};
        } catch {
            throw new Error(`${context} failed: Response is not valid JSON`);
        }
    }

    async crmFetch(url, options = {}) {
        return this.crmRequestPool(async () => {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...this.crmHeaders,
                    ...(options.headers || {}),
                },
            });
            return this.handleResponse(response, options.context || url);
        });
    }

    normalizePhoneNumber(phoneNumber) {
        return String(phoneNumber || '')
            .replace(/'/g, '')
            .replace(/\D/g, '')
            .trim();
    }

    async fetchContactsByPhone(phoneNumber) {
        const queryParams = new URLSearchParams({
            phone_number: this.normalizePhoneNumber(phoneNumber),
        }).toString();

        const data = await this.crmFetch(
            `${this.CRM_BASE_URL}/contacts?${queryParams}`,
            { method: 'GET', context: 'Fetch contacts by phone' }
        );

        return data.content || [];
    }

    async fetchContactTags(contactId) {
        return this.crmFetch(
            `${this.CRM_BASE_URL}/contacts/${contactId}/tags`,
            { method: 'GET', context: `Fetch tags for contact ${contactId}` }
        );
    }

    async fetchContactAccounts(contactId) {
        return this.crmFetch(
            `${this.CRM_BASE_URL}/contacts/${contactId}/accounts`,
            { method: 'GET', context: `Fetch accounts for contact ${contactId}` }
        );
    }

    async fetchContactSubscriptions(contactId) {
        return this.crmFetch(
            `${this.CRM_BASE_URL}/contacts/${contactId}/subscriptions?size=100&page=1&include_terms=true&include_billing_info=true&include_future_info=true`,
            { method: 'GET', context: `Fetch subscriptions for contact ${contactId}` }
        );
    }

    async fetchContactServices(contactId, subscriptionId) {
        const url = `${this.CRM_BASE_URL}/contacts/${contactId}/services?size=100&page=1&subscription_id=${subscriptionId}&include_future_info=true`;
        return this.crmFetch(url, {
            method: 'GET',
            context: `Fetch services for contact ${contactId}`,
        });
    }

    contactHasOttTag(tagsData) {
        const tags = tagsData?.content || [];
        return tags.some(
            (tag) => tag.name === MOBILE_TAG_NAME || tag.id === this.DEFAULT_TAG_ID
        );
    }

    isEffectiveVideoclubService(service) {
        const productId = service?.product?.id || service?.product_id;
        const state = String(service?.state || '').toUpperCase();
        return productId === VIDEOCLUB_3M_PLAN.product_id
            && ['EFFECTIVE', 'ACTIVE'].includes(state);
    }

    async contactHasActiveVideoclub(contactId) {
        const subscriptionsData = await this.fetchContactSubscriptions(contactId);
        const subscriptions = subscriptionsData?.content || [];

        for (const subscription of subscriptions) {
            if (!subscription?.id) continue;

            const servicesData = await this.fetchContactServices(contactId, subscription.id);
            const services = servicesData?.content || [];

            if (services.some((service) => this.isEffectiveVideoclubService(service))) {
                return true;
            }
        }

        return false;
    }

    async resolveExistingContact(phoneNumber) {
        const contacts = await this.fetchContactsByPhone(phoneNumber);

        for (const contact of contacts) {
            const tagsData = await this.fetchContactTags(contact.id);
            if (!this.contactHasOttTag(tagsData)) {
                continue;
            }

            const accountsData = await this.fetchContactAccounts(contact.id);
            const accountId = accountsData.content?.[0]?.id || null;

            return {
                contactId: contact.id,
                accountId,
                contactName: contact.person_name?.full_name || null,
            };
        }

        return null;
    }

    async createContact(phoneNumber) {
        const payload = {
            type: 'PERSON',
            person_name: {
                first_name: 'Dhiraagu',
                last_name: 'OTT User',
            },
            phone: {
                country_code: 'MDV',
                number: this.normalizePhoneNumber(phoneNumber),
                type: 'MOBILE',
            },
            address: {
                type: 'ALTERNATIVE',
                name: '',
                is_primary: true,
                address_line_1: 'N/A',
                address_line_2: '',
                town_city: 'Maldives',
                postal_code: '',
                country_code: 'MDV',
            },
        };

        const contactData = await this.crmFetch(`${this.CRM_BASE_URL}/contacts`, {
            method: 'POST',
            body: JSON.stringify(payload),
            context: 'Contact creation',
        });

        if (!contactData?.id) {
            throw new Error('Contact ID not returned after creation');
        }

        await this.crmFetch(`${this.CRM_BASE_URL}/contacts/${contactData.id}/tags`, {
            method: 'PUT',
            body: JSON.stringify({ tags: [this.DEFAULT_TAG_ID] }),
            context: `Tag registration for contact ${contactData.id}`,
        });

        return contactData;
    }

    async createDevice(contactId) {
        const payload = {
            serial_number: crypto.randomUUID(),
            electronic_id: null,
            contact_id: contactId,
            product_id: this.DEVICE_PRODUCT_ID,
        };

        return this.crmFetch(`${this.CRM_BASE_URL}/devices`, {
            method: 'POST',
            body: JSON.stringify(payload),
            context: 'Device creation',
        });
    }

    async createAccount(contactId) {
        const payload = {
            classification_id: this.CLASSIFICATION_ID,
            credit_limit: '',
            currency_code: this.CURRENCY_CODE,
            is_primary: false,
            payment_terms_id: this.PAYMENT_TERMS_ID,
        };

        return this.crmFetch(`${this.CRM_BASE_URL}/contacts/${contactId}/accounts`, {
            method: 'POST',
            body: JSON.stringify(payload),
            context: 'Account creation',
        });
    }

    async createPayment(contactId, accountId, amount, maxAttempts = 3) {
        let lastFailureMessage = 'Payment API failed';

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            const paymentRef = `DHIOTT${Date.now()}${crypto.randomUUID().slice(0, 8)}`;
            const payload = {
                contact_id: contactId,
                account_id: accountId,
                amount,
                currency_code: 'MVR',
                notes: 'Dhiraagu OTT Payment',
                payment_method: {
                    type: 'ELECTRONIC_TRANSFER',
                },
                state: 'POSTED',
                backoffice_code: paymentRef,
                type_id: PAYMENT_TYPE_ID,
                external_payable: ['Dhiraagu OTT Payment'],
            };

            try {
                const response = await fetch(`${this.CRM_BASE_URL}/payments`, {
                    method: 'POST',
                    headers: this.crmHeaders,
                    body: JSON.stringify(payload),
                });

                const data = await response.json();

                if (!response.ok) {
                    lastFailureMessage = data?.message || `Payment API failed with status ${response.status}`;
                    if (attempt < maxAttempts) {
                        await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
                        continue;
                    }
                    return { success: false, message: lastFailureMessage };
                }

                return { success: true, data };
            } catch (error) {
                lastFailureMessage = error.message;
                if (attempt < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
                    continue;
                }
                return { success: false, message: error.message };
            }
        }

        return { success: false, message: lastFailureMessage };
    }

    async createSubscription(contactId, accountId, plans, maxAttempts = 4) {
        const services = plans.map((plan) => ({
            price_terms_id: plan.price_term_id,
            product_id: plan.product_id,
            quantity: 1,
        }));

        const payload = {
            account_id: accountId,
            scheduled_date: plans[0]?.schedule_date || null,
            services,
        };

        let lastError = 'Subscription API failed';

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                const response = await fetch(
                    `${this.CRM_BASE_URL}/contacts/${contactId}/services`,
                    {
                        method: 'POST',
                        headers: this.crmHeaders,
                        body: JSON.stringify(payload),
                    }
                );

                const raw = await response.text();
                let data = {};
                try {
                    data = raw ? JSON.parse(raw) : {};
                } catch {
                    data = { message: raw || 'Non-JSON response' };
                }

                if (response.ok) {
                    return { success: true, data };
                }

                const errorMessage = data?.message || data?.error || `HTTP ${response.status}`;
                lastError = errorMessage;

                const shouldRetry =
                    response.status >= 500
                    || String(errorMessage).toLowerCase().includes('internal server error');

                if (shouldRetry && attempt < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
                    continue;
                }

                return { success: false, error: errorMessage };
            } catch (error) {
                lastError = error.message;
                if (attempt < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
                    continue;
                }
                return { success: false, error: error.message };
            }
        }

        return { success: false, error: lastError };
    }

    async getSubscriptionDetails(contactId) {
        const data = await this.crmFetch(
            `${this.CRM_BASE_URL}/contacts/${contactId}/subscriptions`,
            { method: 'GET', context: 'Get subscriptions' }
        );

        if (!data.content?.length) {
            return { subscription_id: null, device_ids: [], custom_fields: null };
        }

        const subscriptionId = data.content[0].id;
        const allowedDevicesData = await this.getAllowedDevices(subscriptionId, contactId);

        return {
            subscription_id: subscriptionId,
            device_ids: allowedDevicesData.deviceIds || [],
            custom_fields: allowedDevicesData.customFields || null,
        };
    }

    async getAllowedDevices(subscriptionId, contactId) {
        let devices = [];
        let source = 'allowed_devices';

        try {
            const data = await this.crmFetch(
                `${this.CRM_BASE_URL}/subscriptions/${subscriptionId}/allowed_devices`,
                { method: 'GET', context: 'Get allowed devices' }
            );
            devices = data.content || [];
        } catch {
            devices = [];
            source = 'subscription_devices';
        }

        const hasValidDeviceId = devices.length && devices.some((item) => item?.device?.id);

        if (!hasValidDeviceId) {
            source = 'subscription_devices';
            const fallbackData = await this.crmFetch(
                `${this.CRM_BASE_URL}/subscriptions/${subscriptionId}/devices`,
                { method: 'GET', context: 'Get subscription devices' }
            );
            devices = fallbackData.content || [];
        }

        const deviceIds = devices
            .filter((item) => item?.device?.id)
            .map((item) => ({ device_id: item.device.id }));

        if (!deviceIds.length) {
            return { deviceIds: [], customFields: null };
        }

        if (source === 'allowed_devices') {
            return this.addSubscriptionDevice(subscriptionId, deviceIds, contactId);
        }

        return this.assignDevicesToServices(contactId, deviceIds, subscriptionId);
    }

    async addSubscriptionDevice(subscriptionId, deviceIds, contactId) {
        const data = await this.crmFetch(
            `${this.CRM_BASE_URL}/subscriptions/${subscriptionId}/devices`,
            {
                method: 'POST',
                body: JSON.stringify(deviceIds[0]),
                context: 'Add subscription device',
            }
        );

        if (data.id) {
            return this.assignDevicesToServices(contactId, deviceIds, subscriptionId);
        }

        return { deviceIds: [], customFields: null };
    }

    async assignDevicesToServices(contactId, deviceIds, subscriptionId) {
        const data = await this.crmFetch(
            `${this.CRM_BASE_URL}/contacts/${contactId}/services`,
            { method: 'GET', context: 'Get services for device assignment' }
        );

        if (!data.content?.length) {
            return { deviceIds: [], customFields: null };
        }

        let assignedDeviceIds = [];

        for (const service of data.content) {
            const assigned = await this.assignDevicesToService(service.id, deviceIds, subscriptionId);
            assignedDeviceIds = assigned.deviceIds || assignedDeviceIds;
        }

        return {
            deviceIds: assignedDeviceIds,
            customFields: null,
        };
    }

    async assignDevicesToService(serviceId, deviceIds, subscriptionId) {
        const updatedDevices = deviceIds.map((device) => ({
            ...device,
            action: 'ENABLE',
        }));

        const data = await this.crmFetch(
            `${this.CRM_BASE_URL}/services/${serviceId}/devices`,
            {
                method: 'POST',
                body: JSON.stringify(updatedDevices),
                context: 'Assign devices to service',
            }
        );

        return {
            deviceIds: data,
            customFields: null,
        };
    }

    async setupSubscription(contactId, accountId, plans) {
        const totalAmount = plans.reduce(
            (sum, plan) => sum + (Number(plan.priceAmount) || 0),
            0
        );

        const paymentResult = await this.createPayment(contactId, accountId, totalAmount);
        if (!paymentResult.success) {
            throw new Error(`Payment failed: ${paymentResult.message}`);
        }

        const subscription = await this.createSubscription(contactId, accountId, plans);
        if (!subscription?.success) {
            throw new Error(
                `Subscription creation failed: ${subscription?.error || 'Unknown CRM error'}`
            );
        }

        const subscriptionDetails = await this.getSubscriptionDetails(contactId);

        return {
            paymentId: paymentResult.data?.id || null,
            subscriptionId: subscriptionDetails.subscription_id,
            deviceIds: subscriptionDetails.device_ids || [],
        };
    }

    async registerNewUser(phoneNumber) {
        const contact = await this.createContact(phoneNumber);
        await this.createDevice(contact.id);
        const account = await this.createAccount(contact.id);
        const plan = this.getVideoclubPlan();
        const subscription = await this.setupSubscription(contact.id, account.id, [plan]);

        return {
            success: true,
            phone_number: this.normalizePhoneNumber(phoneNumber),
            contactId: contact.id,
            accountId: account.id,
            subscriptionId: subscription.subscriptionId,
            paymentId: subscription.paymentId,
            action: 'created_new_user',
            message: 'User registered with Videoclub 3 Months subscription',
        };
    }

    async registerExistingUser(phoneNumber, contactId, accountId) {
        const plan = this.getVideoclubPlan();
        const subscription = await this.setupSubscription(contactId, accountId, [plan]);

        return {
            success: true,
            phone_number: this.normalizePhoneNumber(phoneNumber),
            contactId,
            accountId,
            subscriptionId: subscription.subscriptionId,
            paymentId: subscription.paymentId,
            action: 'added_videoclub_subscription',
            message: 'Videoclub 3 Months subscription added for existing user',
        };
    }

    async previewRegistration(phoneNumber) {
        const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

        if (!normalizedPhone) {
            return {
                phone_number: phoneNumber,
                status: 'invalid_phone',
                action: null,
                errors: ['Invalid phone number'],
            };
        }

        try {
            const existing = await this.resolveExistingContact(normalizedPhone);

            if (existing?.contactId) {
                const hasVideoclub = await this.contactHasActiveVideoclub(existing.contactId);

                if (hasVideoclub) {
                    return {
                        phone_number: normalizedPhone,
                        status: 'already_has_videoclub',
                        action: 'skip',
                        contact_id: existing.contactId,
                        account_id: existing.accountId,
                        contact_name: existing.contactName,
                        plan: VIDEOCLUB_3M_PLAN.displayName,
                        errors: [],
                    };
                }

                if (!existing.accountId) {
                    return {
                        phone_number: normalizedPhone,
                        status: 'existing_contact_missing_account',
                        action: 'create_account_and_subscribe',
                        contact_id: existing.contactId,
                        account_id: null,
                        contact_name: existing.contactName,
                        plan: VIDEOCLUB_3M_PLAN.displayName,
                        errors: [],
                    };
                }

                return {
                    phone_number: normalizedPhone,
                    status: 'ready_existing_user',
                    action: 'add_subscription',
                    contact_id: existing.contactId,
                    account_id: existing.accountId,
                    contact_name: existing.contactName,
                    plan: VIDEOCLUB_3M_PLAN.displayName,
                    errors: [],
                };
            }

            return {
                phone_number: normalizedPhone,
                status: 'ready_new_user',
                action: 'create_user',
                contact_id: null,
                account_id: null,
                contact_name: null,
                plan: VIDEOCLUB_3M_PLAN.displayName,
                errors: [],
            };
        } catch (error) {
            return {
                phone_number: normalizedPhone,
                status: 'error',
                action: null,
                errors: [error.message],
            };
        }
    }

    async registerVideoclubUser(phoneNumber) {
        this.assertConfig();

        const preview = await this.previewRegistration(phoneNumber);

        if (preview.status === 'invalid_phone') {
            throw new Error('Invalid phone number');
        }

        if (preview.status === 'already_has_videoclub') {
            return {
                ...preview,
                success: true,
                skipped: true,
                message: 'Contact already has active Videoclub subscription',
            };
        }

        if (preview.status === 'ready_existing_user') {
            return this.registerExistingUser(
                phoneNumber,
                preview.contact_id,
                preview.account_id
            );
        }

        if (preview.status === 'existing_contact_missing_account') {
            const account = await this.createAccount(preview.contact_id);
            return this.registerExistingUser(
                phoneNumber,
                preview.contact_id,
                account.id
            );
        }

        if (preview.status === 'ready_new_user') {
            return this.registerNewUser(phoneNumber);
        }

        if (preview.status === 'error') {
            throw new Error(preview.errors?.[0] || 'Registration preview failed');
        }

        throw new Error('Unable to determine registration action for phone number');
    }
}

module.exports = DhiraaguCrmService;
