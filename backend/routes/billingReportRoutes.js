const express = require('express');
const billingReportController = require('../controllers/billingReportsController');
const loginReportController = require('../controllers/loginReportController');

const router = express.Router();

router.post('/registerUser', loginReportController.registerUser);

router.post('/login', loginReportController.loginUser);

router.post('/forgot-password', loginReportController.forgotPassword);

router.post('/reset-password', loginReportController.resetPassword);

router.get('/getReports', billingReportController.getReports);

router.get('/getAllReports', billingReportController.exportCSV);

router.get('/getCollectionReports', billingReportController.exportCollectionReports);

router.get('/getAtolls', billingReportController.getAtollsData);

router.get('/metrics', billingReportController.getMetrics);

router.get('/package-distribution', billingReportController.getPackageDistribution);

router.get('/areas', billingReportController.getAreaStats);

router.get('/getAllDealerReports', billingReportController.exportDealerReports);

// router.get('/fetchFutureReports', billingReportController.fetchFutureReports);

module.exports = router;