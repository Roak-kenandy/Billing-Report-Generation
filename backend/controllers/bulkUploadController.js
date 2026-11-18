const bulkUploadService = require('../services/bulkUploadService');
const bulkCancelCardSubscriptionService = require('../services/bulkCancelCardSubscriptionService');
const bulkDhiraaguCreationService = require('../services/bulkDhiraaguCreationService');
const bulkAccountTerminationService = require('../services/bulkAccountTerminationService');
const CRM_BASE_URL = process.env.CRM_BASE_URL;
const CRM_CONTACT_BASE_URL = process.env.CRM_CONTACT_BASE_URL;
const API_KEY = process.env.CRM_API_KEY;

const crmHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'api_key': API_KEY,
}

const loginUser = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const user = await bulkUploadService.loginUser(email, password);
        res.status(200).json({ message: "Login successful", user });
    }
    catch (error) {
        res.status(401).json({ message: error.message });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await bulkUploadService.forgotPassword(email);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { resetToken } = req.body;
        const { newPassword } = req.body;
        const result = await bulkUploadService.resetPassword(resetToken, newPassword);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const uploadContacts = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        if (req.file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            return res.status(400).json({ message: 'Invalid file type. Please upload an Excel file' });
        }

        const contactIds = await bulkUploadService.processBulkUpload(req.file.path);
        res.status(200).json({
            message: 'Contacts processed successfully',
            contactIds
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const uploadServiceBulk = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        if (req.file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            return res.status(400).json({ message: 'Invalid file type. Please upload an Excel file' });
        }

        const services = await bulkUploadService.processServiceBulk(req.file.path);
        res.status(200).json({
            message: 'Services processed successfully',
            services
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const uploadAddress = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        if (req.file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            return res.status(400).json({ message: 'Invalid file type. Please upload an Excel file' });
        }

        const services = await bulkUploadService.processAddressBulk(req.file.path);
        res.status(200).json({
            message: 'Address processed successfully',
            services
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const ALLOWED_BULK_FILE_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
];

const validateBulkUploadFile = (file) => {
    if (!file) {
        return 'No file uploaded';
    }

    const isAllowedType = ALLOWED_BULK_FILE_TYPES.includes(file.mimetype)
        || file.originalname?.endsWith('.csv')
        || file.originalname?.endsWith('.xlsx');

    if (!isAllowedType) {
        return 'Invalid file type. Please upload a CSV or Excel file';
    }

    return null;
};

const uploadDealerContacts = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        if (req.file.mimetype !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            return res.status(400).json({ message: 'Invalid file type. Please upload an Excel file' });
        }

        const contactIds = await bulkUploadService.processDealerBulkUpload(req.file.path);
        res.status(200).json({
            message: 'Accounts processed successfully',
            contactIds
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createBulkOperation = async (req, res) => {
    try {
        const { batch, file_name, date, type, status } = req.body;

        if (!batch || !file_name || !date || !status || !type) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const result = await bulkUploadService.createBulkOperation(batch, file_name, date, type, 'Completed');
        return res.status(201).json(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const previewCancelSubscriptions = async (req, res) => {
    req.setTimeout(90 * 60 * 1000);
    res.setTimeout(90 * 60 * 1000);

    try {
        const validationError = validateBulkUploadFile(req.file);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const preview = await bulkUploadService.processCancelSubscriptionsPreview(
            req.file.path,
            req.file.mimetype
        );

        return res.status(200).json({
            message: 'Subscription cancellation preview generated successfully',
            ...preview,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const bulkCancelSubscriptions = async (req, res) => {
    req.setTimeout(90 * 60 * 1000);
    res.setTimeout(90 * 60 * 1000);

    try {
        const validationError = validateBulkUploadFile(req.file);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const result = await bulkUploadService.processCancelSubscriptions(
            req.file.path,
            req.file.mimetype
        );

        return res.status(200).json({
            message: 'Subscription cancellation completed',
            partial: result.total_errors > 0,
            ...result,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const previewCancelCardSubscriptions = async (req, res) => {
    req.setTimeout(90 * 60 * 1000);
    res.setTimeout(90 * 60 * 1000);

    try {
        const validationError = validateBulkUploadFile(req.file);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const preview = await bulkCancelCardSubscriptionService.processCancelCardSubscriptionsPreview(
            req.file.path,
            req.file.mimetype
        );

        return res.status(200).json({
            message: 'Card subscription cancellation preview generated successfully',
            ...preview,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const bulkCancelCardSubscriptions = async (req, res) => {
    req.setTimeout(90 * 60 * 1000);
    res.setTimeout(90 * 60 * 1000);

    try {
        const validationError = validateBulkUploadFile(req.file);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const result = await bulkCancelCardSubscriptionService.processCancelCardSubscriptions(
            req.file.path,
            req.file.mimetype
        );

        return res.status(200).json({
            message: 'Card subscription cancellation completed',
            partial: result.total_errors > 0,
            ...result,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const previewDhiraaguBulkCreation = async (req, res) => {
    req.setTimeout(90 * 60 * 1000);
    res.setTimeout(90 * 60 * 1000);

    try {
        const validationError = validateBulkUploadFile(req.file);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const preview = await bulkDhiraaguCreationService.processDhiraaguBulkPreview(
            req.file.path,
            req.file.mimetype
        );

        return res.status(200).json({
            message: 'Dhiraagu bulk creation preview generated successfully',
            ...preview,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const bulkDhiraaguCreation = async (req, res) => {
    req.setTimeout(90 * 60 * 1000);
    res.setTimeout(90 * 60 * 1000);

    try {
        const validationError = validateBulkUploadFile(req.file);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const result = await bulkDhiraaguCreationService.processDhiraaguBulkCreation(
            req.file.path,
            req.file.mimetype
        );

        return res.status(200).json({
            message: 'Dhiraagu bulk creation completed',
            partial: result.total_errors > 0,
            ...result,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const TERMINATION_ROLES = ['admin', 'sales'];

const getUserRoles = (user) => {
    const roles = Array.isArray(user?.roles) ? user.roles : String(user?.roles || '').split(',');
    return roles.map((role) => String(role?.name || role).trim().toLowerCase()).filter(Boolean);
};

const requireTerminationRole = (req, res) => {
    if (getUserRoles(req.user).some((role) => TERMINATION_ROLES.includes(role))) return true;
    res.status(403).json({ message: 'Only Admin or Sales users can terminate accounts' });
    return false;
};

const sendServiceError = (res, error) => res.status(error.statusCode || 500).json({ message: error.message });

const previewBulkAccountTermination = async (req, res) => {
    if (!requireTerminationRole(req, res)) return;
    req.setTimeout(10 * 60 * 1000);

    try {
        const validationError = validateBulkUploadFile(req.file);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }
        const preview = await bulkAccountTerminationService.createPreview(req.file.buffer, req.file.originalname);
        return res.status(200).json(preview);
    } catch (error) {
        console.error('Account termination preview error:', error);
        return sendServiceError(res, error);
    }
};

const downloadBulkAccountTerminationPreview = (req, res) => {
    const csv = bulkAccountTerminationService.getPreviewCsv(req.params.previewId);
    if (csv === null) return res.status(404).json({ message: 'Preview expired or not found' });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=account-termination-preview.csv');
    return res.send(csv);
};

const startBulkAccountTermination = async (req, res) => {
    if (!requireTerminationRole(req, res)) return;
    try {
        const { previewId } = req.body || {};
        if (!previewId) return res.status(400).json({ message: 'previewId is required' });
        const job = await bulkAccountTerminationService.startJob({
            previewId,
            startedBy: req.user?.email || req.user?.userId || '',
        });
        return res.status(202).json(job);
    } catch (error) {
        return sendServiceError(res, error);
    }
};

const listBulkAccountTerminationJobs = (req, res) => res.json({ jobs: bulkAccountTerminationService.listJobs() });

const getBulkAccountTerminationJob = (req, res) => {
    const job = bulkAccountTerminationService.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ message: 'Job not found (it may have finished more than 24 hours ago or the server restarted)' });
    return res.json(job);
};

const stopBulkAccountTerminationJob = (req, res) => {
    if (!requireTerminationRole(req, res)) return;
    const job = bulkAccountTerminationService.stopJob(req.params.jobId);
    if (!job) return res.status(404).json({ message: 'Job not found' });
    return res.json(job);
};

const downloadBulkAccountTerminationResults = (req, res) => {
    const csv = bulkAccountTerminationService.getJobResultsCsv(req.params.jobId);
    if (csv === null) return res.status(404).json({ message: 'Job not found' });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=account-termination-results-${req.params.jobId}.csv`);
    return res.send(csv);
};

const getAllBulkOperations = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const type = req.query.type || 'all';
        const data = await bulkUploadService.getAllBulkOperations(page, limit, type);

        res.status(200).json({
            success: true,
            message: 'Data fetched successfully',
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getCrmDealerReports = async (req, res) => {
    try {

        // Create contact
        const contactResponse = await fetch(`${CRM_BASE_URL}/credit_notes`, {
            method: 'GET',
            headers: crmHeaders,
        });

        const data = await contactResponse.json();

        return res.status(201).json({
            data: data.content
        });

    } catch (error) {
        console.error('Credit notes error:', error);
        const statusCode = error.message.includes('failed') ? 400 : 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};

/**
 * Updates for the Address
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const updateAddress = async (req, res) => {
    // Expect req.body to be an array of records for bulk processing
    const records = Array.isArray(req.body) ? req.body : [req.body];

    console.log('Received records for address update:', records);

    const results = [];
    const errors = [];

    for (const row of records) {
        // Validate required fields
        if (!row['Contact ID']) {
            errors.push({ record: row, error: 'Missing Contact ID' });
            continue;
        }

        console.log('Processing record:', row);

        // Initialize custom_fields array with the service_provider field
        const customFields = [
            {
                key: 'service_provider',
                value: row['Service Provider'] === 'HDC'
                    ? 'b98eb6ce-bda2-4f2f-993b-b57b66abbeda'
                    : row['Service Provider'] === 'Fiber Cable Net'
                        ? '848f5955-7f7a-41b3-823c-38d5b2406664'
                        : '',
                value_label: row['Service Provider'] || '',
            }
        ];

        // Dynamically add other fields ending with _key, _value, _value_label
        Object.keys(row).forEach(key => {
            if (key.endsWith('_key')) {
                const baseKey = key.replace('_key', '');
                const valueKey = `${baseKey}_value`;
                const valueLabelKey = `${baseKey}_value_label`;

                // Check if corresponding value and value_label exist
                if (row[valueKey] && row[valueLabelKey]) {
                    customFields.push({
                        key: row[key],
                        value: row[valueKey],
                        value_label: row[valueLabelKey],
                    });
                }
            }
        });

        const payload = {
            contact_id: row['Contact ID'],
            custom_fields: customFields,
        };

        try {
            const response = await fetch(`${CRM_BASE_URL}/contacts/${row['Contact ID']}`, {
                method: 'PUT',
                headers: crmHeaders,
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            console.log(data, 'data comes with response');

            if (!response.ok) {
                errors.push({ record: row, error: data });
                continue;
            }

            results.push({ record: row, data });
        } catch (error) {
            console.error(`Error updating contact ${row['Contact ID']} in CRM:`, error);
            errors.push({ record: row, error: 'Internal server error' });
        }
    }

    // Return results and errors
    if (errors.length > 0) {
        return res.status(207).json({ results, errors }); // 207 Multi-Status for partial success
    }
    
    if(results.length >= 0) {
    return res.status(200).json({ status: true });
    }
};


/**
 * Updates for the Address
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
const updateContactAddress = async (req, res) => {
    // Expect req.body to be an array of records for bulk processing
    const records = Array.isArray(req.body) ? req.body : [req.body];

    console.log('Received records for address update:', records);

    const results = [];
    const errors = [];

    for (const row of records) {
        // Validate required fields
        if (!row['Contact ID']) {
            errors.push({ record: row, error: 'Missing Contact ID' });
            continue;
        }


        const payload = {
            contact_id: row['Contact ID'],
            town_city: row['City'] || '',
        };

        console.log('Processing record:', payload);

        try {
            const response = await fetch(`${CRM_BASE_URL}/contacts/${row['Contact ID']}/addresses/df618dd9-5304-40ed-b9b1-39e447a7cd32`, {
                method: 'PUT',
                headers: crmHeaders,
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            console.log(data, 'data comes with response');

            if (!response.ok) {
                errors.push({ record: row, error: data });
                continue;
            }

            results.push({ record: row, data });
        } catch (error) {
            console.error(`Error updating contact ${row['Contact ID']} in CRM:`, error);
            errors.push({ record: row, error: 'Internal server error' });
        }
    }

    // Return results and errors
    if (errors.length > 0) {
        return res.status(207).json({ results, errors }); // 207 Multi-Status for partial success
    }
    
    if(results.length >= 0) {
    return res.status(200).json({ status: true });
    }
};
module.exports = {
    uploadContacts,
    createBulkOperation,
    getAllBulkOperations,
    loginUser,
    forgotPassword,
    resetPassword,
    uploadDealerContacts,
    getCrmDealerReports,
    updateAddress,
    uploadServiceBulk,
    updateContactAddress,
    uploadAddress,
    previewCancelSubscriptions,
    bulkCancelSubscriptions,
    previewCancelCardSubscriptions,
    bulkCancelCardSubscriptions,
    previewDhiraaguBulkCreation,
    bulkDhiraaguCreation,
    previewBulkAccountTermination,
    downloadBulkAccountTerminationPreview,
    startBulkAccountTermination,
    listBulkAccountTerminationJobs,
    getBulkAccountTerminationJob,
    stopBulkAccountTerminationJob,
    downloadBulkAccountTerminationResults,
};