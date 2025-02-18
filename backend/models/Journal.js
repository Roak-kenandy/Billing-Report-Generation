const mongoose = require('mongoose');

const JournalSchema = new mongoose.Schema({
    contact_code: {
        type: String,
        required: true
    },
    contact_id: {
        type: String,
        required: true
    },
}, { strict: false });

module.exports = mongoose.model('Journal', JournalSchema, 'Journals');