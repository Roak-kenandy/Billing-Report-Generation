const express = require('express');
const billingReportController = require('../controllers/billingReportsController');
const loginReportController = require('../controllers/loginReportController');
const rbacController = require('../controllers/rbacController');

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

router.get('/getDealerReports', billingReportController.getDealerReports);

router.get('/getGraphData', billingReportController.getGraphData);

router.get('/getQueueData', billingReportController.getQueueData);

router.get('/getServicerequestReports', billingReportController.serviceRequestReports);

router.get('/getManualJournalReports', billingReportController.exportManualJournalReports);


//Rbac Routes
router.get('/users', rbacController.getUsers);
router.get('/users/:id', rbacController.getUser);
router.post('/users', rbacController.createUser);
router.put('/users/:id/roles', rbacController.updateRoles);
router.put('/users/:id/permissions', rbacController.updatePermissions);
router.delete('/users/:id', rbacController.deleteUser);

// router.get('/fetchFutureReports', billingReportController.fetchFutureReports);

module.exports = router;