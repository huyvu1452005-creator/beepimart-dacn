const express = require('express');
const router = express.Router();

const sliderService = require('../services/sliderService');
const { success } = require('../utils/response');

// GET /api/sliders
// Public - dùng cho trang chủ
router.get('/', async (req, res, next) => {
  try {
    const sliders = await sliderService.getPublic();
    success(res, sliders);
  } catch (err) {
    next(err);
  }
});

module.exports = router;