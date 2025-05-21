const mongoose = require('mongoose');
const { parse } = require('json2csv');
const { getMTVConnection } = require('../config/db');
const csv = require('fast-csv');
const stream = require('stream');

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


const exportContactProfiles = async (search, startDate, endDate, atoll, island, page, limit, format) => {
  try {
    // Calculate timestamps for date filtering
    let startTimestamp, endTimestamp;
    if (startDate) {
      startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
    }
    if (endDate) {
      endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);
    }

    // Date filter for submited_date
    let dateFilter = {};
    if (startDate) {
      dateFilter.submited_date = { $gte: startTimestamp };
    }
    if (endDate) {
      dateFilter.submited_date = dateFilter.submited_date
        ? { $gte: startTimestamp, $lte: endTimestamp }
        : { $lte: endTimestamp };
    }

    // Match stage for search, atoll, and island
    let matchStage = { ...dateFilter };

    if (search) {
      matchStage.$text = { $search: search };
    }

    if (atoll) {
      matchStage['location.province'] = atoll;
    }

    if (island) {
      matchStage['location.city'] = island;
    }

    // Prepare aggregation query
    const aggregationQuery = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'Devices',
          localField: 'contact_id',
          foreignField: 'ownership.id',
          as: 'joinedDataDevices',
        },
      },
      {
        $lookup: {
          from: 'Journals',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'joinedDataJournals',
        },
      },
      {
        $project: {
          _id: 0,
          Name: {
            $concat: [
              { $ifNull: ['$demographics.first_name', ''] },
              ' ',
              { $ifNull: ['$demographics.last_name', ''] },
            ],
          },
          Phone: {
            $cond: {
              if: { $isArray: '$phone' },
              then: { $arrayElemAt: ['$phone', 0] },
              else: { $ifNull: ['$phone', ''] },
            },
          },
          'Registered Date': {
            $dateToString: {
              format: '%d-%b-%Y',
              date: { $toDate: { $multiply: [{ $toLong: '$submited_date' }, 1000] } },
            },
          },
          'Address Line 1': { $ifNull: ['$location.address_line1', ''] },
          'Address Line 2': { $ifNull: ['$location.address_line2', ''] },
          'Address Name': { $ifNull: ['$location.address_name', ''] },
          City: { $ifNull: ['$location.city', ''] },
          Country: {
            $cond: {
              if: { $eq: ['$location.country', 'MDV'] },
              then: 'Maldives',
              else: { $ifNull: ['$location.country', ''] },
            },
          },
          Province: { $ifNull: ['$location.province', ''] },
          Atoll: { $ifNull: ['$location.province', ''] },
          Island: { $ifNull: ['$location.city', ''] },
          'Service Provider': {
            $cond: {
              if: {
                $and: [
                  { $isArray: '$custom_fields' },
                  {
                    $in: [
                      'service_provider',
                      { $map: { input: '$custom_fields', as: 'field', in: '$$field.key' } },
                    ],
                  },
                ],
              },
              then: {
                $let: {
                  vars: {
                    provider: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$custom_fields',
                            as: 'field',
                            cond: { $eq: ['$$field.key', 'service_provider'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: { $ifNull: ['$$provider.value_label', ''] },
                },
              },
              else: '',
            },
          },
          'Device Code': {
            $cond: {
              if: {
                $and: [
                  { $isArray: '$joinedDataDevices' },
                  { $gt: [{ $size: '$joinedDataDevices' }, 0] },
                  { $isArray: { $arrayElemAt: ['$joinedDataDevices.custom_fields', 0] } },
                ],
              },
              then: {
                $let: {
                  vars: {
                    codeField: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: { $arrayElemAt: ['$joinedDataDevices.custom_fields', 0] },
                            as: 'field',
                            cond: { $eq: ['$$field.key', 'code'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: { $ifNull: ['$$codeField.value_label', ''] },
                },
              },
              else: '',
            },
          },
          'Customer Code': {
            $cond: {
              if: {
                $and: [
                  { $isArray: '$joinedDataJournals' },
                  { $gt: [{ $size: '$joinedDataJournals' }, 0] },
                ],
              },
              then: {
                $ifNull: [
                  {
                    $concat: [
                      "'",
                      { $toString: { $arrayElemAt: ['$joinedDataJournals.contact_code', 0] } }
                    ]
                  },
                  ''
                ]
              },
              else: ''
            }
          }
        },
      },
    ];

    // Calculate total count for pagination
    const countPipeline = [{ $match: matchStage }, { $count: 'total' }];
    const countResult = await mongoose.connection.db
      .collection('ContactProfiles')
      .aggregate(countPipeline, { maxTimeMS: 600000, allowDiskUse: true })
      .toArray();
    const total = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(total / limit);

    // Add pagination to the aggregation query for JSON format
    if (format === 'json') {
      aggregationQuery.push(
        { $skip: (page - 1) * limit },
        { $limit: parseInt(limit) }
      );
    }

    // Perform aggregation to fetch the data
    const results = await mongoose.connection.db
      .collection('ContactProfiles')
      .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
      .toArray();

    // Initialize response object
    const response = {
      results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
      },
    };

    // Only generate CSV if requested
    if (format === 'csv') {
      response.csv = parse(results);
    }

    return response;
  } catch (error) {
    console.error('Error exporting contact profiles report:', error);
    throw new Error('Error exporting contact profiles report');
  }
};

// const exportCustomerReports = async (search, startDate, endDate, atoll, island, format, page, limit) => {
//   console.log(page, limit, format, 'page and limit and format')
//   try {
//     // Calculate timestamps for date filtering
//     let startTimestamp, endTimestamp;
//     if (startDate) {
//       startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
//     }
//     if (endDate) {
//       endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);
//     }

//     // Match stage for filtering
//     let matchStage = {
//       'custom_fields.key': 'service_provider', // Filter for service_provider in custom_fields
//     };

//     if (search) {
//       matchStage.$text = { $search: search };
//     }

//     if (atoll) {
//       matchStage['location.province'] = atoll;
//     }

//     if (island) {
//       matchStage['location.city'] = island;
//     }

//     // Date filter for subscriptions (if applicable)
//     let subscriptionDateFilter = {};
//     if (startDate || endDate) {
//       const elemMatchConditions = {};
//       if (startDate) {
//         elemMatchConditions['service_terms.start_date'] = { $gte: startTimestamp };
//       }
//       if (endDate) {
//         elemMatchConditions['service_terms.end_date'] = { $lte: endTimestamp };
//       }
//       subscriptionDateFilter.services = { $elemMatch: elemMatchConditions };
//     }

//     // Aggregation pipeline for counting total items
//     const countPipeline = [
//       { $match: matchStage },
//       {
//         $lookup: {
//           from: 'Subscriptions',
//           localField: 'contact_id',
//           foreignField: 'contact_id',
//           as: 'subscriptionsData',
//         },
//       },
//       { $match: subscriptionDateFilter },
//       { $unwind: { path: '$subscriptionsData', preserveNullAndEmptyArrays: true } },
//       { $match: { 'subscriptionsData.services.state': 'EFFECTIVE' } },
//       { $count: 'totalItems' },
//     ];

//     // Aggregation pipeline for paginated results
//     const aggregationQuery = [
//       { $match: matchStage },
//       {
//         $lookup: {
//           from: 'Subscriptions',
//           localField: 'contact_id',
//           foreignField: 'contact_id',
//           as: 'subscriptionsData',
//         },
//       },
//       { $match: subscriptionDateFilter },
//       { $unwind: { path: '$subscriptionsData', preserveNullAndEmptyArrays: true } },
//       { $match: { 'subscriptionsData.services.state': 'EFFECTIVE' } },
//       {
//         $lookup: {
//           from: 'Devices',
//           localField: 'contact_id',
//           foreignField: 'ownership.id',
//           as: 'devicesData',
//         },
//       },
//       {
//         $lookup: {
//           from: 'Orders',
//           localField: 'contact_id',
//           foreignField: 'contact_id',
//           as: 'ordersData',
//         },
//       },
//       {
//         $lookup: {
//           from: 'Journals',
//           localField: 'contact_id',
//           foreignField: 'contact_id',
//           as: 'journalsData',
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           // id: '$id',
//           'Account Number': '$account.number',
//           'Contact Code': {
//             $concat: ['"', { $toString: { $arrayElemAt: ['$journalsData.contact_code', 0] } }, '"'],
//           },
//           'Customer Name': '$profile.name',
//           'Customer Type': '$profile.type',
//           'Service Provider': {
//             $arrayElemAt: [
//               {
//                 $filter: {
//                   input: '$custom_fields',
//                   as: 'field',
//                   cond: { $eq: ['$$field.key', 'service_provider'] },
//                 },
//               },
//               0,
//             ],
//           },
//           'Customer Code': {
//             $arrayElemAt: [
//               {
//                 $filter: {
//                   input: '$custom_fields',
//                   as: 'field',
//                   cond: { $eq: ['$$field.key', 'customer_code'] },
//                 },
//               },
//               0,
//             ],
//           },
//           Mobile: '$phone',
//           Ward: '$location.address_line1',
//           Road: '$location.address_line2',
//           Island: '$location.city',
//           Atoll: '$location.province',
//           'Business Name': '$business_name',
//           'Sales Model': '$sales_model.name',
//           'Payment Type': {
//             $cond: {
//               if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
//               then: 'QuickPay',
//               else: { $arrayElemAt: ['$ordersData.payment_method.type', 0] },
//             },
//           },
//           'Account Balance': {
//             $cond: {
//               if: { $eq: [{ $type: '$account.balance' }, 'array'] },
//               then: { $toDouble: { $arrayElemAt: ['$account.balance', 0] } },
//               else: { $toDouble: { $ifNull: ['$account.balance', '0.0'] } },
//             },
//           },
//           'Credit Limit': {
//             $cond: {
//               if: { $eq: [{ $type: '$classification.credit_limit' }, 'array'] },
//               then: { $toDouble: { $arrayElemAt: ['$classification.credit_limit', 0] } },
//               else: { $toDouble: { $ifNull: ['$classification.credit_limit', '0.0'] } },
//             },
//           },
//           Currency: '$classification.currency',
//           'Account Status': '$account.life_cycle_state',
//           'Registration Date': {
//             $dateToString: {
//               format: '%d-%b-%Y',
//               date: {
//                 $toDate: {
//                   $multiply: [
//                     {
//                       $cond: {
//                         if: { $eq: [{ $type: '$profile.registration_date' }, 'array'] },
//                         then: { $toLong: { $arrayElemAt: ['$profile.registration_date', 0] } },
//                         else: { $toLong: { $ifNull: ['$profile.registration_date', 0] } },
//                       },
//                     },
//                     1000,
//                   ],
//                 },
//               },
//             },
//           },
//           'Device Name': { $arrayElemAt: ['$devicesData.product.name', 0] },
//           'Service Status': '$subscriptionsData.services.state',
//           'Service Package': '$subscriptionsData.services.product.name',
//           'Service Price': {
//             $cond: {
//               if: { $eq: [{ $type: '$subscriptionsData.services.price_terms.price' }, 'array'] },
//               then: { $round: [{ $toDouble: { $arrayElemAt: ['$subscriptionsData.services.price_terms.price', 0] } }, 2] },
//               else: { $round: [{ $toDouble: { $ifNull: ['$subscriptionsData.services.price_terms.price', '0.0'] } }, 2] },
//             },
//           },
//           'Service Start Date': {
//             $map: {
//               input: '$subscriptionsData.services.service_terms.start_date',
//               as: 'startDate',
//               in: {
//                 $dateToString: {
//                   format: "%d %b %Y",
//                   date: {
//                     $toDate: { $multiply: ['$$startDate', 1000] }
//                   },
//                   timezone: "Indian/Maldives"
//                 }
//               }
//             }
//           },
//           'Service End Date': {
//             $map: {
//               input: '$subscriptionsData.services.service_terms.end_date',
//               as: 'endDate',
//               in: {
//                 $dateToString: {
//                   format: "%d %b %Y",
//                   date: {
//                     $toDate: { $multiply: ['$$endDate', 1000] }
//                   },
//                   timezone: "Indian/Maldives"
//                 }
//               }
//             }
//           }




//         },
//       },
//     ];

//     // Add pagination stages for JSON format
//     let results;
//     let pagination = null;
//     if (format === 'json' && page && limit) {
//       const pageNum = parseInt(page, 10) || 1;
//       const limitNum = parseInt(limit, 10) || 10;
//       const skipNum = (pageNum - 1) * limitNum;

//       // Get total count
//       const countResult = await mongoose.connection.db
//         .collection('ContactProfiles')
//         .aggregate(countPipeline, { maxTimeMS: 600000, allowDiskUse: true })
//         .toArray();
//       const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
//       const totalPages = Math.ceil(totalItems / limitNum);

//       // Add skip and limit to the main query
//       aggregationQuery.push(
//         { $skip: skipNum },
//         { $limit: limitNum }
//       );

//       // Execute paginated query
//       results = await mongoose.connection.db
//         .collection('ContactProfiles')
//         .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
//         .toArray();

//       // Prepare pagination metadata
//       pagination = {
//         totalItems,
//         totalPages,
//         currentPage: pageNum,
//         pageSize: limitNum,
//       };
//     } else {
//       // Execute non-paginated query (for CSV or JSON without pagination)
//       results = await mongoose.connection.db
//         .collection('ContactProfiles')
//         .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
//         .toArray();
//     }

//     // Handle response format
//     if (format === 'csv') {
//       const fields = [
//         // 'id',
//         'Account Number',
//         // 'Contact Code',
//         'Customer Name',
//         // 'Customer Type',
//         'Service Provider.value_label',
//         // 'Customer Code.value_label',
//         'Mobile',
//         'Island',
//         'Atoll',
//         'Ward',
//         'Road',
//         // 'Business Name',
//         // 'Sales Model',
//         // 'Payment Type',
//         // 'Account Balance',
//         // 'Credit Limit',
//         // 'Currency',
//         'Account Status',
//         // 'Registration Date',
//         'Device Name',
//         'Service Status',
//         'Service Package',
//         // 'Service Price',
//         'Service Start Date',
//         // 'Service End Date',
//       ];
//       const csvData = parse(results, { fields });
//       return { data: csvData, isCsv: true };
//     }

//     // Return JSON with pagination metadata
//     return {
//       data: results,
//       isCsv: false,
//       pagination,
//     };
//   } catch (error) {
//     console.error('Error exporting customer report:', error);
//     throw new Error('Error exporting customer report');
//   }
// };


const exportCustomerReports = async (search, startDate, endDate, atoll, island, format, page, limit, serviceProvider) => {
  try {
    // Calculate timestamps for date filtering
    let startTimestamp, endTimestamp;
    if (startDate) {
      startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
    }
    if (endDate) {
      endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);
    }

    // Match stage for filtering
    let matchStage = {};

    if (serviceProvider) {
      matchStage['custom_fields'] = {
        $elemMatch: {
          key: 'service_provider',
          value_label: serviceProvider,
        },
      };
    } else {
      // Only include records with a service_provider field if no specific provider is requested
      matchStage['custom_fields.key'] = 'service_provider';
    }

    if (search) {
      matchStage.$text = { $search: search };
    }

    if (atoll) {
      matchStage['location.province'] = atoll;
    }

    if (island) {
      matchStage['location.city'] = island;
    }

    // Date filter for subscriptions
    let subscriptionDateFilter = {};
    if (startDate || endDate) {
      const elemMatchConditions = {};
      if (startDate) {
        elemMatchConditions['service_terms.start_date'] = { $gte: startTimestamp };
      }
      if (endDate) {
        elemMatchConditions['service_terms.end_date'] = { $lte: endTimestamp };
      }
      subscriptionDateFilter.services = { $elemMatch: elemMatchConditions };
    }

    // Aggregation pipeline for counting total items
    const countPipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'Subscriptions',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'subscriptionsData',
        },
      },
      { $match: subscriptionDateFilter },
      { $unwind: { path: '$subscriptionsData', preserveNullAndEmptyArrays: true } },
      { $match: { 'subscriptionsData.services.state': 'EFFECTIVE' } },
      { $count: 'totalItems' },
    ];

    // Aggregation pipeline for paginated results
    const aggregationQuery = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'Subscriptions',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'subscriptionsData',
        },
      },
      { $match: subscriptionDateFilter },
      { $unwind: { path: '$subscriptionsData', preserveNullAndEmptyArrays: true } },
      { $match: { 'subscriptionsData.services.state': 'EFFECTIVE' } },
      {
        $lookup: {
          from: 'Devices',
          localField: 'contact_id',
          foreignField: 'ownership.id',
          as: 'devicesData',
        },
      },
      {
        $lookup: {
          from: 'Orders',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'ordersData',
        },
      },
      {
        $lookup: {
          from: 'Journals',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'journalsData',
        },
      },
      {
        $project: {
          _id: 0,
          'Account Number': '$account.number',
          'Contact Code': {
            $concat: ['"', { $toString: { $arrayElemAt: ['$journalsData.contact_code', 0] } }, '"'],
          },
          'Customer Name': '$profile.name',
          'Customer Type': '$profile.type',
          'Service Provider': {
            $let: {
              vars: {
                spField: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$custom_fields',
                        as: 'field',
                        cond: { $eq: ['$$field.key', 'service_provider'] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: '$$spField.value_label',
            },
          },
          'Customer Code': {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$custom_fields',
                  as: 'field',
                  cond: { $eq: ['$$field.key', 'customer_code'] },
                },
              },
              0,
            ],
          },
          Mobile: '$phone',
          Ward: '$location.address_line1',
          Road: '$location.address_line2',
          Island: '$location.city',
          Atoll: '$location.province',
          'Business Name': '$business_name',
          'Sales Model': '$sales_model.name',
          'Payment Type': {
            $cond: {
              if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
              then: 'QuickPay',
              else: { $arrayElemAt: ['$ordersData.payment_method.type', 0] },
            },
          },
          'Account Balance': {
            $cond: {
              if: { $eq: [{ $type: '$account.balance' }, 'array'] },
              then: { $toDouble: { $arrayElemAt: ['$account.balance', 0] } },
              else: { $toDouble: { $ifNull: ['$account.balance', '0.0'] } },
            },
          },
          'Credit Limit': {
            $cond: {
              if: { $eq: [{ $type: '$classification.credit_limit' }, 'array'] },
              then: { $toDouble: { $arrayElemAt: ['$classification.credit_limit', 0] } },
              else: { $toDouble: { $ifNull: ['$classification.credit_limit', '0.0'] } },
            },
          },
          Currency: '$classification.currency',
          'Account Status': '$account.life_cycle_state',
          'Registration Date': {
            $dateToString: {
              format: '%d-%b-%Y',
              date: {
                $toDate: {
                  $multiply: [
                    {
                      $cond: {
                        if: { $eq: [{ $type: '$profile.registration_date' }, 'array'] },
                        then: { $toLong: { $arrayElemAt: ['$profile.registration_date', 0] } },
                        else: { $toLong: { $ifNull: ['$profile.registration_date', 0] } },
                      },
                    },
                    1000,
                  ],
                },
              },
            },
          },
          'Device Name': { $arrayElemAt: ['$devicesData.product.name', 0] },
          'Service Status': {
            $filter: {
              input: '$subscriptionsData.services.state',
              as: 'status',
              cond: { $eq: ['$$status', 'EFFECTIVE'] },
            },
          },
          'Service Package': {
            $filter: {
              input: '$subscriptionsData.services.product.name',
              as: 'package',
              cond: {
                $eq: [
                  {
                    $arrayElemAt: [
                      '$subscriptionsData.services.state',
                      { $indexOfArray: ['$subscriptionsData.services.product.name', '$$package'] },
                    ],
                  },
                  'EFFECTIVE',
                ],
              },
            },
          },
          'Service Price': {
            $cond: {
              if: { $eq: [{ $type: '$subscriptionsData.services.price_terms.price' }, 'array'] },
              then: { $round: [{ $toDouble: { $arrayElemAt: ['$subscriptionsData.services.price_terms.price', 0] } }, 2] },
              else: { $round: [{ $toDouble: { $ifNull: ['$subscriptionsData.services.price_terms.price', '0.0'] } }, 2] },
            },
          },
          'Service Start Date': {
            $map: {
              input: {
                $filter: {
                  input: '$subscriptionsData.services.service_terms.start_date',
                  as: 'startDate',
                  cond: {
                    $eq: [
                      {
                        $arrayElemAt: [
                          '$subscriptionsData.services.state',
                          { $indexOfArray: ['$subscriptionsData.services.service_terms.start_date', '$$startDate'] },
                        ],
                      },
                      'EFFECTIVE',
                    ],
                  },
                },
              },
              as: 'startDate',
              in: {
                $dateToString: {
                  format: '%d %b %Y',
                  date: { $toDate: { $multiply: ['$$startDate', 1000] } },
                  timezone: 'Indian/Maldives',
                },
              },
            },
          },
          'Service End Date': {
            $map: {
              input: {
                $filter: {
                  input: '$subscriptionsData.services.rated_up_to_date',
                  as: 'endDate',
                  cond: {
                    $eq: [
                      {
                        $arrayElemAt: [
                          '$subscriptionsData.services.state',
                          { $indexOfArray: ['$subscriptionsData.services.rated_up_to_date', '$$endDate'] },
                        ],
                      },
                      'EFFECTIVE',
                    ],
                  },
                },
              },
              as: 'endDate',
              in: {
                $dateToString: {
                  format: '%d %b %Y',
                  date: { $toDate: { $multiply: ['$$endDate', 1000] } },
                  timezone: 'Indian/Maldives',
                },
              },
            },
          },
          'Tag Area': {
            $reduce: {
              input: {
                $map: {
                  input: '$tags',
                  as: 'tag',
                  in: '$$tag.name',
                },
              },
              initialValue: '',
              in: {
                $cond: {
                  if: { $eq: ['$$value', ''] },
                  then: '$$this',
                  else: { $concat: ['$$value', ', ', '$$this'] },
                },
              },
            },
          },
        },
      },
    ];

    // Add pagination stages for JSON format
    let results;
    let pagination = null;
    if (format === 'json' && page && limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skipNum = (pageNum - 1) * limitNum;

      // Get total count
      const countResult = await mongoose.connection.db
        .collection('ContactProfiles')
        .aggregate(countPipeline, { maxTimeMS: 600000, allowDiskUse: true })
        .toArray();
      const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
      const totalPages = Math.ceil(totalItems / limitNum);

      // Add skip and limit to the main query
      aggregationQuery.push(
        { $skip: skipNum },
        { $limit: limitNum }
      );

      // Execute paginated query
      results = await mongoose.connection.db
        .collection('ContactProfiles')
        .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
        .toArray();

      // Prepare pagination metadata
      pagination = {
        totalItems,
        totalPages,
        currentPage: pageNum,
        pageSize: limitNum,
      };
    } else {
      // Execute non-paginated query (for CSV or JSON without pagination)
      results = await mongoose.connection.db
        .collection('ContactProfiles')
        .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
        .toArray();
    }

    // Handle response format
    if (format === 'csv') {
      const fields = [
        { label: 'Account Number', value: 'Account Number' },
        { label: 'Customer Name', value: 'Customer Name' },
        { label: 'Service Provider', value: 'Service Provider' },
        { label: 'Mobile', value: 'Mobile' },
        { label: 'Area', value: 'Tag Area' },
        { label: 'Island', value: 'Island' },
        { label: 'Atoll', value: 'Atoll' },
        { label: 'Ward', value: 'Ward' },
        { label: 'Road', value: 'Road' },
        { label: 'Account Status', value: 'Account Status' },
        { label: 'Device Name', value: 'Device Name' },
        { label: 'Service Status', value: 'Service Status' },
        { label: 'Service Package', value: 'Service Package' },
        { label: 'Service End Date', value: 'Service End Date' },
      ];
      const csvData = parse(results, { fields });
      return { data: csvData, isCsv: true };
    }

    // Return JSON with pagination metadata
    return {
      data: results,
      isCsv: false,
      pagination,
    };
  } catch (error) {
    console.error('Error exporting customer report:', error);
    throw new Error('Error exporting customer report');
  }
};

