const { isMongoConnected } = require('../config/db');

const isMongoOptionalMode = () => (
    process.env.MONGO_OPTIONAL === 'true' || process.env.MONGO_OPTIONAL === '1'
);

/**
 * When MongoDB is down and MONGO_OPTIONAL is set, allow login using backend/.env credentials.
 * Returns { user } on success, { error } on failure, or null to use MongoDB login.
 */
const authenticateCrmOnlyDevLogin = (email, password) => {
    if (isMongoConnected() || !isMongoOptionalMode()) {
        return null;
    }

    const devEmail = process.env.CRM_ONLY_DEV_LOGIN_EMAIL;
    const devPassword = process.env.CRM_ONLY_DEV_LOGIN_PASSWORD;

    if (!devEmail || !devPassword) {
        return {
            error: 'MongoDB is not connected. Set CRM_ONLY_DEV_LOGIN_EMAIL and CRM_ONLY_DEV_LOGIN_PASSWORD in backend/.env, or connect Atlas and whitelist your IP.',
        };
    }

    if (email !== devEmail || password !== devPassword) {
        return { error: 'Invalid email or password' };
    }

    const roles = (process.env.CRM_ONLY_DEV_LOGIN_ROLES || 'Admin,Finance,Sales')
        .split(',')
        .map((role) => role.trim())
        .filter(Boolean);

    return {
        user: {
            id: 'crm-only-dev',
            userName: process.env.CRM_ONLY_DEV_LOGIN_USER_NAME || 'CRM Dev User',
            email: devEmail,
            roles,
            permissions: [],
        },
    };
};

module.exports = {
    authenticateCrmOnlyDevLogin,
};
