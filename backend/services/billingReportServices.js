const mongoose = require('mongoose');
const { parse } = require('json2csv');

// const getReports = async (page, limit, search = '', startDate, endDate, atoll, island) => {
//     try {
//         const skip = (page - 1) * limit;

//         console.log(startDate, endDate, 'dates for the reports');

//         // Date filter
//         let dateFilter = {};
//         if (startDate || endDate) {
//             const elemMatchConditions = {};
//             if (startDate) {
//                 const startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
//                 elemMatchConditions['service_terms.start_date'] = { $gte: startTimestamp };
//             }
//             if (endDate) {
//                 const endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);
//                 elemMatchConditions['service_terms.end_date'] = { $lte: endTimestamp };
//             }
//             dateFilter.services = { $elemMatch: elemMatchConditions };
//         }

//         console.log(dateFilter, 'date filter');

//         // Match stage for search, atoll, and island
//         let matchStage = { ...dateFilter };

//         // Add search filter
//         if (search) {
//             matchStage.$text = { $search: search };
//         }

//         // Add Atoll filter
//         if (atoll) {
//             matchStage['joinedData2.location.province'] = atoll;
//         }

//         // Add Island filter
//         if (island) {
//             matchStage['joinedData2.location.city'] = island;
//         }

//         console.log(matchStage, 'match stage');

//         const aggregationPipeline = [
//             // { $match: matchStage },
//             // { $skip: skip },
//             // { $limit: limit },
//             {
//                 $lookup: {
//                     from: 'ContactProfiles',
//                     localField: 'contact_id',
//                     foreignField: 'contact_id',
//                     as: 'joinedData2',
//                 }
//             },
//             {
//                 $match: {
//                   ...dateFilter,  // Keep date filters
//                   ...(search && { $text: { $search: search } }),  // Search filter
//                   ...(atoll && { "joinedData2.location.province": atoll }),  // Atoll filter
//                   ...(island && { "joinedData2.location.city": island }),     // Island filter
//                 }
//               },
//               { $skip: skip },
//               { $limit: limit },
//             {
//                 $lookup: {
//                     from: 'Devices',
//                     localField: 'contact_id',
//                     foreignField: 'ownership.id',
//                     as: 'joinedData3',
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'Orders',
//                     localField: 'contact_id',
//                     foreignField: 'contact_id',
//                     as: 'ordersData',
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'Journals',
//                     localField: 'contact_id',
//                     foreignField: 'contact_id',
//                     as: 'joinedData4',
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     "Submitted By User": "$submited_by_user_name",
//                     "Contact Code": {
//                         $concat: [{ $toString: { $arrayElemAt: ['$joinedData4.contact_code', 0] } }]
//                     },
//                     "Device Code": {
//                         $cond: {
//                             if: {
//                                 $eq: [
//                                     { $type: '$joinedData3.custom_fields.value' },
//                                     'array',
//                                 ]
//                             },
//                             then: {
//                                 $arrayElemAt: [
//                                     { $arrayElemAt: ['$joinedData3.custom_fields.value', 0] },
//                                     0
//                                 ]
//                             },
//                             else: '$joinedData3.custom_fields.value',
//                         }
//                     },
//                     "Customer Name": {
//                         $arrayElemAt: [
//                             '$joinedData2.profile.name',
//                             0
//                         ]
//                     },
//                     "Customer Type": {
//                         $arrayElemAt: [
//                             '$joinedData2.profile.type',
//                             0
//                         ]
//                     },
//                     "Customer Type 2": {
//                         $cond: {
//                             if: {
//                                 $or: [
//                                     {
//                                         $not: {
//                                             $isArray: '$joinedData2.company_profile.industry_name'
//                                         }
//                                     },
//                                     {
//                                         $eq: [
//                                             {
//                                                 $size: {
//                                                     $ifNull: [
//                                                         '$joinedData2.company_profile.industry_name',
//                                                         []
//                                                     ]
//                                                 }
//                                             },
//                                             0
//                                         ]
//                                     }
//                                 ]
//                             },
//                             then: 'N/A',
//                             else: {
//                                 $arrayElemAt: [
//                                     '$joinedData2.company_profile.industry_name',
//                                     0
//                                 ]
//                             }
//                         }
//                     },
//                     "Payment Type": {
//                         $cond: {
//                             if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
//                             then: 'QuickPay',
//                             else: { $arrayElemAt: ['$ordersData.payment_method.type', 0] }
//                         }
//                     },
//                     "Sales Model": {
//                         $arrayElemAt: [
//                             '$joinedData2.sales_model.name',
//                             0
//                         ]
//                     },
//                     Area: {
//                         $cond: {
//                             if: {
//                                 $eq: [
//                                     { $type: '$joinedData2.tags.name' },
//                                     'array',
//                                 ]
//                             },
//                             then: {
//                                 $arrayElemAt: [
//                                     { $arrayElemAt: ['$joinedData2.tags.name', 0] },
//                                     0
//                                 ]
//                             },
//                             else: '$joinedData2.tags.name',
//                         }
//                     },
//                     "Dealer": {
//                         $cond: {
//                             if: {
//                                 $eq: [
//                                     { $type: '$joinedData2.custom_fields.value_label' },
//                                     'array',
//                                 ]
//                             },
//                             then: {
//                                 $arrayElemAt: [
//                                     { $arrayElemAt: ['$joinedData2.custom_fields.value_label', 0] },
//                                     0
//                                 ]
//                             },
//                             else: '$joinedData2.custom_fields.value_label',
//                         }
//                     },
//                     Mobile: {
//                         $arrayElemAt: ['$joinedData2.phone', 0]
//                     },
//                     Ward: {
//                         $arrayElemAt: [
//                             '$joinedData2.location.address_line1',
//                             0
//                         ]
//                     },
//                     Road: {
//                         $arrayElemAt: [
//                             '$joinedData2.location.address_line2',
//                             0
//                         ]
//                     },
//                     Island: {
//                         $arrayElemAt: [
//                             '$joinedData2.location.city',
//                             0
//                         ]
//                     },
//                     Atoll: {
//                         $arrayElemAt: [
//                             '$joinedData2.location.province',
//                             0
//                         ]
//                     },
//                     STB: {
//                         $arrayElemAt: [
//                             '$joinedData3.product.name',
//                             0
//                         ]
//                     },
//                     Status: {
//                         $arrayElemAt: [
//                             '$services.state',
//                             0
//                         ]
//                     },
//                     Package: {
//                         $arrayElemAt: [
//                             '$services.product.name',
//                             0
//                         ]
//                     },
//                     Price: {
//                         $round: [
//                             { $toDouble: { $arrayElemAt: ['$services.price_terms.price', 0] } }, 2
//                         ]
//                     },
//                     "Start Date": {
//                         $dateToString: {
//                             format: "%d-%b-%Y",
//                             date: {
//                                 $toDate: {
//                                     $multiply: [
//                                         { $toLong: { $arrayElemAt: ['$services.service_terms.start_date', 0] } },
//                                         1000
//                                     ]
//                                 }
//                             }
//                         }
//                     },
//                     "End Date": {
//                         $dateToString: {
//                             format: "%d-%b-%Y",
//                             date: {
//                                 $toDate: {
//                                     $multiply: [
//                                         { $toLong: { $arrayElemAt: ['$services.service_terms.end_date', 0] } },
//                                         1000
//                                     ]
//                                 }
//                             }
//                         }
//                     }
//                 }
//             }
//         ];

