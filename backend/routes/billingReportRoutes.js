const express = require('express');
const multer = require('multer');
const billingReportController = require('../controllers/billingReportsController');
const loginReportController = require('../controllers/loginReportController');
const rbacController = require('../controllers/rbacController');
const bulkUploadController = require('../controllers/bulkUploadController');

const router = express.Router();

const upload = multer({ dest: 'uploads/' });

router.post('/registerUser', loginReportController.registerUser);

router.post('/login', loginReportController.loginUser);

router.post('/forgot-password', loginReportController.forgotPassword);

router.post('/reset-password', loginReportController.resetPassword);

router.get('/getReports', billingReportController.getReports);

router.get('/getAllReports', billingReportController.exportCSV);

router.get('/customerDealers', billingReportController.exportCustomerCSVorJSON);

router.get('/customerReports', billingReportController.exportContactProfiles);

router.get('/invoiceReports', billingReportController.exportContactProfilesWithInvoiceController);

router.get('/hdcReports', billingReportController.exportContactProfilesWithHdc);

router.get('/customerDisconnectedDealers', billingReportController.exportCustomerReportsNotEffective);

router.get('/customerDealerWiseCollection', billingReportController.exportCustomerDealerWiseCollection);

router.get('/customerWiseCollection', billingReportController.exportCustomerCollection);

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

router.get('/getDealerNames', billingReportController.getDealerNames);


//Rbac Routes
router.get('/users', rbacController.getUsers);
router.get('/users/:id', rbacController.getUser);
router.post('/users', rbacController.createUser);
router.put('/users/:id/roles', rbacController.updateRoles);
router.put('/users/:id/permissions', rbacController.updatePermissions);
router.delete('/users/:id', rbacController.deleteUser);

//Bulk Upload Routes
router.post('/upload-contacts', upload.single('file'), bulkUploadController.uploadContacts);

router.post('/upload-services', upload.single('file'), bulkUploadController.uploadServiceBulk);

router.post('/upload-address', upload.single('file'), bulkUploadController.uploadAddress);

router.post('/upload-dealer-contacts', upload.single('file'), bulkUploadController.uploadDealerContacts);

router.post('/create-bulk', bulkUploadController.createBulkOperation);

router.get('/get-bulk', bulkUploadController.getAllBulkOperations);

router.get('/crm-dealers', bulkUploadController.getCrmDealerReports);

//MTV Registered Customer
router.get('/mtv/registered', billingReportController.mtvRegisteredCustomer);

router.get('/mtv/registered/count', billingReportController.getReferralCountReport);

router.get('/devices/statistics', billingReportController.getDeviceStatistics);

router.get('/devices/statistics/export', billingReportController.exportDeviceStatistics);

router.get('/devices/names', billingReportController.getDeviceNames);

router.get('/vip/tags', billingReportController.getVipTags);

router.post('/bulkService', bulkUploadController.updateAddress);

router.post('/bulkAddress', bulkUploadController.updateContactAddress);


// router.get('/fetchFutureReports', billingReportController.fetchFutureReports);

module.exports = router;