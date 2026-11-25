const express = require('express');
const cors = require('cors');
const billingReportRoutes = require('./routes/billingReportRoutes');
const compression = require('compression');

const app = express();

// Enable CORS for all routes
app.use(cors());

//Middleware to parse JSON
app.use(express.json());    //This is a built-in middleware function in Express. It parses incoming requests with JSON payloads and is based on body-parser.

app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  })
)

//Define a routes
app.use('/billing-reports', billingReportRoutes);

//Default route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

module.exports = app;