const mongoose = require('mongoose');
const { parse } = require('json2csv');
const { getMTVConnection } = require('../config/db');
const csv = require('fast-csv');
const stream = require('stream');
const { Parser } = require('json2csv');


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
              date: { $toDate: { $multiply: [{ $toLong: '$profile.registration_date' }, 1000] } },
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
          },
          Tags: {
            $cond: {
              if: { $isArray: '$tags' },
              then: {
                $map: {
                  input: '$tags',
                  as: 'tag',
                  in: { $ifNull: ['$$tag.name', ''] },
                },
              },
              else: [],
            },
          },
          'Device Name': {
            $cond: {
              if: {
                $and: [
                  { $isArray: '$joinedDataDevices' },
                  { $gt: [{ $size: '$joinedDataDevices' }, 0] },
                ],
              },
              then: {
                $reduce: {
                  input: '$joinedDataDevices',
                  initialValue: '',
                  in: {
                    $concat: [
                      '$$value',
                      { $cond: { if: { $eq: ['$$value', ''] }, then: '', else: ', ' } },
                      { $ifNull: ['$$this.product.name', ''] },
                    ],
                  },
                },
              },
              else: '',
            },
          },
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


const exportContactProfilesWithInvoice = async (search, startDate, endDate, atoll, island, page, limit, format) => {
  try {
    // Validate input dates
    if (startDate && isNaN(new Date(startDate).getTime())) {
      throw new Error('Invalid startDate format');
    }
    if (endDate && isNaN(new Date(endDate).getTime())) {
      throw new Error('Invalid endDate format');
    }

    // Date filter
    let startTimestamp, endTimestamp;
    if (startDate) {
      const start = new Date(startDate);
      startTimestamp = Math.floor(start.setUTCHours(0, 0, 0, 0) / 1000);
    }
    if (endDate) {
      const end = new Date(endDate);
      endTimestamp = Math.floor(end.setUTCHours(23, 59, 59, 999) / 1000);
    }

    // Match stage for Events
    let eventMatch = { type: 'INVOICE_POSTED' };
    if (startTimestamp || endTimestamp) {
      eventMatch['transaction.posted_date'] = {};
      if (startTimestamp) eventMatch['transaction.posted_date'].$gte = startTimestamp;
      if (endTimestamp) eventMatch['transaction.posted_date'].$lte = endTimestamp;
    }

    // Base event query
    const eventQueryBase = [
      { $match: eventMatch },
      {
        $project: {
          contact_id: 1,
          'transaction.number': 1,
          'transaction.reference_number': 1,
          'transaction.posted_date': 1,
          'transaction.issued_date': 1,
          'transaction.due_date': 1,
          'transaction.total_default_currency': 1,
          'transaction.net_amount': 1,
          'transaction.default_currency_discount_amount': 1,
          'transaction.default_currency_tax_amount': 1,
          'transaction.currency_code': 1,
          'transaction.total_amount': 1,
          'transaction.exchange_rate': 1,
        },
      },
    ];

    // Add pagination for JSON, no pagination for CSV
    const eventQuery = format === 'json'
      ? [...eventQueryBase, { $skip: (page - 1) * limit }, { $limit: parseInt(limit) }]
      : eventQueryBase;

    // Fetch Events
    const eventsCursor = mongoose.connection.db
      .collection('Events')
      .aggregate(eventQuery, { maxTimeMS: 300000, allowDiskUse: true });

    // For JSON, collect events into an array
    let events = [];
    if (format === 'json') {
      events = await eventsCursor.toArray();
    }

    // Extract contact_ids
    const contactIds = format === 'json'
      ? events.map(event => event.contact_id)
      : await eventsCursor.toArray().then(events => events.map(event => event.contact_id));

    // Match stage for ContactProfiles
    let profileMatch = { contact_id: { $in: contactIds } };
    if (search) profileMatch.$text = { $search: search };
    if (atoll) profileMatch['location.province'] = atoll;
    if (island) profileMatch['location.city'] = island;

    // Aggregation for ContactProfiles
    const profileQuery = [
      { $match: profileMatch },
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
          contact_id: 1,
          Name: {
            $cond: {
              if: {
                $eq: [
                  {
                    $concat: [
                      { $ifNull: ['$demographics.first_name', ''] },
                      ' ',
                      { $ifNull: ['$demographics.last_name', ''] },
                    ]
                  },
                  ' '
                ]
              },
              then: { $ifNull: [{ $arrayElemAt: ['$joinedDataJournals.contact_name', 0] }, ''] },
              else: {
                $concat: [
                  { $ifNull: ['$demographics.first_name', ''] },
                  ' ',
                  { $ifNull: ['$demographics.last_name', ''] },
                ]
              }
            }
          },
          'Customer Code': {
            $ifNull: [
              {
                $toString: { $arrayElemAt: ['$joinedDataJournals.contact_code', 0] }
              },
              ''
            ]
          },
          'Account Number': {
            $ifNull: [{ $arrayElemAt: ['$joinedDataJournals.account_number', 0] }, ''],
          },
          Country: { $ifNull: ['$location.country', ''] },
          'Account Classification': { $ifNull: ['$account.classification.name', ''] },
          'Contact Sales Model': { $ifNull: ['$sales_model.name', ''] },
          Tags: {
            $ifNull: [
              {
                $reduce: {
                  input: '$tags',
                  initialValue: '',
                  in: {
                    $cond: {
                      if: { $eq: ['$this', {}] },
                      then: '$$value',
                      else: {
                        $concat: [
                          '$$value',
                          { $cond: { if: { $eq: ['$$value', ''] }, then: '', else: ',' } },
                          '$$this.name'
                        ]
                      }
                    }
                  }
                }
              },
              ''
            ]
          },
          'Address Name': { $ifNull: ['$location.address_name', ''] },
          'Address Line1': { $ifNull: ['$location.address_line1', ''] },
          'Address Line2': { $ifNull: ['$location.address_line2', ''] },
          City: { $ifNull: ['$location.city', ''] },
          'Service Provider': {
            $let: {
              vars: {
                serviceProvider: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ['$custom_fields', []] },
                        as: 'field',
                        cond: { $eq: ['$$field.key', 'service_provider'] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ['$$serviceProvider.value_label', ''] }
            }
          },
          'Invoiced Service': {
            $ifNull: [
              {
                $reduce: {
                  input: { $ifNull: ['$services', []] },
                  initialValue: '',
                  in: {
                    $concat: [
                      '$$value',
                      { $cond: { if: { $eq: ['$$value', ''] }, then: '', else: ',' } },
                      { $ifNull: ['$$this.product.name', ''] }
                    ]
                  }
                }
              },
              ''
            ]
          }
        },
      },
    ];

    const profiles = await mongoose.connection.db
      .collection('ContactProfiles')
      .aggregate(profileQuery, { maxTimeMS: 300000, allowDiskUse: true })
      .toArray();

    // Count for pagination
    const countQuery = [
      { $match: eventMatch },
      { $count: 'total' },
    ];
    const countResult = await mongoose.connection.db
      .collection('Events')
      .aggregate(countQuery, { maxTimeMS: 300000, allowDiskUse: true })
      .toArray();
    const total = countResult.length > 0 ? countResult[0].total : 0;
    const totalPages = Math.ceil(total / limit);

    // Prepare response
    const response = {
      results: format === 'json' ? [] : undefined,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages },
      csv: undefined,
    };

    // Handle JSON output
    if (format === 'json') {
      response.results = events.map(event => {
        const profile = profiles.find(p => p.contact_id === event.contact_id) || {};
        // Helper function to safely extract transaction fields
        const getTransactionField = (field, isDecimal = false) => {
          if (!event.transaction || !event.transaction[field]) return '';
          if (isDecimal) {
            return event.transaction[field]?.$numberDecimal?.toString() ||
              event.transaction[field]?.toString() ||
              '';
          }
          return event.transaction[field]?.toString() || '';
        };

        const result = {
          Name: profile.Name || '',
          'Customer Code': profile['Customer Code'] || '',
          'Account Number': profile['Account Number'] || '',
          Country: profile.Country || '',
          'Account Classification': profile['Account Classification'] || '',
          'Contact Sales Model': profile['Contact Sales Model'] || '',
          Tags: profile.Tags || '',
          'Address Name': profile['Address Name'] || '',
          'Address Line1': profile['Address Line1'] || '',
          'Address Line2': profile['Address Line2'] || '',
          City: profile.City || '',
          'Service Provider': profile['Service Provider'] || '',
          'Invoiced Service': profile['Invoiced Service'] || '',
          'Invoice Number': getTransactionField('number'),
          'Invoice Reference Number': getTransactionField('reference_number'),
          'Posted Date': event.transaction?.posted_date
            ? new Date(event.transaction.posted_date * 1000).toLocaleString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
            })
            : '',
          'Issued Date': event.transaction?.issued_date
            ? new Date(event.transaction.issued_date * 1000).toLocaleString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
            })
            : '',
          'Due Date': event.transaction?.due_date
            ? new Date(event.transaction.due_date * 1000).toLocaleString('en-GB', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
            })
            : '',
          'Total Default Currency': getTransactionField('total_default_currency', true),
          'Total Net Amount': getTransactionField('net_amount', true),
          'Total Discount': getTransactionField('default_currency_discount_amount', true),
          'Total Tax': getTransactionField('default_currency_tax_amount', true),
          Currency: getTransactionField('currency_code'),
          'Total Amount': getTransactionField('total_amount', true),
          'Exchange Rate': getTransactionField('exchange_rate', true),
        };
        return result;
      });
    }

    // Handle CSV output with streaming
    if (format === 'csv') {
      const fields = [
        'Name',
        'Customer Code',
        'Account Number',
        'Country',
        'Account Classification',
        'Contact Sales Model',
        'Tags',
        'Address Name',
        'Address Line1',
        'Address Line2',
        'City',
        'Service Provider',
        'Invoiced Service',
        'Invoice Number',
        'Invoice Reference Number',
        'Posted Date',
        'Issued Date',
        'Due Date',
        'Total Default Currency',
        'Total Net Amount',
        'Total Discount',
        'Total Tax',
        'Currency',
        'Total Amount',
        'Exchange Rate',
      ];
      const parser = new Parser({ fields, header: true });
      let csvContent = '';

      // Write header
      csvContent = parser.parse([]); // Generates the header row

      const stream = mongoose.connection.db
        .collection('Events')
        .aggregate(eventQueryBase, { maxTimeMS: 300000, allowDiskUse: true })
        .stream();

      await new Promise((resolve, reject) => {
        stream.on('data', (event) => {
          const profile = profiles.find(p => p.contact_id === event.contact_id) || {};
          // Helper function to safely extract transaction fields
          const getTransactionField = (field, isDecimal = false) => {
            if (!event.transaction || !event.transaction[field]) return '';
            if (isDecimal) {
              return event.transaction[field]?.$numberDecimal?.toString() ||
                event.transaction[field]?.toString() ||
                '';
            }
            return event.transaction[field]?.toString() || '';
          };

          const row = {
            Name: profile.Name || '',
            'Customer Code': profile['Customer Code'] || '',
            'Account Number': profile['Account Number'] || '',
            Country: profile.Country || '',
            'Account Classification': profile['Account Classification'] || '',
            'Contact Sales Model': profile['Contact Sales Model'] || '',
            Tags: profile.Tags || '',
            'Address Name': profile['Address Name'] || '',
            'Address Line1': profile['Address Line1'] || '',
            'Address Line2': profile['Address Line2'] || '',
            City: profile.City || '',
            'Service Provider': profile['Service Provider'] || '',
            'Invoiced Service': profile['Invoiced Service'] || '',
            'Invoice Number': getTransactionField('number'),
            'Invoice Reference Number': getTransactionField('reference_number'),
            'Posted Date': event.transaction?.posted_date
              ? new Date(event.transaction.posted_date * 1000).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
              })
              : '',
            'Issued Date': event.transaction?.issued_date
              ? new Date(event.transaction.issued_date * 1000).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
              })
              : '',
            'Due Date': event.transaction?.due_date
              ? new Date(event.transaction.due_date * 1000).toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
              })
              : '',
            'Total Default Currency': getTransactionField('total_default_currency', true),
            'Total Net Amount': getTransactionField('net_amount', true),
            'Total Discount': getTransactionField('default_currency_discount_amount', true),
            'Total Tax': getTransactionField('default_currency_tax_amount', true),
            Currency: getTransactionField('currency_code'),
            'Total Amount': getTransactionField('total_amount', true),
            'Exchange Rate': getTransactionField('exchange_rate', true),
          };
          // Parse the row without header
          const rowCsv = parser.parse([row]).split('\n')[1]; // Skip the header row, take only the data row
          csvContent += `\n${rowCsv}`;
        });
        stream.on('end', () => {
          response.csv = csvContent;
          resolve();
        });
        stream.on('error', (err) => reject(err));
      });
    }

    return response;
  } catch (error) {
    console.error('Error exporting contact profiles with invoice report:', {
      error: error.message,
      stack: error.stack,
    });
    throw new Error('Error exporting contact profiles with invoice report');
  }
};


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

