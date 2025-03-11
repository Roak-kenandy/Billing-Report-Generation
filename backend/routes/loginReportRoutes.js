const express = require('express');
const loginReportController = require('../controllers/loginReportController');

const router = express.Router();

router.get('/login', loginReportController.loginUser);

module.exports = router;