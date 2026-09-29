const logger = require('../utils/logger');
const { NODE_ENV } = require('../config/env');

// Middleware xử lý lỗi tập trung
// Đặt cuối cùng trong chuỗi middleware
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Lỗi hệ thống';

  // Log lỗi server (5xx) là error, lỗi client (4xx) là warn
  if (statusCode >= 500) {
    logger.error('Server error', {
      message: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });
  } else {
    logger.warn('Client error', {
      message: err.message,
      url: req.originalUrl,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(err.errors && { errors: err.errors }),
    // Chỉ show stack trace trong development
    ...(NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Middleware xử lý route không tồn tại
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: `Không tìm thấy route: ${req.method} ${req.originalUrl}`,
  });
};

module.exports = { errorHandler, notFoundHandler };