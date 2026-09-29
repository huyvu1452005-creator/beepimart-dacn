const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { NODE_ENV, UPLOAD } = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Import tất cả routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const categoriesRoutes = require('./routes/categories');
const productsRoutes = require('./routes/products');
const slidersRoutes = require('./routes/sliders');
const ordersRoutes = require('./routes/orders');
const shipperRoutes = require('./routes/shipper');
const adminRoutes = require('./routes/admin');
const healthRoutes = require('./routes/health');

const app = express();

// ============================================================
// MIDDLEWARE BẢO MẬT
// ============================================================

// Helmet: bảo vệ HTTP headers (XSS, clickjacking, MIME sniffing, ...)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Cho phép load ảnh cross-origin
}));

// CORS: cho phép frontend gọi API
app.use(cors({
  origin: '*', // Production nên giới hạn domain cụ thể
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging HTTP request
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limit cho toàn bộ API
app.use('/api', apiLimiter);

// ============================================================
// SERVE FILE TĨNH
// ============================================================

// Serve ảnh upload
app.use('/uploads', express.static(path.join(__dirname, '..', UPLOAD.dir)));

// ============================================================
// ROUTES
// ============================================================

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sliders', slidersRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/shipper', shipperRoutes);
app.use('/api/admin', adminRoutes);

// ============================================================
// XỬ LÝ LỖI
// ============================================================

// Route không tồn tại
app.use(notFoundHandler);

// Xử lý lỗi tập trung
app.use(errorHandler);

module.exports = app;