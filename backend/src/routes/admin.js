const express = require('express');
const router = express.Router();

const adminService = require('../services/adminService');
const productService = require('../services/productService');
const sliderService = require('../services/sliderService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');
const { upload } = require('../middleware/upload');
const { writeAuditLog } = require('../utils/auditLog');
const { success } = require('../utils/response');

// Tất cả route admin đều yêu cầu role admin
router.use(authenticateToken, requireAdmin);

/* ===== ORDERS ===== */
router.get('/orders', async (req, res, next) => {
  try {
    success(res, await adminService.getOrders());
  } catch (err) { next(err); }
});

router.get('/orders/cancelled', async (req, res, next) => {
  try {
    success(res, await adminService.getCancelledOrders());
  } catch (err) { next(err); }
});

router.put('/orders/:id/status', async (req, res, next) => {
  try {
    const result = await adminService.updateOrderStatus(
      req.params.id, req.body.status, req.body.reason
    );
    await writeAuditLog({
      userId: req.user.id,
      action: 'ADMIN_UPDATE_ORDER_STATUS',
      entity: 'order',
      entityId: req.params.id,
      ip: req.ip,
      metadata: { newStatus: req.body.status },
    });
    success(res, result);
  } catch (err) { next(err); }
});

/* ===== PRODUCTS ===== */
router.post('/products', async (req, res, next) => {
  try {
    const product = await productService.create(req.body);
    await writeAuditLog({
      userId: req.user.id,
      action: 'ADMIN_CREATE_PRODUCT',
      entity: 'product',
      entityId: product.id,
      ip: req.ip,
    });
    success(res, product, 201);
  } catch (err) { next(err); }
});

router.put('/products/:id', async (req, res, next) => {
  try {
    const product = await productService.update(req.params.id, req.body);
    await writeAuditLog({
      userId: req.user.id,
      action: 'ADMIN_UPDATE_PRODUCT',
      entity: 'product',
      entityId: req.params.id,
      ip: req.ip,
    });
    success(res, product);
  } catch (err) { next(err); }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    const product = await productService.remove(req.params.id);
    await writeAuditLog({
      userId: req.user.id,
      action: 'ADMIN_DELETE_PRODUCT',
      entity: 'product',
      entityId: req.params.id,
      ip: req.ip,
    });
    success(res, product);
  } catch (err) { next(err); }
});

/* ===== SLIDERS ===== */
router.get('/sliders', async (req, res, next) => {
  try { success(res, await sliderService.getAll()); }
  catch (err) { next(err); }
});

router.post('/sliders', async (req, res, next) => {
  try {
    const slider = await sliderService.create(req.body);
    await writeAuditLog({
      userId: req.user.id,
      action: 'ADMIN_CREATE_SLIDER',
      entity: 'slider',
      entityId: slider.id,
      ip: req.ip,
    });
    success(res, slider, 201);
  } catch (err) { next(err); }
});

router.put('/sliders/:id', async (req, res, next) => {
  try {
    const slider = await sliderService.update(req.params.id, req.body);
    await writeAuditLog({
      userId: req.user.id,
      action: 'ADMIN_UPDATE_SLIDER',
      entity: 'slider',
      entityId: req.params.id,
      ip: req.ip,
    });
    success(res, slider);
  } catch (err) { next(err); }
});

router.delete('/sliders/:id', async (req, res, next) => {
  try {
    const slider = await sliderService.remove(req.params.id);
    await writeAuditLog({
      userId: req.user.id,
      action: 'ADMIN_DELETE_SLIDER',
      entity: 'slider',
      entityId: req.params.id,
      ip: req.ip,
    });
    success(res, slider);
  } catch (err) { next(err); }
});

/* ===== SHIPPERS ===== */
router.get('/shippers', async (req, res, next) => {
  try { success(res, await adminService.getShippers()); }
  catch (err) { next(err); }
});

router.get('/shippers/:id/history', async (req, res, next) => {
  try { success(res, await adminService.getShipperHistory(req.params.id)); }
  catch (err) { next(err); }
});

/* ===== USERS ===== */
router.get('/users', async (req, res, next) => {
  try { success(res, await adminService.getUsers()); }
  catch (err) { next(err); }
});

/* ===== STATS ===== */
router.get('/stats/overview', async (req, res, next) => {
  try { success(res, await adminService.getStatsOverview()); }
  catch (err) { next(err); }
});

router.get('/stats/orders-by-status', async (req, res, next) => {
  try { success(res, await adminService.getOrdersByStatus()); }
  catch (err) { next(err); }
});

router.get('/stats/top-products', async (req, res, next) => {
  try { success(res, await adminService.getTopProducts()); }
  catch (err) { next(err); }
});

/* ===== UPLOAD ===== */
router.post('/upload', uploadLimiter, upload.single('image'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Không có file' });
    }
    success(res, { url: `/uploads/${req.file.filename}`, filename: req.file.filename });
  } catch (err) { next(err); }
});

module.exports = router;