const exportCustomerReportsNotEffective = async (search, startDate, endDate, atoll, island, format, page, limit, serviceProvider) => {
  try {
    // Calculate timestamps for date filtering
    let startTimestamp, endTimestamp;
    if (startDate) {
      startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
    }
    if (endDate) {
      endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);
    }

    // Match stage for filtering
    let matchStage = {};

    if (serviceProvider) {
      matchStage['custom_fields'] = {
        $elemMatch: {
          key: 'service_provider',
          value_label: serviceProvider,
        },
      };
    } else {
      matchStage['custom_fields.key'] = 'service_provider';
    }

    if (search) {
      matchStage.$text = { $search: search };
    }

    if (atoll) {
      matchStage['location.province'] = atoll;
    }

    if (island) {
      matchStage['location.city'] = island;
    }

    // Date filter for subscriptions
    let subscriptionDateFilter = {};
    if (startDate || endDate) {
      const elemMatchConditions = {};
      if (startDate) {
        elemMatchConditions['service_terms.start_date'] = { $gte: startTimestamp };
      }
      if (endDate) {
        elemMatchConditions['service_terms.end_date'] = { $lte: endTimestamp };
      }
      subscriptionDateFilter.services = { $elemMatch: elemMatchConditions };
    }

    // Aggregation pipeline for counting total items
    const countPipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'Subscriptions',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'subscriptionsData',
        },
      },
      { $match: subscriptionDateFilter },
      { $unwind: { path: '$subscriptionsData', preserveNullAndEmptyArrays: true } },
      { $match: { 'subscriptionsData.services.state': 'NOT_EFFECTIVE' } },
      { $count: 'totalItems' },
    ];

    // Aggregation pipeline for paginated results
    const aggregationQuery = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'Subscriptions',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'subscriptionsData',
        },
      },
      { $match: subscriptionDateFilter },
      { $unwind: { path: '$subscriptionsData', preserveNullAndEmptyArrays: true } },
      { $match: { 'subscriptionsData.services.state': 'NOT_EFFECTIVE' } },
      {
        $lookup: {
          from: 'Devices',
          localField: 'contact_id',
          foreignField: 'ownership.id',
          as: 'devicesData',
        },
      },
      {
        $lookup: {
          from: 'Orders',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'ordersData',
        },
      },
      {
        $lookup: {
          from: 'Journals',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'journalsData',
        },
      },
      {
        $project: {
          _id: 0,
          'Account Number': '$account.number',
          'Contact Code': {
            $concat: ['"', { $toString: { $arrayElemAt: ['$journalsData.contact_code', 0] } }, '"'],
          },
          'Customer Name': '$profile.name',
          'Customer Type': '$profile.type',
          'Service Provider': {
            $let: {
              vars: {
                spField: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$custom_fields',
                        as: 'field',
                        cond: { $eq: ['$$field.key', 'service_provider'] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: '$$spField.value_label',
            },
          },
          'Customer Code': {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$custom_fields',
                  as: 'field',
                  cond: { $eq: ['$$field.key', 'customer_code'] },
                },
              },
              0,
            ],
          },
          Mobile: '$phone',
          Ward: '$location.address_line1',
          Road: '$location.address_line2',
          Island: '$location.city',
          Atoll: '$location.province',
          'Business Name': '$business_name',
          'Sales Model': '$sales_model.name',
          'Payment Type': {
            $cond: {
              if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
              then: 'QuickPay',
              else: { $arrayElemAt: ['$ordersData.payment_method.type', 0] },
            },
          },
          'Account Balance': {
            $cond: {
              if: { $eq: [{ $type: '$account.balance' }, 'array'] },
              then: { $toDouble: { $arrayElemAt: ['$account.balance', 0] } },
              else: { $toDouble: { $ifNull: ['$account.balance', '0.0'] } },
            },
          },
          'Credit Limit': {
            $cond: {
              if: { $eq: [{ $type: '$classification.credit_limit' }, 'array'] },
              then: { $toDouble: { $arrayElemAt: ['$classification.credit_limit', 0] } },
              else: { $toDouble: { $ifNull: ['$classification.credit_limit', '0.0'] } },
            },
          },
          Currency: '$classification.currency',
          'Account Status': '$account.life_cycle_state',
          'Registration Date': {
            $dateToString: {
              format: '%d-%b-%Y',
              date: {
                $toDate: {
                  $multiply: [
                    {
                      $cond: {
                        if: { $eq: [{ $type: '$profile.registration_date' }, 'array'] },
                        then: { $toLong: { $arrayElemAt: ['$profile.registration_date', 0] } },
                        else: { $toLong: { $ifNull: ['$profile.registration_date', 0] } },
                      },
                    },
                    1000,
                  ],
                },
              },
            },
          },
          'Device Name': { $arrayElemAt: ['$devicesData.product.name', 0] },
          'Service Status': {
            $filter: {
              input: '$subscriptionsData.services.state',
              as: 'status',
              cond: { $eq: ['$$status', 'NOT_EFFECTIVE'] },
            },
          },
          'Service Package': {
            $filter: {
              input: '$subscriptionsData.services.product.name',
              as: 'package',
              cond: {
                $eq: [
                  {
                    $arrayElemAt: [
                      '$subscriptionsData.services.state',
                      { $indexOfArray: ['$subscriptionsData.services.product.name', '$$package'] },
                    ],
                  },
                  'NOT_EFFECTIVE',
                ],
              },
            },
          },
          'Service Price': {
            $cond: {
              if: { $eq: [{ $type: '$subscriptionsData.services.price_terms.price' }, 'array'] },
              then: { $round: [{ $toDouble: { $arrayElemAt: ['$subscriptionsData.services.price_terms.price', 0] } }, 2] },
              else: { $round: [{ $toDouble: { $ifNull: ['$subscriptionsData.services.price_terms.price', '0.0'] } }, 2] },
            },
          },
          'Service Start Date': {
            $map: {
              input: {
                $filter: {
                  input: '$subscriptionsData.services.service_terms.start_date',
                  as: 'startDate',
                  cond: {
                    $eq: [
                      {
                        $arrayElemAt: [
                          '$subscriptionsData.services.state',
                          { $indexOfArray: ['$subscriptionsData.services.service_terms.start_date', '$$startDate'] },
                        ],
                      },
                      'NOT_EFFECTIVE',
                    ],
                  },
                },
              },
              as: 'startDate',
              in: {
                $dateToString: {
                  format: '%d %b %Y',
                  date: { $toDate: { $multiply: ['$$startDate', 1000] } },
                  timezone: 'Indian/Maldives',
                },
              },
            },
          },
          'Service End Date': {
            $map: {
              input: {
                $filter: {
                  input: '$subscriptionsData.services.rated_up_to_date',
                  as: 'endDate',
                  cond: {
                    $eq: [
                      {
                        $arrayElemAt: [
                          '$subscriptionsData.services.state',
                          { $indexOfArray: ['$subscriptionsData.services.rated_up_to_date', '$$endDate'] },
                        ],
                      },
                      'NOT_EFFECTIVE',
                    ],
                  },
                },
              },
              as: 'endDate',
              in: {
                $dateToString: {
                  format: '%d %b %Y',
                  date: { $toDate: { $multiply: ['$$endDate', 1000] } },
                  timezone: 'Indian/Maldives',
                },
              },
            },
          },
          'Tag Area': {
            $reduce: {
              input: {
                $map: {
                  input: '$tags',
                  as: 'tag',
                  in: '$$tag.name',
                },
              },
              initialValue: '',
              in: {
                $cond: {
                  if: { $eq: ['$$value', ''] },
                  then: '$$this',
                  else: { $concat: ['$$value', ', ', '$$this'] },
                },
              },
            },
          },
        },
      },
    ];

    // Add pagination stages for JSON format
    let results;
    let pagination = null;
    if (format === 'json' && page && limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skipNum = (pageNum - 1) * limitNum;

      // Get total count
      const countResult = await mongoose.connection.db
        .collection('ContactProfiles')
        .aggregate(countPipeline, { maxTimeMS: 600000, allowDiskUse: true })
        .toArray();
      const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
      const totalPages = Math.ceil(totalItems / limitNum);

      // Add skip and limit to the main query
      aggregationQuery.push(
        { $skip: skipNum },
        { $limit: limitNum }
      );

      // Execute paginated query
      results = await mongoose.connection.db
        .collection('ContactProfiles')
        .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
        .toArray();

      // Prepare pagination metadata
      pagination = {
        totalItems,
        totalPages,
        currentPage: pageNum,
        pageSize: limitNum,
      };
    } else {
      // Execute non-paginated query (for CSV or JSON without pagination)
      results = await mongoose.connection.db
        .collection('ContactProfiles')
        .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
        .toArray();
    }

    // Handle response format
    if (format === 'csv') {
      const fields = [
        { label: 'Account Number', value: 'Account Number' },
        { label: 'Customer Name', value: 'Customer Name' },
        { label: 'Service Provider', value: 'Service Provider' },
        { label: 'Mobile', value: 'Mobile' },
        { label: 'Area', value: 'Tag Area' },
        { label: 'Island', value: 'Island' },
        { label: 'Atoll', value: 'Atoll' },
        { label: 'Ward', value: 'Ward' },
        { label: 'Road', value: 'Road' },
        { label: 'Device Name', value: 'Device Name' },
        { label: 'Service Status', value: 'Service Status' },
        { label: 'Service Package', value: 'Service Package' },
        { label: 'Service End Date', value: 'Service End Date' },
      ];
      const csvData = parse(results, { fields });
      return { data: csvData, isCsv: true };
    }

    // Return JSON with pagination metadata
    return {
      data: results,
      isCsv: false,
      pagination,
    };
  } catch (error) {
    console.error('Error exporting customer report:', error);
    throw new Error('Error exporting customer report');
  }
};

