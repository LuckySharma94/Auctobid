const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const { httpError } = require("../utils/helpers");

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!file.mimetype.startsWith("image/") || !ALLOWED.includes(ext)) {
      return cb(httpError(400, "Only JPG, PNG, WEBP, GIF or AVIF images are allowed."));
    }
    cb(null, true);
  }
});

module.exports = { upload, UPLOAD_DIR };
