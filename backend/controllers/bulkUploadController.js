const bulkUploadService = require('../services/bulkUploadService');

const loginUser = async (req, res) => {
    const {email, password} = req.body;
    
    if(!email || !password){
        res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const user = await bulkUploadService.loginUser(email, password);
        res.status(200).json({ message: "Login successful", user});
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

const createBulkOperation = async (req, res) => {
    try {
        const { batch, file_name, date, status } = req.body;

        if (!batch || !file_name || !date || !status) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const result = await bulkUploadService.createBulkOperation(batch, file_name, date, 'Completed');
        return res.status(201).json(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

const getAllBulkOperations = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const data = await bulkUploadService.getAllBulkOperations(page, limit);

        res.status(200).json({
            success: true,
            message: 'Data fetched successfully',
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
module.exports = {
    uploadContacts,
    createBulkOperation,
    getAllBulkOperations,
    loginUser,
    forgotPassword,
    resetPassword
};