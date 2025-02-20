const mongoose = require('mongoose');
const { Transform } = require('stream');

// Journal Schema
const JournalSchema = new mongoose.Schema({
    contact_code: {
        type: String,
        required: true,
        index: true,
    },
    contact_id: {
        type: String,
        required: true,
        index: true,
    },
}, { strict: false });

// ContactProfile Schema
const ContactProfileSchema = new mongoose.Schema({
    contact_id: {
        type: String,
        index: true,
    },
    demographics: {
        first_name: {
            type: String,
            index: true,
        },
        last_name: String,
    }
});

// Subscription Schema
const SubscriptionSchema = new mongoose.Schema({
    contact_id: {
        type: String,
        index: true,
    },
    services: [{
        expires_on: { type: Date, required: true },
        service_id: String,
        first_activation_date: { type: Date, required: true },
        state: String,
    }],
});

// Define the models
const Journal = mongoose.model('Journal', JournalSchema, 'Journals');

const getReports = async (page, limit, search = '') => {
    try {
        const skip = (page - 1) * limit;
        const query = search ? { $or: [
            { contact_code: { $regex: search, $options: 'i' } },
            { 'demographics.first_name': { $regex: search, $options: 'i' } }
        ]} : {};

        const aggregationPipeline = [
            { $match: query },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: "ContactProfiles",
                    localField: "contact_id",
                    foreignField: "contact_id",
                    as: "contactProfile"
                }
            },
            {
                $lookup: {
                    from: "Subscriptions",
                    localField: "contact_id",
                    foreignField: "contact_id",
                    as: "subscription"
                }
            },
            // Early Projection
            { $project: {
                contact_code: 1,
                contactProfile: 1,
                subscription: 1
            } },

            // Calculate servicesCount, expiresDates, and other fields
            { $addFields: {
                firstName: { $ifNull: [{ $arrayElemAt: ["$contactProfile.demographics.first_name", 0] }, "N"] },
                lastName: { $ifNull: [{ $arrayElemAt: ["$contactProfile.demographics.last_name", 0] }, "/A"] },
                servicesCount: { $size: "$subscription.services" },
                expiresDates: {
                    $reduce: {
                        input: "$subscription.services",
                        initialValue: [],
                        in: {
                            $concatArrays: [
                                "$$value",
                                [
                                    {
                                        $dateToString: {
                                            format: "%d/%m/%Y",
                                            date: {
                                                $toDate: {
                                                    $multiply: [
                                                        {
                                                            $ifNull: [
                                                                // "$$this.expires_on",
                                                                // "$$this.latest_not_effective_date"
                                                                { $arrayElemAt: ["$$this.expires_on", 0] },
                                                                { $arrayElemAt: ["$$this.latest_not_effective_date", 0] }
                                                            ]
                                                        },
                                                        1000
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                ]
                            ]
                        }
                    }
                },
                packageNames: "$subscription.services.product.name",
                packageStates: "$subscription.services.state"
            } },

            // Deduplication Group
            { $group: {
                _id: {
                    contactCode: "$contact_code",
                    firstName: "$firstName",
                    lastName: "$lastName"
                },
                servicesCount: { $first: "$servicesCount" }, // Use the pre-calculated count
                expiresDates: { $addToSet: "$expiresDates" },
                packageNames: { $addToSet: "$packageNames" },
                packageStates: { $addToSet: "$packageStates" }
            } },

            // Final Projection
            { $project: {
                _id: 0,
                contactCode: "$_id.contactCode",
                fullName: { $concat: ["$_id.firstName", " ", "$_id.lastName"] },
                servicesCount: 1,
                expiresDates: 1,
                packageNames: 1,
                packageStates: 1
            } }
        ];

        const journals = await Journal.aggregate(aggregationPipeline);

        // Map data to the desired format
        const reports = journals.map(journal => ({
            id: journal.contactCode,
            Name: journal.fullName,
            'Active Packages': journal.servicesCount,
            'Expiry Date': [...new Set(journal.expiresDates.flat())].join(', '),
            'Package Names': [...new Set(journal.packageNames.flat())].join(', '),
            'Package States': [...new Set(journal.packageStates.flat())].join(', ')
        }));

        // Get the total count of documents for pagination metadata
        const total = await Journal.countDocuments(query);

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
        throw err;
    }
};


// const getReports = async (page, limit, search = '') => {
//     try {
//         const skip = (page - 1) * limit;
//         const query = search ? { $or: [
//             { contact_code: { $regex: search, $options: 'i' } },
//             { 'demographics.first_name': { $regex: search, $options: 'i' } }
//         ]} : {};

//         const aggregationPipeline = [
//             { $match: query },
//             { $skip: skip },
//             { $limit: limit },
//             {
//                 $lookup: {
//                     from: "ContactProfiles",
//                     localField: "contact_id",
//                     foreignField: "contact_id",
//                     as: "contactProfile"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "Subscriptions",
//                     localField: "contact_id",
//                     foreignField: "contact_id",
//                     as: "subscription"
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     contact_code: 1,
//                     "contactProfile.demographics.first_name": 1,
//                     "contactProfile.demographics.last_name": 1,
//                     "subscription.services": 1
//                 }
//             }
//         ];

//         const journals = await Journal.aggregate(aggregationPipeline);

//         // Map data to the desired format
//         const reports = journals.map(journal => ({
//             id: journal.contact_code,
//             Name: journal.contactProfile[0]?.demographics
//                 ? `${journal.contactProfile[0].demographics.first_name} ${journal.contactProfile[0].demographics.last_name}`
//                 : 'N/A',
//             'Active Packages': journal.subscription[0]?.services || []
//         }));

//         // Get the total count of documents for pagination metadata
//         const total = await Journal.countDocuments(query);

//         return {
//             message: 'Billing Reports Data',
//             data: reports,
//             pagination: {
//                 total,
//                 page,
//                 limit,
//                 totalPages: Math.ceil(total / limit),
//             },
//         };
//     } catch (err) {
//         console.log('Error occurred while fetching!!', err);
//         throw err;
//     }
// };






// const exportReports = async (search = '') => {
//     try {
//         const query = search ? {
//             $or: [
//                 { contact_code: { $regex: search, $options: 'i' } },
//                 { 'demographics.first_name': { $regex: search, $options: 'i' } }
//             ]
//         } : {};

//         const aggregationPipeline = [
//             { $match: query },
//             {
//                 $lookup: {
//                     from: "ContactProfiles",
//                     localField: "contact_id",
//                     foreignField: "contact_id",
//                     as: "contactProfile"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "Subscriptions",
//                     localField: "contact_id",
//                     foreignField: "contact_id",
//                     as: "subscription"
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     contact_code: 1,
//                     "contactProfile.demographics.first_name": 1,
//                     "contactProfile.demographics.last_name": 1,
//                     "subscription.services": 1
//                 }
//             }
//         ];

//         const journals = await Journal.aggregate(aggregationPipeline);
//         console.log(journals,'journal neededed');

//         // Map to store unique records
//         const uniqueRecords = new Map();

//         journals.forEach(journal => {
//             const contactCode = journal.contact_code || '';
//             const firstName = journal.contactProfile[0]?.demographics?.first_name || 'N';
//             const lastName = journal.contactProfile[0]?.demographics?.last_name || '/A';

//             const services = journal.subscription[0]?.services?.length || 0;

//             const expiresDate = [...new Set(
//                 (journal.subscription[0]?.services || []).map(pkg =>
//                     pkg.expires_on ? new Date(pkg.expires_on * 1000).toLocaleDateString('en-GB') : ''
//                 )
//             )].join(', ');

//             const packageNames = [...new Set(
//                 (journal.subscription[0]?.services || []).map(pkg => pkg.product?.name)
//             )].join(', ');

//             const packageStates = [...new Set(
//                 (journal.subscription[0]?.services || []).map(pkg => pkg.state)
//             )].join(', ');

//             // Unique key to identify a row
//             const recordKey = `${contactCode}-${firstName}-${lastName}-${services}-${expiresDate}-${packageNames}-${packageStates}`;

//             if (!uniqueRecords.has(recordKey)) {
//                 uniqueRecords.set(recordKey, `"${contactCode}","${firstName} ${lastName}","${services}","${expiresDate}","${packageNames}","${packageStates}"`);
//             }
//         });

//         const csvHeaders = 'ID,Name,Active Packages,Expiry Date,Package Names,Package States\n';
//         return csvHeaders + [...uniqueRecords.values()].join('\n');

//     } catch (err) {
//         console.log('Error occurred during CSV export!!', err);
//         throw err;
//     }
// };

const exportReports = async (search = '') => {
    try {
        const aggregationPipeline = [
            { $match: search ? {
                $or: [
                    { contact_code: new RegExp(search, 'i') },
                    { 'demographics.first_name': new RegExp(search, 'i') }
                ]
            } : {} },
            
            // Parallel Lookups
            {
                $lookup: {
                    from: "ContactProfiles",
                    let: { contactId: "$contact_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$contact_id", "$$contactId"] } } },
                        { $project: { 
                            "demographics.first_name": 1,
                            "demographics.last_name": 1 
                        } }
                    ],
                    as: "contactProfile"
                }
            },
            {
                $lookup: {
                    from: "Subscriptions",
                    let: { contactId: "$contact_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$contact_id", "$$contactId"] } } },
                        { $unwind: "$services" },
                        { $project: {
                            "services.expires_on": 1,
                            "services.latest_not_effective_date": 1,
                            "services.product.name": 1,
                            "services.state": 1
                        } }
                    ],
                    as: "subscriptionServices"
                }
            },

            // Early Projection
            { $project: {
                contact_code: 1,
                contactProfile: 1,
                subscriptionServices: 1
            } },

            // Calculate servicesCount HERE
            { $addFields: {
                firstName: { $ifNull: [{ $arrayElemAt: ["$contactProfile.demographics.first_name", 0] }, "N"] },
                lastName: { $ifNull: [{ $arrayElemAt: ["$contactProfile.demographics.last_name", 0] }, "/A"] },
                servicesCount: { $size: "$subscriptionServices" },
                expiresDates: {
                    $reduce: {
                        input: "$subscriptionServices.services",
                        initialValue: [],
                        in: {
                            $concatArrays: [
                                "$$value",
                                [
                                    {
                                        $dateToString: {
                                            format: "%d/%m/%Y",
                                            date: {
                                                $toDate: {
                                                    $multiply: [
                                                        {
                                                            $ifNull: [
                                                                "$$this.expires_on",
                                                                "$$this.latest_not_effective_date"
                                                            ]
                                                        },
                                                        1000
                                                    ]
                                                }
                                            }
                                        }
                                    }
                                ]
                            ]
                        }
                    }
                },
                packageNames: "$subscriptionServices.services.product.name",
                packageStates: "$subscriptionServices.services.state"
            } },

            // Deduplication Group
            { $group: {
                _id: {
                    contactCode: "$contact_code",
                    firstName: "$firstName",
                    lastName: "$lastName"
                },
                servicesCount: { $first: "$servicesCount" }, // Use the pre-calculated count
                expiresDates: { $addToSet: "$expiresDates" },
                packageNames: { $addToSet: "$packageNames" },
                packageStates: { $addToSet: "$packageStates" }
            } },

            // Final Projection
            { $project: {
                _id: 0,
                contactCode: "$_id.contactCode",
                fullName: { $concat: ["$_id.firstName", " ", "$_id.lastName"] },
                servicesCount: 1,
                expiresDates: 1,
                packageNames: 1,
                packageStates: 1
            } }
        ];

        const cursor = Journal.aggregate(aggregationPipeline).cursor({ batchSize: 1000 });
        let csvContent = 'ID,Name,Active Packages,Expiry Date,Package Names,Package States\n';

        for await (const doc of cursor) {
            const uniqueExpires = [...new Set(doc.expiresDates.flat())].join(', ');
            const uniqueNames = [...new Set(doc.packageNames.flat())].join(', ');
            const uniqueStates = [...new Set(doc.packageStates.flat())].join(', ');

            csvContent += `"=""${doc.contactCode}""","${doc.fullName}","${doc.servicesCount}","${uniqueExpires}","${uniqueNames}","${uniqueStates}"\n`;
        }

        return csvContent;

    } catch (err) {
        console.error('Error during CSV export:', err);
        throw err;
    }
};