// const exportCustomerDealerWiseCollection = async (search, startDate, endDate, atoll, island, format, page, limit, serviceProvider) => {
//   try {
//     // Validate date inputs
//     if (startDate && isNaN(new Date(startDate).getTime())) {
//       throw new Error('Invalid startDate');
//     }
//     if (endDate && isNaN(new Date(endDate).getTime())) {
//       throw new Error('Invalid endDate');
//     }

//     // Calculate timestamps for date filtering (in seconds)
//     let startTimestamp, endTimestamp;
//     if (startDate) {
//       startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
//     }
//     if (endDate) {
//       endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);
//     }

//     // Match stage for filtering
//     let matchStage = {};
//     if (serviceProvider) {
//       matchStage['custom_fields'] = {
//         $elemMatch: {
//           key: 'service_provider',
//           value_label: serviceProvider,
//         },
//       };
//     } else {
//       matchStage['custom_fields.key'] = 'service_provider';
//     }

//     if (search) {
//       matchStage.$text = { $search: search };
//     }

//     if (atoll) {
//       matchStage['location.province'] = atoll;
//     }

//     if (island) {
//       matchStage['location.city'] = island;
//     }

//     // Date filter for journals
//     let journalDateFilter = {};
//     if (startDate || endDate) {
//       const dateConditions = {};
//       if (startDate) {
//         dateConditions.$gte = startTimestamp;
//       }
//       if (endDate) {
//         dateConditions.$lte = endTimestamp;
//       }
//       journalDateFilter = {
//         $or: [
//           { 'journalsData.posted_date': dateConditions },
//           { journalsData: { $exists: false } },
//           { journalsData: null },
//         ],
//       };
//     }

//     // Aggregation pipeline for counting total items
//     const countPipeline = [
//       { $match: matchStage },
//       {
//         $lookup: {
//           from: 'Journals',
//           let: { contactId: '$contact_id' },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $and: [
//                     { $eq: ['$contact_id', '$$contactId'] },
//                     { $eq: ['$related_entity.transaction_type', 'PAYMENT'] },
//                   ],
//                 },
//               },
//             },
//           ],
//           as: 'journalsData',
//         },
//       },
//       {
//         $unwind: { path: '$journalsData', preserveNullAndEmptyArrays: true },
//       },
//       { $match: journalDateFilter },
//       { $count: 'totalItems' },
//     ];

