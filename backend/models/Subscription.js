const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
    contact_id: String,
    services: [{
        expires_on: { type: Date, required: true },
        service_id: String,
        first_activation_date: { type: Date, required: true },
        state: String,
    }],
});

module.exports = mongoose.model('Subscription', SubscriptionSchema, 'Subscriptions');