// const getAllReports = async (search = '') => {
//     try {
//         const query = search ? { $or: [
//             { contact_code: { $regex: search, $options: 'i' } },
//             { 'demographics.first_name': { $regex: search, $options: 'i' } }
//         ]} : {};

//         const aggregationPipeline = [
//             { $match: query },
//             {
//                 $lookup: {
//                     from: "ContactProfiles",
//                     localField: "contact_id",
//                     foreignField: "contact_id",
//                     as: "contactProfile"
//                 }
//             },
//             {
//                 $lookup: {
//                     from: "Subscriptions",
//                     localField: "contact_id",
//                     foreignField: "contact_id",
//                     as: "subscription"
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     contact_code: 1,
//                     "contactProfile.demographics.first_name": 1,
//                     "contactProfile.demographics.last_name": 1,
//                     "subscription.services": 1
//                 }
//             }
//         ];

//         const cursor = Journal.aggregate(aggregationPipeline).cursor({ batchSize: 1000 });

//         const transformStream = new Transform({
//             objectMode: true,
//             transform: (journal, encoding, callback) => {
//                 try {
//                     const report = {
//                         ID: journal.contact_code,
//                         Name: journal.contactProfile[0]?.demographics 
//                             ? `${journal.contactProfile[0].demographics.first_name} ${journal.contactProfile[0].demographics.last_name}`
//                             : 'N/A',
//                         'Active Packages': journal.subscription[0]?.services || [],
//                         'First Activation Date': journal.subscription[0]?.services.map(pkg =>
//                             new Date(pkg.first_activation_date * 1000).toLocaleDateString('en-GB', {
//                                 year: 'numeric',
//                                 month: '2-digit',
//                                 day: '2-digit',
//                             })
//                         ).join(', '),
//                         'Package Names': journal.subscription[0]?.services.map(pkg => pkg.product?.name).join(', '),
//                         'Package States': journal.subscription[0]?.services.map(pkg => pkg.state).join(', '),
//                     };
//                     callback(null, JSON.stringify(report));
//                 } catch (err) {
//                     callback(err);
//                 }
//             }
//         });

//         return cursor.pipe(transformStream);
//     } catch (err) {
//         console.error('Error occurred while fetching all reports!!', err);
//         throw err;
//     }
// };

module.exports = {
    getReports,
    exportReports
    
}