const billingReportService = require('../services/billingReportServices');
const { Parser } = require('json2csv');

const getReports = async (req, res) => {
  const { page = 1, limit = 10, search = '', startDate, endDate, atoll, island } = req.query;
  const data = await billingReportService.getReports(parseInt(page), parseInt(limit), search, startDate, endDate, atoll, island);
  res.send(data);
};

const exportCSV = async (req, res) => {
  try {
    const { search, startDate, endDate, atoll, island } = req.query;

    const csvData = await billingReportService.exportReports(search, startDate, endDate, atoll, island);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=reports.csv');
    res.send(csvData);

  } catch (error) {
    res.status(500).json({
      message: 'Error exporting CSV',
      error: error.message
    });
  }
};

const exportContactProfiles = async (req, res) => {
  try {
    const { search, startDate, endDate, atoll, island, page = 1, limit = 10, format = 'json' } = req.query;

    const data = await billingReportService.exportContactProfiles(search, startDate, endDate, atoll, island, page, limit, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customer-reports.csv');
      res.send(data.csv);
    } else {
      res.json({
        data: data.results,
        pagination: data.pagination,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error processing request',
      error: error.message,
    });
  }
};

const exportHdcContactProfiles = async (req, res) => {
  try {
    const { search, startDate, endDate, page = 1, limit = 10, format = 'json' } = req.query;

    console.log(limit,'limiting value')

    const data = await billingReportService.exportHdcContactProfiles(startDate, endDate, page, limit, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=hdc-customer-reports.csv');
      res.send(data.csv);
    } else {
      res.json({
        data: data.results,
        pagination: data.pagination,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error processing request',
      error: error.message,
    });
  }
};

const exportContactProfilesWithInvoiceController = async (req, res) => {
  try {
    const { search, startDate, endDate, atoll, island, page = 1, limit = 10, format = 'json' } = req.query;

    const data = await billingReportService.exportContactProfilesWithInvoice(search, startDate, endDate, atoll, island, page, limit, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customer-invoice-reports.csv');
      res.send(data.csv);
    } else {
      res.json({
        data: data.results,
        pagination: data.pagination,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error processing request',
      error: error.message,
    });
  }
};

const exportContactProfilesWithHdc = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10, format = 'json' } = req.query;

    const data = await billingReportService.exportContactProfilesWithHdc(startDate, endDate, page, limit, format);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customer-hdc-reports.csv');
      res.send(data.csv);
    } else {
      res.json({
        data: data.results,
        pagination: data.pagination,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error processing request',
      error: error.message,
    });
  }
};


const exportContactProfilesWithHdcClient = async (req, res) => {
  try {
    const { postedStartDate, postedEndDate, page, limit, format = 'json' } = req.query;

    const data = await billingReportService.exportContactProfilesWithHdcClient(
      postedStartDate,
      postedEndDate,
      page,
      limit,
      format
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customer-hdc-reports.csv');

      for await (const chunk of data.csvStream) {
        res.write(chunk);
      }
      res.end();
    } else {
      res.json({ data: data.results, pagination: data.pagination });
    }
  } catch (error) {
    console.error('Error exporting HDC report:', error);
    res.status(500).json({ message: 'Error processing request', error: error.message });
  }
};

const exportConsolidatedContactProfilesWithHdcClient = async (req, res) => {
  try {
    const { postedStartDate, postedEndDate, page, limit, format = 'json' } = req.query;

    const data = await billingReportService.exportConsolidatedContactProfilesWithHdcClient(
      postedStartDate,
      postedEndDate,
      page,
      limit,
      format
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customer-hdc-reports.csv');

      for await (const chunk of data.csvStream) {
        res.write(chunk);
      }
      res.end();
    } else {
      res.json({ data: data.results, pagination: data.pagination });
    }
  } catch (error) {
    console.error('Error exporting HDC report:', error);
    res.status(500).json({ message: 'Error processing request', error: error.message });
  }
};


// const exportContactProfilesWithHdcClient = async (req, res) => {
//   try {
//     const { startDate, endDate } = req.query;
//     console.log('Received export request with params:', { startDate, endDate });

//     // Queue the job instead of calling the service directly
//     const job = await exportQueue.add("hdcReport", { startDate, endDate });

