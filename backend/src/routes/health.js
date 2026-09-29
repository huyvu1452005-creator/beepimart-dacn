const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');

// GET /api/health
// Health check để Docker/K8s biết container còn sống không
router.get('/', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ok',
      db: 'connected',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      db: 'disconnected',
      error: err.message,
    });
  }
});

module.exports = router;