//     // Aggregation pipeline for paginated results
//     const aggregationQuery = [
//       { $match: matchStage },
//       {
//         $lookup: {
//           from: 'Subscriptions',
//           localField: 'contact_id',
//           foreignField: 'contact_id',
//           as: 'subscriptionsData',
//         },
//       },
//       {
//         $unwind: { path: '$subscriptionsData', preserveNullAndEmptyArrays: true },
//       },
//       {
//         $lookup: {
//           from: 'Devices',
//           localField: 'contact_id',
//           foreignField: 'ownership.id',
//           as: 'devicesData',
//         },
//       },
//       {
//         $lookup: {
//           from: 'Orders',
//           localField: 'contact_id',
//           foreignField: 'contact_id',
//           as: 'ordersData',
//         },
//       },
//       {
//         $lookup: {
//           from: 'Journals',
//           let: { contactId: '$contact_id' },
//           pipeline: [
//             {
//               $match: {
//                 $expr: {
//                   $and: [
//                     { $eq: ['$contact_id', '$$contactId'] },
//                     { $eq: ['$related_entity.transaction_type', 'PAYMENT'] },
//                   ],
//                 },
//               },
//             },
//           ],
//           as: 'journalsData',
//         },
//       },
//       {
//         $unwind: { path: '$journalsData', preserveNullAndEmptyArrays: true },
//       },
//       { $match: journalDateFilter },
//       {
//         $project: {
//           _id: 0,
//           'Account Number': '$account.number',
//           'Contact Code': {
//             $cond: {
//               if: { $or: [{ $eq: ['$journalsData', null] }, { $eq: ['$journalsData.contact_code', null] }] },
//               then: '',
//               else: { $concat: ['"', { $toString: '$journalsData.contact_code' }, '"'] },
//             },
//           },
//           'Customer Name': '$profile.name',
//           'Customer Type': '$profile.type',
//           'Service Provider': {
//             $let: {
//               vars: {
//                 spField: {
//                   $arrayElemAt: [
//                     {
//                       $filter: {
//                         input: '$custom_fields',
//                         as: 'field',
//                         cond: { $eq: ['$$field.key', 'service_provider'] },
//                       },
//                     },
//                     0,
//                   ],
//                 },
//               },
//               in: '$$spField.value_label',
//             },
//           },
//           'Customer Code': {
//             $cond: {
//               if: {
//                 $eq: [
//                   {
//                     $size: {
//                       $filter: {
//                         input: '$custom_fields',
//                         as: 'field',
//                         cond: { $eq: ['$$field.key', 'customer_code'] },
//                       },
//                     },
//                   },
//                   0,
//                 ],
//               },
//               then: '',
//               else: {
//                 $let: {
//                   vars: {
//                     codeField: {
//                       $arrayElemAt: [
//                         {
//                           $filter: {
//                             input: '$custom_fields',
//                             as: 'field',
//                             cond: { $eq: ['$$field.key', 'customer_code'] },
//                           },
//                         },
//                         0,
//                       ],
//                     },
//                   },
//                   in: '$$codeField.value_label',
//                 },
//               },
//             },
//           },
//           Mobile: '$phone',
//           Ward: '$location.address_line1',
//           Road: '$location.address_line2',
//           Island: '$location.city',
//           Atoll: '$location.province',
//           'Business Name': '$business_name',
//           'Sales Model': '$sales_model.name',
//           'Payment Type': {
//             $cond: {
//               if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
//               then: 'QuickPay',
//               else: { $arrayElemAt: ['$ordersData.payment_method.type', 0] },
//             },
//           },
//           'Account Balance': {
//             $cond: {
//               if: { $eq: [{ $type: '$account.balance' }, 'array'] },
//               then: { $toDouble: { $arrayElemAt: ['$account.balance', 0] } },
//               else: { $toDouble: { $ifNull: ['$account.balance', '0.0'] } },
//             },
//           },
//           'Credit Limit': {
//             $cond: {
//               if: { $eq: [{ $type: '$classification.credit_limit' }, 'array'] },
//               then: { $toDouble: { $arrayElemAt: ['$classification.credit_limit', 0] } },
//               else: { $toDouble: { $ifNull: ['$classification.credit_limit', '0.0'] } },
//             },
//           },
//           Currency: '$classification.currency',
//           'Account Status': '$account.life_cycle_state',
//           'Registration Date': {
//             $dateToString: {
//               format: '%d-%b-%Y',
//               date: {
//                 $toDate: {
//                   $multiply: [
//                     {
//                       $cond: {
//                         if: { $eq: [{ $type: '$profile.registration_date' }, 'array'] },
//                         then: { $toLong: { $arrayElemAt: ['$profile.registration_date', 0] } },
//                         else: { $toLong: { $ifNull: ['$profile.registration_date', 0] } },
//                       },
//                     },
//                     1000,
//                   ],
//                 },
//               },
//             },
//           },
//           'Device Name': { $arrayElemAt: ['$devicesData.product.name', 0] },
//           'Service Status': '$subscriptionsData.services.state',
//           'Service Package': '$subscriptionsData.services.product.name',
//           'Service Price': {
//             $reduce: {
//               input: {
//                 $map: {
//                   input: '$subscriptionsData.services.price_terms.price',
//                   as: 'price',
//                   in: {
//                     $round: [
//                       {
//                         $toDouble: {
//                           $ifNull: ['$$price', '0.0'],
//                         },
//                       },
//                       2,
//                     ],
//                   },
//                 },
//               },
//               initialValue: '',
//               in: {
//                 $cond: {
//                   if: { $eq: ['$$value', ''] },
//                   then: { $toString: '$$this' },
//                   else: { $concat: ['$$value', ', ', { $toString: '$$this' }] },
//                 },
//               },
//             },
//           },
//           'Tag Area': {
//             $reduce: {
//               input: {
//                 $map: {
//                   input: '$tags',
//                   as: 'tag',
//                   in: '$$tag.name',
//                 },
//               },
//               initialValue: '',
//               in: {
//                 $cond: {
//                   if: { $eq: ['$$value', ''] },
//                   then: '$$this',
//                   else: { $concat: ['$$value', ', ', '$$this'] },
//                 },
//               },
//             },
//           },
//           'Posted Date': {
//             $cond: {
//               if: { $or: [{ $eq: ['$journalsData', null] }, { $eq: ['$journalsData.posted_date', null] }] },
//               then: '',
//               else: {
//                 $dateToString: {
//                   format: '%d-%b-%Y',
//                   date: { $toDate: { $multiply: ['$journalsData.posted_date', 1000] } },
//                   timezone: 'Indian/Maldives',
//                 },
//               },
//             },
//           },
//           'User Name': {
//             $cond: {
//               if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
//               then: 'Quick Pay',
//               else: {
//                 $cond: {
//                   if: { $or: [{ $eq: ['$journalsData', null] }, { $eq: ['$journalsData.submited_by_user_name', null] }] },
//                   then: '',
//                   else: { $toString: '$journalsData.submited_by_user_name' },
//                 },
//               },
//             },
//           },
//           'Decoder No': {
//             $cond: {
//               if: {
//                 $or: [
//                   { $eq: [{ $type: { $arrayElemAt: ['$devicesData.custom_fields', 0] } }, 'missing'] },
//                   { $eq: [{ $arrayElemAt: ['$devicesData.custom_fields', 0] }, null] },
//                   { $eq: [{ $size: { $arrayElemAt: ['$devicesData.custom_fields', 0] } }, 0] },
//                 ],
//               },
//               then: '',
//               else: {
//                 $let: {
//                   vars: {
//                     codeField: {
//                       $arrayElemAt: [
//                         {
//                           $filter: {
//                             input: { $arrayElemAt: ['$devicesData.custom_fields', 0] },
//                             as: 'field',
//                             cond: { $eq: ['$$field.key', 'code'] },
//                           },
//                         },
//                         0,
//                       ],
//                     },
//                   },
//                   in: {
//                     $cond: {
//                       if: { $or: [{ $eq: ['$$codeField', null] }, { $eq: ['$$codeField', undefined] }] },
//                       then: '',
//                       else: { $toString: '$$codeField.value' },
//                     },
//                   },
//                 },
//               },
//             },
//           },
//           'Receipt ID': {
//             $cond: {
//               if: { $or: [{ $eq: ['$journalsData', null] }, { $eq: ['$journalsData.related_entity.reference_code', null] }] },
//               then: '',
//               else: { $toString: '$journalsData.related_entity.reference_code' },
//             },
//           },
//           'Address': {
//             $reduce: {
//               input: [
//                 { $toString: { $ifNull: ['$location.address_line1', ''] } },
//                 { $toString: { $ifNull: ['$location.address_line2', ''] } },
//                 { $toString: { $ifNull: ['$location.address_name', ''] } },
//                 { $toString: { $ifNull: ['$location.city', ''] } },
//                 { $toString: { $ifNull: ['$location.country', ''] } },
//                 { $toString: { $ifNull: ['$location.town_city', ''] } },
//                 { $toString: { $ifNull: ['$location.state_province_county', ''] } },
//               ],
//               initialValue: '',
//               in: {
//                 $cond: {
//                   if: {
//                     $and: [
//                       { $ne: ['$$this', ''] },
//                       { $ne: ['$$value', ''] },
//                     ],
//                   },
//                   then: { $concat: ['$$value', ', ', '$$this'] },
//                   else: {
//                     $cond: {
//                       if: { $eq: ['$$value', ''] },
//                       then: '$$this',
//                       else: '$$value',
//                     },
//                   },
//                 },
//               },
//             },
//           },
//           'Payment Action': {
//             $cond: {
//               if: { $or: [{ $eq: ['$journalsData', null] }, { $eq: ['$journalsData.account_type', null] }] },
//               then: '',
//               else: {
//                 $switch: {
//                   branches: [
//                     { case: { $eq: ['$journalsData.account_type', 'CREDIT'] }, then: 'Add' },
//                     { case: { $eq: ['$journalsData.account_type', 'DEBIT'] }, then: 'Deduct' },
//                   ],
//                   default: '',
//                 },
//               },
//             },
//           },
//           'GST': {
//             $reduce: {
//               input: {
//                 $map: {
//                   input: '$subscriptionsData.services.price_terms.price',
//                   as: 'price',
//                   in: {
//                     $round: [
//                       {
//                         $multiply: [
//                           { $divide: [{ $toDouble: { $ifNull: ['$$price', '0.0'] } }, 2.16] },
//                           0.16
//                         ]
//                       },
//                       2
//                     ]
//                   },
//                 },
//               },
//               initialValue: '',
//               in: {
//                 $cond: {
//                   if: { $eq: ['$$value', ''] },
//                   then: { $toString: '$$this' },
//                   else: { $concat: ['$$value', ', ', { $toString: '$$this' }] },
//                 },
//               },
//             },
//           },
//           'Amount': {
//             $reduce: {
//               input: {
//                 $map: {
//                   input: '$subscriptionsData.services.price_terms.price',
//                   as: 'price',
//                   in: {
//                     $ceil: {
//                       $add: [
//                         { $divide: [{ $toDouble: { $ifNull: ['$$price', '0.0'] } }, 2.16] },
//                         {
//                           $multiply: [
//                             { $divide: [{ $toDouble: { $ifNull: ['$$price', '0.0'] } }, 2.16] },
//                             0.16
//                           ]
//                         }
//                       ]
//                     }
//                   },
//                 },
//               },
//               initialValue: '',
//               in: {
//                 $cond: {
//                   if: { $eq: ['$$value', ''] },
//                   then: { $toString: '$$this' },
//                   else: { $concat: ['$$value', ', ', { $toString: '$$this' }] },
//                 },
//               },
//             },
//           },
//         },
//       },
//     ];

//     // Add pagination stages for JSON format
//     let results;
//     let pagination = null;
//     if (format === 'json' && page && limit) {
//       const pageNum = parseInt(page, 10) || 1;
//       const limitNum = parseInt(limit, 10) || 10;
//       const skipNum = (pageNum - 1) * limitNum;

//       // Get total count
//       const countResult = await mongoose.connection.db
//         .collection('ContactProfiles')
//         .aggregate(countPipeline, { maxTimeMS: 600000, allowDiskUse: true })
//         .toArray();
//       const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
//       const totalPages = Math.ceil(totalItems / limitNum);

//       // Add skip and limit to the main query
//       aggregationQuery.push(
//         { $skip: skipNum },
//         { $limit: limitNum }
//       );

//       // Execute paginated query
//       results = await mongoose.connection.db
//         .collection('ContactProfiles')
//         .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
//         .toArray();

//       // Prepare pagination metadata
//       pagination = {
//         totalItems,
//         totalPages,
//         currentPage: pageNum,
//         pageSize: limitNum,
//       };
//     } else {
//       // Execute non-paginated query (for CSV or JSON without pagination)
//       results = await mongoose.connection.db
//         .collection('ContactProfiles')
//         .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
//         .toArray();
//     }

//     // Handle response format
//     if (format === 'csv') {
//       const fields = [
//         { label: 'Posted Date', value: 'Posted Date' },
//         { label: 'User Name', value: 'User Name' },
//         { label: 'Dealer', value: 'Service Provider' },
//         { label: 'Decoder No.', value: 'Decoder No' },
//         { label: 'Account Number', value: 'Account Number' },
//         { label: 'Area', value: 'Tag Area' },
//         { label: 'Customer Name', value: 'Customer Name' },
//         { label: 'Atoll', value: 'Atoll' },
//         { label: 'Island', value: 'Island' },
//         { label: 'Ward', value: 'Ward' },
//         { label: 'Road', value: 'Road' },
//         { label: 'Address', value: 'Address' },
//         { label: 'Payment Type', value: 'Payment Type' },
//         { label: 'Payment Action', value: 'Payment Action' },
//         { label: 'Mobile', value: 'Mobile' },
//         { label: 'Amount', value: 'Amount' },
//         { label: 'GST', value: 'GST' },
//         { label: 'Service Price', value: 'Service Price' },
//         { label: 'Receipt ID', value: 'Receipt ID' },
//       ];
//       const csvData = parse(results, { fields });
//       return { data: csvData, isCsv: true };
//     }

//     // Return JSON with pagination metadata
//     return {
//       data: results,
//       isCsv: false,
//       pagination,
//     };
//   } catch (error) {
//     console.error('Error exporting customer report:', error);
//     throw new Error('Error exporting customer report');
//   }
// };

