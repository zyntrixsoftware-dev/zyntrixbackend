const express = require("express");
const auth    = require("../middleware/authMiddleware");
const ic      = require("../controllers/importController");

const router = express.Router();

// Upload Excel + mapping  →  save schema + records
router.post("/upload",       auth, ic.upload.single("file"), ic.uploadAndSave);

// Fetch the saved schema (column config) for a system+type
router.get("/schema",        auth, ic.getSchema);

// Fetch paginated records
router.get("/records",       auth, ic.getRecords);

// List all system+type combos the client has imported
router.get("/types",         auth, ic.getImportedTypes);

// Delete a single record by Mongo _id
router.delete("/record/:id", auth, ic.deleteRecord);

module.exports = router;