//         // Fetch data using aggregation
//         const results = await mongoose.connection.db.collection('Subscriptions').aggregate(aggregationPipeline, { maxTimeMS: 600000, allowDiskUse: true }).toArray();
//         console.log(results.length,'length of all')

//         // Get the total count of documents for pagination metadata
//         const total = await mongoose.connection.db.collection('Subscriptions').countDocuments(matchStage);

//         return {
//             message: 'Billing Reports Data',
//             data: results,
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


const getReports = async (page, limit, search = '', startDate, endDate, atoll, island) => {
    try {
        const skip = (page - 1) * limit;

        // Calculate timestamps for date filtering
        let startTimestamp, endTimestamp;
        if (startDate) {
            startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
        }
        if (endDate) {
            endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);
        }

        // Date filter for initial match (subscriptions with at least one matching service)
        let dateFilter = {};
        if (startDate || endDate) {
            const elemMatchConditions = {};
            if (startDate) {
                elemMatchConditions['service_terms.start_date'] = { $gte: startTimestamp };
            }
            if (endDate) {
                elemMatchConditions['service_terms.end_date'] = { $lte: endTimestamp };
            }
            dateFilter.services = { $elemMatch: elemMatchConditions };
        }

        // Date filter for individual services after unwind
        let serviceDateFilter = {};
        if (startDate) {
            serviceDateFilter["services.service_terms.start_date"] = { $gte: startTimestamp };
        }
        if (endDate) {
            serviceDateFilter["services.service_terms.end_date"] = { $lte: endTimestamp };
        }

        // Match stage for search, atoll, and island
        let matchStage = { ...dateFilter };

        if (search) {
            matchStage.$text = { $search: search };
        }

        if (atoll) {
            matchStage['joinedData2.location.province'] = atoll;
        }

        if (island) {
            matchStage['joinedData2.location.city'] = island;
        }

        const aggregationPipeline = [
            {
                $lookup: {
                    from: 'ContactProfiles',
                    localField: 'contact_id',
                    foreignField: 'contact_id',
                    as: 'joinedData2',
                }
            },
            { $match: matchStage },
            { $unwind: "$services" },
            { $match: serviceDateFilter },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'Devices',
                    localField: 'contact_id',
                    foreignField: 'ownership.id',
                    as: 'joinedData3',
                }
            },
            {
                $lookup: {
                    from: 'Orders',
                    localField: 'contact_id',
                    foreignField: 'contact_id',
                    as: 'ordersData',
                }
            },
            {
                $lookup: {
                    from: 'Journals',
                    localField: 'contact_id',
                    foreignField: 'contact_id',
                    as: 'joinedData4',
                }
            },
            {
                $project: {
                    _id: 0,
                    "Submitted By User": "$submited_by_user_name",
                    "Contact Code": {
                        $concat: [{ $toString: { $arrayElemAt: ['$joinedData4.contact_code', 0] } }]
                    },
                    "Device Code": {
                        $cond: {
                            if: { $eq: [{ $type: '$joinedData3.custom_fields.value' }, 'array'] },
                            then: { $arrayElemAt: [{ $arrayElemAt: ['$joinedData3.custom_fields.value', 0] }, 0] },
                            else: '$joinedData3.custom_fields.value',
                        }
                    },
                    "Customer Name": { $arrayElemAt: ['$joinedData2.profile.name', 0] },
                    "Customer Type": { $arrayElemAt: ['$joinedData2.profile.type', 0] },
                    "Customer Type 2": {
                        $cond: {
                            if: {
                                $or: [
                                    { $not: { $isArray: '$joinedData2.company_profile.industry_name' } },
                                    { $eq: [{ $size: { $ifNull: ['$joinedData2.company_profile.industry_name', []] } }, 0] }
                                ]
                            },
                            then: 'N/A',
                            else: { $arrayElemAt: ['$joinedData2.company_profile.industry_name', 0] }
                        }
                    },
                    "Payment Type": {
                        $cond: {
                            if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
                            then: 'QuickPay',
                            else: { $arrayElemAt: ['$ordersData.payment_method.type', 0] }
                        }
                    },
                    "Sales Model": { $arrayElemAt: ['$joinedData2.sales_model.name', 0] },
                    Area: {
                        $cond: {
                            if: { $eq: [{ $type: '$joinedData2.tags.name' }, 'array'] },
                            then: { $arrayElemAt: [{ $arrayElemAt: ['$joinedData2.tags.name', 0] }, 0] },
                            else: '$joinedData2.tags.name',
                        }
                    },
                    "Dealer": {
                        $cond: {
                            if: { $eq: [{ $type: '$joinedData2.custom_fields.value_label' }, 'array'] },
                            then: { $arrayElemAt: [{ $arrayElemAt: ['$joinedData2.custom_fields.value_label', 0] }, 0] },
                            else: '$joinedData2.custom_fields.value_label',
                        }
                    },
                    Mobile: { $arrayElemAt: ['$joinedData2.phone', 0] },
                    Ward: { $arrayElemAt: ['$joinedData2.location.address_line1', 0] },
                    Road: { $arrayElemAt: ['$joinedData2.location.address_line2', 0] },
                    Island: { $arrayElemAt: ['$joinedData2.location.city', 0] },
                    Atoll: { $arrayElemAt: ['$joinedData2.location.province', 0] },
                    STB: { $arrayElemAt: ['$joinedData3.product.name', 0] },
                    Status: "$services.state", // Direct access after unwind
                    Package: "$services.product.name",
                    Price: { $round: [{ $toDouble: "$services.price_terms.price" }, 2] },
                    "Start Date": {
                        $dateToString: {
                            format: "%d-%b-%Y",
                            date: { $toDate: { $multiply: [{ $toLong: "$services.service_terms.start_date" }, 1000] } }
                        }
                    },
                    "End Date": {
                        $dateToString: {
                            format: "%d-%b-%Y",
                            date: { $toDate: { $multiply: [{ $toLong: "$services.service_terms.end_date" }, 1000] } }
                        }
                    }
                }
            }
        ];

        // Fetch paginated results
        const results = await mongoose.connection.db.collection('Subscriptions').aggregate(aggregationPipeline, { maxTimeMS: 600000, allowDiskUse: true }).toArray();

        // Calculate total count of matching services
        const countPipeline = [
            {
                $lookup: {
                    from: 'ContactProfiles',
                    localField: 'contact_id',
                    foreignField: 'contact_id',
                    as: 'joinedData2',
                }
            },
            { $match: matchStage },
            { $unwind: "$services" },
            { $match: serviceDateFilter },
            { $count: "total" }
        ];

        const totalResult = await mongoose.connection.db.collection('Subscriptions').aggregate(countPipeline).toArray();
        const total = totalResult.length > 0 ? totalResult[0].total : 0;

        return {
            message: 'Billing Reports Data',
            data: results,
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

const getMetrics = async () => {
    try {

        const aggregationPipeline = [
            {
                $lookup: {
                    from: 'ContactProfiles',
                    localField: 'contact_id',
                    foreignField: 'contact_id',
                    as: 'joinedData2',
                }
            },
            { $unwind: "$services" },
            {
                $group: {
                    _id: null,
                    totalSubscriptions: { $sum: 1 },
                    activeSubscriptions: {
                        $sum: { $cond: [{ $eq: ["$services.state", "EFFECTIVE"] }, 1, 0] }
                    },
                    totalRevenue: {
                        $sum: {
                            $cond: [
                                { $in: ["$services.state", ["EFFECTIVE", "NOT_EFFECTIVE"]] },
                                { $toDouble: "$services.price_terms.price" },
                                0
                            ]
                        }
                    }
                    // totalRevenue: {
                    //     $sum: {
                    //         $cond: [
                    //             { $eq: ["$services.state", "EFFECTIVE"] },
                    //             { $toDouble: "$services.price_terms.price" },
                    //             0
                    //         ]
                    //     }
                    // }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalSubscriptions: 1,
                    activeSubscriptions: 1,
                    totalRevenue: { $round: ["$totalRevenue", 2] }
                }
            }
        ];

        const result = await mongoose.connection.db.collection('Subscriptions')
            .aggregate(aggregationPipeline)
            .next();

        return result || {
            totalSubscriptions: 0,
            activeSubscriptions: 0,
            totalRevenue: 0
        }


    }
    catch (err) {
        console.log('Error occurred in metrics', err)
    }
}

const getPackageDistribution = async () => {
    try {

        const aggregationPipeline = [
            {
                $lookup: {
                    from: 'ContactProfiles',
                    localField: 'contact_id',
                    foreignField: 'contact_id',
                    as: 'joinedData2',
                }
            },
            { $unwind: "$services" },
            {
                $group: {
                    _id: "$services.product.name",
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: "$_id",
                    value: "$count"
                }
            },
            { $sort: { value: -1 } }
        ];

        const results = await mongoose.connection.db.collection('Subscriptions')
            .aggregate(aggregationPipeline)
            .toArray();

        return results;
    } catch (err) {
        console.log("Error occured in package distribution", err)
    }
}

const getAreaStats = async () => {
    try {
        const aggregationPipeline = [
            {
                $lookup: {
                    from: 'ContactProfiles',
                    localField: 'contact_id',
                    foreignField: 'contact_id',
                    as: 'joinedData2',
                }
            },
            { $unwind: "$services" },  // Unwind early to filter services
            // Group by area
            {
                $group: {
                    _id: {
                        $cond: {
                            if: { $eq: [{ $type: "$joinedData2.tags.name" }, "array"] },
                            then: { $arrayElemAt: ["$joinedData2.tags.name", 0] },
                            else: "$joinedData2.tags.name"
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            // Format output
            {
                $project: {
                    _id: 0,
                    area: {
                        $cond: {
                            if: { $eq: [{ $type: "$_id" }, "array"] },
                            then: { $reduce: {
                                input: "$_id",
                                initialValue: "",
                                in: { $concat: ["$$value", { $cond: [{ $eq: ["$$value", ""] }, "", ", "] }, "$$this"] }
                            }},
                            else: { $ifNull: ["$_id", "N/A"] }
                        }
                    },
                    count: 1
                }
            }
        ];

        const results = await mongoose.connection.db.collection('Subscriptions')
            .aggregate(aggregationPipeline, { allowDiskUse: true })
            .toArray();

        return {
            message: 'Area-wise Statistics',
            data: results
        };
    } catch (err) {
        console.log('Error fetching area stats:', err);
        throw err;
    }
};




// const exportReports = async (search,startDate,endDate, atoll, island) => {
//     try {

//         console.log(startDate,endDate,'dates for the export')

//         // Date filter
//         let dateFilter = {};
//         if (startDate || endDate) {
//             const elemMatchConditions = {};
//             if (startDate) {
//                 const startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
//                 elemMatchConditions['service_terms.start_date'] = { $gte: startTimestamp };
//             }
//             if (endDate) {
//                 const endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);
//                 elemMatchConditions['service_terms.end_date'] = { $lte: endTimestamp };
//             }
//             dateFilter.services = { $elemMatch: elemMatchConditions };
//         }

//         console.log(dateFilter, 'date filter');

//         // Match stage for search, atoll, and island
//         let matchStage = { ...dateFilter };

//         // Add search filter
//         if (search) {
//             matchStage.$text = { $search: search };
//         }

//         // Add Atoll filter
//         if (atoll) {
//             matchStage['joinedData2.location.province'] = atoll;
//         }

//         // Add Island filter
//         if (island) {
//             matchStage['joinedData2.location.city'] = island;
//         }
//         // Prepare your aggregation query
//         const aggregationQuery = [
//             // { $match: matchStage },
//             {
//                 $lookup: {
//                     from: 'ContactProfiles',
//                     localField: 'contact_id',
//                     foreignField: 'contact_id',
//                     as: 'joinedData2',
//                 }
//             },
//             {$match: {
//                 ...dateFilter,  // Keep date filters
//                 ...(search && { $text: { $search: search } }),  // Search filter
//                 ...(atoll && { "joinedData2.location.province": atoll }),  // Atoll filter
//                 ...(island && { "joinedData2.location.city": island }),     // Island filter
//               }
//             },
//             {
//                 $lookup: {
//                     from: 'Devices',
//                     localField: 'contact_id',
//                     foreignField: 'ownership.id',
//                     as: 'joinedData3',
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'Orders',
//                     localField: 'contact_id',
//                     foreignField: 'contact_id',
//                     as: 'ordersData',
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'Journals', // Lookup from Journals collection
//                     localField: 'contact_id',
//                     foreignField: 'contact_id',
//                     as: 'joinedData4',
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     "Contact Code": {
//                         $concat: ['"', { $toString: { $arrayElemAt: ['$joinedData4.contact_code', 0] } }, '"']
//                     },
//                     "Device Code": {
//                         $cond: {
//                             if: {
//                                 $eq: [
//                                     { $type: '$joinedData3.custom_fields.value' },
//                                     'array',
//                                 ]
//                             },
//                             then: {
//                                 $arrayElemAt: [
//                                     { $arrayElemAt: ['$joinedData3.custom_fields.value', 0] },
//                                     0
//                                 ]
//                             },
//                             else: '$joinedData3.custom_fields.value',
//                         }
//                     },
//                     "Customer Name": {
//                         $arrayElemAt: [
//                             '$joinedData2.profile.name',
//                             0
//                         ]
//                     },
//                     "Customer Type": {
//                         $arrayElemAt: [
//                             '$joinedData2.profile.type',
//                             0
//                         ]
//                     },
//                     "Customer Type 2": {
//                         $cond: {
//                             if: {
//                                 $or: [
//                                     {
//                                         $not: {
//                                             $isArray: '$joinedData2.company_profile.industry_name'
//                                         }
//                                     },
//                                     {
//                                         $eq: [
//                                             {
//                                                 $size: {
//                                                     $ifNull: [
//                                                         '$joinedData2.company_profile.industry_name',
//                                                         []
//                                                     ]
//                                                 }
//                                             },
//                                             0
//                                         ]
//                                     }
//                                 ]
//                             },
//                             then: 'N/A',
//                             else: {
//                                 $arrayElemAt: [
//                                     '$joinedData2.company_profile.industry_name',
//                                     0
//                                 ]
//                             }
//                         }
//                     },
//                     "Payment Type": {
//                         $cond: {
//                             if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
//                             then: 'QuickPay',
//                             else: { $arrayElemAt: ['$ordersData.payment_method.type', 0] }
//                         }
//                     },
//                     "Sales Model": {
//                         $arrayElemAt: [
//                             '$joinedData2.sales_model.name',
//                             0
//                         ]
//                     },
//                     "Submitted By User": "$submited_by_user_name",
//                     Area: {
//                         $cond: {
//                             if: {
//                                 $eq: [
//                                     { $type: '$joinedData2.tags.name' },
//                                     'array',
//                                 ]
//                             },
//                             then: {
//                                 $arrayElemAt: [
//                                     { $arrayElemAt: ['$joinedData2.tags.name', 0] },
//                                     0
//                                 ]
//                             },
//                             else: '$joinedData2.tags.name',
//                         }
//                     },
//                     "Dealer": {
//                         $cond: {
//                             if: {
//                                 $eq: [
//                                     { $type: '$joinedData2.custom_fields.value_label' },
//                                     'array',
//                                 ]
//                             },
//                             then: {
//                                 $arrayElemAt: [
//                                     { $arrayElemAt: ['$joinedData2.custom_fields.value_label', 0] },
//                                     0
//                                 ]
//                             },
//                             else: '$joinedData2.custom_fields.value_label',
//                         }
//                     },
//                     Mobile: {
//                         $arrayElemAt: ['$joinedData2.phone', 0]
//                     },
//                     Ward: {
//                         $arrayElemAt: [
//                             '$joinedData2.location.address_line1',
//                             0
//                         ]
//                     },
//                     Road: {
//                         $arrayElemAt: [
//                             '$joinedData2.location.address_line2',
//                             0
//                         ]
//                     },
//                     Island: {
//                         $arrayElemAt: [
//                             '$joinedData2.location.city',
//                             0
//                         ]
//                     },
//                     Atoll: {
//                         $arrayElemAt: [
//                             '$joinedData2.location.province',
//                             0
//                         ]
//                     },
//                     STB: {
//                         $arrayElemAt: [
//                             '$joinedData3.product.name',
//                             0
//                         ]
//                     },
//                     Status: {
//                         $arrayElemAt: [
//                             '$services.state',
//                             0
//                         ]
//                     },
//                     Package: {
//                         $arrayElemAt: [
//                             '$services.product.name',
//                             0
//                         ]
//                     },
//                     Price: {
//                         $round: [
//                             { $toDouble: { $arrayElemAt: ['$services.price_terms.price', 0] } }, 2
//                         ]
//                     },
//                     "Start Date": {
//                         $dateToString: {
//                             format: "%d-%b-%Y", // Example: "04-Feb-2025"
//                             date: {
//                                 $toDate: {
//                                     $multiply: [
//                                         { $toLong: { $arrayElemAt: ['$services.service_terms.start_date', 0] } },
//                                         1000
//                                     ]
//                                 }
//                             }
//                         }
//                     },
//                     "End Date": {
//                         $dateToString: {
//                             format: "%d-%b-%Y",
//                             date: {
//                                 $toDate: {
//                                     $multiply: [
//                                         { $toLong: { $arrayElemAt: ['$services.service_terms.end_date', 0] } },
//                                         1000
//                                     ]
//                                 }
//                             }
//                         }
//                     }
//                 }
//             }
//         ];

//         // Optionally, filter based on the 'search' query parameter if provided
//         if (search) {
//             aggregationQuery[0].$match = { 
//                 ...aggregationQuery[0].$match, 
//                 $text: { $search: search }
//             };
//         }

//         // Perform aggregation to fetch the data
//         const results = await mongoose.connection.db.collection('Subscriptions').aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true }).toArray();

//         // Convert the data to CSV format
//         const csvData = parse(results);

//         return csvData;

//     } catch (error) {
//         console.error('Error exporting report:', error);
//         throw new Error('Error exporting report');
//     }
// };


const exportReports = async (search, startDate, endDate, atoll, island) => {
    try {

        // Calculate timestamps for date filtering
        let startTimestamp, endTimestamp;
        if (startDate) {
            startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
        }
        if (endDate) {
            endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);
        }

        // Date filter for initial match (subscriptions with at least one matching service)
        let dateFilter = {};
        if (startDate || endDate) {
            const elemMatchConditions = {};
            if (startDate) {
                elemMatchConditions['service_terms.start_date'] = { $gte: startTimestamp };
            }
            if (endDate) {
                elemMatchConditions['service_terms.end_date'] = { $lte: endTimestamp };
            }
            dateFilter.services = { $elemMatch: elemMatchConditions };
        }

        // Date filter for individual services after unwind
        let serviceDateFilter = {};
        if (startDate) {
            serviceDateFilter["services.service_terms.start_date"] = { $gte: startTimestamp };
        }
        if (endDate) {
            serviceDateFilter["services.service_terms.end_date"] = { $lte: endTimestamp };
        }

        // Match stage for search, atoll, and island
        let matchStage = { ...dateFilter };

        if (search) {
            matchStage.$text = { $search: search };
        }

        if (atoll) {
            matchStage['joinedData2.location.province'] = atoll;
        }

        if (island) {
            matchStage['joinedData2.location.city'] = island;
        }
        // Prepare your aggregation query
        const aggregationQuery = [
            {
                $lookup: {
                    from: 'ContactProfiles',
                    localField: 'contact_id',
                    foreignField: 'contact_id',
                    as: 'joinedData2',
                }
            },
            { $match: matchStage },
            { $unwind: "$services" },
            { $match: serviceDateFilter },
            {
                $lookup: {
                    from: 'Devices',
                    localField: 'contact_id',
                    foreignField: 'ownership.id',
                    as: 'joinedData3',
                }
            },
            {
                $lookup: {
                    from: 'Orders',
                    localField: 'contact_id',
                    foreignField: 'contact_id',
                    as: 'ordersData',
                }
            },
            {
                $lookup: {
                    from: 'Journals',
                    localField: 'contact_id',
                    foreignField: 'contact_id',
                    as: 'joinedData4',
                }
            },
            {
                $project: {
                    _id: 0,
                    "Contact Code": {
                        $concat: ['"', { $toString: { $arrayElemAt: ['$joinedData4.contact_code', 0] } }, '"']
                    },
                    "Device Code": {
                        $cond: {
                            if: { $eq: [{ $type: '$joinedData3.custom_fields.value' }, 'array'] },
                            then: { $arrayElemAt: [{ $arrayElemAt: ['$joinedData3.custom_fields.value', 0] }, 0] },
                            else: '$joinedData3.custom_fields.value',
                        }
                    },
                    "Customer Name": { $arrayElemAt: ['$joinedData2.profile.name', 0] },
                    "Customer Type": { $arrayElemAt: ['$joinedData2.profile.type', 0] },
                    "Customer Type 2": {
                        $cond: {
                            if: {
                                $or: [
                                    { $not: { $isArray: '$joinedData2.company_profile.industry_name' } },
                                    { $eq: [{ $size: { $ifNull: ['$joinedData2.company_profile.industry_name', []] } }, 0] }
                                ]
                            },
                            then: 'N/A',
                            else: { $arrayElemAt: ['$joinedData2.company_profile.industry_name', 0] }
                        }
                    },
                    "Submitted By User": "$submited_by_user_name",
                    "Payment Type": {
                        $cond: {
                            if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
                            then: 'QuickPay',
                            else: { $arrayElemAt: ['$ordersData.payment_method.type', 0] }
                        }
                    },
                    "Sales Model": { $arrayElemAt: ['$joinedData2.sales_model.name', 0] },
                    Area: {
                        $cond: {
                            if: { $eq: [{ $type: '$joinedData2.tags.name' }, 'array'] },
                            then: { $arrayElemAt: [{ $arrayElemAt: ['$joinedData2.tags.name', 0] }, 0] },
                            else: '$joinedData2.tags.name',
                        }
                    },
                    "Service Provider": {
                        $cond: {
                            if: { $eq: [{ $type: '$joinedData2.custom_fields.value_label' }, 'array'] },
                            then: { $arrayElemAt: [{ $arrayElemAt: ['$joinedData2.custom_fields.value_label', 0] }, 0] },
                            else: '$joinedData2.custom_fields.value_label',
                        }
                    },
                    Mobile: { $arrayElemAt: ['$joinedData2.phone', 0] },
                    Ward: { $arrayElemAt: ['$joinedData2.location.address_line1', 0] },
                    Road: { $arrayElemAt: ['$joinedData2.location.address_line2', 0] },
                    Island: { $arrayElemAt: ['$joinedData2.location.city', 0] },
                    Atoll: { $arrayElemAt: ['$joinedData2.location.province', 0] },
                    STB: { $arrayElemAt: ['$joinedData3.product.name', 0] },
                    Status: "$services.state", // Direct access after unwind
                    Package: "$services.product.name",
                    Price: { $round: [{ $toDouble: "$services.price_terms.price" }, 2] },
                    "Start Date": {
                        $dateToString: {
                            format: "%d-%b-%Y",
                            date: { $toDate: { $multiply: [{ $toLong: "$services.service_terms.start_date" }, 1000] } }
                        }
                    },
                    "End Date": {
                        $dateToString: {
                            format: "%d-%b-%Y",
                            date: { $toDate: { $multiply: [{ $toLong: "$services.service_terms.end_date" }, 1000] } }
                        }
                    }
                }
            }
        ];

        // Optionally, filter based on the 'search' query parameter if provided
        if (search) {
            aggregationQuery[0].$match = {
                ...aggregationQuery[0].$match,
                $text: { $search: search }
            };
        }

        // Perform aggregation to fetch the data
        const results = await mongoose.connection.db.collection('Subscriptions').aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true }).toArray();

        // Convert the data to CSV format
        const csvData = parse(results);

        return csvData;

    } catch (error) {
        console.error('Error exporting report:', error);
        throw new Error('Error exporting report');
    }
};

const exportDealerReports = async () => {
    try {
        const aggregationQuery = [
            {
                $lookup: {
                    from: 'Journals',
                    localField: 'merchant_id',
                    foreignField: 'account_organisation_id',
                    as: 'joinedData2',
                    pipeline: [
                        {
                            $project: {
                                AccountType: '$account_type',
                                Amount: { $toDouble: '$amount' },
                                PostedDate: '$posted_date',
                                Account: '$account_organisation_name',
                                _id: 0
                            }
                        },
                    ]
                }
            },
            { $unwind: { path: '$joinedData2', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    "joinedData2.Dealer Name": "$merchant_name", // Use merchant_name from medianet_dealers
                    "joinedData2.Date": {
                        $dateToString: {
                            format: "%d-%m-%Y %H:%M:%S",
                            date: { $toDate: { $multiply: ["$joinedData2.PostedDate", 1000] } }
                        }
                    },
                    "joinedData2.BP Commission": { $divide: ["$joinedData2.Amount", 2.16] },
                    "joinedData2.GST": { $multiply: [{ $divide: ["$joinedData2.Amount", 2.16] }, 0.16] },
                    "joinedData2.Total TopUp Amount": "$joinedData2.Amount",
                    "joinedData2.Original Payment": {
                        $round: [
                            {
                                $add: [
                                    { $divide: ["$joinedData2.Amount", 2.16] },
                                    { $multiply: [{ $divide: ["$joinedData2.Amount", 2.16] }, 0.16] }
                                ]
                            },
                            
                        ]
                    },

                    "joinedData2.Account Type": {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$joinedData2.AccountType", "CREDIT"] }, then: "Dealer Credit Card" },
                                { case: { $eq: ["$joinedData2.AccountType", "DEBIT"] }, then: "INVOICE" }
                            ],
                            default: "UNKNOWN"
                        }
                    }
                }
            },
            { $replaceRoot: { newRoot: "$joinedData2" } },
            {
                $group: {
                    _id: {
                        Date: '$Date',
                        AccountType: '$Account Type',
                        DealerName: '$Account',
                        Amount: '$Amount',
                        BPCommission: '$BP Commission',
                        GST: '$GST',
                        OriginalPayment: '$Original Payment',
                        TotalTopUp: '$Total TopUp Amount'
                    },
                    doc: { $first: '$$ROOT' }
                }
            },
            { $replaceRoot: { newRoot: '$doc' } }
        ];

        const results = await mongoose.connection.db.collection('medianet_dealers')
            .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
            .toArray();

        // CSV configuration with explicit headers
        const csvData = parse(results, {
            fields: [
                'Date',
                'Account Type',
                'Dealer Name',
                'Original Payment',
                'Total TopUp Amount',
                'GST',
                'BP Commission',
            ]
        });

        return csvData;
    } catch (error) {
        console.log('Error exporting report:', error);
        throw new Error("Error exporting report");
    }
};



const getAtollsData = async () => {
    const aggregationQuery = [
        {
            $lookup: {
                from: 'medianet_islands',
                localField: 'atolls_id',
                foreignField: 'atolls_id',
                as: 'atollsData',
            }
        },
        { $unwind: "$atollsData" }, // Deconstruct the atollsData array
        {
            $project: {
                _id: 0,
                atolls_id: 1,
                atolls_name: 1,
                islands_id: "$atollsData.islands_id",
                islands_name: "$atollsData.islands_name"
            }
        },
        {
            $group: {
                _id: {
                    atolls_id: "$atolls_id",
                    atolls_name: "$atolls_name"
                },
                islands: {
                    $push: {
                        islands_id: "$islands_id",
                        islands_name: "$islands_name"
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                atolls_id: "$_id.atolls_id",
                atolls_name: "$_id.atolls_name",
                islands: 1
            }
        }
    ];

    const results = await mongoose.connection.db.collection('medianet_atolls').aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true }).toArray();
    return results;
};


// const fetchFutureReports = async (
//     // search = '', startDate, endDate, atoll, island
// ) => {
//     try {
//         // Calculate timestamps for date filtering
//         // let startTimestamp, endTimestamp;
//         // if (startDate) {
//         //     startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
//         // }
//         // if (endDate) {
//         //     endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);
//         // }

//         // // Date filter for initial match (subscriptions with at least one matching service)
//         // let dateFilter = {};
//         // if (startDate || endDate) {
//         //     const elemMatchConditions = {};
//         //     if (startDate) {
//         //         elemMatchConditions['service_terms.start_date'] = { $gte: startTimestamp };
//         //     }
//         //     if (endDate) {
//         //         elemMatchConditions['service_terms.end_date'] = { $lte: endTimestamp };
//         //     }
//         //     dateFilter.services = { $elemMatch: elemMatchConditions };
//         // }

//         // // Date filter for individual services after unwind
//         // let serviceDateFilter = {};
//         // if (startDate) {
//         //     serviceDateFilter["services.service_terms.start_date"] = { $gte: startTimestamp };
//         // }
//         // if (endDate) {
//         //     serviceDateFilter["services.service_terms.end_date"] = { $lte: endTimestamp };
//         // }

//         // // Match stage for search, atoll, and island
//         // let matchStage = { ...dateFilter };

//         // if (search) {
//         //     matchStage.$text = { $search: search };
//         // }

//         // if (atoll) {
//         //     matchStage['joinedData2.location.province'] = atoll;
//         // }

//         // if (island) {
//         //     matchStage['joinedData2.location.city'] = island;
//         // }

//         const aggregationPipeline = [
//             {
//                 $lookup: {
//                     from: 'ContactProfiles',
//                     localField: 'contact_id',
//                     foreignField: 'contact_id',
//                     as: 'joinedData2',
//                 }
//             },
//             // { $match: matchStage },
//             { $unwind: "$services" },
//             // { $match: serviceDateFilter },
//             {
//                 $lookup: {
//                     from: 'Devices',
//                     localField: 'contact_id',
//                     foreignField: 'ownership.id',
//                     as: 'joinedData3',
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'Orders',
//                     localField: 'contact_id',
//                     foreignField: 'contact_id',
//                     as: 'ordersData',
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'Journals',
//                     localField: 'contact_id',
//                     foreignField: 'contact_id',
//                     as: 'joinedData4',
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     "Area": {
//                         $cond: {
//                             if: { $eq: [{ $type: '$joinedData2.tags.name' }, 'array'] },
//                             then: { $arrayElemAt: [{ $arrayElemAt: ['$joinedData2.tags.name', 0] }, 0] },
//                             else: '$joinedData2.tags.name',
//                         }
//                     },
//                     "Customer Name": { $arrayElemAt: ['$joinedData2.profile.name', 0] },
//                     "Dealer": {
//                         $cond: {
//                             if: { $eq: [{ $type: '$joinedData2.custom_fields.value_label' }, 'array'] },
//                             then: { $arrayElemAt: [{ $arrayElemAt: ['$joinedData2.custom_fields.value_label', 0] }, 0] },
//                             else: '$joinedData2.custom_fields.value_label',
//                         }
//                     },
//                     "Sales Model": { $arrayElemAt: ['$joinedData2.sales_model.name', 0] },
//                     "Price": { $round: [{ $toDouble: "$services.price_terms.price" }, 2] },
//                     "start_date_timestamp": { $toLong: "$services.service_terms.start_date" },
//                     "end_date_timestamp": { $toLong: "$services.service_terms.end_date" },
//                 }
//             },
//             { $match: { "Area": "City Hotel" } },
//             {
//                 $group: {
//                     _id: "$Customer Name",
//                     dealer: { $first: "$Dealer" },
//                     salesModel: { $first: "$Sales Model" },
//                     totalPrice: { $sum: "$Price" },
//                     subscriptionCount: { $sum: 1 },
//                     minStartDate: { $min: "$start_date_timestamp" },
//                     maxEndDate: { $max: "$end_date_timestamp" }
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     "Customer Name": "$_id",
//                     "Dealer": "$dealer",
//                     "Sales Model": "$salesModel",
//                     "Total Price": "$totalPrice",
//                     "Number of Subscriptions": "$subscriptionCount",
//                     "Earliest Start Date": {
//                         $dateToString: {
//                             format: "%d-%b-%Y",
//                             date: { $toDate: { $multiply: [ "$minStartDate", 1000 ] } }
//                         }
//                     },
//                     "Latest End Date": {
//                         $dateToString: {
//                             format: "%d-%b-%Y",
//                             date: { $toDate: { $multiply: [ "$maxEndDate", 1000 ] } }
//                         }
//                     }
//                 }
//             }
//         ];

//         const results = await mongoose.connection.db.collection('Subscriptions').aggregate(aggregationPipeline, { maxTimeMS: 600000, allowDiskUse: true }).toArray();

//         return {
//             message: 'Grouped Billing Reports Data for City Hotel',
//             data: results
//         };
//     } catch (err) {
//         console.log('Error occurred while fetching grouped reports!!', err);
//         throw err;
//     }
// };


// const getDisconnectionReport = async (search = '', startDate, endDate, atoll, island) => {
//     try {

//         // Date filter for initial match
//         let dateFilter = {};
//         if (startDate || endDate) {
//             dateFilter.services = { 
//                 $elemMatch: {
//                     ...(startDate && { 'service_terms.start_date': { $gte: startTimestamp } }),
//                     ...(endDate && { 'service_terms.end_date': { $lte: endTimestamp } })
//                 }
//             };
//         }

//         // Build match stage
//         let matchStage = { 
//             ...dateFilter,
//             ...(atoll && { 'joinedData2.location.province': atoll }),
//             ...(island && { 'joinedData2.location.city': island }),
//             ...(search && { $text: { $search: search } })
//         };

//         const aggregationPipeline = [
//             {
//                 $lookup: {
//                     from: 'ContactProfiles',
//                     localField: 'contact_id',
//                     foreignField: 'contact_id',
//                     as: 'joinedData2',
//                 }
//             },
//             { $match: matchStage },
//             { $unwind: "$services" },
//             {
//                 $match: {
//                     ...(startDate && { "services.service_terms.start_date": { $gte: startTimestamp } }),
//                     ...(endDate && { "services.service_terms.end_date": { $lte: endTimestamp } })
//                 }
//             },
//             {
//                 $lookup: {
//                     from: 'Journals',
//                     localField: 'contact_id',
//                     foreignField: 'contact_id',
//                     as: 'journalData',
//                 }
//             },
//             {
//                 $project: {
//                     _id: 0,
//                     "Contact Name": { $arrayElemAt: ['$joinedData2.profile.name', 0] },
//                     "Account Number": { $arrayElemAt: ['$journalData.contact_code', 0] },
//                     "Contact Code": { $arrayElemAt: ['$joinedData2.custom_fields.value', 0] },
//                     "Contact Sales Model": { $arrayElemAt: ['$joinedData2.sales_model.name', 0] },
//                     "Atoll": { $arrayElemAt: ['$joinedData2.location.province', 0] },
//                     "Island": { $arrayElemAt: ['$joinedData2.location.city', 0] },
//                     "Product Name": "$services.product.name",
//                     "Product Sub Total": { $round: [{ $toDouble: "$services.price_terms.price" }, 2] },
//                     "start_date": "$services.service_terms.start_date",
//                     "end_date": "$services.service_terms.end_date",
//                     "Area": {
//                         $cond: {
//                             if: { $eq: [{ $type: '$joinedData2.tags.name' }, 'array'] },
//                             then: { $arrayElemAt: [{ $arrayElemAt: ['$joinedData2.tags.name', 0] }, 0] },
//                             else: '$joinedData2.tags.name',
//                         }
//                     }
//                 }
//             },
//             { $match: { "Area": "City Hotel" } },
//             {
//                 $project: {
//                     "Contact Name": 1,
//                     "Account Number": 1,
//                     "Contact Code": 1,
//                     "Contact Sales Model": 1,
//                     "Atoll": 1,
//                     "Island": 1,
//                     "Product Name": 1,
//                     "Product Sub Total": 1,
//                     "Billed from date": {
//                         $dateToString: {
//                             format: "%m/%d/%y %H:%M",
//                             date: { $toDate: { $multiply: ["$start_date", 1000] } }
//                         }
//                     },
//                     "Billed to date": {
//                         $dateToString: {
//                             format: "%m/%d/%y %H:%M",
//                             date: { $toDate: { $multiply: ["$end_date", 1000] } }
//                         }
//                     }
//                 }
//             }
//         ];

//         const results = await mongoose.connection.db.collection('Subscriptions')
//             .aggregate(aggregationPipeline, { maxTimeMS: 600000, allowDiskUse: true })
//             .toArray();

//         return {
//             message: 'Future Disconnection Report',
//             data: results
//         };
//     } catch (err) {
//         console.log('Error occurred while generating disconnection report!!', err);
//         throw err;
//     }
// };




module.exports = {
    getReports,
    exportReports,
    getAtollsData,
    getMetrics,
    getPackageDistribution,
    exportDealerReports,
    getAreaStats,
    // fetchFutureReports
}