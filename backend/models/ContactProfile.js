const mongoose = require('mongoose');

const ContactProfileSchema = new mongoose.Schema({
    contact_id: String,
    demographics: {
        first_name: String,
        last_name: String,
    }
});

module.exports = mongoose.model('ContactProfile', ContactProfileSchema, 'ContactProfiles');