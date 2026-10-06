const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");
const { httpError } = require("../utils/helpers");

// POST /api/uploads (multipart, field "image") -> { url }
router.post("/", protect, upload.single("image"), (req, res) => {
  if (!req.file) throw httpError(400, "Choose an image to upload.");
  res.status(201).json({ url: `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}` });
});

module.exports = router;
