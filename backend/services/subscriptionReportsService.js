const mongoose = require('mongoose');
const { parse } = require('json2csv');

const toMaldivesDay = (value) => {
  const str = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const ms = Date.parse(str);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + 5 * 3600 * 1000).toISOString().slice(0, 10);
};

const maldivesDayStart = (value) => {
  const day = toMaldivesDay(value);
  return day ? Math.floor(Date.parse(`${day}T00:00:00+05:00`) / 1000) : undefined;
};

const maldivesDayEnd = (value) => {
  const start = maldivesDayStart(value);
  return start === undefined ? undefined : start + 86399;
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Finance "Subscription Reports" – every non-DRAFT package whose start_date falls in the
 * selected Maldives day range (all statuses: EFFECTIVE, NOT_EFFECTIVE, CANCELLED, etc.).
 */
const buildStages = ({
  search = '',
  startDate,
  endDate,
  atoll,
  island,
  includeCsvExtras = false,
  page,
  limit,
}) => {
  const startTimestamp = startDate ? maldivesDayStart(startDate) : undefined;
  const endTimestamp = endDate ? maldivesDayEnd(endDate) : undefined;

  if (startTimestamp === undefined || endTimestamp === undefined) {
    const err = new Error('Start date and end date are required.');
    err.statusCode = 400;
    throw err;
  }
  if (startTimestamp > endTimestamp) {
    const err = new Error('Start date must be on or before end date.');
    err.statusCode = 400;
    throw err;
  }

  const serviceElemMatch = {
    state: { $ne: 'DRAFT' },
    'service_terms.start_date': { $gte: startTimestamp, $lte: endTimestamp },
  };
  const serviceAfterUnwind = {
    'services.state': { $ne: 'DRAFT' },
    'services.service_terms.start_date': { $gte: startTimestamp, $lte: endTimestamp },
  };

  const preUnwindMatch = { services: { $elemMatch: serviceElemMatch } };
  const contactMatch = {};
  if (atoll) contactMatch['joinedData2.location.province'] = atoll;
  if (island) contactMatch['joinedData2.location.city'] = island;
  if (search) {
    const term = escapeRegex(String(search).trim());
    const prefix = { $regex: `^${term}`, $options: 'i' };
    contactMatch.$or = [
      { 'joinedData2.account.number': prefix },
      { 'joinedData2.profile.code': prefix },
      { 'joinedData2.phone': prefix },
      { 'joinedData2.profile.name': { $regex: term, $options: 'i' } },
      { 'joinedData2.demographics.first_name': { $regex: term, $options: 'i' } },
      { 'joinedData2.demographics.last_name': { $regex: term, $options: 'i' } },
      { 'services.product.name': { $regex: term, $options: 'i' } },
    ];
  }

  const contactLookup = {
    $lookup: {
      from: 'ContactProfiles',
      localField: 'contact_id',
      foreignField: 'contact_id',
      pipeline: [{
        $project: {
          _id: 0,
          'profile.name': 1,
          'profile.type': 1,
          'profile.code': 1,
          'company_profile.industry_name': 1,
          'sales_model.name': 1,
          'account.number': 1,
          'account.balance': 1,
          'wallet.code': 1,
          'tags.name': 1,
          custom_fields: 1,
          phone: 1,
          'demographics.first_name': 1,
          'demographics.last_name': 1,
          'location.address_line1': 1,
          'location.address_line2': 1,
          'location.city': 1,
          'location.province': 1,
        },
      }],
      as: 'joinedData2',
    },
  };

  const deviceLookup = {
    $lookup: {
      from: 'Devices',
      localField: 'contact_id',
      foreignField: 'ownership.id',
      pipeline: [{
        $project: {
          _id: 0,
          'product.name': 1,
          custom_fields: 1,
        },
      }],
      as: 'joinedData3',
    },
  };

  const orderLookup = {
    $lookup: {
      from: 'Orders',
      localField: 'contact_id',
      foreignField: 'contact_id',
      pipeline: [{
        $project: {
          _id: 0,
          'payment_method.type': 1,
        },
      }],
      as: 'ordersData',
    },
  };

  const projectFields = {
    _id: 0,
    'Submitted By User': '$submited_by_user_name',
    'Account Number': { $ifNull: [{ $arrayElemAt: ['$joinedData2.account.number', 0] }, ''] },
    'Contact Code': {
      $toString: { $ifNull: [{ $arrayElemAt: ['$joinedData2.profile.code', 0] }, ''] },
    },
    'Device Code': {
      $let: {
        vars: {
          codeField: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: [{ $arrayElemAt: ['$joinedData3.custom_fields', 0] }, []] },
                  as: 'field',
                  cond: { $eq: ['$$field.key', 'code'] },
                },
              },
              0,
            ],
          },
        },
        in: {
          $ifNull: [
            '$$codeField.value_label',
            { $ifNull: ['$$codeField.value', ''] },
          ],
        },
      },
    },
    'Customer Name': { $ifNull: [{ $arrayElemAt: ['$joinedData2.profile.name', 0] }, ''] },
    'Customer Type': { $ifNull: [{ $arrayElemAt: ['$joinedData2.profile.type', 0] }, ''] },
    'Customer Type 2': {
      $cond: {
        if: {
          $or: [
            { $not: { $isArray: { $arrayElemAt: ['$joinedData2.company_profile.industry_name', 0] } } },
            {
              $eq: [
                { $size: { $ifNull: [{ $arrayElemAt: ['$joinedData2.company_profile.industry_name', 0] }, []] } },
                0,
              ],
            },
          ],
        },
        then: 'N/A',
        else: { $arrayElemAt: [{ $arrayElemAt: ['$joinedData2.company_profile.industry_name', 0] }, 0] },
      },
    },
    'Payment Type': {
      $cond: {
        if: { $eq: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, 'ELECTRONIC_TRANSFER'] },
        then: 'QuickPay',
        else: { $ifNull: [{ $arrayElemAt: ['$ordersData.payment_method.type', 0] }, ''] },
      },
    },
    'Sales Model': { $ifNull: [{ $arrayElemAt: ['$joinedData2.sales_model.name', 0] }, ''] },
    Area: {
      $let: {
        vars: { tags: { $ifNull: [{ $arrayElemAt: ['$joinedData2.tags', 0] }, []] } },
        in: {
          $cond: {
            if: { $gt: [{ $size: '$$tags' }, 0] },
            then: { $ifNull: [{ $arrayElemAt: ['$$tags.name', 0] }, ''] },
            else: '',
          },
        },
      },
    },
    Dealer: {
      $let: {
        vars: {
          dealerField: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: [{ $arrayElemAt: ['$joinedData2.custom_fields', 0] }, []] },
                  as: 'field',
                  cond: { $eq: ['$$field.key', 'service_provider'] },
                },
              },
              0,
            ],
          },
        },
        in: { $ifNull: ['$$dealerField.value_label', ''] },
      },
    },
    Mobile: {
      $let: {
        vars: { phone: { $arrayElemAt: ['$joinedData2.phone', 0] } },
        in: {
          $cond: {
            if: { $isArray: '$$phone' },
            then: { $ifNull: [{ $arrayElemAt: ['$$phone', 0] }, ''] },
            else: { $ifNull: ['$$phone', ''] },
          },
        },
      },
    },
    Ward: { $ifNull: [{ $arrayElemAt: ['$joinedData2.location.address_line1', 0] }, ''] },
    Road: { $ifNull: [{ $arrayElemAt: ['$joinedData2.location.address_line2', 0] }, ''] },
    Island: { $ifNull: [{ $arrayElemAt: ['$joinedData2.location.city', 0] }, ''] },
    Atoll: { $ifNull: [{ $arrayElemAt: ['$joinedData2.location.province', 0] }, ''] },
    STB: { $ifNull: [{ $arrayElemAt: ['$joinedData3.product.name', 0] }, ''] },
    Status: '$services.state',
    Package: '$services.product.name',
    Price: {
      $round: [{ $toDouble: { $ifNull: ['$services.price_terms.price', 0] } }, 2],
    },
    'Start Date': {
      $cond: {
        if: { $gt: ['$services.service_terms.start_date', 0] },
        then: {
          $dateToString: {
            format: '%d-%b-%Y',
            date: { $toDate: { $multiply: [{ $toLong: '$services.service_terms.start_date' }, 1000] } },
            timezone: '+05:00',
          },
        },
        else: '',
      },
    },
    'End Date': {
      $cond: {
        if: { $gt: ['$services.service_terms.end_date', 0] },
        then: {
          $dateToString: {
            format: '%d-%b-%Y',
            date: { $toDate: { $multiply: [{ $toLong: '$services.service_terms.end_date' }, 1000] } },
            timezone: '+05:00',
          },
        },
        else: '',
      },
    },
  };

  if (includeCsvExtras) {
    projectFields['Available Balance'] = {
      $ifNull: [{ $toDouble: { $arrayElemAt: ['$joinedData2.account.balance', 0] } }, 0],
    };
    projectFields['Service Provider'] = projectFields.Dealer;
    projectFields['Wallet Code'] = {
      $ifNull: [{ $arrayElemAt: ['$joinedData2.wallet.code', 0] }, 'N/A'],
    };
    projectFields['Day Count from Cycle End Date to Report Extraction Date'] = {
      $cond: {
        if: { $gt: ['$services.service_terms.end_date', 0] },
        then: {
          $round: [
            {
              $divide: [
                {
                  $subtract: [
                    '$$NOW',
                    { $toDate: { $multiply: [{ $toLong: '$services.service_terms.end_date' }, 1000] } },
                  ],
                },
                86400000,
              ],
            },
            0,
          ],
        },
        else: null,
      },
    };
  }

  const needsContactEarly = Boolean(search || atoll || island);
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, parseInt(limit, 10) || 10);
  const pageStages = page != null
    ? [{ $skip: (pageNum - 1) * limitNum }, { $limit: limitNum }]
    : [];

  const coreStages = needsContactEarly
    ? [
        { $match: preUnwindMatch },
        contactLookup,
        { $unwind: '$services' },
        { $match: { ...serviceAfterUnwind, ...contactMatch } },
        { $sort: { 'services.service_terms.start_date': -1, _id: -1 } },
        ...pageStages,
        deviceLookup,
        orderLookup,
        { $project: projectFields },
      ]
    : [
        { $match: preUnwindMatch },
        { $unwind: '$services' },
        { $match: serviceAfterUnwind },
        { $sort: { 'services.service_terms.start_date': -1, _id: -1 } },
        ...pageStages,
        contactLookup,
        deviceLookup,
        orderLookup,
        { $project: projectFields },
      ];

  const countStages = needsContactEarly
    ? [
        { $match: preUnwindMatch },
        contactLookup,
        { $unwind: '$services' },
        { $match: { ...serviceAfterUnwind, ...contactMatch } },
        { $count: 'total' },
      ]
    : [
        { $match: preUnwindMatch },
        { $unwind: '$services' },
        { $match: serviceAfterUnwind },
        { $count: 'total' },
      ];

  return { coreStages, countStages, pageNum, limitNum };
};

const getReports = async (page, limit, search = '', startDate, endDate, atoll, island) => {
  const { coreStages, countStages, pageNum, limitNum } = buildStages({
    search,
    startDate,
    endDate,
    atoll,
    island,
    page,
    limit,
  });

  const collection = mongoose.connection.db.collection('Subscriptions');
  const [results, totalResult] = await Promise.all([
    collection.aggregate(coreStages, { maxTimeMS: 600000, allowDiskUse: true }).toArray(),
    collection.aggregate(countStages, { maxTimeMS: 600000, allowDiskUse: true }).toArray(),
  ]);
  const total = totalResult.length > 0 ? Number(totalResult[0].total) : 0;

  return {
    message: 'Billing Reports Data',
    data: results,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
};

const exportReports = async (search, startDate, endDate, atoll, island) => {
  const { coreStages } = buildStages({
    search,
    startDate,
    endDate,
    atoll,
    island,
    includeCsvExtras: true,
  });

  const results = await mongoose.connection.db
    .collection('Subscriptions')
    .aggregate(coreStages, { maxTimeMS: 600000, allowDiskUse: true })
    .toArray();

  return parse(results);
};

module.exports = {
  getReports,
  exportReports,
};
