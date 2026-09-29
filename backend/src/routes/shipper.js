const express = require('express');
const router = express.Router();

const shipperService = require('../services/shipperService');
const { authenticateToken, requireShipper } = require('../middleware/auth');
const { writeAuditLog } = require('../utils/auditLog');
const { success } = require('../utils/response');

// Tất cả route trong đây đều yêu cầu role shipper
router.use(authenticateToken, requireShipper);

// GET /api/shipper/me
router.get('/me', async (req, res, next) => {
  try {
    const info = await shipperService.getMe(req.user.id);
    success(res, info);
  } catch (err) {
    next(err);
  }
});

// GET /api/shipper/available-orders
router.get('/available-orders', async (req, res, next) => {
  try {
    const orders = await shipperService.getAvailableOrders();
    success(res, orders);
  } catch (err) {
    next(err);
  }
});

// GET /api/shipper/my-deliveries
router.get('/my-deliveries', async (req, res, next) => {
  try {
    const orders = await shipperService.getMyDeliveries(req.user.id);
    success(res, orders);
  } catch (err) {
    next(err);
  }
});

// GET /api/shipper/history
router.get('/history', async (req, res, next) => {
  try {
    const history = await shipperService.getHistory(req.user.id);
    success(res, history);
  } catch (err) {
    next(err);
  }
});

// POST /api/shipper/accept-order/:orderId
router.post('/accept-order/:orderId', async (req, res, next) => {
  try {
    const result = await shipperService.acceptOrder(req.params.orderId, req.user.id);
    await writeAuditLog({
      userId: req.user.id,
      action: 'SHIPPER_ACCEPT_ORDER',
      entity: 'order',
      entityId: req.params.orderId,
      ip: req.ip,
    });
    success(res, result);
  } catch (err) {
    next(err);
  }
});

// POST /api/shipper/complete-delivery/:orderId
router.post('/complete-delivery/:orderId', async (req, res, next) => {
  try {
    const result = await shipperService.completeDelivery(
      req.params.orderId,
      req.user.id,
      req.body.notes
    );
    await writeAuditLog({
      userId: req.user.id,
      action: 'SHIPPER_COMPLETE_DELIVERY',
      entity: 'order',
      entityId: req.params.orderId,
      ip: req.ip,
    });
    success(res, result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;