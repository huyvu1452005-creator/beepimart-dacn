const express = require('express');
const router = express.Router();

const categoryService = require('../services/categoryService');
const { success } = require('../utils/response');

// GET /api/categories
router.get('/', async (req, res, next) => {
  try {
    const categories = await categoryService.list();
    success(res, categories);
  } catch (err) {
    next(err);
  }
});

module.exports = router;