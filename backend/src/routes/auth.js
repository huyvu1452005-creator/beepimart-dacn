const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const authService = require('../services/authService');
const { validate } = require('../middleware/validate');
const { authenticateToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { writeAuditLog } = require('../utils/auditLog');
const { success } = require('../utils/response');

// POST /api/auth/register
// Đăng ký tài khoản mới
router.post(
  '/register',
  authLimiter,
  [
    body('username').trim().isLength({ min: 4, max: 50 })
      .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username chỉ chứa chữ, số, _'),
    body('email').trim().isEmail().withMessage('Email không hợp lệ'),
    body('password').isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const user = await authService.register(req.body);
      await writeAuditLog({
        userId: user.id,
        action: 'REGISTER',
        entity: 'user',
        entityId: user.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
      success(res, user, 201);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
// Đăng nhập
router.post(
  '/login',
  authLimiter,
  [
    body('username').trim().notEmpty().withMessage('Vui lòng nhập username'),
    body('password').notEmpty().withMessage('Vui lòng nhập mật khẩu'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await authService.login(req.body);
      await writeAuditLog({
        action: 'LOGIN',
        entity: 'user',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { username: req.body.username },
      });
      success(res, result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me
// Lấy thông tin user hiện tại
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const user = await authService.getProfile(req.user.id);
    success(res, user);
  } catch (err) {
    next(err);
  }
});

module.exports = router;