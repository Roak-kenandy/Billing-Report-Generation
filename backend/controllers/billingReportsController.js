const billingReportService = require('../services/billingReportServices');
const { pipeline } = require('stream/promises');
const { Transform: JSON2CSVTransform } = require('json2csv');


const getReports = async (req, res) => {
    const { page = 1, limit = 10, search = '' } = req.query; // Default page = 1, limit = 10
    const data = await billingReportService.getReports(parseInt(page), parseInt(limit), search);
    res.send(data);
};

const exportCSV = async (req, res) => {
    try {
        const { search } = req.query;
        
        const csvData = await billingReportService.exportReports(search);
        
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

// const getAllReports = async (req, res) => {
//     const { search = '' } = req.query;

//     //Set headers for CSV file download
//     res.setHeader('Content-Type', 'text/csv');
//     res.setHeader('Content-Disposition', 'attachment; filename="billing-reports.csv"');
//     try {
//         //Create a stream to fetch data from database
//         const dataStream = await billingReportService.getAllReports(search);

//         //Convert JSON data to CSV format
//         const json2csv = new JSON2CSVTransform({
//             fields: ['ID', 'Name','Active Packages', 'First Activation Date', 'Package Names'],
//         })

//         // Handle client disconnects
//         req.on('close', () => {
//             console.log('Client disconnected prematurely');
//             if (!res.headersSent) {
//                 res.status(500).send('Client disconnected');
//             }
//         });
//         await pipeline(dataStream, json2csv, res);

//     }
//     catch (err) {
//         console.error('Error setting up streaming:',err);
//         if (!res.headersSent) {
//             res.status(500).send('Error occurred while setting up streaming');
//         }
//     }
// };

module.exports = {
    getReports,
    exportCSV
}