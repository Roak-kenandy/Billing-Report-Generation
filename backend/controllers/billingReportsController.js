const billingReportService = require('../services/billingReportServices');

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
        
        const csvData = await billingReportService.exportDealerReports();
        
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        const result = await billingReportService.getAllDealerReports(page, limit);
        
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
    exportManualJournalReports
    // fetchFutureReports
}