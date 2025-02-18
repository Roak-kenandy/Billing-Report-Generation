const billingReportService = require('../services/billingReportServices');

const getReports = async (req, res) => {
    const { page = 1, limit = 10 } = req.query; // Default page = 1, limit = 10
    const data = await billingReportService.getReports(parseInt(page), parseInt(limit));
    console.log(data);
    res.send(data);
};

module.exports = {
    getReports
}