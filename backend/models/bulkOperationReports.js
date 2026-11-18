const mongoose = require("mongoose");

const bulkOperationReportsSchema = new mongoose.Schema({
    batch: { type: String, required: true },
    file_name: { type: String, required: true },
    date: { type: Number, required: false },
    type: { type: String, required: false },
    status: { type: String },
    summary: { type: mongoose.Schema.Types.Mixed, required: false },
});

module.exports = mongoose.model("BulkOperationReport", bulkOperationReportsSchema, "BulkOperationReports");