const express = require('express');
const router = express.Router();

const productService = require('../services/productService');
const { success } = require('../utils/response');

// ============================================================
// QUAN TRỌNG: Route /best-sellers phải đặt TRƯỚC /:id/detail
// Nếu đặt sau, Express sẽ hiểu "best-sellers" là :id
// ============================================================

// GET /api/products/best-sellers
// Lấy top 10 sản phẩm bán chạy
// Nếu chưa có đơn hàng hoàn thành -> trả random 10 sản phẩm
router.get('/best-sellers', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const products = await productService.getBestSellers(limit);
    success(res, products);
  } catch (err) {
    next(err);
  }
});

// GET /api/products
// Danh sách sản phẩm (có filter search + category)
router.get('/', async (req, res, next) => {
  try {
    const products = await productService.list(req.query);
    success(res, products);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id/detail
// Chi tiết 1 sản phẩm kèm sản phẩm liên quan
router.get('/:id/detail', async (req, res, next) => {
  try {
    const product = await productService.getDetail(req.params.id);
    success(res, product);
  } catch (err) {
    next(err);
  }
});

module.exports = router;