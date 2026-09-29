const { pool } = require('../config/database');
const { NotFoundError } = require('../utils/errors');

// Lấy danh sách đơn hàng (không bao gồm đơn đã hủy)
async function getOrders() {
  const result = await pool.query(
    `SELECT o.id, u.username, o.total_amount, o.status, o.created_at, o.shipping_address,
            o.payment_method, o.is_paid, o.is_fragile,
            (SELECT s.full_name FROM shippers s WHERE s.id = o.shipper_id) AS shipper_name,
            (SELECT json_agg(json_build_object(
              'name', oi.product_name, 'quantity', oi.quantity, 'price', oi.price
            ) ORDER BY oi.id)
             FROM order_items oi WHERE oi.order_id = o.id) AS items
     FROM orders o
     JOIN users u ON o.user_id = u.id
     WHERE o.status != 'Đã hủy'
     ORDER BY o.id DESC`
  );
  return result.rows;
}

// Lấy đơn hàng đã hủy
async function getCancelledOrders() {
  const result = await pool.query(
    `SELECT o.id, u.username, o.total_amount, o.status, o.created_at,
            o.shipping_address, o.cancel_reason, o.cancelled_at,
            (SELECT json_agg(json_build_object(
              'name', oi.product_name, 'quantity', oi.quantity, 'price', oi.price
            ) ORDER BY oi.id)
             FROM order_items oi WHERE oi.order_id = o.id) AS items
     FROM orders o
     JOIN users u ON o.user_id = u.id
     WHERE o.status = 'Đã hủy'
     ORDER BY o.cancelled_at DESC NULLS LAST`
  );
  return result.rows;
}

// Cập nhật trạng thái đơn hàng
async function updateOrderStatus(orderId, status, reason) {
  const validStatuses = ['Chờ xử lý', 'Đã xác nhận', 'Chờ lấy hàng', 'Đang giao', 'Hoàn thành', 'Đã hủy'];
  if (!validStatuses.includes(status)) {
    throw new NotFoundError('Trạng thái không hợp lệ');
  }

  if (status === 'Đã hủy') {
    await pool.query(
      `UPDATE orders SET status = $1, cancel_reason = $2, cancelled_at = NOW() WHERE id = $3`,
      [status, reason || 'Admin hủy', orderId]
    );
  } else {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, orderId]);
  }
  return { success: true };
}

// Lấy danh sách shipper kèm số đơn đang giao
async function getShippers() {
  const result = await pool.query(
    `SELECT s.*, u.username, u.email,
       (SELECT COUNT(*) FROM orders WHERE shipper_id = s.id AND status = 'Đang giao') AS delivering_count
     FROM shippers s
     JOIN users u ON s.user_id = u.id
     ORDER BY s.total_points DESC`
  );
  return result.rows;
}

// Lấy lịch sử giao hàng của 1 shipper
async function getShipperHistory(shipperId) {
  const result = await pool.query(
    `SELECT sh.*, o.total_amount, o.shipping_address
     FROM shipper_history sh
     JOIN orders o ON sh.order_id = o.id
     WHERE sh.shipper_id = $1
     ORDER BY sh.delivered_at DESC`,
    [shipperId]
  );
  return result.rows;
}

// Thống kê tổng quan
async function getStatsOverview() {
  const [orders, revenue, products, users, shippers, cancelled] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM orders'),
    pool.query("SELECT COALESCE(SUM(total_amount), 0) AS total FROM orders WHERE status = 'Hoàn thành'"),
    pool.query('SELECT COUNT(*) FROM products WHERE is_active = TRUE'),
    pool.query("SELECT COUNT(*) FROM users WHERE role = 'customer'"),
    pool.query('SELECT COUNT(*) FROM shippers WHERE is_active = TRUE'),
    pool.query("SELECT COUNT(*) FROM orders WHERE status = 'Đã hủy'"),
  ]);

  return {
    total_orders: Number(orders.rows[0].count),
    total_revenue: Number(revenue.rows[0].total),
    total_products: Number(products.rows[0].count),
    total_users: Number(users.rows[0].count),
    total_shippers: Number(shippers.rows[0].count),
    total_cancelled: Number(cancelled.rows[0].count),
  };
}

// Thống kê đơn hàng theo trạng thái
async function getOrdersByStatus() {
  const result = await pool.query(
    'SELECT status, COUNT(*) AS count FROM orders GROUP BY status'
  );
  return result.rows;
}

// Top 10 sản phẩm bán chạy
async function getTopProducts() {
  const result = await pool.query(
    `SELECT p.id, p.name, SUM(oi.quantity) AS total_sold
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     JOIN orders o ON oi.order_id = o.id
     WHERE o.status = 'Hoàn thành'
     GROUP BY p.id, p.name
     ORDER BY total_sold DESC
     LIMIT 10`
  );
  return result.rows;
}

// Danh sách người dùng
async function getUsers() {
  const result = await pool.query(
    'SELECT id, username, email, role, full_name, phone, address, created_at FROM users ORDER BY id ASC'
  );
  return result.rows;
}

module.exports = {
  getOrders,
  getCancelledOrders,
  updateOrderStatus,
  getShippers,
  getShipperHistory,
  getStatsOverview,
  getOrdersByStatus,
  getTopProducts,
  getUsers,
};