//     res.json({
//       jobId: job.id,
//       message: "HDC report export started. Check status later.",
//     });
//   } catch (error) {
//     console.error("Error queuing export job:", error);
//     res.status(500).json({ message: "Error queuing export job", error: error.message });
//   }
// };




const exportCustomerCSVorJSON = async (req, res) => {
  try {
    const { search, startDate, endDate, atoll, island, format, page, limit, serviceProvider, spIsland} = req.query;

    const response = await billingReportService.exportCustomerReports(
      search,
      startDate,
      endDate,
      atoll,
      island,
      format,
      page,
      limit,
      serviceProvider,
      spIsland
    );

    if (response.isCsv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customer_reports.csv');
      res.send(response.data);
    } else {
      res.status(200).json({
        data: response.data,
        pagination: response.pagination,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error exporting report',
      error: error.message,
    });
  }
};

const exportCustomerReportsNotEffective = async (req, res) => {
  try {
    const { search, startDate, endDate, atoll, island, format, page, limit, serviceProvider, spIsland } = req.query;

    const response = await billingReportService.exportCustomerReportsNotEffective(
      search,
      startDate,
      endDate,
      atoll,
      island,
      format,
      page,
      limit,
      serviceProvider,
      spIsland
    );

    if (response.isCsv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customer_disconnected_reports.csv');
      res.send(response.data);
    } else {
      res.status(200).json({
        data: response.data,
        pagination: response.pagination,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error exporting report',
      error: error.message,
    });
  }
};

// const exportCustomerDealerWiseCollection = async (req, res) => {
//   try {
//     const { search, startDate, endDate, atoll, island, format, page, limit, serviceProvider } = req.query;

//     const response = await billingReportService.exportCustomerDealerWiseCollection(
//       search,
//       startDate,
//       endDate,
//       atoll,
//       island,
//       format,
//       page,
//       limit,
//       serviceProvider
//     );

//     if (response.isCsv) {
//       res.setHeader('Content-Type', 'text/csv');
//       res.setHeader('Content-Disposition', 'attachment; filename=dealer_wise_collection.csv');
//       res.send(response.data);
//     } else {
//       res.status(200).json({
//         data: response.data,
//         pagination: response.pagination,
//       });
//     }
//   } catch (error) {
//     res.status(500).json({
//       message: 'Error exporting report',
//       error: error.message,
//     });
//   }
// };

// const exportQueue = require('../queues/exportQueue');
// const { v4: uuidv4 } = require('uuid');

// const exportCustomerCollection = async (req, res) => {
//   try {
//     const { search, startDate, endDate, atoll, island, page = 1, limit = 50 } = req.query;
//     const parsedLimit = parseInt(limit);
//     const parsedPage = parseInt(page);

//     if (!startDate || !endDate) {
//       return res.status(400).json({ message: 'Start and end dates are required' });
//     }

//     if (parsedLimit <= 1000) {
//       console.log('Processing synchronous export:', { search, startDate, endDate, atoll, island, page, limit });
//       const csvData = await billingReportService.exportCustomerCollection(
//         search,
//         startDate,
//         endDate,
//         atoll,
//         island,
//         parsedPage,
//         parsedLimit,
//         false
//       );

//       res.setHeader('Content-Type', 'text/csv');
//       res.setHeader('Content-Disposition', 'attachment; filename=reports.csv');
//       res.send(csvData);
//     } else {
//       const jobId = uuidv4();
//       console.log('Queuing asynchronous export:', { search, startDate, endDate, atoll, island, jobId });
//       await exportQueue.add({ search, startDate, endDate, atoll, island, jobId });
//       res.json({ message: 'Export job queued. Check back for the download link.', jobId });
//     }
//   } catch (error) {
//     console.error('Controller error:', error);
//     res.status(500).json({
//       message: 'Error exporting CSV',
//       error: error.message,
//     });
//   }
// };

const exportCustomerCollection = async (req, res) => {
  try {
    const { search, startDate, endDate, atoll, island, format = 'csv', page = 1, limit = 1000 } = req.query;

    const response = await billingReportService.exportCustomerCollection(
      page,
      limit,
      startDate,
      endDate,
      atoll,
      island
    );

    if (format === 'csv') {
      // Assuming a CSV conversion utility is available
      const csvData = response.data
        .map(row =>
          [
            row.posted_date,
            row.name,
            row.phone,
            row.atoll,
            row.island,
            row.ward,
            row.road,
            row.address,
            row.account_number,
            row.service_price,
            row.submitted_by_user,
            row.dealer,
            row.receipt_id,
            row.payment_type,
          ].join(',')
        )
        .join('\n');
      const csvHeader = 'Posted Date,Name,Phone,Atoll,Island,Ward,Road,Address,Account Number,Service Price,Submitted By,Dealer,Receipt ID,Payment Type\n';
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customer_wise_collection.csv');
      res.send(csvHeader + csvData);
    } else {
      res.status(200).json({
        data: response.data,
        pagination: response.pagination,
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error exporting report',
      error: error.message,
    });
  }
};

const exportCustomerDealerWiseCollection = async (req, res) => {
  try {
    const { search, startDate, endDate, atoll, island, format = 'csv', serviceProvider, spIsland, page = 1, limit = 1000 } = req.query;


    const response = await billingReportService.exportCustomerDealerWiseCollection(
      page,
      limit,
      startDate,
      endDate,
      atoll,
      island,
      format,
      serviceProvider,
      spIsland
    );

    if (!response || !response.data) {
      return res.status(400).json({
        message: 'Error exporting report',
        error: 'No data returned from the service',
      });
    }

    if (format === 'csv') {
      const csvHeader = 'Posted Date,Service Provider,Account Number,Tags,Name,Customer Code,Country,Address Name,Atoll,Island,City,Reciept Number,Total Amount,Payment Method,Action,Submitted By\n';
      const csvData = response.data
        .map(row =>
          [
            row['Posted Date'] || '',
            row['Service Provider'] || '',
            row['Account Number'] || '',
            row['Tags'] || '',
            row['Name'] || '',
            row['Customer Code'] || '',
            row['Country'] || '',
            row['Address Name'] || '',
            row['Atoll'] || '',
            row['Island'] || '',
            row['City'] || '',
            row['Reciept Number'] || '',
            row['Total Amount'] || '',
            row['Payment Method'] || '',
            row['Action'] || '',
            row['Submitted By'] || ''
          ]
            .map(field => `"${String(field).replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customer_wise_collection.csv');
      res.send(csvHeader + csvData);
    } else {
      res.status(200).json({
        data: response.data,
        pagination: response.pagination || {},
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error exporting report',
      error: error.message || 'An unexpected error occurred',
    });
  }
};

const exportCollectionReports = async (req, res) => {
  try {
    const { page, limit, search, atoll, island, startDate, endDate, format } = req.query;

    // Validate date format if provided
    if (startDate && !isValidDate(startDate)) {
      return res.status(400).json({
        message: 'Invalid start date format. Please use YYYY-MM-DD format.',
        error: 'INVALID_START_DATE'
      });
    }

    if (endDate && !isValidDate(endDate)) {
      return res.status(400).json({
        message: 'Invalid end date format. Please use YYYY-MM-DD format.',
        error: 'INVALID_END_DATE'
      });
    }

    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        message: 'Start date cannot be later than end date.',
        error: 'INVALID_DATE_RANGE'
      });
    }

    const result = await billingReportService.exportCollectionReports({ 
      page, 
      limit, 
      search, 
      atoll, 
      island, 
      startDate, 
      endDate, 
      format 
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=reports-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(result);
    } else {
      res.json(result);
    }
  } catch (error) {
    console.error('Error in exportCollectionReports controller:', error);
    res.status(500).json({
      message: 'Error fetching reports',
      error: error.message
    });
  }
};

// Helper function to validate date format
const isValidDate = (dateString) => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  const timestamp = date.getTime();
  
  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) return false;
  
  return date.toISOString().startsWith(dateString);
};

const serviceRequestReports = async (req, res) => {
  try {
    const { team, queue } = req.query;

    const csvData = await billingReportService.serviceRequestReports(req);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=service-request-reports.csv');
    res.send(csvData);

  } catch (error) {
    res.status(500).json({
      message: 'Error exporting CSV',
      error: error.message
    });
  }
};

const getGraphData = async (req, res) => {
  try {
    const data = await billingReportService.getGraphData();

    res.status(200).json({
      success: true,
      message: 'Metrics data fetched successfully',
      data: data,
    });
  } catch (error) {
    console.error('Error fetching metrics data:', error);

    res.status(500).json({
      success: false,
      message: 'Error fetching metrics data',
      error: error.message,
    });
  }
};

const getQueueData = async (req, res) => {
  try {
    const data = await billingReportService.getQueueData(req, res);

    res.status(200).json({
      success: true,
      message: 'Metrics data fetched successfully',
      data: data,
    });
  } catch (error) {
    console.error('Error fetching metrics data:', error);

    res.status(500).json({
      success: false,
      message: 'Error fetching metrics data',
      error: error.message,
    });
  }
};

const exportManualJournalReports = async (req, res) => {
  try {
    let page, limit;
    const isCSVExport = req.query.export === 'csv'; // Check if it's a CSV export

    if (!isCSVExport) {
      // Parse page and limit for JSON requests (default to 1 and 10 if not provided)
      page = parseInt(req.query.page, 10) || 1;
      limit = parseInt(req.query.limit, 10) || 10;
    } else {
      // For CSV export, ignore pagination
      page = undefined;
      limit = undefined;
    }

    const result = await billingReportService.exportManualJournalReports(page, limit);

    if (isCSVExport) {
      // Send CSV response
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=manual-reports.csv');
      res.send(result.csvData);
    } else {
      // Send JSON response with paginated data
      res.json({
        message: result.message,
        data: result.data,
        pagination: result.pagination
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error processing request',
      error: error.message
    });
  }
};

const getAtollsData = async (req, res) => {
  try {
    const data = await billingReportService.getAtollsData();

    res.status(200).json({
      success: true,
      message: 'Atolls data fetched successfully',
      data: data,
    });
  } catch (error) {
    console.error('Error fetching atolls data:', error);

    res.status(500).json({
      success: false,
      message: 'Error fetching atolls data',
      error: error.message,
    });
  }
};

const getMetrics = async (req, res) => {
  try {
    const data = await billingReportService.getMetrics();

    res.status(200).json({
      success: true,
      message: 'Metrics data fetched successfully',
      data: data,
    });
  } catch (error) {
    console.error('Error fetching metrics data:', error);

    res.status(500).json({
      success: false,
      message: 'Error fetching metrics data',
      error: error.message,
    });
  }
};

const getPackageDistribution = async (req, res) => {
  try {
    const data = await billingReportService.getPackageDistribution();

    res.status(200).json({
      success: true,
      message: 'Package Distribution data fetched successfully',
      data: data,
    });
  } catch (error) {
    console.error('Error fetching package distribution data:', error);

    res.status(500).json({
      success: false,
      message: 'Error fetching package distribution data',
      error: error.message,
    });
  }
};

const getAreaStats = async (req, res) => {
  try {
    const data = await billingReportService.getAreaStats();

    res.status(200).json({
      success: true,
      message: 'Area data fetched successfully',
      data: data,
    });
  } catch (error) {
    console.error('Error fetching area data:', error);

    res.status(500).json({
      success: false,
      message: 'Error fetching area data',
      error: error.message,
    });
  }
};

const exportDealerReports = async (req, res) => {
  try {
    // const { search, startDate,endDate, atoll, island } = req.query;
    const { startDate, endDate, dealerName } = req.query;

    const csvData = await billingReportService.exportDealerReports(startDate, endDate, dealerName);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=reports.csv');
    res.send(csvData);

  } catch (error) {
    res.status(500).json({
      message: 'Error exporting CSV',
      error: error.message
    });
  }
};

// const fetchFutureReports = async (req, res) => {
//     const data = await billingReportService.fetchFutureReports();
//     res.send(data);
// };
const getDealerReports = async (req, res) => {
  try {
    // const page = parseInt(req.query.page) || 1;
    // const limit = parseInt(req.query.limit) || 10;
    const { page = 1, limit = 10, startDate, endDate, dealerName } = req.query;

    const result = await billingReportService.getAllDealerReports(parseInt(page), parseInt(limit), startDate, endDate, dealerName);

    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message
    });
  }
};

const getDealerNames = async (req, res) => {
  try {
    const data = await billingReportService.getDealerNames();

    res.status(200).json({
      success: true,
      message: 'Dealer names fetched successfully',
      data: data,
    });
  } catch (error) {
    console.error('Error fetching dealer names:', error);

    res.status(500).json({
      success: false,
      message: 'Error fetching dealer names',
      error: error.message,
    });
  }
};

const mtvRegisteredCustomer = async (req, res) => {
  const { page, limit, search = '', startDate, endDate } = req.query;
  try {
    const data = await billingReportService.getMtvUserReports(
      page ? parseInt(page) : undefined,
      limit ? parseInt(limit) : undefined,
      startDate,
      endDate
    );
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching reports', error: err.message });
  }
};

const getReferralCountReport = async (req, res) => {
  try {
    const data = await billingReportService.getReferralCountReport(req);
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching reports', error: err.message });
  }
};

const getDeviceStatistics = async (req, res) => {
  try {
    const data = await billingReportService.getDeviceStatistics();
    res.send(data);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching devices statistics', error: err.message });
  }
};



const getDeviceNames = async (req, res) => {
  try {
    const data = await billingReportService.getDeviceNames();

    // Define fields for CSV
    const fields = [
      { label: 'Organisation Name', value: 'organisationName' },
      { label: 'Device Name', value: 'deviceName' },
      { label: 'Ownership Name', value: 'ownershipName' },
      { label: 'Phone', value: 'phone' }
    ];

    // Format data for CSV
    const formattedData = data.statistics.flatMap(item =>
      item.devices.map(device => ({
        organisationName: item.organisationName || 'N/A',
        deviceName: device.deviceName || 'N/A',
        ownershipName: device.ownershipName || 'N/A',
        phone: device.phone || 'N/A' // Map phone from the device object
      }))
    );

    // Generate CSV
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(formattedData);

    // Set response headers for CSV download
    res.header('Content-Type', 'text/csv');
    res.attachment('device_statistics.csv');
    return res.send(csv);
  } catch (err) {
    res.status(500).send({ message: 'Error exporting device statistics', error: err.message });
  }
};

const exportDeviceStatistics = async (req, res) => {
  try {
    const data = await billingReportService.getDeviceStatisticsForExport();

    // Define fields for CSV
    const fields = [
      { label: 'Tag', value: 'tag' },
      { label: 'Device Code', value: 'customFieldValue' },
      { label: 'Product ID', value: 'productId' },
      { label: 'Product Name', value: 'productName' },
      { label: 'Contact Id', value: 'contact_id' },
    ];

    // Format data for CSV
    const formattedData = data.map(item => ({
      tag: item.tag || 'N/A',
      customFieldValue: item.customFieldValue?.[0] || 'N/A', // Assuming custom_fields is an array
      productId: item.productId || 'N/A',
      productName: item.productName || 'N/A',
      contact_id: item.contact_id || 'N/A',
    }));

    // Generate CSV
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(formattedData);

    // Set response headers for CSV download
    res.header('Content-Type', 'text/csv');
    res.attachment('device_statistics.csv');
    return res.send(csv);
  } catch (err) {
    res.status(500).send({ message: 'Error exporting device statistics', error: err.message });
  }
};

const getVipTags = async (req, res) => {
  try {

    const csvData = await billingReportService.getVipTags();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=vip_reports.csv');
    res.send(csvData);

  } catch (error) {
    res.status(500).json({
      message: 'Error exporting CSV',
      error: error.message
    });
  }
};

module.exports = {
  getReports,
  exportCSV,
  getAtollsData,
  getMetrics,
  getPackageDistribution,
  exportDealerReports,
  getAreaStats,
  exportCollectionReports,
  getDealerReports,
  serviceRequestReports,
  getGraphData,
  getQueueData,
  exportManualJournalReports,
  getDealerNames,
  mtvRegisteredCustomer,
  getReferralCountReport,
  getDeviceStatistics,
  exportDeviceStatistics,
  exportCustomerCSVorJSON,
  exportCustomerReportsNotEffective,
  exportCustomerDealerWiseCollection,
  getDeviceNames,
  getVipTags,
  exportCustomerCollection,
  exportContactProfiles,
  exportContactProfilesWithInvoiceController,
  exportContactProfilesWithHdc,
  exportHdcContactProfiles,
  exportContactProfilesWithHdcClient,
  exportConsolidatedContactProfilesWithHdcClient
}