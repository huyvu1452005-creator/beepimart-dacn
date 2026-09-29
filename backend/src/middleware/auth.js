const jwt = require('jsonwebtoken');
const { JWT } = require('../config/env');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

// Middleware verify JWT token
// Lấy token từ header Authorization: Bearer xxx
// Nếu hợp lệ, gán user vào req.user
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(new UnauthorizedError('Vui lòng đăng nhập'));
  }

  jwt.verify(token, JWT.secret, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new UnauthorizedError('Phiên đăng nhập hết hạn'));
      }
      return next(new UnauthorizedError('Token không hợp lệ'));
    }
    req.user = user;
    next();
  });
};

// Middleware kiểm tra role
// Sử dụng: requireRole('admin', 'shipper')
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(`Yêu cầu role: ${roles.join(', ')}`));
    }
    next();
  };
};

// Shortcut cho các role phổ biến
const requireAdmin = requireRole('admin');
const requireShipper = requireRole('shipper');
const requireCustomer = requireRole('customer');

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireShipper,
  requireCustomer,
};