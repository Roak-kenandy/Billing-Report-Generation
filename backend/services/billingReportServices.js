const mongoose = require('mongoose');
// const Journal = require('./models/Journal');
// const ContactProfile = require('./models/ContactProfile');
// const Subscription = require('./models/Subscription');

const JournalSchema = new mongoose.Schema({
    contact_code: {
        type:String,
        required:true
    },
    contact_id: {
        type:String,
        required:true
    },
},
{ strict: false });

const ContactProfileSchema = new mongoose.Schema({
    contact_id: String,
    demographics: {
        first_name: String,
        last_name: String,
    }
});

const SubscriptionSchema = new mongoose.Schema({
    contact_id: String,
    services: [{
        expires_on: { type: Date, required: true },
        service_id: String,
        first_activation_date: { type: Date, required: true },
        state: String,
    }],
});

// Define the models
const Journal = mongoose.model('Journal', JournalSchema, 'Journals');
const ContactProfile = mongoose.model('ContactProfile', ContactProfileSchema, 'ContactProfiles');
const Subscription = mongoose.model('Subscription', SubscriptionSchema, 'Subscriptions');

const getReports = async (page, limit) => {
    try {

        // Calculate skip value for pagination
        const skip = (page - 1) * limit;

        // Fetch data from the MongoDB collections with pagination
        const journals = await Journal.find({}, { contact_code: 1, contact_id: 1, _id: 0 })
            .skip(skip)
            .limit(limit);

        const contactProfiles = await ContactProfile.find({}, { contact_id: 1, 'demographics.first_name': 1, 'demographics.last_name': 1, _id: 0 });
        const subscriptions = await Subscription.find({}, { contact_id: 1, services: 1, _id: 0 });

        // Map data to the desired format
        const reports = journals.map(journal => {
            const contactProfile = contactProfiles.find(profile => profile.contact_id === journal.contact_id);
            const subscription = subscriptions.find(sub => sub.contact_id === journal.contact_id);

            return {
                id: journal.contact_code,
                Name: contactProfile ? `${contactProfile.demographics.first_name} ${contactProfile.demographics.last_name}` : 'N/A',
                'Active Packages': subscription ? subscription.services : [],
            };
        });

        // Get the total count of documents for pagination metadata
        const total = await Journal.countDocuments();

        return {
            message: 'Billing Reports Data',
            data: reports,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    } catch (err) {
        console.log('Error occurred while fetching!!', err);
        throw err; // Rethrow the error to be handled by the controller
    }
};

module.exports = {
    getReports
}