const mongoose = require("mongoose");

const fieldSchema = new mongoose.Schema({
  excelHeader: String,   // exactly what the Excel column says e.g. "Emp Name"
  systemKey:   String,   // your internal key e.g. "name"
  label:       String,   // what the UI shows e.g. "Employee Name"
  dataType:    { type: String, enum: ["string","number","date","email","phone"], default: "string" },
  required:    { type: Boolean, default: false }
}, { _id: false });

const schemaConfigSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  system:   { type: String, enum: ["hrms","sales","employee"], required: true },
  type:     { type: String, required: true },  // e.g. "candidates", "deals", "leads"
  fields:   [fieldSchema]
}, { timestamps: true });

schemaConfigSchema.index({ clientId: 1, system: 1, type: 1 }, { unique: true });

module.exports = mongoose.model("SchemaConfig", schemaConfigSchema);
