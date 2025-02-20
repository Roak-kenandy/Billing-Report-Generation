const express = require('express');
const billingReportController = require('../controllers/billingReportsController');

const router = express.Router();

router.get('/getReports', billingReportController.getReports);

// router.get('/getAllReports', billingReportController.getAllReports);

router.get('/getAllReports', billingReportController.exportCSV);

module.exports = router;