const exportCustomerDealerWiseCollection = async (search, startDate, endDate, atoll, island, format, page, limit, serviceProvider) => {
  try {
    // Validate date inputs
    if (startDate && isNaN(new Date(startDate).getTime())) {
      throw new Error('Invalid startDate');
    }
    if (endDate && isNaN(new Date(endDate).getTime())) {
      throw new Error('Invalid endDate');
    }

    // Calculate timestamps for date filtering (in seconds)
    let startTimestamp, endTimestamp;
    if (startDate) {
      startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
    }
    if (endDate) {
      endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);
    }

    // Match stage for filtering
    let matchStage = {};
    if (serviceProvider) {
      matchStage['custom_fields'] = {
        $elemMatch: {
          key: 'service_provider',
          value_label: serviceProvider,
        },
      };
    } else {
      matchStage['custom_fields.key'] = 'service_provider';
    }

    if (search) {
      matchStage.$text = { $search: search };
    }

    if (atoll) {
      matchStage['location.province'] = atoll;
    }

    if (island) {
      matchStage['location.city'] = island;
    }

    //-Date filter for journals
    let journalDateFilter = {};
    if (startDate || endDate) {
      const dateConditions = {};
      if (startDate) {
        dateConditions.$gte = startTimestamp;
      }
      if (endDate) {
        dateConditions.$lte = endTimestamp;
      }
      journalDateFilter = {
        $or: [
          { 'journalsData.posted_date': dateConditions },
          { journalsData: { $exists: false } },
          { journalsData: null },
        ],
      };
    }

    // Aggregation pipeline for counting total items
    const countPipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'Subscriptions',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'subscriptionsData',
        },
      },
      {
        $unwind: { path: '$subscriptionsData', preserveNullAndEmptyArrays: true },
      },
      {
        $match: {
          subscriptionsData: { $exists: true, $ne: null },
        },
      },
      {
        $lookup: {
          from: 'Journals',
          let: { contactId: '$contact_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$contact_id', '$$contactId'] },
                    { $in: ['$related_entity.transaction_type', ['PAYMENT', 'MANUAL_JOURNAL']] },
                  ],
                },
              },
            },
            { $sort: { posted_date: -1 } },
            // Limit to 1 to get only the latest journal entry
            { $limit: 1 },
          ],
          as: 'journalsData',
        },
      },
      {
        $unwind: { path: '$journalsData', preserveNullAndEmptyArrays: true },
      },
      { $match: journalDateFilter },
      { $group: { _id: '$phone', count: { $sum: 1 } } },
      { $count: 'totalItems' },
    ];

    // Aggregation pipeline for paginated results
    const aggregationQuery = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'Subscriptions',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'subscriptionsData',
        },
      },
      {
        $unwind: { path: '$subscriptionsData', preserveNullAndEmptyArrays: true },
      },
      {
        $match: {
          subscriptionsData: { $exists: true, $ne: null },
        },
      },
      {
        $lookup: {
          from: 'Devices',
          localField: 'contact_id',
          foreignField: 'ownership.id',
          as: 'devicesData',
        },
      },
      {
        $lookup: {
          from: 'Orders',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'ordersData',
        },
      },
      {
        $lookup: {
          from: 'Journals',
          let: { contactId: '$contact_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$contact_id', '$$contactId'] },
                    { $in: ['$related_entity.transaction_type', ['PAYMENT', 'MANUAL_JOURNAL']] },
                  ],
                },
              },
            },
            { $sort: { posted_date: -1 } },
            // Limit to 1 to get only the latest journal entry
            { $limit: 1 },
          ],
          as: 'journalsData',
        },
      },
      {
        $unwind: { path: '$journalsData', preserveNullAndEmptyArrays: true },
      },
      { $match: journalDateFilter },
      {
        $group: {
          _id: '$phone',
          doc: { $first: '$$ROOT' },
        },
      },
      {
        $replaceRoot: { newRoot: '$doc' },
      },
      {
        $project: {
          _id: 0,
          'Account Number': '$account.number',
          'Contact Code': {
            $cond: {
              if: { $or: [{ $eq: ['$journalsData', null] }, { $eq: ['$journalsData.contact_code', null] }] },
              then: '',
              else: { $concat: ['"', { $toString: '$journalsData.contact_code' }, '"'] },
            },
          },
          'Customer Name': '$profile.name',
          'Customer Type': '$profile.type',
          'Service Provider': {
            $let: {
              vars: {
                spField: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$custom_fields',
                        as: 'field',
                        cond: { $eq: ['$$field.key', 'service_provider'] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: '$$spField.value_label',
            },
          },
          'Customer Code': {
            $cond: {
              if: {
                $eq: [
                  {
                    $size: {
                      $filter: {
                        input: '$custom_fields',
                        as: 'field',
                        cond: { $eq: ['$$field.key', 'customer_code'] },
                      },
                    },
                  },
                  0,
                ],
              },
              then: '',
              else: {
                $let: {
                  vars: {
                    codeField: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: '$custom_fields',
                            as: 'field',
                            cond: { $eq: ['$$field.key', 'customer_code'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: '$$codeField.value_label',
                },
              },
            },
          },
          Mobile: '$phone',
          Ward: '$location.address_line1',
          Road: '$location.address_line2',
          Island: '$location.city',
          Atoll: '$location.province',
          'Business Name': '$business_name',
          'Sales Model': '$sales_model.name',
          // 'Payment Type': {
          //   $cond: {
          //     if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
          //     then: 'QuickPay',
          //     else: { $arrayElemAt: ['$ordersData.payment_method.type', 0] },
          //   },
          // },
          'Payment Type': {
            $cond: {
              if: { $eq: ['$journalsData.submited_by_user_name', 'Fareedh Test (c545*******b9b8d)'] },
              then: 'Quick Pay',
              else: {
                $cond: {
                  if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'CRM_WALLET'] },
                  then: 'CASH',
                  else: {
                    $cond: {
                      if: { $eq: ['$journalsData.related_entity.transaction_type', 'MANUAL_JOURNAL'] },
                      then: {
                        $switch: {
                          branches: [
                            { case: { $eq: ['$journalsData.account_type', 'CREDIT'] }, then: 'Credit Note' },
                            { case: { $eq: ['$journalsData.account_type', 'DEBIT'] }, then: 'Debit Note' },
                          ],
                          default: { $arrayElemAt: ['$ordersData.payment_method.type', 0] }
                        }
                      },
                      else: { $arrayElemAt: ['$ordersData.payment_method.type', 0] }
                    }
                  }
                }
              }
            }
          },
          'Account Balance': {
            $cond: {
              if: { $eq: [{ $type: '$account.balance' }, 'array'] },
              then: { $toDouble: { $arrayElemAt: ['$account.balance', 0] } },
              else: { $toDouble: { $ifNull: ['$account.balance', '0.0'] } },
            },
          },
          'Credit Limit': {
            $cond: {
              if: { $eq: [{ $type: '$classification.credit_limit' }, 'array'] },
              then: { $toDouble: { $arrayElemAt: ['$classification.credit_limit', 0] } },
              else: { $toDouble: { $ifNull: ['$classification.credit_limit', '0.0'] } },
            },
          },
          Currency: '$classification.currency',
          'Account Status': '$account.life_cycle_state',
          'Registration Date': {
            $dateToString: {
              format: '%d-%b-%Y',
              date: {
                $toDate: {
                  $multiply: [
                    {
                      $cond: {
                        if: { $eq: [{ $type: '$profile.registration_date' }, 'array'] },
                        then: { $arrayElemAt: ['$profile.registration_date', 0] },
                        else: { $toLong: { $ifNull: ['$profile.registration_date', 0] } },
                      },
                    },
                    1000,
                  ],
                },
              },
            },
          },
          'Device Name': { $arrayElemAt: ['$devicesData.product.name', 0] },
          'Service Status': '$subscriptionsData.services.state',
          'Service Package': '$subscriptionsData.services.product.name',
          'Service Price': {
            $reduce: {
              input: {
                $map: {
                  input: '$subscriptionsData.services.price_terms.price',
                  as: 'price',
                  in: {
                    $round: [
                      {
                        $toDouble: {
                          $ifNull: ['$$price', '0.0'],
                        },
                      },
                      2,
                    ],
                  },
                },
              },
              initialValue: '',
              in: {
                $cond: {
                  if: { $eq: ['$$value', ''] },
                  then: { $toString: '$$this' },
                  else: { $concat: ['$$value', ', ', { $toString: '$$this' }] },
                },
              },
            },
          },
          'Tag Area': {
            $reduce: {
              input: {
                $map: {
                  input: '$tags',
                  as: 'tag',
                  in: '$$tag.name',
                },
              },
              initialValue: '',
              in: {
                $cond: {
                  if: { $eq: ['$$value', ''] },
                  then: '$$this',
                  else: { $concat: ['$$value', ', ', '$$this'] },
                },
              },
            },
          },
          'Posted Date': {
            $cond: {
              if: { $or: [{ $eq: ['$journalsData', null] }, { $eq: ['$journalsData.posted_date', null] }] },
              then: '',
              else: {
                $dateToString: {
                  format: '%d-%b-%Y',
                  date: { $toDate: { $multiply: ['$journalsData.posted_date', 1000] } },
                  timezone: 'Indian/Maldives',
                },
              },
            },
          },
          'User Name': {
            $cond: {
              if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
              then: 'Quick Pay',
              else: {
                $cond: {
                  if: { $or: [{ $eq: ['$journalsData', null] }, { $eq: ['$journalsData.submited_by_user_name', null] }] },
                  then: '',
                  else: { $toString: '$journalsData.submited_by_user_name' },
                },
              },
            },
          },
          'Decoder No': {
            $cond: {
              if: {
                $or: [
                  { $eq: [{ $type: { $arrayElemAt: ['$devicesData.custom_fields', 0] } }, 'missing'] },
                  { $eq: [{ $arrayElemAt: ['$devicesData.custom_fields', 0] }, null] },
                  { $eq: [{ $size: { $arrayElemAt: ['$devicesData.custom_fields', 0] } }, 0] },
                ],
              },
              then: '',
              else: {
                $let: {
                  vars: {
                    codeField: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: { $arrayElemAt: ['$devicesData.custom_fields', 0] },
                            as: 'field',
                            cond: { $eq: ['$$field.key', 'code'] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: {
                    $cond: {
                      if: { $or: [{ $eq: ['$$codeField', null] }, { $eq: ['$$codeField', undefined] }] },
                      then: '',
                      else: { $toString: '$$codeField.value' },
                    },
                  },
                },
              },
            },
          },
          'Receipt ID': {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$journalsData', null] },
                  { $eq: ['$journalsData.related_entity', null] },
                  {
                    $and: [
                      { $eq: ['$journalsData.related_entity.number', null] },
                      { $eq: ['$journalsData.related_entity.reference_code', null] }
                    ]
                  }
                ]
              },
              then: '',
              else: {
                $concat: ["'", {
                  $toString: {
                    $cond: {
                      if: { $ne: ['$journalsData.related_entity.number', null] },
                      then: '$journalsData.related_entity.number',
                      else: {
                        $cond: {
                          if: { $ne: ['$journalsData.related_entity.reference_code', null] },
                          then: '$journalsData.related_entity.reference_code',
                          else: '$journalsData.code'
                        }
                      }
                    }
                  }
                }]
              }
            }
          },
          'Address': {
            $reduce: {
              input: [
                { $toString: { $ifNull: ['$location.address_line1', ''] } },
                { $toString: { $ifNull: ['$location.address_line2', ''] } },
                { $toString: { $ifNull: ['$location.address_name', ''] } },
                { $toString: { $ifNull: ['$location.city', ''] } },
                { $toString: { $ifNull: ['$location.country', ''] } },
                { $toString: { $ifNull: ['$location.town_city', ''] } },
                { $toString: { $ifNull: ['$location.state_province_county', ''] } },
              ],
              initialValue: '',
              in: {
                $cond: {
                  if: {
                    $and: [
                      { $ne: ['$$this', ''] },
                      { $ne: ['$$value', ''] },
                    ],
                  },
                  then: { $concat: ['$$value', ', ', '$$this'] },
                  else: {
                    $cond: {
                      if: { $eq: ['$$value', ''] },
                      then: '$$this',
                      else: '$$value',
                    },
                  },
                },
              },
            },
          },
          'Payment Action': {
            $cond: {
              if: { $or: [{ $eq: ['$journalsData', null] }, { $eq: ['$journalsData.account_type', null] }] },
              then: '',
              else: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$journalsData.account_type', 'CREDIT'] }, then: 'Add' },
                    { case: { $eq: ['$journalsData.account_type', 'DEBIT'] }, then: 'Deduct' },
                  ],
                  default: '',
                },
              },
            },
          },
          'GST': {
            $reduce: {
              input: {
                $map: {
                  input: '$subscriptionsData.services.price_terms.price',
                  as: 'price',
                  in: {
                    $round: [
                      {
                        $multiply: [
                          { $divide: [{ $toDouble: { $ifNull: ['$$price', '0.0'] } }, 2.16] },
                          0.16
                        ]
                      },
                      2
                    ]
                  },
                },
              },
              initialValue: '',
              in: {
                $cond: {
                  if: { $eq: ['$$value', ''] },
                  then: { $toString: '$$this' },
                  else: { $concat: ['$$value', ', ', { $toString: '$$this' }] },
                },
              },
            },
          },
          'Amount': {
            $reduce: {
              input: {
                $map: {
                  input: '$subscriptionsData.services.price_terms.price',
                  as: 'price',
                  in: {
                    $ceil: {
                      $add: [
                        { $divide: [{ $toDouble: { $ifNull: ['$$price', '0.0'] } }, 2.16] },
                        {
                          $multiply: [
                            { $divide: [{ $toDouble: { $ifNull: ['$$price', '0.0'] } }, 2.16] },
                            0.16
                          ]
                        }
                      ]
                    }
                  },
                },
              },
              initialValue: '',
              in: {
                $cond: {
                  if: { $eq: ['$$value', ''] },
                  then: { $toString: '$$this' },
                  else: { $concat: ['$$value', ', ', { $toString: '$$this' }] },
                },
              },
            },
          },
        },
      },
    ];

    // Add pagination stages for JSON format
    let results;
    let pagination = null;
    if (format === 'json' && page && limit) {
      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 10;
      const skipNum = (pageNum - 1) * limitNum;

      // Get total count
      const countResult = await mongoose.connection.db
        .collection('ContactProfiles')
        .aggregate(countPipeline, { maxTimeMS: 600000, allowDiskUse: true })
        .toArray();
      const totalItems = countResult.length > 0 ? countResult[0].totalItems : 0;
      const totalPages = Math.ceil(totalItems / limitNum);

      // Add skip and limit to the main query
      aggregationQuery.push(
        { $skip: skipNum },
        { $limit: limitNum }
      );

      // Execute paginated query
      results = await mongoose.connection.db
        .collection('ContactProfiles')
        .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
        .toArray();

      // Prepare pagination metadata
      pagination = {
        totalItems,
        totalPages,
        currentPage: pageNum,
        pageSize: limitNum,
      };
    } else {
      // Execute non-paginated query (for CSV or JSON without pagination)
      results = await mongoose.connection.db
        .collection('ContactProfiles')
        .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
        .toArray();
    }

    // Handle response format
    if (format === 'csv') {
      const fields = [
        { label: 'Posted Date', value: 'Posted Date' },
        { label: 'User Name', value: 'User Name' },
        { label: 'Dealer', value: 'Service Provider' },
        { label: 'Decoder No.', value: 'Decoder No' },
        { label: 'Account Number', value: 'Account Number' },
        { label: 'Area', value: 'Tag Area' },
        { label: 'Customer Name', value: 'Customer Name' },
        { label: 'Atoll', value: 'Atoll' },
        { label: 'Island', value: 'Island' },
        { label: 'Ward', value: 'Ward' },
        { label: 'Road', value: 'Road' },
        { label: 'Address', value: 'Address' },
        { label: 'Payment Type', value: 'Payment Type' },
        { label: 'Payment Action', value: 'Payment Action' },
        { label: 'Mobile', value: 'Mobile' },
        { label: 'Amount', value: 'Amount' },
        { label: 'GST', value: 'GST' },
        { label: 'Service Price', value: 'Service Price' },
        { label: 'Receipt ID', value: 'Receipt ID' },
      ];
      const csvData = parse(results, { fields });
      return { data: csvData, isCsv: true };
    }

    // Return JSON with pagination metadata
    return {
      data: results,
      isCsv: false,
      pagination,
    };
  } catch (error) {
    console.error('Error exporting customer report:', error);
    throw new Error('Error exporting customer report');
  }
};

const exportCustomerCollection = async (
  page,
  limit,
  search,
  startDate,
  endDate,
  atoll,
  island,) => {
  try {
    // Calculate timestamps
    let startTimestamp, endTimestamp;
    if (startDate) {
      startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
    }
    if (endDate) {
      endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);
    }

    // Match stage
    let matchStage = {
      'related_entity.transaction_type': { $in: ['PAYMENT', 'MANUAL_JOURNAL'] },
    };
    if (startTimestamp) {
      matchStage.posted_date = { $gte: startTimestamp };
    }
    if (endTimestamp) {
      matchStage.posted_date = matchStage.posted_date || {};
      matchStage.posted_date.$lte = endTimestamp;
    }
    if (search) {
      matchStage.$text = { $search: search };
    }

    // Aggregation pipeline
    const aggregationQuery = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'ContactProfiles',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'joinedData',
        },
      },
      {
        $lookup: {
          from: 'Events',
          let: { contact_id: '$contact_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$contact_id', '$$contact_id'] },
                type: 'PAYMENT_POSTED',
              },
            },
            {
              $project: {
                _id: 0,
                transaction_number: '$transaction.number',
                payment_method_type: '$payment_method.payment_method_type',
              },
            },
          ],
          as: 'eventData',
        },
      },
      {
        $project: {
          _id: 0,
          posted_date: {
            $dateToString: { format: '%d %b %Y', date: { $toDate: { $multiply: ['$posted_date', 1000] } } },
          },
          name: {
            $cond: {
              if: { $gt: [{ $size: '$joinedData' }, 0] },
              then: {
                $concat: [
                  { $arrayElemAt: ['$joinedData.demographics.first_name', 0] },
                  ' ',
                  { $arrayElemAt: ['$joinedData.demographics.last_name', 0] },
                ],
              },
              else: 'N/A',
            },
          },
          phone: { $arrayElemAt: ['$joinedData.phone', 0] },
          atoll: { $arrayElemAt: ['$joinedData.location.province', 0] },
          island: { $arrayElemAt: ['$joinedData.location.city', 0] },
          ward: { $arrayElemAt: ['$joinedData.location.address_line1', 0] },
          road: { $arrayElemAt: ['$joinedData.location.address_line2', 0] },
          address: {
            $cond: {
              if: { $gt: [{ $size: '$joinedData' }, 0] },
              then: {
                $concat: [
                  { $arrayElemAt: ['$joinedData.location.address_line1', 0] },
                  ', ',
                  { $arrayElemAt: ['$joinedData.location.address_name', 0] },
                  ', ',
                  { $arrayElemAt: ['$joinedData.location.address_line2', 0] },
                  ', ',
                  { $arrayElemAt: ['$joinedData.location.city', 0] },
                  ', ',
                  { $arrayElemAt: ['$joinedData.location.province', 0] },
                  ', ',
                  { $arrayElemAt: ['$joinedData.location.country', 0] },
                ],
              },
              else: 'N/A',
            },
          },
          account_number: 1,
          service_price: { $toDouble: '$amount' },
          submitted_by_user: '$submited_by_user_name',
          dealer: { $arrayElemAt: ['$joinedData.custom_fields.value_label', 0] },
          receipt_id: { $arrayElemAt: ['$eventData.transaction_number', 0] },
          payment_type: { $arrayElemAt: ['$eventData.payment_method_type', 0] },
        },
      },
      { $limit: 100 }
    ];

    console.log('aggregationQuery:', aggregationQuery)

    console.log('Starting asynchronous aggregation...');
    const result = await mongoose.connection.db
      .collection('Journals')
      .aggregate(aggregationQuery, { maxTimeMS: 60000, allowDiskUse: true })
      .batchSize(1000);
    console.log(result, 'result having datas')
    return result;
  } catch (error) {
    console.error('Error details:', error.name, error.message, error.stack);
    throw new Error(`Error exporting report: ${error.message}`);
  }
};


