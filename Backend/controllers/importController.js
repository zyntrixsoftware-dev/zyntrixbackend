const multer = require("multer");
const XLSX   = require("xlsx");
const SchemaConfig  = require("../models/SchemaConfig");
const DynamicRecord = require("../models/DynamicRecord");

// ── multer: keep file in memory (no disk writes) ──────────────────
const storage = multer.memoryStorage();
exports.upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },   // 10 MB cap
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel"
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx / .xls files are accepted"), false);
    }
  }
});

// ── POST /api/import/upload ───────────────────────────────────────
// body (multipart): system, type, mapping (JSON string of field array)
// file: the xlsx
exports.uploadAndSave = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No file uploaded" });

    const { system, type } = req.body;
    if (!system || !type) return res.status(400).json({ msg: "system and type are required" });

    let fields;
    try {
      fields = JSON.parse(req.body.mapping);
      if (!Array.isArray(fields)) throw new Error();
    } catch {
      return res.status(400).json({ msg: "mapping must be a valid JSON array" });
    }

    const clientId = req.user.id;

    // 1 – Parse Excel
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    const rows     = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rows.length === 0) return res.status(400).json({ msg: "Excel file is empty" });

    // 2 – Persist schema config (upsert)
    await SchemaConfig.findOneAndUpdate(
      { clientId, system, type },
      { clientId, system, type, fields },
      { upsert: true, new: true }
    );

    // 3 – Replace old records, insert new ones
    await DynamicRecord.deleteMany({ clientId, system, type });

    const docs = rows.map(row => {
      const mapped = {};
      fields.forEach(f => {
        if (row[f.excelHeader] !== undefined) mapped[f.systemKey] = row[f.excelHeader];
      });
      return { clientId, system, type, data: mapped };
    });

    await DynamicRecord.insertMany(docs);

    return res.json({ msg: "Import successful", count: docs.length });
  } catch (err) {
    console.error("IMPORT ERROR:", err);
    return res.status(500).json({ msg: "Import failed: " + err.message });
  }
};

// ── GET /api/import/schema?system=hrms&type=candidates ────────────
exports.getSchema = async (req, res) => {
  try {
    const { system, type } = req.query;
    if (!system || !type) return res.status(400).json({ msg: "system and type are required" });
    const schema = await SchemaConfig.findOne({ clientId: req.user.id, system, type });
    return res.json(schema || { fields: [] });
  } catch (err) {
    return res.status(500).json({ msg: "Server error" });
  }
};

// ── GET /api/import/records?system=hrms&type=candidates&page=1&limit=100 ─
exports.getRecords = async (req, res) => {
  try {
    const { system, type } = req.query;
    if (!system || !type) return res.status(400).json({ msg: "system and type are required" });

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(500, parseInt(req.query.limit) || 100);

    const [records, total] = await Promise.all([
      DynamicRecord.find({ clientId: req.user.id, system, type })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DynamicRecord.countDocuments({ clientId: req.user.id, system, type })
    ]);

    return res.json({
      records: records.map(r => ({ _id: r._id, ...r.data })),
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    return res.status(500).json({ msg: "Server error" });
  }
};

// ── DELETE /api/import/record/:id ─────────────────────────────────
exports.deleteRecord = async (req, res) => {
  try {
    const deleted = await DynamicRecord.findOneAndDelete({
      _id: req.params.id,
      clientId: req.user.id
    });
    if (!deleted) return res.status(404).json({ msg: "Record not found" });
    return res.json({ msg: "Deleted" });
  } catch (err) {
    return res.status(500).json({ msg: "Server error" });
  }
};

// ── GET /api/import/types ─────────────────────────────────────────
// Returns all system+type combos the client has imported
exports.getImportedTypes = async (req, res) => {
  try {
    const configs = await SchemaConfig.find({ clientId: req.user.id }, "system type fields").lean();
    return res.json(configs);
  } catch (err) {
    return res.status(500).json({ msg: "Server error" });
  }
};
