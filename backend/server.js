const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const JWT_SECRET = 'BeePiMart_Enterprise_Ultra_Secret_2026';

/* ============================================================
   UPLOAD ẢNH
   ============================================================ */
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) &&
        allowed.test(file.mimetype)) return cb(null, true);
    cb(new Error('Chỉ cho phép ảnh JPG, PNG, GIF, WEBP'));
  }
});

app.use('/uploads', express.static(UPLOAD_DIR));

/* ============================================================
   DATABASE
   ============================================================ */
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

const connectWithRetry = () => {
  pool.query('SELECT NOW()', (err) => {
    if (err) {
      console.error('DB chưa sẵn sàng, thử lại 3s...', err.message);
      setTimeout(connectWithRetry, 3000);
    } else {
      console.log('PostgreSQL đã kết nối!');
    }
  });
};
connectWithRetry();

/* ============================================================
   MIDDLEWARE
   ============================================================ */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Vui lòng đăng nhập' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Phiên hết hạn' });
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Quyền admin bị từ chối' });
  next();
};

const requireShipper = (req, res, next) => {
  if (req.user.role !== 'shipper') return res.status(403).json({ error: 'Chỉ shipper' });
  next();
};

/* ============================================================
   AUTH
   ============================================================ */
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const check = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (check.rows.length > 0) return res.status(400).json({ error: 'Tên hoặc email đã dùng' });
    await pool.query(
      "INSERT INTO users (username, email, password_raw, role) VALUES ($1, $2, $3, 'customer')",
      [username, email, password]
    );
    res.json({ success: true, message: 'Đăng ký thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0 || result.rows[0].password_raw !== password) {
      return res.status(400).json({ error: 'Sai tài khoản hoặc mật khẩu' });
    }
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username: user.username, role: user.role });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   USER PROFILE
   ============================================================ */
