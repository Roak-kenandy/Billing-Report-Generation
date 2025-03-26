const mongoose = require("mongoose");

const bulkOperationReportsSchema = new mongoose.Schema({
    batch: { type: String, required: true },
    file_name: { type: String, required: true },
    date: { type: Number, required: false },
    status: { type: String },
});

module.exports = mongoose.model("BulkOperationReport", bulkOperationReportsSchema, "BulkOperationReports");