const exportDealerReports = async (startDate, endDate, dealerName) => {

  try {
    // Prepare the match stage for filtering
    let matchStage = {};
    if (startDate) {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      matchStage["joinedData2.PostedDate"] = { $gte: startTimestamp };
    }
    if (endDate) {
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      if (matchStage["joinedData2.PostedDate"]) {
        matchStage["joinedData2.PostedDate"].$lte = endTimestamp;
      } else {
        matchStage["joinedData2.PostedDate"] = { $lte: endTimestamp };
      }
    }
    if (dealerName) {
      matchStage["merchant_name"] = dealerName;
    }

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
      // Add the match stage for filtering
      { $match: matchStage },
      {
        $addFields: {
          "joinedData2.Dealer Name": "$merchant_name",
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
      { $replaceRoot: { newRoot: '$doc' } },
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
  }
  catch (error) {
    console.log('Error exporting report:', error);
    throw new Error("Error exporting report");
  }
};


const exportCollectionReports = async (search, startDate, endDate, atoll, island) => {
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
          "Contact Name": { $arrayElemAt: ['$joinedData2.profile.name', 0] },
          "Contact Code": {
            $concat: ['"', { $toString: { $arrayElemAt: ['$joinedData4.contact_code', 0] } }, '"']
          },
          "Back Office Code": '$joinedData4.related_entity.backoffice_code',
          "Account Number": {
            $ifNull: [
              { $arrayElemAt: ['$joinedData4.account_number', 0] },
              'N/A'
            ]
          },
          "Amount": {
            $ifNull: [
              {
                $reduce: {
                  input: {
                    $map: {
                      input: "$joinedData4.amount",
                      as: "amt",
                      in: { $toString: "$$amt" }
                    }
                  },
                  initialValue: "",
                  in: {
                    $cond: [
                      { $eq: ["$$value", ""] },
                      "$$this",
                      { $concat: ["$$value", ", ", "$$this"] }
                    ]
                  }
                }
              },
              "N/A"
            ]
          },
          "Total Default Currency": {
            $toDouble: {
              $ifNull: [
                { $arrayElemAt: ['$joinedData4.total_default_currency', 0] },
                0
              ]
            }
          },
          "Payment Type": {
            $cond: {
              if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
              then: 'QuickPay',
              else: { $arrayElemAt: ['$ordersData.payment_method.type', 0] }
            }
          },
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

const serviceRequestReports = async (req) => {
  try {
    const { startDate, endDate } = req.query;

    // Validate and parse the date range
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the entire end day

      // Convert dates to Unix timestamps (in seconds) for comparison with created_date
      const startTimestamp = Math.floor(start.getTime() / 1000);
      const endTimestamp = Math.floor(end.getTime() / 1000);

      dateFilter = {
        created_date: {
          $gte: startTimestamp,
          $lte: endTimestamp,
        },
      };
    } else {
      throw new Error('Start date and end date are required');
    }

    const aggregationQuery = [
      // Match stage to filter by date range
      {
        $match: dateFilter,
      },
      // Join with ContactProfiles
      {
        $lookup: {
          from: "ContactProfiles",
          localField: "contact_id",
          foreignField: "contact_id",
          as: "contact",
        },
      },
      { $unwind: "$contact" },

      // Add formatted fields
      {
        $addFields: {
          Name: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ["$contact.demographics.first_name", ""] },
                  " ",
                  { $ifNull: ["$contact.demographics.last_name", ""] },
                ],
              },
              chars: " ",
            },
          },
          UserID: {
            $let: {
              vars: {
                customerCodeField: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$contact.custom_fields",
                        cond: { $eq: ["$$this.key", "customer_code"] },
                      },
                    },
                    0,
                  ],
                },
              },
              in: { $ifNull: ["$$customerCodeField.value", "N/A"] },
            },
          },
          Address: {
            $concat: [
              { $ifNull: ["$contact.location.address_line1", ""] },
              ", ",
              { $ifNull: ["$contact.location.address_line2", ""] },
              ", ",
              { $ifNull: ["$contact.location.city", ""] },
              ", ",
              { $ifNull: ["$contact.location.province", ""] },
              ", ",
              {
                $switch: {
                  branches: [
                    {
                      case: { $eq: ["$contact.location.country", "MDV"] },
                      then: "Maldives",
                    },
                  ],
                  default: { $ifNull: ["$contact.location.country", ""] },
                },
              },
            ],
          },
          Email: { $ifNull: ["$contact.email", ""] },
          Mobile: { $ifNull: ["$contact.phone", ""] },
        },
      },

      {
        $lookup: {
          from: "Devices",
          localField: "contact_id",
          foreignField: "ownership.id",
          as: "device",
        },
      },
      { $unwind: { path: "$device", preserveNullAndEmptyArrays: true } },

      {
        $addFields: {
          "STB Type/ App": { $ifNull: ["$device.product.name", "N/A"] },
        },
      },

      // Project fields in new order + Description
      {
        $project: {
          _id: 0,
          "Open Aging": {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: { $toDate: { $multiply: ["$created_date", 1000] } },
            },
          },
          "Closed Aging": {
            $round: [
              {
                $divide: [
                  { $abs: { $subtract: ["$actual_close_date", "$created_date"] } },
                  86400,
                ],
              },
              0,
            ],
          },
          "Service Request Status": {
            $ifNull: ["$status.name", ""],
          },
          Priority: "$priority",
          Team: {
            $ifNull: ["$owner_team.name", ""],
          },
          "Service Request Categories": {
            $ifNull: ["$queue.name", ""],
          },
          "Current Assigned Users": {
            $ifNull: ["$owner.name", ""],
          },
          UserID: 1,
          "Service Request": "$number",
          Name: 1,
          Description: "$description",
          Address: 1,
          Atoll: { $ifNull: ["$contact.location.province", ""] },
          Island: { $ifNull: ["$contact.location.city", ""] },
          Email: 1,
          Mobile: 1,
          "STB Type/ App": 1,
          "Closure Date": {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: { $toDate: { $multiply: ["$actual_close_date", 1000] } },
            },
          },
          "Closing Comment": {
            $ifNull: ["$response", ""],
          },
        },
      },
    ];

    const results = await mongoose.connection.db
      .collection('ServiceRequests')
      .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
      .toArray();

    if (results.length === 0) {
      throw new Error('No data found for the report');
    }

    // CSV with new column order
    const csvData = parse(results, {
      fields: [
        "Open Aging",
        "Closed Aging",
        "UserID",
        "Service Request",
        "Name",
        "Description",
        "Address",
        "Atoll",
        "Island",
        "Email",
        "Mobile",
        "Service Request Status",
        "Priority",
        "Team",
        "Service Request Categories",
        "Current Assigned Users",
        "STB Type/ App",
        "Closure Date",
        "Closing Comment",
      ],
    });

    return csvData;
  } catch (error) {
    console.error('Error exporting report:', error);
    throw new Error('Error exporting report');
  }
};


const getGraphData = async (req, res) => {
  try {
    // Current timestamp in seconds (to calculate aging for open tickets)
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const currentYear = new Date().getFullYear(); // Get the current year (e.g., 2025)

    // Aggregation pipeline to calculate aging and bucket tickets
    const aggregationQuery = [
      // Step 1: Filter for the current year based on created_date
      {
        $match: {
          $expr: {
            $eq: [
              { $year: { $toDate: { $multiply: ["$created_date", 1000] } } }, // Convert created_date to date and extract year
              currentYear,
            ],
          },
        },
      },

      // Step 2: Add a field for aging in days
      {
        $addFields: {
          agingInSeconds: {
            $cond: {
              if: "$resolved",
              then: { $subtract: ["$actual_close_date", "$created_date"] },
              else: { $subtract: [currentTimestamp, "$created_date"] },
            },
          },
        },
      },
      {
        $addFields: {
          agingInDays: { $divide: ["$agingInSeconds", 86400] }, // Convert seconds to days
        },
      },

      // Step 3: Add a field for the bucket based on aging
      {
        $addFields: {
          agingBucket: {
            $switch: {
              branches: [
                { case: { $lt: ["$agingInDays", 1] }, then: "<24hr" },
                { case: { $and: [{ $gte: ["$agingInDays", 1] }, { $lt: ["$agingInDays", 2] }] }, then: "24hr" },
                { case: { $and: [{ $gte: ["$agingInDays", 2] }, { $lt: ["$agingInDays", 5] }] }, then: "48hr" },
                { case: { $and: [{ $gte: ["$agingInDays", 5] }, { $lt: ["$agingInDays", 11] }] }, then: "5-10 days" },
                { case: { $and: [{ $gte: ["$agingInDays", 11] }, { $lt: ["$agingInDays", 21] }] }, then: "11-20 days" },
                { case: { $and: [{ $gte: ["$agingInDays", 21] }, { $lt: ["$agingInDays", 31] }] }, then: "21-30 days" },
              ],
              default: ">30 days",
            },
          },
        },
      },

      // Step 4: Facet to split the pipeline into installation and fault tickets
      {
        $facet: {
          installationTickets: [
            { $match: { "queue.name": "New Connections" } }, // Only closed tickets
            // Group by aging bucket for histogram
            {
              $group: {
                _id: "$agingBucket",
                Closed: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                bucket: "$_id",
                Closed: 1,
              },
            },
          ],
          faultTickets: [
            { $match: { "queue.name": "Fault", resolved: true } }, // Only closed tickets
            // Group by aging bucket for histogram
            {
              $group: {
                _id: "$agingBucket",
                Closed: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                bucket: "$_id",
                Closed: 1,
              },
            },
          ],
          installationPie: [
            { $match: { "queue.name": "New Connections" } },
            {
              $group: {
                _id: "$resolved",
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                resolved: "$_id",
                count: 1,
              },
            },
          ],
          faultPie: [
            { $match: { "queue.name": "Fault" } },
            {
              $group: {
                _id: "$resolved",
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                resolved: "$_id",
                count: 1,
              },
            },
          ],
        },
      },
    ];

    const results = await mongoose.connection.db
      .collection('ServiceRequests')
      .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
      .toArray();

    if (!results || results.length === 0) {
      throw new Error('No data found for the graphs');
    }

    const result = results[0];

    // Ensure all buckets are present in the histograms
    const buckets = ["<24hr", "24hr", "48hr", "5-10 days", "11-20 days", "21-30 days", ">30 days"];
    const completeHistogram = (data) => {
      const existingBuckets = data.map((item) => item.bucket);
      const missingBuckets = buckets.filter((bucket) => !existingBuckets.includes(bucket));
      const missingData = missingBuckets.map((bucket) => ({
        bucket,
        Closed: 0,
      }));
      return [...data, ...missingData].sort((a, b) => buckets.indexOf(a.bucket) - buckets.indexOf(b.bucket));
    };

    // Format the pie chart data
    const formatPieData = (data) => {
      const closed = data.find((item) => item.resolved === true)?.count || 0;
      const open = data.find((item) => item.resolved === false)?.count || 0;
      return { Closed: closed, Open: open };
    };

    const responseData = {
      year: currentYear, // Include the current year in the response
      installationHistogram: completeHistogram(result.installationTickets),
      faultHistogram: completeHistogram(result.faultTickets),
      installationPie: formatPieData(result.installationPie),
      faultPie: formatPieData(result.faultPie),
    };

    return responseData;
  } catch (error) {
    console.error('Error fetching graph data:', error);
    throw new Error('Error fetching graph data');
  }
};