//     //-Date filter for journals
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
//         $match: {
//           subscriptionsData: { $exists: true, $ne: null },
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
//                     { $in: ['$related_entity.transaction_type', ['PAYMENT', 'MANUAL_JOURNAL']] },
//                   ],
//                 },
//               },
//             },
//             { $sort: { posted_date: -1 } },
//             // Limit to 1 to get only the latest journal entry
//             { $limit: 1 },
//           ],
//           as: 'journalsData',
//         },
//       },
//       {
//         $unwind: { path: '$journalsData', preserveNullAndEmptyArrays: true },
//       },
//       { $match: journalDateFilter },
//       { $group: { _id: '$phone', count: { $sum: 1 } } },
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
//         $match: {
//           subscriptionsData: { $exists: true, $ne: null },
//         },
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
//                     { $in: ['$related_entity.transaction_type', ['PAYMENT', 'MANUAL_JOURNAL']] },
//                   ],
//                 },
//               },
//             },
//             { $sort: { posted_date: -1 } },
//             // Limit to 1 to get only the latest journal entry
//             { $limit: 1 },
//           ],
//           as: 'journalsData',
//         },
//       },
//       {
//         $unwind: { path: '$journalsData', preserveNullAndEmptyArrays: true },
//       },
//       { $match: journalDateFilter },
//       {
//         $group: {
//           _id: '$phone',
//           doc: { $first: '$$ROOT' },
//         },
//       },
//       {
//         $replaceRoot: { newRoot: '$doc' },
//       },
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
//           // 'Payment Type': {
//           //   $cond: {
//           //     if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
//           //     then: 'QuickPay',
//           //     else: { $arrayElemAt: ['$ordersData.payment_method.type', 0] },
//           //   },
//           // },
//           'Payment Type': {
//             $cond: {
//               if: { $eq: ['$journalsData.submited_by_user_name', 'Fareedh Test (c545*******b9b8d)'] },
//               then: 'Quick Pay',
//               else: {
//                 $cond: {
//                   if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'CRM_WALLET'] },
//                   then: 'CASH',
//                   else: {
//                     $cond: {
//                       if: { $eq: ['$journalsData.related_entity.transaction_type', 'MANUAL_JOURNAL'] },
//                       then: {
//                         $switch: {
//                           branches: [
//                             { case: { $eq: ['$journalsData.account_type', 'CREDIT'] }, then: 'Credit Note' },
//                             { case: { $eq: ['$journalsData.account_type', 'DEBIT'] }, then: 'Debit Note' },
//                           ],
//                           default: { $arrayElemAt: ['$ordersData.payment_method.type', 0] }
//                         }
//                       },
//                       else: { $arrayElemAt: ['$ordersData.payment_method.type', 0] }
//                     }
//                   }
//                 }
//               }
//             }
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
//                         then: { $arrayElemAt: ['$profile.registration_date', 0] },
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
//               if: {
//                 $or: [
//                   { $eq: ['$journalsData', null] },
//                   { $eq: ['$journalsData.related_entity', null] },
//                   {
//                     $and: [
//                       { $eq: ['$journalsData.related_entity.number', null] },
//                       { $eq: ['$journalsData.related_entity.reference_code', null] }
//                     ]
//                   }
//                 ]
//               },
//               then: '',
//               else: {
//                 $concat: ["'", {
//                   $toString: {
//                     $cond: {
//                       if: { $ne: ['$journalsData.related_entity.number', null] },
//                       then: '$journalsData.related_entity.number',
//                       else: {
//                         $cond: {
//                           if: { $ne: ['$journalsData.related_entity.reference_code', null] },
//                           then: '$journalsData.related_entity.reference_code',
//                           else: '$journalsData.code'
//                         }
//                       }
//                     }
//                   }
//                 }]
//               }
//             }
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

