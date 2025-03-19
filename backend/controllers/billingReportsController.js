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
        
        const csvData = await billingReportService.serviceRequestReports(team, queue);
        
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
    serviceRequestReports
    // fetchFutureReports
}