const rateLimit = require('express-rate-limit');

// Giới hạn request để chống brute force và spam
// Mỗi limiter có config riêng tùy mức độ nhạy cảm

// Login/Register: 10 lần / 15 phút
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: 'Quá nhiều lần thử. Vui lòng thử lại sau 15 phút.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API chung: 200 lần / 15 phút
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    error: 'Quá nhiều request. Vui lòng thử lại sau.',
  },
});

// Upload: 20 lần / giờ
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Quá nhiều lần upload. Vui lòng thử lại sau 1 giờ.',
  },
});

module.exports = { authLimiter, apiLimiter, uploadLimiter };