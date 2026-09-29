const { Pool } = require('pg');
const { DB } = require('./env');
const logger = require('../utils/logger');

// Tạo connection pool tới PostgreSQL
// Pool giúp tái sử dụng kết nối, tránh mở/đóng liên tục
const pool = new Pool({
  host: DB.host,
  port: DB.port,
  user: DB.user,
  password: DB.password,
  database: DB.database,
  max: 20,                        // Tối đa 20 kết nối đồng thời
  idleTimeoutMillis: 30000,       // Đóng kết nối rảnh sau 30s
  connectionTimeoutMillis: 5000,  // Timeout khi chờ kết nối
});

// Log lỗi không mong muốn từ pool
pool.on('error', (err) => {
  logger.error('Unexpected database error', { error: err.message });
});

// Hàm kết nối lại nếu DB chưa sẵn sàng
// Cần thiết vì backend khởi động trước khi PostgreSQL ready
const connectWithRetry = (retries = 10, delayMs = 3000) => {
  pool.query('SELECT NOW()', (err) => {
    if (err) {
      if (retries > 0) {
        logger.warn(`Database not ready, retrying in 3s (${retries} left)`, {
          error: err.message,
        });
        setTimeout(() => connectWithRetry(retries - 1, delayMs), delayMs);
      } else {
        logger.error('Cannot connect to database after multiple retries');
      }
    } else {
      logger.info('PostgreSQL connected successfully');
    }
  });
};

module.exports = { pool, connectWithRetry };