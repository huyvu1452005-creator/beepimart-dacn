const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const authService = require('../services/authService');
const { validate } = require('../middleware/validate');
const { authenticateToken } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/auditLog');
const { success } = require('../utils/response');

// PUT /api/users/me
// Cập nhật profile
router.put(
  '/me',
  authenticateToken,
  [
    body('email').optional().trim().isEmail().withMessage('Email không hợp lệ'),
    body('phone').optional().matches(/^[0-9]{9,11}$/).withMessage('SĐT không hợp lệ'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const user = await authService.updateProfile(req.user.id, req.body);
      await writeAuditLog({
        userId: req.user.id,
        action: 'UPDATE_PROFILE',
        entity: 'user',
        entityId: req.user.id,
        ip: req.ip,
      });
      success(res, user);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/users/me/password
// Đổi mật khẩu
router.put(
  '/me/password',
  authenticateToken,
  [
    body('old_password').notEmpty().withMessage('Nhập mật khẩu cũ'),
    body('new_password').isLength({ min: 6 }).withMessage('Mật khẩu mới từ 6 ký tự'),
  ],
  validate,
  async (req, res, next) => {
    try {
      await authService.changePassword(
        req.user.id,
        req.body.old_password,
        req.body.new_password
      );
      await writeAuditLog({
        userId: req.user.id,
        action: 'CHANGE_PASSWORD',
        entity: 'user',
        entityId: req.user.id,
        ip: req.ip,
      });
      success(res, { message: 'Đổi mật khẩu thành công' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;