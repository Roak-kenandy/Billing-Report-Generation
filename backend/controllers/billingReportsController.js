const billingReportService = require('../services/billingReportServices');
const { Parser } = require('json2csv');

const getReports = async (req, res) => {
    const { page = 1, limit = 10, search = '', startDate, endDate, atoll, island } = req.query;
    const data = await billingReportService.getReports(parseInt(page), parseInt(limit), search, startDate, endDate, atoll, island );
    res.send(data);
};

const exportCSV = async (req, res) => {
    try {
        const { search, startDate,endDate, atoll, island } = req.query;
        
        const csvData = await billingReportService.exportReports(search,startDate,endDate,atoll,island);
        
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

const exportCustomerCSVorJSON = async (req, res) => {
  try {
    const { search, startDate, endDate, atoll, island, format, page, limit, serviceProvider } = req.query;

    const response = await billingReportService.exportCustomerReports(
      search,
      startDate,
      endDate,
      atoll,
      island,
      format,
      page,
      limit,
      serviceProvider
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
    const { search, startDate, endDate, atoll, island, format, page, limit, serviceProvider } = req.query;

    const response = await billingReportService.exportCustomerReportsNotEffective(
      search,
      startDate,
      endDate,
      atoll,
      island,
      format,
      page,
      limit,
      serviceProvider
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

const exportCustomerDealerWiseCollection = async (req, res) => {
  try {
    const { search, startDate, endDate, atoll, island, format, page, limit, serviceProvider } = req.query;

    const response = await billingReportService.exportCustomerDealerWiseCollection(
      search,
      startDate,
      endDate,
      atoll,
      island,
      format,
      page,
      limit,
      serviceProvider
    );

    if (response.isCsv) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=dealer_wise_collection.csv');
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

const exportCollectionReports = async (req, res) => {
    try {
        const { search, startDate,endDate, atoll, island } = req.query;
        
        const csvData = await billingReportService.exportCollectionReports(search,startDate,endDate,atoll,island);
        
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

const serviceRequestReports = async (req, res) => {
    try {
        const { team, queue} = req.query;
        
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
        const data = await billingReportService.getQueueData(req,res);

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
        const { startDate, endDate,dealerName} = req.query;
        
        const csvData = await billingReportService.exportDealerReports(startDate, endDate,dealerName);
        
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
        const {page = 1, limit = 10, startDate, endDate,dealerName} = req.query;
        
        const result = await billingReportService.getAllDealerReports(parseInt(page), parseInt(limit), startDate, endDate,dealerName);
        
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
        {label: 'Contact Id', value: 'contact_id'},
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
    getVipTags
}