const getQueueData = async (req, res) => {
  try {
    // Current timestamp in seconds
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const currentYear = new Date().getFullYear();

    // Get the owner_team filter from query params (e.g., "Male", "Hulhumale", or "All")
    const ownerTeamFilter = req.query.owner_team || 'All';

    // Base match stage for filtering by year and owner_team
    const matchStage = {
      $match: {
        $expr: {
          $eq: [
            { $year: { $toDate: { $multiply: ["$created_date", 1000] } } },
            currentYear,
          ],
        },
      },
    };

    // Add owner_team filter if not "All"
    if (ownerTeamFilter !== 'All') {
      matchStage.$match['owner_team.name'] = ownerTeamFilter;
    }

    // Aggregation pipeline
    const aggregationQuery = [
      // Step 1: Filter by year (and owner_team if specified)
      matchStage,

      // Step 2: Add aging in days
      {
        $addFields: {
          agingInSeconds: {
            $cond: {
              if: "$resolved",
              then: { $subtract: ["$actual_close_date", "$created_date"] },
              else: { $subtract: [currentTimestamp, "$created_date"] },
            },
          },
        },
      },
      {
        $addFields: {
          agingInDays: { $divide: ["$agingInSeconds", 86400] }, // Convert seconds to days
        },
      },

      // Step 3: Add aging bucket
      {
        $addFields: {
          agingBucket: {
            $switch: {
              branches: [
                { case: { $lt: ["$agingInDays", 1] }, then: "Less 24 Hrs" },
                { case: { $and: [{ $gte: ["$agingInDays", 1] }, { $lt: ["$agingInDays", 2] }] }, then: "24 Hrs" },
                { case: { $and: [{ $gte: ["$agingInDays", 2] }, { $lt: ["$agingInDays", 5] }] }, then: "48 Hrs" },
                { case: { $and: [{ $gte: ["$agingInDays", 5] }, { $lt: ["$agingInDays", 11] }] }, then: "5-10 Days" },
                { case: { $and: [{ $gte: ["$agingInDays", 11] }, { $lt: ["$agingInDays", 21] }] }, then: "11-20 Days" },
                { case: { $and: [{ $gte: ["$agingInDays", 21] }, { $lt: ["$agingInDays", 31] }] }, then: "21-30 Days" },
              ],
              default: ">30 days",
            },
          },
        },
      },

      // Step 4: Facet to split into main table and aging summaries
      {
        $facet: {
          // Main table: Group by queue.name and owner_team.name
          queueTable: [
            {
              $group: {
                _id: {
                  queueName: "$queue.name",
                  ownerTeam: "$owner_team.name",
                },
                totalTickets: { $sum: 1 },
                openTickets: { $sum: { $cond: [{ $eq: ["$resolved", false] }, 1, 0] } },
                closedTickets: { $sum: { $cond: [{ $eq: ["$resolved", true] }, 1, 0] } },
              },
            },
            {
              $project: {
                _id: 0,
                queueName: "$_id.queueName",
                ownerTeam: "$_id.ownerTeam",
                totalTickets: 1,
                openTickets: 1,
                closedTickets: 1,
              },
            },
          ],

          // Open tickets aging summary
          openTicketsAging: [
            { $match: { resolved: false } },
            {
              $group: {
                _id: "$agingBucket",
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                agingBucket: "$_id",
                count: 1,
              },
            },
          ],

          // Closed tickets aging summary
          closedTicketsAging: [
            { $match: { resolved: true } },
            {
              $group: {
                _id: "$agingBucket",
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                agingBucket: "$_id",
                count: 1,
              },
            },
          ],

          // Total tickets count (for display)
          totalTickets: [
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                count: 1,
              },
            },
          ],
        },
      },
    ];

    const results = await mongoose.connection.db
      .collection('ServiceRequests')
      .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
      .toArray();

    if (!results || results.length === 0) {
      throw new Error('No data found for the queue');
    }

    const result = results[0];

    // Ensure all aging buckets are present
    const agingBuckets = ["Less 24 Hrs", "24 Hrs", "48 Hrs", "5-10 Days", "11-20 Days", "21-30 Days", ">30 days"];
    const completeAgingSummary = (data) => {
      const existingBuckets = data.map((item) => item.agingBucket);
      const missingBuckets = agingBuckets.filter((bucket) => !existingBuckets.includes(bucket));
      const missingData = missingBuckets.map((bucket) => ({
        agingBucket: bucket,
        count: 0,
      }));
      return [...data, ...missingData].sort(
        (a, b) => agingBuckets.indexOf(a.agingBucket) - agingBuckets.indexOf(b.agingBucket)
      );
    };

    // Calculate percentages for aging summaries
    const totalOpenTickets = result.openTicketsAging.reduce((sum, item) => sum + item.count, 0);
    const totalClosedTickets = result.closedTicketsAging.reduce((sum, item) => sum + item.count, 0);

    const openTicketsAgingWithPercentage = completeAgingSummary(result.openTicketsAging).map((item) => ({
      ...item,
      percentage: totalOpenTickets > 0 ? ((item.count / totalOpenTickets) * 100).toFixed(2) : "0.00",
    }));

    const closedTicketsAgingWithPercentage = completeAgingSummary(result.closedTicketsAging).map((item) => ({
      ...item,
      percentage: totalClosedTickets > 0 ? ((item.count / totalClosedTickets) * 100).toFixed(2) : "0.00",
    }));

    const responseData = {
      queueTable: result.queueTable,
      openTicketsAging: openTicketsAgingWithPercentage,
      closedTicketsAging: closedTicketsAgingWithPercentage,
      totalTickets: result.totalTickets[0]?.count || 0,
    };

    return responseData
  } catch (error) {
    console.error('Error fetching queue data:', error);
  }
};


const exportManualJournalReports = async (page, limit) => {
  try {
    const matchConditions = { "related_entity.transaction_type": "MANUAL_JOURNAL" };
    const aggregationPipeline = [
      { $match: matchConditions },
      { $sort: { posted_date: -1 } }
    ];

    // Apply pagination only if page and limit are provided
    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      aggregationPipeline.push({ $skip: skip }, { $limit: limit });
    }

    aggregationPipeline.push({
      $project: {
        _id: 0,
        "Account Number": "$account_number",
        "Contact Name": "$contact_name",
        "Posted Date": {
          $dateToString: {
            format: "%Y-%m-%d %H:%M:%S",
            date: { $toDate: { $multiply: ["$posted_date", 1000] } }
          }
        },
        "Action Type": "$account_type",
        "Amount": { $toDouble: "$amount" },
        "Remarks": { $ifNull: ["$notes", "N/A"] },
        "Submitted By": { $ifNull: ["$submited_by_user_name", "N/A"] },
        "Business Name": 1
      }
    });

    const results = await mongoose.connection.db.collection('Journals')
      .aggregate(aggregationPipeline, { maxTimeMS: 60000, allowDiskUse: true })
      .toArray();

    const total = await mongoose.connection.db.collection('Journals')
      .countDocuments(matchConditions);

    const csvData = parse(results); // Assuming 'parse' converts JSON to CSV string

    return {
      message: 'Billing Reports Data',
      data: results,
      pagination: (page !== undefined && limit !== undefined) ? {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      } : undefined,
      csvData
    };

  } catch (error) {
    console.error('Error exporting manual journal report:', error);
    throw error;
  }
};


const getMetrics = async () => {
  try {
    const aggregationPipeline = [
      { $unwind: "$services" }, // Unwind first to reduce document size early
      {
        $group: {
          _id: null,
          totalSubscriptions: { $sum: 1 },
          activeSubscriptions: {
            $sum: { $cond: [{ $eq: ["$services.state", "EFFECTIVE"] }, 1, 0] }
          },
          totalRevenue: {
            $sum: {
              $toDouble: {
                $ifNull: ["$services.price_terms.price", "0"]
              }
            }
          }
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
    };
  } catch (err) {
    console.error('Error occurred in metrics:', err);
    throw err;
  }
};

const getPackageDistribution = async () => {
  try {
    const aggregationPipeline = [
      { $unwind: "$services" },
      {
        $group: {
          _id: "$services.product.name",
          value: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          value: 1
        }
      },
      { $sort: { value: -1 } },
      { $limit: 50 }
    ];

    const results = await mongoose.connection.db.collection('Subscriptions')
      .aggregate(aggregationPipeline)
      .toArray();

    return results;
  } catch (err) {
    console.error("Error occurred in package distribution:", err);
    throw err;
  }
};

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
              then: {
                $reduce: {
                  input: "$_id",
                  initialValue: "",
                  in: { $concat: ["$$value", { $cond: [{ $eq: ["$$value", ""] }, "", ", "] }, "$$this"] }
                }
              },
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

// const getAllDealerReports = async (page = 1, limit = 10, startDate, endDate,dealerName) => {
//     try {
//         const aggregationQuery = [
//             {
//                 $lookup: {
//                     from: 'Journals',
//                     localField: 'merchant_id',
//                     foreignField: 'account_organisation_id',
//                     as: 'joinedData2',
//                     pipeline: [
//                         {
//                             $project: {
//                                 AccountType: '$account_type',
//                                 Amount: { $toDouble: '$amount' },
//                                 PostedDate: '$posted_date',
//                                 Account: '$account_organisation_name',
//                                 _id: 0
//                             }
//                         },
//                     ]
//                 }
//             },
//             { $unwind: { path: '$joinedData2', preserveNullAndEmptyArrays: true } },
//             {
//                 $addFields: {
//                     "joinedData2.Dealer Name": "$merchant_name",
//                     "joinedData2.Date": {
//                         $dateToString: {
//                             format: "%d-%m-%Y %H:%M:%S",
//                             date: { $toDate: { $multiply: ["$joinedData2.PostedDate", 1000] } }
//                         }
//                     },
//                     "joinedData2.BP Commission": { $divide: ["$joinedData2.Amount", 2.16] },
//                     "joinedData2.GST": { $multiply: [{ $divide: ["$joinedData2.Amount", 2.16] }, 0.16] },
//                     "joinedData2.Total TopUp Amount": "$joinedData2.Amount",
//                     "joinedData2.Original Payment": {
//                         $round: [
//                             {
//                                 $add: [
//                                     { $divide: ["$joinedData2.Amount", 2.16] },
//                                     { $multiply: [{ $divide: ["$joinedData2.Amount", 2.16] }, 0.16] }
//                                 ]
//                             },
//                         ]
//                     },
//                     "joinedData2.Account Type": {
//                         $switch: {
//                             branches: [
//                                 { case: { $eq: ["$joinedData2.AccountType", "CREDIT"] }, then: "Dealer Credit Card" },
//                                 { case: { $eq: ["$joinedData2.AccountType", "DEBIT"] }, then: "INVOICE" }
//                             ],
//                             default: "UNKNOWN"
//                         }
//                     }
//                 }
//             },
//             { $replaceRoot: { newRoot: "$joinedData2" } },
//             {
//                 $group: {
//                     _id: {
//                         Date: '$Date',
//                         AccountType: '$Account Type',
//                         DealerName: '$Account',
//                         Amount: '$Amount',
//                         BPCommission: '$BP Commission',
//                         GST: '$GST',
//                         OriginalPayment: '$Original Payment',
//                         TotalTopUp: '$Total TopUp Amount'
//                     },
//                     doc: { $first: '$$ROOT' }
//                 }
//             },
//             { $replaceRoot: { newRoot: '$doc' } },
//             {
//                 $facet: {
//                     metadata: [{ $count: "total" }],
//                     data: [
//                         { $skip: (page - 1) * limit },
//                         { $limit: limit }
//                     ]
//                 }
//             }
//         ];

//         const results = await mongoose.connection.db.collection('medianet_dealers')
//             .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
//             .toArray();

//         return {
//             data: results[0].data,
//             total: results[0].metadata[0]?.total || 0,
//             page,
//             limit,
//             totalPages: Math.ceil((results[0].metadata[0]?.total || 0) / limit)
//         };
//     } catch (error) {
//         console.log('Error fetching reports:', error);
//         throw new Error("Error fetching report data");
//     }
// };


const getAllDealerReports = async (page = 1, limit = 10, startDate, endDate, dealerName) => {
  try {
    // Prepare the match stage for filtering
    let matchStage = {};
    if (startDate) {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      matchStage["joinedData2.PostedDate"] = { $gte: startTimestamp };
    }
    if (endDate) {
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      if (matchStage["joinedData2.PostedDate"]) {
        matchStage["joinedData2.PostedDate"].$lte = endTimestamp;
      } else {
        matchStage["joinedData2.PostedDate"] = { $lte: endTimestamp };
      }
    }
    if (dealerName) {
      matchStage["merchant_name"] = dealerName;
    }

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
      // Add the match stage for filtering
      { $match: matchStage },
      {
        $addFields: {
          "joinedData2.Dealer Name": "$merchant_name",
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
      { $replaceRoot: { newRoot: '$doc' } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: (page - 1) * limit },
            { $limit: limit }
          ]
        }
      }
    ];

    const results = await mongoose.connection.db.collection('medianet_dealers')
      .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
      .toArray();

    return {
      data: results[0].data,
      total: results[0].metadata[0]?.total || 0,
      page,
      limit,
      totalPages: Math.ceil((results[0].metadata[0]?.total || 0) / limit)
    };
  } catch (error) {
    console.log('Error fetching reports:', error);
    throw new Error("Error fetching report data");
  }
};
const getDealerNames = async () => {
  try {
    const aggregationQuery = [
      {
        $lookup: {
          from: 'Journals',
          localField: 'merchant_id',
          foreignField: 'account_organisation_id',
          as: 'joinedData'
        }
      },
      { $unwind: { path: '$joinedData', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$merchant_name', // Group by merchant_name to get unique dealer names
        }
      },
      {
        $project: {
          _id: 0,
          dealerName: '$_id' // Rename _id to dealerName
        }
      },
      {
        $sort: { dealerName: 1 } // Optional: Sort alphabetically
      }
    ];

    const results = await mongoose.connection.db.collection('medianet_dealers')
      .aggregate(aggregationQuery, { maxTimeMS: 60000, allowDiskUse: true })
      .toArray();

    return {
      data: results, // Array of objects with dealerName property
      total: results.length
    };
  } catch (error) {
    console.log('Error fetching dealer names:', error);
    throw new Error("Error fetching dealer names");
  }
};


