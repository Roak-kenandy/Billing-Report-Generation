const bcrypt = require('bcrypt');
const UserLoginReports = require('../models/UserLoginReports');

class RbacService {
    // Get all users with roles
    async getAllUsers() {
        return await UserLoginReports.find().select('-password');
    }

    // Get user by ID
    async getUserById(id) {
        return await UserLoginReports.findById(id).select('-password');
    }

    async createUser({ name, email, password, roles = [] }) {
        const trimmedName = String(name || '').trim();
        const trimmedEmail = String(email || '').trim().toLowerCase();
        const roleList = Array.isArray(roles) ? roles.filter(Boolean) : [];

        if (!trimmedName || !trimmedEmail || !password) {
            const err = new Error('Name, email, and password are required.');
            err.statusCode = 400;
            throw err;
        }
        if (String(password).length < 8) {
            const err = new Error('Password must be at least 8 characters.');
            err.statusCode = 400;
            throw err;
        }

        const existing = await UserLoginReports.findOne({ email: trimmedEmail });
        if (existing) {
            const err = new Error('A user with this email already exists.');
            err.statusCode = 409;
            throw err;
        }

        const user = new UserLoginReports({
            name: trimmedName,
            email: trimmedEmail,
            password: await bcrypt.hash(String(password), 10),
            roles: roleList,
        });
        await user.save();

        const saved = user.toObject();
        delete saved.password;
        return saved;
    }

    // Update user roles
    async updateUserRoles(id, roles) {
        return await UserLoginReports.findByIdAndUpdate(
            id,
            { roles },
            { new: true }
        ).select('-password');
    }

    // Update user permissions
    async updateUserPermissions(id, permissions) {
        return await UserLoginReports.findByIdAndUpdate(
            id,
            { permissions },
            { new: true }
        ).select('-password');
    }

    // Delete user
    async deleteUser(id) {
        return await UserLoginReports.findByIdAndDelete(id);
    }
}

module.exports = new RbacService();