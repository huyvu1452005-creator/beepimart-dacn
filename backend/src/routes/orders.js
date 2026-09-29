const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const orderService = require('../services/orderService');
const { validate } = require('../middleware/validate');
const { authenticateToken } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/auditLog');
const { success } = require('../utils/response');

// POST /api/orders/checkout
// Tạo đơn hàng mới
router.post(
  '/checkout',
  authenticateToken,
  [
    body('cartItems').isArray({ min: 1 }).withMessage('Giỏ hàng trống'),
    body('shipping_address').trim().notEmpty().withMessage('Nhập địa chỉ giao hàng'),
    body('payment_method').optional().isIn(['COD', 'BANK', 'WALLET']),
  ],
  validate,
  async (req, res, next) => {
    try {
      const result = await orderService.checkout(req.user.id, req.body);
      await writeAuditLog({
        userId: req.user.id,
        action: 'CREATE_ORDER',
        entity: 'order',
        entityId: result.orderId,
        ip: req.ip,
      });
      success(res, result, 201);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/orders/my-orders
router.get('/my-orders', authenticateToken, async (req, res, next) => {
  try {
    const orders = await orderService.getMyOrders(req.user.id);
    success(res, orders);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id/tracking
router.get('/:id/tracking', authenticateToken, async (req, res, next) => {
  try {
    const tracking = await orderService.getTracking(
      req.params.id,
      req.user.id,
      req.user.role
    );
    success(res, tracking);
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const order = await orderService.getDetail(req.params.id, req.user.id);
    success(res, order);
  } catch (err) {
    next(err);
  }
});

// PUT /api/orders/:id/cancel
router.put(
  '/:id/cancel',
  authenticateToken,
  async (req, res, next) => {
    try {
      const result = await orderService.cancel(req.params.id, req.user.id, req.body.reason);
      await writeAuditLog({
        userId: req.user.id,
        action: 'CANCEL_ORDER',
        entity: 'order',
        entityId: req.params.id,
        ip: req.ip,
      });
      success(res, result);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/orders/:id/confirm-received
router.put('/:id/confirm-received', authenticateToken, async (req, res, next) => {
  try {
    const result = await orderService.confirmReceived(req.params.id, req.user.id);
    await writeAuditLog({
      userId: req.user.id,
      action: 'CONFIRM_RECEIVED',
      entity: 'order',
      entityId: req.params.id,
      ip: req.ip,
    });
    success(res, result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;