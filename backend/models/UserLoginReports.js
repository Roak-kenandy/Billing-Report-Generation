const mongoose = require("mongoose");

const userLoginReportsSchema = new mongoose.Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, required: false },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  roles: [{ type: String }],
  permissions: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("UserLoginReport", userLoginReportsSchema, "UserLoginReports");