const exportCustomerCollection = async (
  page = 1,
  limit = 100,
  startDate,
  endDate,
  atoll,
  island
) => {
  try {
    let startTimestamp, endTimestamp;
    if (startDate) startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
    if (endDate) endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);

    let matchStage = {
      'related_entity.transaction_type': { $in: ['PAYMENT', 'MANUAL_JOURNAL'] },
    };
    if (startTimestamp) matchStage.posted_date = { $gte: startTimestamp };
    if (endTimestamp) matchStage.posted_date = { ...matchStage.posted_date, $lte: endTimestamp };

    const aggregationQuery = [
      // { $match: matchStage },
      {
        $project: {
          contact_id: 1,
          posted_date: 1,
          amount: 1,
          submited_by_user_name: 1,
          related_entity: 1,
        },
      },
      {
        $lookup: {
          from: 'ContactProfiles',
          localField: 'contact_id',
          foreignField: 'contact_id',
          pipeline: [
            {
              $match: {
                $and: [
                  atoll ? { 'location.province': atoll } : {},
                  island ? { 'location.city': island } : {},
                ],
              },
            },
            {
              $project: {
                'demographics.first_name': 1,
                'demographics.last_name': 1,
                phone: 1,
                'location.province': 1,
                'location.city': 1,
                'location.address_line1': 1,
                'location.address_line2': 1,
                'location.address_name': 1,
                'location.country': 1,
                'custom_fields.value_label': 1,
              },
            },
          ],
          as: 'joinedData',
        },
      },
      {
        $lookup: {
          from: 'Events',
          localField: 'contact_id',
          foreignField: 'contact_id',
          pipeline: [
            { $match: { type: 'PAYMENT_POSTED' } },
            {
              $project: {
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
            $ifNull: [
              {
                $concat: [
                  { $arrayElemAt: ['$joinedData.demographics.first_name', 0] },
                  ' ',
                  { $arrayElemAt: ['$joinedData.demographics.last_name', 0] },
                ],
              },
              'N/A',
            ],
          },
          phone: { $ifNull: [{ $arrayElemAt: ['$joinedData.phone', 0] }, 'N/A'] },
          atoll: { $ifNull: [{ $arrayElemAt: ['$joinedData.location.province', 0] }, 'N/A'] },
          island: { $ifNull: [{ $arrayElemAt: ['$joinedData.location.city', 0] }, 'N/A'] },
          ward: { $ifNull: [{ $arrayElemAt: ['$joinedData.location.address_line1', 0] }, 'N/A'] },
          road: { $ifNull: [{ $arrayElemAt: ['$joinedData.location.address_line2', 0] }, 'N/A'] },
          address: {
            $ifNull: [
              {
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
              'N/A',
            ],
          },
          account_number: 1,
          service_price: { $toDouble: '$amount' },
          submitted_by_user: '$submited_by_user_name',
          dealer: { $ifNull: [{ $arrayElemAt: ['$joinedData.custom_fields.value_label', 0] }, 'N/A'] },
          receipt_id: { $ifNull: [{ $arrayElemAt: ['$eventData.transaction_number', 0] }, 'N/A'] },
          payment_type: { $ifNull: [{ $arrayElemAt: ['$eventData.payment_method_type', 0] }, 'N/A'] },
        },
      },
      { $skip: (parseInt(page) - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
    ];

    const cursor = mongoose.connection.db
      .collection('Journals')
      .aggregate(aggregationQuery, { maxTimeMS: 120000, allowDiskUse: true });
    const results = [];
    for await (const doc of cursor) {
      results.push(doc);
    }

    return {
      data: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: results.length,
      },
    };
  } catch (error) {
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      queryParams: { page, limit, startDate, endDate, atoll, island },
    });
    throw new Error(`Error exporting report: ${error.message}`);
  }
};

// const exportCustomerDealerWiseCollection = async (
//   page,
//   limit,
//   startDate,
//   endDate,
//   atoll,
//   island,
//   format
// ) => {
//   try {
//     // Date filter
//     let startTimestamp, endTimestamp;
//     if (startDate) startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
//     if (endDate) endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);

//     // Match stage for Events
//     let eventMatch = { type: { $in: ['PAYMENT_POSTED', 'TOP_UP_POSTED'] } };
//     if (startTimestamp) eventMatch['transaction.posted_date'] = { $gte: startTimestamp };
//     if (endTimestamp) eventMatch['transaction.posted_date'] = eventMatch['transaction.posted_date']
//       ? { $gte: startTimestamp, $lte: endTimestamp }
//       : { $lte: endTimestamp };

//     // Base event query
//     const eventQueryBase = [
//       { $match: eventMatch },
//       {
//         $project: {
//           contact_id: 1,
//           'transaction.id': 1, // Include transaction.id for matching
//           'transaction.number': 1,
//           'transaction.posted_date': 1,
//           'transaction.currency_code': 1,
//           'transaction.total_amount': 1,
//           'payment_method': 1,
//           'submited_by_user_name': 1,
//           'type': 1
//         },
//       },
//     ];

//     // Add pagination for JSON, no pagination for CSV
//     const eventQuery = format === 'json'
//       ? [...eventQueryBase, { $skip: (page - 1) * limit }, { $limit: parseInt(limit) }]
//       : eventQueryBase;

//     // Fetch Events
//     const events = await mongoose.connection.db
//       .collection('Events')
//       .aggregate(eventQuery, { maxTimeMS: 300000, allowDiskUse: true })
//       .toArray();

//     // Extract contact_ids
//     const contactIds = events.map(event => event.contact_id);

//     // Early return if no contact IDs
//     if (!contactIds.length) {
//       return {
//         data: [],
//         pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, totalPages: 0 },
//       };
//     }

//     // Match stage for ContactProfiles
//     let profileMatch = { contact_id: { $in: contactIds }, 'custom_fields.key': 'service_provider' };

//     // Aggregation for ContactProfiles
//     const profileQuery = [
//       { $match: profileMatch },
//       {
//         $lookup: {
//           from: 'Journals',
//           localField: 'contact_id',
//           foreignField: 'contact_id',
//           as: 'joinedDataJournals',
//           pipeline: [
//             {
//               $match: {
//                 account_type: { $in: ['CREDIT', 'DEBIT'] } // Filter valid account types
//               }
//             },
//             { $sort: { posted_date: -1 } }, // Sort by most recent
//           ]
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           contact_id: 1,
//           Name: {
//             $cond: {
//               if: {
//                 $eq: [
//                   {
//                     $concat: [
//                       { $ifNull: ['$demographics.first_name', ''] },
//                       ' ',
//                       { $ifNull: ['$demographics.last_name', ''] },
//                     ]
//                   },
//                   ' '
//                 ]
//               },
//               then: { $ifNull: [{ $arrayElemAt: ['$joinedDataJournals.contact_name', 0] }, ''] },
//               else: {
//                 $concat: [
//                   { $ifNull: ['$demographics.first_name', ''] },
//                   ' ',
//                   { $ifNull: ['$demographics.last_name', ''] },
//                 ]
//               }
//             }
//           },
//           'Customer Code': {
//             $ifNull: [
//               {
//                 $toString: { $arrayElemAt: ['$joinedDataJournals.contact_code', 0] }
//               },
//               ''
//             ]
//           },
//           'Account Number': {
//             $ifNull: [{ $arrayElemAt: ['$joinedDataJournals.account_number', 0] }, ''],
//           },
//           Country: { $ifNull: ['$location.country', ''] },
//           Tags: {
//             $ifNull: [
//               {
//                 $reduce: {
//                   input: '$tags',
//                   initialValue: '',
//                   in: {
//                     $cond: {
//                       if: { $eq: ['$this', {}] },
//                       then: '$$value',
//                       else: {
//                         $concat: [
//                           '$$value',
//                           { $cond: { if: { $eq: ['$$value', ''] }, then: '', else: ',' } },
//                           '$$this.name'
//                         ]
//                       }
//                     }
//                   }
//                 }
//               },
//               ''
//             ]
//           },
//           'Address Name': { $ifNull: ['$location.address_name', ''] },
//           'Atoll': { $ifNull: ['$location.address_line1', ''] },
//           'Island': { $ifNull: ['$location.address_line2', ''] },
//           City: { $ifNull: ['$location.city', ''] },
//           'Service Provider': {
//             $let: {
//               vars: {
//                 serviceProvider: {
//                   $arrayElemAt: [
//                     {
//                       $filter: {
//                         input: { $ifNull: ['$custom_fields', []] },
//                         as: 'field',
//                         cond: { $eq: ['$$field.key', 'service_provider'] }
//                       }
//                     },
//                     0
//                   ]
//                 }
//               },
//               in: { $ifNull: ['$$serviceProvider.value_label', ''] }
//             }
//           },
//           'joinedDataJournals.account_type': 1,
//           'joinedDataJournals.related_entity.id': 1, // Include related_entity.id for matching
//         },
//       },
//     ];

//     const profiles = await mongoose.connection.db
//       .collection('ContactProfiles')
//       .aggregate(profileQuery, { maxTimeMS: 300000, allowDiskUse: true })
//       .toArray();

//     // Count for pagination
//     const countQuery = [
//       { $match: eventMatch },
//       { $count: 'total' },
//     ];
//     const countResult = await mongoose.connection.db
//       .collection('Events')
//       .aggregate(countQuery, { maxTimeMS: 300000, allowDiskUse: true })
//       .toArray();
//     const total = countResult.length > 0 ? countResult[0].total : 0;
//     const totalPages = Math.ceil(total / limit);

//     // Prepare data array
//     let data = events.map(event => {
//       const profile = profiles.find(p => p.contact_id === event.contact_id) || {};
//       // Helper function to safely extract transaction fields
//       const getTransactionField = (field, isDecimal = false) => {
//         if (!event.transaction || !event.transaction[field]) return '';
//         if (isDecimal) {
//           return event.transaction[field]?.$numberDecimal?.toString() ||
//             event.transaction[field]?.toString() ||
//             '';
//         }
//         return event.transaction[field]?.toString() || '';
//       };

//       // Transform payment method based on payment_method_type
//       let paymentMethod = '';
//       if (event.payment_method) {
//         const paymentType = event.payment_method.payment_method_type;
//         paymentMethod = paymentType === 'ELECTRONIC_TRANSFER' ? 'QUICK PAY' :
//           paymentType === 'CRM_WALLET' ? 'CASH' :
//             paymentType === 'CHEQUE' ? 'CHEQUE' :
//               paymentType === 'CASH' ? 'CASH' : '';
//       }

//       const submittedName = event.submited_by_user_name || '';

//       let action = '';
//       if (event.type === 'TOP_UP_POSTED') {
//         action = 'Top Up';
//       } else if (profile.joinedDataJournals && profile.joinedDataJournals.length > 0) {
//         // Find journal entry where related_entity.id matches event.transaction.id
//         const journalEntry = profile.joinedDataJournals.find(j => 
//           j.related_entity?.id === event.transaction?.id && j.account_type
//         );
//         if (journalEntry && journalEntry.account_type) {
//           action = journalEntry.account_type.toUpperCase() === 'CREDIT' ? 'Add' :
//                    journalEntry.account_type.toUpperCase() === 'DEBIT' ? 'Deduct' : '';
//         }
//       }

//       const receiptNumber = getTransactionField('number');

//       return {
//         Name: profile.Name || '',
//         'Customer Code': profile['Customer Code'] ? `'${profile['Customer Code']}` : '',
//         'Account Number': profile['Account Number'] || '',
//         Country: profile.Country || '',
//         Tags: profile.Tags || '',
//         'Address Name': profile['Address Name'] || '',
//         'Atoll': profile['Atoll'] || '',
//         'Island': profile['Island'] || '',
//         City: profile.City || '',
//         'Service Provider': profile['Service Provider'] || '',
//         'Reciept Number': receiptNumber ? `'${receiptNumber}` : '',
//         'Posted Date': event.transaction?.posted_date
//           ? new Date(event.transaction.posted_date * 1000).toLocaleString('en-GB', {
//             day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
//           })
//           : '',
//         'Total Amount': getTransactionField('total_amount', true),
//         'Payment Method': paymentMethod,
//         'Action': action,
//         'Submitted By': submittedName,
//       };
//     });

//     console.log(totalPages,'all total pages required')

//     console.log(data.length, 'rows fetched');

//     // Filter out rows where Service Provider is empty or undefined
//     data = data.filter(row => row['Service Provider'] && row['Service Provider'].trim() !== '');

//     // Adjust total and totalPages based on filtered data
//     const filteredTotal = data.length;
//     console.log('Filtered Total:', filteredTotal);
//     const filteredTotalPages = format === 'json' ? Math.ceil(filteredTotal / limit) : totalPages;
//     // Prepare response
//     return {
//       data,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total: format === 'json' ? filteredTotal : total,
//         totalPages: filteredTotalPages
//       },
//     };
//   } catch (error) {
//     console.error('Error exporting contact profiles with invoice report:', {
//       error: error.message,
//       stack: error.stack,
//     });
//     throw new Error('Error exporting contact profiles with invoice report');
//   }
// };

const exportCustomerDealerWiseCollection = async (
  page,
  limit,
  startDate,
  endDate,
  atoll,
  island,
  format,
  serviceProvider
) => {
  try {
    // Date filter
    let startTimestamp, endTimestamp;
    if (startDate) startTimestamp = Math.floor(new Date(startDate).setUTCHours(0, 0, 0, 0) / 1000);
    if (endDate) endTimestamp = Math.floor(new Date(endDate).setUTCHours(23, 59, 59, 999) / 1000);

    // STEP 1: Get contact_ids that have service_provider (do this first to reduce dataset)
    const serviceProviderMatch = {
      'custom_fields.key': 'service_provider',
      'custom_fields.value_label': { $exists: true, $ne: '', $ne: null }
    };

    // Add service provider filter if provided
    if (serviceProvider && serviceProvider.trim() !== '') {
      serviceProviderMatch['custom_fields.value_label'] = serviceProvider;
    }

    const validContactIds = await mongoose.connection.db
      .collection('ContactProfiles')
      .find(
        serviceProviderMatch,
        { 
          projection: { contact_id: 1 },
          maxTimeMS: 60000 
        }
      )
      .toArray();

    const validContactIdSet = new Set(validContactIds.map(c => c.contact_id));

    if (validContactIdSet.size === 0) {
      return {
        data: [],
        pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, totalPages: 0 },
      };
    }

    // STEP 2: Build event match with contact filter
    let eventMatch = { 
      type: { $in: ['PAYMENT_POSTED', 'TOP_UP_POSTED'] },
      contact_id: { $in: Array.from(validContactIdSet) } // Pre-filter by valid contacts
    };
    
    if (startTimestamp) eventMatch['transaction.posted_date'] = { $gte: startTimestamp };
    if (endTimestamp) eventMatch['transaction.posted_date'] = eventMatch['transaction.posted_date']
      ? { $gte: startTimestamp, $lte: endTimestamp }
      : { $lte: endTimestamp };

    // STEP 3: Get total count for pagination
    const totalCount = await mongoose.connection.db
      .collection('Events')
      .countDocuments(eventMatch, { maxTimeMS: 60000 });
    
    const totalPages = Math.ceil(totalCount / limit);

    // STEP 4: Get events with pagination (only for JSON)
    const eventQuery = [
      { $match: eventMatch },
      {
        $project: {
          contact_id: 1,
          'transaction.id': 1,
          'transaction.number': 1,
          'transaction.posted_date': 1,
          'transaction.currency_code': 1,
          'transaction.total_amount': 1,
          'payment_method': 1,
          'submited_by_user_name': 1,
          'type': 1
        },
      }
    ];

    // Add pagination only for JSON
    if (format === 'json') {
      eventQuery.push(
        { $skip: (page - 1) * limit },
        { $limit: parseInt(limit) }
      );
    }

    const events = await mongoose.connection.db
      .collection('Events')
      .aggregate(eventQuery, { maxTimeMS: 60000, allowDiskUse: true })
      .toArray();

    if (events.length === 0) {
      return {
        data: [],
        pagination: { page: parseInt(page), limit: parseInt(limit), total: totalCount, totalPages },
      };
    }

    // STEP 5: Get contact profiles for these events
    const eventContactIds = [...new Set(events.map(e => e.contact_id))];
    
    // Build profile match query with service provider filter
    const profileMatchQuery = { 
      contact_id: { $in: eventContactIds },
      'custom_fields.key': 'service_provider',
    };

    // Add service provider filter to profile query as well (for consistency)
    if (serviceProvider && serviceProvider.trim() !== '') {
      profileMatchQuery['custom_fields.value_label'] = serviceProvider;
    }
    
    const profileQuery = [
      { $match: profileMatchQuery },
      {
        $lookup: {
          from: 'Journals',
          localField: 'contact_id',
          foreignField: 'contact_id',
          as: 'joinedDataJournals',
          pipeline: [
            {
              $match: {
                account_type: { $in: ['CREDIT', 'DEBIT'] }
              }
            },
            { $sort: { posted_date: -1 } }
            // Removed $limit: 10 to ensure all relevant journal entries are retrieved
          ]
        },
      },
      {
        $project: {
          _id: 0,
          contact_id: 1,
          Name: {
            $cond: {
              if: {
                $eq: [
                  {
                    $trim: {
                      input: {
                        $concat: [
                          { $ifNull: ['$demographics.first_name', ''] },
                          ' ',
                          { $ifNull: ['$demographics.last_name', ''] },
                        ]
                      }
                    }
                  },
                  ''
                ]
              },
              then: { $ifNull: [{ $arrayElemAt: ['$joinedDataJournals.contact_name', 0] }, ''] },
              else: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ['$demographics.first_name', ''] },
                      ' ',
                      { $ifNull: ['$demographics.last_name', ''] },
                    ]
                  }
                }
              }
            }
          },
          'Customer Code': {
            $ifNull: [
              {
                $toString: { $arrayElemAt: ['$joinedDataJournals.contact_code', 0] }
              },
              ''
            ]
          },
          'Account Number': {
            $ifNull: [{ $arrayElemAt: ['$joinedDataJournals.account_number', 0] }, ''],
          },
          Country: { $ifNull: ['$location.country', ''] },
          Tags: {
            $ifNull: [
              {
                $reduce: {
                  input: '$tags',
                  initialValue: '',
                  in: {
                    $cond: {
                      if: { $eq: ['$this', {}] },
                      then: '$$value',
                      else: {
                        $concat: [
                          '$$value',
                          { $cond: { if: { $eq: ['$$value', ''] }, then: '', else: ',' } },
                          '$$this.name'
                        ]
                      }
                    }
                  }
                }
              },
              ''
            ]
          },
          'Address Name': { $ifNull: ['$location.address_name', ''] },
          'Atoll': { $ifNull: ['$location.address_line1', ''] },
          'Island': { $ifNull: ['$location.address_line2', ''] },
          City: { $ifNull: ['$location.city', ''] },
          'Service Provider': {
            $let: {
              vars: {
                serviceProvider: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: { $ifNull: ['$custom_fields', []] },
                        as: 'field',
                        cond: { $eq: ['$$field.key', 'service_provider'] }
                      }
                    },
                    0
                  ]
                }
              },
              in: { $ifNull: ['$$serviceProvider.value_label', ''] }
            }
          },
          'joinedDataJournals.account_type': 1,
          'joinedDataJournals.related_entity.id': 1,
        },
      },
    ];

    const profiles = await mongoose.connection.db
      .collection('ContactProfiles')
      .aggregate(profileQuery, { maxTimeMS: 60000, allowDiskUse: true })
      .toArray();

    // STEP 6: Transform data
    const data = events.map(event => {
      const profile = profiles.find(p => p.contact_id === event.contact_id) || {};
      
      // Helper function to safely extract transaction fields
      const getTransactionField = (field, isDecimal = false) => {
        if (!event.transaction || !event.transaction[field]) return '';
        if (isDecimal) {
          return event.transaction[field]?.$numberDecimal?.toString() ||
            event.transaction[field]?.toString() ||
            '';
        }
        return event.transaction[field]?.toString() || '';
      };

      // Transform payment method based on payment_method_type
      let paymentMethod = '';
      if (event.payment_method) {
        const paymentType = event.payment_method.payment_method_type;
        paymentMethod = paymentType === 'ELECTRONIC_TRANSFER' ? 'QUICK PAY' :
          paymentType === 'CRM_WALLET' ? 'CASH' :
            paymentType === 'CHEQUE' ? 'CHEQUE' :
              paymentType === 'CASH' ? 'CASH' : '';
      }

      const submittedName = event.submited_by_user_name || '';

      // Improved action determination logic
      let action = '';
      if (event.type === 'TOP_UP_POSTED') {
        action = 'Top Up';
      } else if (event.type === 'PAYMENT_POSTED') {
        if (profile.joinedDataJournals && profile.joinedDataJournals.length > 0) {
          const journalEntry = profile.joinedDataJournals.find(j => 
            j.related_entity?.id === event.transaction?.id && j.account_type
          );
          if (journalEntry && journalEntry.account_type) {
            action = journalEntry.account_type.toUpperCase() === 'CREDIT' ? 'Add' :
                     journalEntry.account_type.toUpperCase() === 'DEBIT' ? 'Deduct' : '';
          } else {
            // Fallback for PAYMENT_POSTED when no matching journal entry is found
            action = 'Payment';
          }
        } else {
          // Fallback when no journal entries are available
          action = 'Payment';
        }
      }

      const receiptNumber = getTransactionField('number');

      return {
        Name: profile.Name || '',
        'Customer Code': profile['Customer Code'] ? `'${profile['Customer Code']}` : '',
        'Account Number': profile['Account Number'] || '',
        Country: profile.Country || '',
        Tags: profile.Tags || '',
        'Address Name': profile['Address Name'] || '',
        'Atoll': profile['Atoll'] || '',
        'Island': profile['Island'] || '',
        City: profile.City || '',
        'Service Provider': profile['Service Provider'] || '',
        'Reciept Number': receiptNumber ? `'${receiptNumber}` : '',
        'Posted Date': event.transaction?.posted_date
          ? new Date(event.transaction.posted_date * 1000).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
          })
          : '',
        'Total Amount': getTransactionField('total_amount', true),
        'Payment Method': paymentMethod,
        'Action': action,
        'Submitted By': submittedName,
      };
    });

    return {
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        totalPages: totalPages
      },
    };

  } catch (error) {
    console.error('Error exporting contact profiles with invoice report:', {
      error: error.message,
      stack: error.stack,
    });
    throw new Error('Error exporting contact profiles with invoice report');
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
  exportContactProfiles,
  exportContactProfilesWithInvoice
}