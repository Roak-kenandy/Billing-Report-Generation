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

    // Create a new user
    async createUser(userData) {
        const user = new UserLoginReports(userData);
        return await user.save();
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