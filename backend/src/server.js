const app = require('./app');
const { PORT } = require('./config/env');
const { connectWithRetry } = require('./config/database');
const logger = require('./utils/logger');

// Kết nối DB với retry
connectWithRetry();

// Khởi động server
const server = app.listen(PORT, () => {
  logger.info(`BeePiMart API Server ready on port ${PORT}`);
});

// Xử lý tắt server an toàn
// Đóng kết nối DB và dừng nhận request mới
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection', { error: err.message, stack: err.stack });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = server;