const getMtvUserReports = async (page, limit, startDate, endDate) => {
  try {
    let dateFilter = {};

    // Convert MM/DD/YYYY to Date object
    const parseDate = (dateStr, isEnd = false) => {
      if (typeof dateStr === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [month, day, year] = dateStr.split('/').map(Number);
        const date = new Date(year, month - 1, day);
        date.setHours(isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
        return date;
      }
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) throw new Error('Invalid date format');
      date.setHours(isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0, isEnd ? 999 : 0);
      return date;
    };

    if (startDate && endDate) {
      const startUTC = parseDate(startDate);
      const endUTC = parseDate(endDate, true);
      dateFilter.createdAt = { $gte: startUTC, $lte: endUTC };
    } else if (startDate) {
      const startUTC = parseDate(startDate);
      dateFilter.createdAt = { $gte: startUTC };
    } else if (endDate) {
      const endUTC = parseDate(endDate, true);
      dateFilter.createdAt = { $lte: endUTC };
    }

    // Build the aggregation pipeline
    const aggregationPipeline = [
      { $match: dateFilter },
      { $sort: { createdAt: -1 } },
      {
        $project: {
          _id: 0,
          Name: { $concat: ['$firstName', ' ', '$lastName'] },
          'Phone Number': '$phoneNumber',
          'Country Code': '$countryCode',
          'Referral Code': '$referralCode',
          'Referral Type': '$referralType',
          Date: {
            $dateToString: {
              format: '%d-%b-%Y',
              date: '$createdAt',
              timezone: 'Indian/Maldives',
            },
          },
        },
      },
    ];

    // Conditionally add pagination stages
    const isPaginated = page !== undefined && limit !== undefined;
    if (isPaginated) {
      const skip = (page - 1) * limit;
      aggregationPipeline.splice(2, 0, { $skip: skip }, { $limit: limit });
    }

    const mtvDb = getMTVConnection();
    const results = await mtvDb
      .collection('MTVUsers')
      .aggregate(aggregationPipeline)
      .toArray();

    // Calculate total count for pagination (only needed if paginated)
    let pagination = {};
    if (isPaginated) {
      const total = await mtvDb
        .collection('MTVUsers')
        .countDocuments(dateFilter);
      pagination = {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    return {
      message: 'User Reports Data',
      data: results,
      ...(isPaginated && { pagination }), // Only include pagination if paginated
    };
  } catch (err) {
    console.log('Error occurred while fetching!!', err);
    throw err;
  }
};


const getReferralCountReport = async (req) => {
  try {
    // Parse query parameters, but allow them to be undefined for CSV download
    const page = req.query.page ? parseInt(req.query.page) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
    const search = req.query.search ? req.query.search.toLowerCase() : '';
    const skip = page && limit ? (page - 1) * limit : 0; // Only calculate skip if pagination is applied

    // Build the search regex for referralCode and referralType
    const searchFilter = search
      ? {
        $or: [
          { referralCode: { $regex: search, $options: 'i' } },
          { referralType: { $regex: search, $options: 'i' } },
        ],
      }
      : {};

    // Build the base aggregation pipeline (without pagination stages)
    const aggregationPipeline = [
      // Match users with a referralCode and apply search filter
      {
        $match: {
          referralCode: { $exists: true, $ne: null },
          ...searchFilter,
        },
      },
      // Group by referralCode and referralType, and count the number of users
      {
        $group: {
          _id: {
            referralCode: '$referralCode',
            referralType: '$referralType',
          },
          referralCount: { $sum: 1 },
        },
      },
      // Filter out groups with empty referralCode or referralType
      {
        $match: {
          '_id.referralCode': { $ne: '' },
          '_id.referralType': { $ne: '' },
        },
      },
      // Project the desired output
      {
        $project: {
          _id: 0,
          'Referral Code': '$_id.referralCode',
          'Referral Type': '$_id.referralType',
          'Referral Count': '$referralCount',
        },
      },
      // Sort by Referral Count in descending order
      { $sort: { 'Referral Count': -1 } },
    ];

    // Conditionally add pagination stages if page and limit are provided
    if (page !== undefined && limit !== undefined) {
      aggregationPipeline.push(
        { $skip: skip },
        { $limit: limit }
      );
    }

    const mtvDb = getMTVConnection();
    const results = await mtvDb
      .collection('MTVUsers')
      .aggregate(aggregationPipeline)
      .toArray();

    // Get total count for pagination metadata
    const countPipeline = [
      {
        $match: {
          referralCode: { $exists: true, $ne: null },
          ...searchFilter,
        },
      },
      {
        $group: {
          _id: {
            referralCode: '$referralCode',
            referralType: '$referralType',
          },
        },
      },
      // Filter out groups with empty referralCode or referralType
      {
        $match: {
          '_id.referralCode': { $ne: '' },
          '_id.referralType': { $ne: '' },
        },
      },
      { $count: 'total' },
    ];
    const countResult = await mtvDb
      .collection('MTVUsers')
      .aggregate(countPipeline)
      .toArray();
    const total = countResult[0]?.total || 0;

    return {
      message: 'Referral Count Report Data',
      data: results,
      pagination: {
        page: page || 1, // Default to 1 if not provided
        limit: limit || total, // Use total as limit if not provided (i.e., full dataset)
        total,
        totalPages: limit ? Math.ceil(total / limit) : 1, // 1 page if no limit
      },
    };
  } catch (err) {
    console.log('Error occurred while fetching referral count report!!', err);
    throw err;
  }
};


const getDeviceStatistics = async () => {
  try {
    const aggregationQuery = [
      // Step 1: Filter ContactProfiles for specific tags
      {
        $match: {
          'tags.name': { $in: ['Medianet TV', 'OTT'] }
        }
      },
      // Step 2: Lookup Devices collection where ownership.id matches contact_id
      {
        $lookup: {
          from: 'Devices',
          localField: 'contact_id',
          foreignField: 'ownership.id',
          as: 'deviceData'
        }
      },
      // Step 3: Unwind deviceData to process each device
      {
        $unwind: {
          path: '$deviceData',
          preserveNullAndEmptyArrays: true
        }
      },
      // Step 4: Unwind tags and filter for Medianet TV and OTT
      {
        $unwind: '$tags'
      },
      {
        $match: {
          'tags.name': { $in: ['Medianet TV', 'OTT'] }
        }
      },
      // Step 5: Group by tag name only, count total devices
      {
        $group: {
          _id: '$tags.name',
          totalDevices: { $sum: 1 }
        }
      },
      // Step 6: Project the final output
      {
        $project: {
          _id: 0,
          tag: '$_id',
          totalDevices: 1
        }
      },
      // Step 7: Sort by tag for consistent output
      {
        $sort: {
          tag: 1
        }
      }
    ];

    const results = await mongoose.connection.db.collection('ContactProfiles')
      .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
      .toArray();

    // Format the response
    return {
      statistics: results.map(item => ({
        tag: item.tag,
        totalDevices: item.totalDevices
      }))
    };
  } catch (error) {
    console.log('Error fetching device statistics:', error);
    throw new Error("Error fetching device statistics");
  }
};

const getDeviceNames = async () => {
  try {
    const aggregationQuery = [
      // Step 1: Unwind services array to process each service
      {
        $unwind: {
          path: '$services',
          preserveNullAndEmptyArrays: true
        }
      },
      // Step 2: Match only services with state "EFFECTIVE"
      {
        $match: {
          'services.state': 'EFFECTIVE'
        }
      },
      // Step 3: Lookup Devices collection where ownership.id matches contact_id
      {
        $lookup: {
          from: 'Devices',
          localField: 'contact_id',
          foreignField: 'ownership.id',
          as: 'deviceData'
        }
      },
      // Step 4: Unwind deviceData to process each device
      {
        $unwind: {
          path: '$deviceData',
          preserveNullAndEmptyArrays: true
        }
      },
      // Step 5: Match devices with product name "MX 380"
      {
        $match: {
          'deviceData.product.name': 'MX 380'
        }
      },
      // Step 6: Project to include phone with each device
      {
        $project: {
          organisationName: '$organisation_name',
          phone: '$phone', // Correct path to the phone field
          deviceName: '$deviceData.product.name',
          ownershipName: '$deviceData.ownership.name'
        }
      },
      // Step 7: Group by organisation name and collect devices with their phone
      {
        $group: {
          _id: '$organisationName',
          devices: {
            $push: {
              deviceName: '$deviceName',
              ownershipName: '$ownershipName',
              phone: '$phone'
            }
          }
        }
      },
      // Step 8: Project the final output
      {
        $project: {
          _id: 0,
          organisationName: '$_id',
          devices: 1
        }
      },
      // Step 9: Sort by organisation name for consistent output
      {
        $sort: {
          organisationName: 1
        }
      }
    ];

    const results = await mongoose.connection.db.collection('ContactProfiles')
      .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
      .toArray();

    // Format the response
    return {
      statistics: results.map(item => ({
        organisationName: item.organisationName,
        devices: item.devices
      }))
    };
  } catch (error) {
    console.log('Error fetching device statistics:', error);
    throw new Error("Error fetching device statistics");
  }
};

const getDeviceStatisticsForExport = async () => {
  try {
    const aggregationQuery = [
      // Step 1: Filter ContactProfiles for specific tags
      {
        $match: {
          'tags.name': { $in: ['Medianet TV', 'OTT'] }
        }
      },
      // Step 2: Lookup Devices collection where ownership.id matches contact_id
      {
        $lookup: {
          from: 'Devices',
          localField: 'contact_id',
          foreignField: 'ownership.id',
          as: 'deviceData'
        }
      },
      // Step 3: Unwind deviceData to process each device
      {
        $unwind: {
          path: '$deviceData',
          preserveNullAndEmptyArrays: true
        }
      },
      // Step 4: Unwind tags and filter for Medianet TV and OTT
      {
        $unwind: '$tags'
      },
      {
        $match: {
          'tags.name': { $in: ['Medianet TV', 'OTT'] }
        }
      },
      // Step 5: Project the required fields
      {
        $project: {
          _id: 0,
          contact_id: '$contact_id',
          tag: '$tags.name',
          customFieldValue: '$deviceData.custom_fields.value',
          productId: '$deviceData.product.id',
          productName: '$deviceData.product.name'
        }
      }
    ];

    const results = await mongoose.connection.db.collection('ContactProfiles')
      .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
      .toArray();

    return results;
  } catch (error) {
    console.error('Error fetching device statistics for export:', error);
    throw new Error('Error fetching device statistics for export');
  }
};

const getVipTags = async () => {
  try {
    // Define aggregation pipeline
    const aggregationQuery = [
      {
        $match: {
          'tags.name': 'VIP'
        }
      },
      {
        $lookup: {
          from: 'Subscriptions',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'subscriptionData'
        }
      },
      {
        $lookup: {
          from: 'Devices',
          localField: 'contact_id',
          foreignField: 'ownership.id',
          as: 'deviceData'
        }
      },
      {
        $lookup: {
          from: 'Orders',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'orderData'
        }
      },
      {
        $lookup: {
          from: 'Journals',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'journalData'
        }
      },
      {
        $unwind: {
          path: '$subscriptionData.services',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          ContactCode: {
            $concat: ['"', { $toString: { $arrayElemAt: ['$journalData.contact_code', 0] } }, '"']
          },
          DeviceCode: {
            $cond: {
              if: { $eq: [{ $type: '$deviceData.custom_fields.value' }, 'array'] },
              then: { $arrayElemAt: [{ $arrayElemAt: ['$deviceData.custom_fields.value', 0] }, 0] },
              else: '$deviceData.custom_fields.value'
            }
          },
          CustomerName: '$profile.name',
          CustomerType: '$profile.type',
          CustomerType2: {
            $cond: {
              if: {
                $or: [
                  { $not: { $isArray: '$company_profile.industry_name' } },
                  { $eq: [{ $size: { $ifNull: ['$company_profile.industry_name', []] } }, 0] }
                ]
              },
              then: 'N/A',
              else: { $arrayElemAt: ['$company_profile.industry_name', 0] }
            }
          },
          PaymentType: {
            $cond: {
              if: { $eq: [{ $arrayElemAt: ['$orderData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
              then: 'QuickPay',
              else: { $arrayElemAt: ['$orderData.payment_method.type', 0] }
            }
          },
          SalesModel: '$sales_model.name',
          Area: {
            $cond: {
              if: { $eq: [{ $type: '$tags.name' }, 'array'] },
              then: { $arrayElemAt: ['$tags.name', 0] },
              else: '$tags.name'
            }
          },
          ServiceProvider: {
            $cond: {
              if: { $eq: [{ $type: '$custom_fields.value_label' }, 'array'] },
              then: { $arrayElemAt: [{ $arrayElemAt: ['$custom_fields.value_label', 0] }, 0] },
              else: '$custom_fields.value_label'
            }
          },
          Mobile: '$phone',
          Ward: '$location.address_line1',
          Road: '$location.address_line2',
          Island: '$location.city',
          Atoll: '$location.province',
          STB: { $arrayElemAt: ['$deviceData.product.name', 0] },
          Status: '$subscriptionData.services.state',
          Package: '$subscriptionData.services.product.name',
          Price: { $round: [{ $toDouble: '$subscriptionData.services.price_terms.price' }, 2] },
          StartDate: {
            $dateToString: {
              format: '%d-%b-%Y',
              date: { $toDate: { $multiply: [{ $toLong: '$subscriptionData.services.service_terms.start_date' }, 1000] } }
            }
          },
          EndDate: {
            $dateToString: {
              format: '%d-%b-%Y',
              date: { $toDate: { $multiply: [{ $toLong: '$subscriptionData.services.service_terms.end_date' }, 1000] } }
            }
          },
          VipTag: { $arrayElemAt: ['$tags.name', 0] }
        }
      }
    ];

    // Perform aggregation
    const results = await mongoose.connection.db.collection('ContactProfiles')
      .aggregate(aggregationQuery, { maxTimeMS: 600000, allowDiskUse: true })
      .toArray();

    // Convert to CSV
    const csvData = parse(results);

    return csvData;
  } catch (error) {
    console.error('Error fetching VIP tag report:', error);
    throw new Error('Error fetching VIP tag report');
  }
};


module.exports = {
  getReports,
  exportReports,
  getAtollsData,
  getMetrics,
  getPackageDistribution,
  exportDealerReports,
  getAreaStats,
  exportCollectionReports,
  getAllDealerReports,
  serviceRequestReports,
  getGraphData,
  getQueueData,
  exportManualJournalReports,
  getDealerNames,
  getMtvUserReports,
  getReferralCountReport,
  getDeviceStatistics,
  getDeviceStatisticsForExport,
  exportCustomerReports,
  exportCustomerReportsNotEffective,
  exportCustomerDealerWiseCollection,
  getDeviceNames,
  getVipTags,
  exportCustomerCollection,
  exportContactProfiles
}