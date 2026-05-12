const mongoose = require("mongoose");

const dynamicRecordSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  system:   { type: String, required: true },   // "hrms", "sales"
  type:     { type: String, required: true },   // "candidates", "deals", "leads"
  data:     { type: mongoose.Schema.Types.Mixed, required: true }  // the actual row
}, { timestamps: true });

dynamicRecordSchema.index({ clientId: 1, system: 1, type: 1 });

module.exports = mongoose.model("DynamicRecord", dynamicRecordSchema);
