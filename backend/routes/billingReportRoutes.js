const express = require('express');
const billingReportController = require('../controllers/billingReportsController');

const router = express.Router();

router.get('/getReports', billingReportController.getReports);

module.exports = router;