const express = require('express');
const connectDB = require('./config/db');
const billingReportRoutes = require('./routes/billingReportRoutes');

const app = express();

//Middleware to parse JSON
app.use(express.json());    //This is a built-in middleware function in Express. It parses incoming requests with JSON payloads and is based on body-parser.

//Connect to MongoDB Atlas
connectDB();

//Define a routes
app.use('/billing-reports', billingReportRoutes);

//Default route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

module.exports = app;