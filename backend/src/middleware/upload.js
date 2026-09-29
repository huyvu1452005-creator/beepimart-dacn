const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { UPLOAD } = require('../config/env');
const { BadRequestError } = require('../utils/errors');

// Tạo thư mục uploads nếu chưa tồn tại
const UPLOAD_DIR = path.join(__dirname, '..', '..', UPLOAD.dir);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Cấu hình nơi lưu file và tên file
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Tên file = timestamp + random + ext, tránh trùng
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

// Chỉ chấp nhận file ảnh
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedExts = /\.(jpeg|jpg|png|gif|webp)$/i;

  if (allowedMimes.includes(file.mimetype) && allowedExts.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Chỉ cho phép ảnh JPG, PNG, GIF, WEBP'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: UPLOAD.maxFileSize },
  fileFilter,
});

module.exports = { upload, UPLOAD_DIR };