const loginReportService = require('../services/loginReportService');

const registerUser = async (req, res) => {
    try {
        const { name, email, password, designation } = req.body;

        if (!name || !email || !password || !designation) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const result = await loginReportService.registerUser(name, email, password, designation);
        return res.status(201).json(result);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

const loginUser = async (req, res) => {
    const {email, password} = req.body;
    
    if(!email || !password){
        res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const user = await loginReportService.loginUser(email, password);
        res.status(200).json({ message: "Login successful", user});
    }
    catch (error) {
        res.status(401).json({ message: error.message });
    }
};

const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const result = await loginReportService.forgotPassword(email);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { resetToken } = req.body;
        const { newPassword } = req.body;
        const result = await loginReportService.resetPassword(resetToken, newPassword);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

module.exports = {
    loginUser,
    registerUser,
    forgotPassword,
    resetPassword
  };