app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, role, full_name, phone, address, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/me', authenticateToken, async (req, res) => {
  const { full_name, phone, address, email } = req.body;
  try {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Email không hợp lệ' });
    if (phone && !/^[0-9]{9,11}$/.test(phone.replace(/\s/g, '')))
      return res.status(400).json({ error: 'SĐT không hợp lệ' });
    if (email) {
      const dup = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user.id]);
      if (dup.rows.length > 0) return res.status(400).json({ error: 'Email đã dùng' });
    }
    await pool.query(
      `UPDATE users SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone),
       address = COALESCE($3, address), email = COALESCE($4, email) WHERE id = $5`,
      [full_name, phone, address, email, req.user.id]
    );
    res.json({ success: true, message: 'Cập nhật thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/me/password', authenticateToken, async (req, res) => {
  const { old_password, new_password } = req.body;
  try {
    if (!old_password || !new_password) return res.status(400).json({ error: 'Nhập đầy đủ' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Mật khẩu từ 6 ký tự' });
    const result = await pool.query('SELECT password_raw FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0 || result.rows[0].password_raw !== old_password)
      return res.status(400).json({ error: 'Mật khẩu cũ sai' });
    await pool.query('UPDATE users SET password_raw = $1 WHERE id = $2', [new_password, req.user.id]);
    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   CATEGORIES
   ============================================================ */
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.name, c.slug, c.icon,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
       FROM categories c ORDER BY c.id ASC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   PRODUCTS
   ============================================================ */
app.get('/api/products', async (req, res) => {
  const { search, category_id } = req.query;
  try {
    let query = 'SELECT * FROM products';
    let params = [];
    let conditions = [];
    if (search) {
      conditions.push(`LOWER(name) LIKE $${params.length + 1}`);
      params.push(`%${search.toLowerCase()}%`);
    }
    if (category_id && Number(category_id) !== 0) {
      conditions.push(`category_id = $${params.length + 1}`);
      params.push(Number(category_id));
    }
    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY id DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products/:id/detail', async (req, res) => {
  try {
    const productRes = await pool.query(
      `SELECT p.*, c.name AS category_name, c.icon AS category_icon
       FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = $1`,
      [req.params.id]
    );
    if (productRes.rows.length === 0) return res.status(404).json({ error: 'Không tồn tại' });
    const product = productRes.rows[0];
    const relatedRes = await pool.query(
      `SELECT id, name, price, image_url, stock FROM products
       WHERE category_id = $1 AND id != $2 ORDER BY RANDOM() LIMIT 4`,
      [product.category_id, product.id]
    );
    res.json({ ...product, related: relatedRes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Không tồn tại' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   SLIDERS — Public
   ============================================================ */
app.get('/api/sliders', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, image_url, link_url, button_text, tag_text, display_order
       FROM sliders WHERE is_active = TRUE ORDER BY display_order ASC, id ASC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   SLIDERS — Admin
   ============================================================ */
app.get('/api/admin/sliders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sliders ORDER BY display_order ASC, id ASC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/sliders', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, image_url, link_url, button_text, tag_text, display_order, is_active } = req.body;
  if (!title || !image_url) return res.status(400).json({ error: 'Thiếu tiêu đề/ảnh' });
  try {
    const result = await pool.query(
      `INSERT INTO sliders (title, description, image_url, link_url, button_text, tag_text, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [title, description, image_url, link_url || '#', button_text || 'Xem Thêm →', tag_text, display_order || 0, is_active !== false]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/sliders/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, image_url, link_url, button_text, tag_text, display_order, is_active } = req.body;
  try {
    const old = await pool.query('SELECT image_url FROM sliders WHERE id = $1', [req.params.id]);
    const oldUrl = old.rows[0]?.image_url;
    await pool.query(
      `UPDATE sliders SET title = $1, description = $2, image_url = $3, link_url = $4,
       button_text = $5, tag_text = $6, display_order = $7, is_active = $8 WHERE id = $9`,
      [title, description, image_url, link_url || '#', button_text || 'Xem Thêm →', tag_text, display_order || 0, is_active !== false, req.params.id]
    );
    if (oldUrl && oldUrl !== image_url && oldUrl.startsWith('/uploads/')) {
      const oldPath = path.join(UPLOAD_DIR, path.basename(oldUrl));
      if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath); } catch (e) {}
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/sliders/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const old = await pool.query('SELECT image_url FROM sliders WHERE id = $1', [req.params.id]);
    const oldUrl = old.rows[0]?.image_url;
    await pool.query('DELETE FROM sliders WHERE id = $1', [req.params.id]);
    if (oldUrl && oldUrl.startsWith('/uploads/')) {
      const oldPath = path.join(UPLOAD_DIR, path.basename(oldUrl));
      if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath); } catch (e) {}
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   ORDERS — CHECKOUT
   ============================================================ */
app.post('/api/orders/checkout', authenticateToken, async (req, res) => {
  const { cartItems, shipping_address, payment_method, notes } = req.body;
  if (!cartItems || cartItems.length === 0) return res.status(400).json({ error: 'Giỏ hàng trống' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let totalAmount = 0;
    let isFragile = false;

    for (let item of cartItems) {
      const prodRes = await client.query(
        'SELECT price, stock, name, is_fragile FROM products WHERE id = $1 FOR UPDATE',
        [item.product_id]
      );
      if (prodRes.rows.length === 0) throw new Error('Sản phẩm không tồn tại');
      const product = prodRes.rows[0];
      if (product.stock < item.quantity) throw new Error(`[${product.name}] không đủ tồn kho`);
      if (product.is_fragile) isFragile = true;
      totalAmount += Number(product.price) * item.quantity;
    }

    const orderRes = await client.query(
      `INSERT INTO orders (user_id, total_amount, status, shipping_address, payment_method, is_paid, is_fragile, notes)
       VALUES ($1, $2, 'Chờ xử lý', $3, $4, $5, $6, $7) RETURNING id`,
      [req.user.id, totalAmount, shipping_address || null,
       payment_method || 'COD', payment_method !== 'COD', isFragile, notes || null]
    );
    const orderId = orderRes.rows[0].id;

    for (let item of cartItems) {
      const prodRes = await client.query('SELECT price FROM products WHERE id = $1', [item.product_id]);
      const price = prodRes.rows[0].price;
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [orderId, item.product_id, item.quantity, price]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, orderId });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

/* ============================================================
   ORDERS — MY ORDERS
   ============================================================ */
app.get('/api/orders/my-orders', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.total_amount, o.status, o.created_at, o.shipping_address,
              o.payment_method, o.is_paid, o.is_fragile, o.notes, o.cancel_reason,
              (SELECT json_agg(json_build_object('name', p.name, 'quantity', oi.quantity, 'price', oi.price, 'image_url', p.image_url) ORDER BY oi.id)
               FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = o.id) AS items
       FROM orders o WHERE o.user_id = $1 ORDER BY o.id DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   ORDERS — TRACKING
   ============================================================ */
app.get('/api/orders/:id/tracking', authenticateToken, async (req, res) => {
  try {
    const orderRes = await pool.query(
      `SELECT o.*, u.username,
        (SELECT s.full_name FROM shippers s WHERE s.id = o.shipper_id) AS shipper_name,
        (SELECT s.phone FROM shippers s WHERE s.id = o.shipper_id) AS shipper_phone
       FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = $1`,
      [req.params.id]
    );
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Không tồn tại' });
    const order = orderRes.rows[0];
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Không có quyền' });
    }

    const statusFlow = [
      { key: 'Chờ xử lý', label: 'Đặt hàng thành công', icon: '📝', desc: 'Đã tiếp nhận đơn' },
      { key: 'Đã xác nhận', label: 'Đã xác nhận đơn', icon: '✅', desc: 'Người bán xác nhận' },
      { key: 'Chờ lấy hàng', label: 'Chờ shipper lấy', icon: '📦', desc: 'Đang chờ shipper' },
      { key: 'Đang giao', label: 'Đang giao hàng', icon: '🚚', desc: 'Shipper đang giao' },
      { key: 'Hoàn thành', label: 'Giao thành công', icon: '🎉', desc: 'Đã nhận hàng' }
    ];
    if (order.status === 'Đã hủy') {
      statusFlow.push({ key: 'Đã hủy', label: 'Đơn đã hủy', icon: '❌', desc: 'Đã hủy' });
    }
    const currentIdx = statusFlow.findIndex(s => s.key === order.status);
    const timeline = statusFlow.map((step, idx) => ({
      ...step, completed: idx <= currentIdx, current: idx === currentIdx,
      timestamp: idx <= currentIdx ? order.created_at : null
    }));
    res.json({
      order: {
        id: order.id, status: order.status, created_at: order.created_at,
        total_amount: order.total_amount, shipping_address: order.shipping_address,
        shipper_name: order.shipper_name, shipper_phone: order.shipper_phone,
        is_fragile: order.is_fragile, payment_method: order.payment_method, is_paid: order.is_paid
      },
      timeline
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   ORDERS — CHI TIẾT
   ============================================================ */
app.get('/api/orders/:id', authenticateToken, async (req, res) => {
  try {
    const orderRes = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (orderRes.rows.length === 0) return res.status(404).json({ error: 'Không tồn tại' });
    const itemsRes = await pool.query(
      `SELECT oi.id, oi.quantity, oi.price, p.name, p.image_url
       FROM order_items oi JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1 ORDER BY oi.id`,
      [req.params.id]
    );
    res.json({ ...orderRes.rows[0], items: itemsRes.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   CUSTOMER — HỦY ĐƠN (chỉ khi chưa giao)
   ============================================================ */
app.put('/api/orders/:id/cancel', authenticateToken, async (req, res) => {
  const orderId = req.params.id;
  const { reason } = req.body;
  try {
    const check = await pool.query(
      'SELECT id, status FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, req.user.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Không tồn tại' });
    const order = check.rows[0];
    if (['Đang giao', 'Hoàn thành', 'Đã hủy'].includes(order.status)) {
      return res.status(400).json({ error: 'Không thể hủy đơn ở trạng thái này' });
    }

    await pool.query(
      `UPDATE orders SET status = 'Đã hủy', cancel_reason = $1, cancelled_at = NOW() WHERE id = $2`,
      [reason || 'Khách hàng hủy', orderId]
    );
    res.json({ success: true, message: 'Đã hủy đơn hàng' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   CUSTOMER — XÁC NHẬN ĐÃ NHẬN HÀNG
   ============================================================ */
app.put('/api/orders/:id/confirm-received', authenticateToken, async (req, res) => {
  const orderId = req.params.id;
  try {
    const check = await pool.query(
      'SELECT id, status FROM orders WHERE id = $1 AND user_id = $2',
      [orderId, req.user.id]
    );
    if (check.rows.length === 0) return res.status(404).json({ error: 'Không tồn tại' });
    const status = check.rows[0].status;
    if (status === 'Hoàn thành') return res.status(400).json({ error: 'Đã hoàn thành' });
    if (status === 'Đã hủy') return res.status(400).json({ error: 'Đã hủy' });
    await pool.query("UPDATE orders SET status = 'Hoàn thành' WHERE id = $1", [orderId]);
    res.json({ success: true, message: 'Xác nhận thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   ADMIN — ĐƠN HÀNG
   ============================================================ */
app.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, u.username, o.total_amount, o.status, o.created_at, o.shipping_address,
        o.payment_method, o.is_paid, o.is_fragile,
        (SELECT s.full_name FROM shippers s WHERE s.id = o.shipper_id) AS shipper_name,
        (SELECT json_agg(json_build_object('name', p.name, 'quantity', oi.quantity, 'price', oi.price) ORDER BY oi.id)
         FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = o.id) AS items
       FROM orders o JOIN users u ON o.user_id = u.id
       WHERE o.status != 'Đã hủy'
       ORDER BY o.id DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/orders/cancelled', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, u.username, o.total_amount, o.status, o.created_at,
              o.shipping_address, o.cancel_reason, o.cancelled_at,
        (SELECT json_agg(json_build_object('name', p.name, 'quantity', oi.quantity, 'price', oi.price) ORDER BY oi.id)
         FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = o.id) AS items
       FROM orders o JOIN users u ON o.user_id = u.id
       WHERE o.status = 'Đã hủy'
       ORDER BY o.cancelled_at DESC NULLS LAST`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  const { status, reason } = req.body;
  const validStatuses = ['Chờ xử lý', 'Đã xác nhận', 'Chờ lấy hàng', 'Đang giao', 'Hoàn thành', 'Đã hủy'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Trạng thái sai' });
  try {
    if (status === 'Đã hủy') {
      await pool.query(
        `UPDATE orders SET status = $1, cancel_reason = $2, cancelled_at = NOW() WHERE id = $3`,
        [status, reason || 'Admin hủy', req.params.id]
      );
    } else {
      await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.id]);
    }
    res.json({ success: true, message: 'Đã cập nhật!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   ADMIN — SẢN PHẨM CRUD
   ============================================================ */
app.post('/api/admin/products', authenticateToken, requireAdmin, async (req, res) => {
  const { name, category_id, description, price, stock, image_url, is_fragile } = req.body;
  try {
    await pool.query(
      `INSERT INTO products (name, category_id, description, price, stock, image_url, is_fragile)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [name, category_id, description, price, stock, image_url, is_fragile || false]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { name, category_id, description, price, stock, image_url, is_fragile } = req.body;
  try {
    const old = await pool.query('SELECT image_url FROM products WHERE id = $1', [req.params.id]);
    const oldUrl = old.rows[0]?.image_url;
    await pool.query(
      `UPDATE products SET name = $1, category_id = $2, description = $3,
       price = $4, stock = $5, image_url = $6, is_fragile = $7 WHERE id = $8`,
      [name, category_id, description, price, stock, image_url, is_fragile || false, req.params.id]
    );
    if (oldUrl && oldUrl !== image_url && oldUrl.startsWith('/uploads/')) {
      const oldPath = path.join(UPLOAD_DIR, path.basename(oldUrl));
      if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath); } catch (e) {}
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const old = await pool.query('SELECT image_url FROM products WHERE id = $1', [req.params.id]);
    const oldUrl = old.rows[0]?.image_url;
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    if (oldUrl && oldUrl.startsWith('/uploads/')) {
      const oldPath = path.join(UPLOAD_DIR, path.basename(oldUrl));
      if (fs.existsSync(oldPath)) try { fs.unlinkSync(oldPath); } catch (e) {}
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   ADMIN — USERS
   ============================================================ */
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, role, full_name, phone, address, created_at FROM users ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   ADMIN — SHIPPERS
   ============================================================ */
app.get('/api/admin/shippers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.username, u.email,
        (SELECT COUNT(*) FROM orders WHERE shipper_id = s.id AND status = 'Đang giao') AS delivering_count
       FROM shippers s JOIN users u ON s.user_id = u.id
       ORDER BY s.total_points DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/shippers/:id/history', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sh.*, o.total_amount, o.shipping_address
       FROM shipper_history sh JOIN orders o ON sh.order_id = o.id
       WHERE sh.shipper_id = $1 ORDER BY sh.delivered_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   ADMIN — THỐNG KÊ
   ============================================================ */
app.get('/api/admin/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [orders, revenue, products, users, shippers, cancelled] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM orders'),
      pool.query("SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE status = 'Hoàn thành'"),
      pool.query('SELECT COUNT(*) FROM products'),
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'customer'"),
      pool.query('SELECT COUNT(*) FROM shippers WHERE is_active = TRUE'),
      pool.query("SELECT COUNT(*) FROM orders WHERE status = 'Đã hủy'")
    ]);
    res.json({
      total_orders: Number(orders.rows[0].count),
      total_revenue: Number(revenue.rows[0].total),
      total_products: Number(products.rows[0].count),
      total_users: Number(users.rows[0].count),
      total_shippers: Number(shippers.rows[0].count),
      total_cancelled: Number(cancelled.rows[0].count)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/stats/orders-by-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT status, COUNT(*) AS count FROM orders GROUP BY status');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/stats/top-products', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.name, SUM(oi.quantity) AS total_sold
       FROM order_items oi JOIN products p ON oi.product_id = p.id
       JOIN orders o ON oi.order_id = o.id
       WHERE o.status = 'Hoàn thành'
       GROUP BY p.id, p.name ORDER BY total_sold DESC LIMIT 10`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ============================================================
   SHIPPER — API
   ============================================================ */
app.get('/api/shipper/me', authenticateToken, requireShipper, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, u.username, u.email FROM shippers s
       JOIN users u ON s.user_id = u.id WHERE s.user_id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy shipper' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/shipper/available-orders', authenticateToken, requireShipper, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.id, o.total_amount, o.status, o.shipping_address, o.created_at,
              o.is_fragile, o.payment_method, o.is_paid, o.notes,
              (SELECT json_agg(json_build_object('name', p.name, 'quantity', oi.quantity) ORDER BY oi.id)
               FROM order_items oi JOIN products p ON oi.product_id = p.id
               WHERE oi.order_id = o.id) AS items
       FROM orders o
       WHERE o.shipper_id IS NULL
         AND o.status IN ('Đã xác nhận', 'Chờ lấy hàng')
       ORDER BY o.is_fragile DESC, o.created_at ASC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/shipper/my-deliveries', authenticateToken, requireShipper, async (req, res) => {
  try {
    const shipperRes = await pool.query('SELECT id FROM shippers WHERE user_id = $1', [req.user.id]);
    if (shipperRes.rows.length === 0) return res.json([]);
    const shipperId = shipperRes.rows[0].id;

    const result = await pool.query(
      `SELECT o.id, o.total_amount, o.status, o.shipping_address, o.created_at,
              o.assigned_at, o.is_fragile, o.payment_method, o.is_paid, o.notes,
              (SELECT json_agg(json_build_object('name', p.name, 'quantity', oi.quantity) ORDER BY oi.id)
               FROM order_items oi JOIN products p ON oi.product_id = p.id
               WHERE oi.order_id = o.id) AS items
       FROM orders o WHERE o.shipper_id = $1 AND o.status = 'Đang giao'
       ORDER BY o.assigned_at DESC`,
      [shipperId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/shipper/history', authenticateToken, requireShipper, async (req, res) => {
  try {
    const shipperRes = await pool.query('SELECT id FROM shippers WHERE user_id = $1', [req.user.id]);
    if (shipperRes.rows.length === 0) return res.json([]);
    const shipperId = shipperRes.rows[0].id;

    const result = await pool.query(
      `SELECT sh.id, sh.order_id, sh.points_earned, sh.delivered_at, sh.notes,
              o.total_amount, o.shipping_address
       FROM shipper_history sh JOIN orders o ON sh.order_id = o.id
       WHERE sh.shipper_id = $1 ORDER BY sh.delivered_at DESC`,
      [shipperId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shipper/accept-order/:orderId', authenticateToken, requireShipper, async (req, res) => {
  const orderId = req.params.orderId;
  try {
    const shipperRes = await pool.query('SELECT id FROM shippers WHERE user_id = $1', [req.user.id]);
    if (shipperRes.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy shipper' });
    const shipperId = shipperRes.rows[0].id;

    const check = await pool.query('SELECT id, shipper_id FROM orders WHERE id = $1', [orderId]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Đơn không tồn tại' });
    if (check.rows[0].shipper_id) return res.status(400).json({ error: 'Đơn đã có người nhận' });

    await pool.query(
      `UPDATE orders SET shipper_id = $1, status = 'Đang giao', assigned_at = NOW() WHERE id = $2`,
      [shipperId, orderId]
    );
    res.json({ success: true, message: 'Nhận đơn thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shipper/complete-delivery/:orderId', authenticateToken, requireShipper, async (req, res) => {
  const orderId = req.params.orderId;
  const { notes } = req.body;
  const POINTS = 10;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const shipperRes = await client.query('SELECT id FROM shippers WHERE user_id = $1', [req.user.id]);
    if (shipperRes.rows.length === 0) throw new Error('Không tìm thấy shipper');
    const shipperId = shipperRes.rows[0].id;

    const orderCheck = await client.query(
      'SELECT id, shipper_id, status, payment_method FROM orders WHERE id = $1',
      [orderId]
    );
    if (orderCheck.rows.length === 0) throw new Error('Đơn không tồn tại');
    const order = orderCheck.rows[0];
    if (order.shipper_id !== shipperId) throw new Error('Bạn không phải shipper đơn này');
    if (order.status !== 'Đang giao') throw new Error('Đơn không ở trạng thái đang giao');

    await client.query(
      `UPDATE orders SET status = 'Hoàn thành', delivered_at = NOW(),
       is_paid = CASE WHEN payment_method = 'COD' THEN TRUE ELSE is_paid END
       WHERE id = $1`,
      [orderId]
    );

    await client.query(
      `INSERT INTO shipper_history (shipper_id, order_id, points_earned, notes)
       VALUES ($1, $2, $3, $4)`,
      [shipperId, orderId, POINTS, notes || null]
    );

    await client.query(
      `UPDATE shippers SET total_points = total_points + $1, total_deliveries = total_deliveries + 1 WHERE id = $2`,
      [POINTS, shipperId]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: `Giao thành công! +${POINTS} điểm`, points_earned: POINTS });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

/* ============================================================
   UPLOAD ẢNH
   ============================================================ */
app.post('/api/admin/upload', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Không có file' });
  res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

/* ============================================================
   HEALTH
   ============================================================ */
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) { res.status(500).json({ status: 'error', error: err.message }); }
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File quá lớn (max 5MB)' });
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(500).json({ error: err.message });
  next();
});

app.listen(5000, () => console.log('BeePiMart API Server ready on port 5000'));