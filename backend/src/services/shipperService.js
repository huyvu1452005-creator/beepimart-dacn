const { pool } = require('../config/database');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../utils/errors');

// Số điểm được cộng cho mỗi đơn giao thành công
const POINTS_PER_DELIVERY = 10;

// Lấy thông tin shipper theo user_id
async function getMe(userId) {
  const result = await pool.query(
    `SELECT s.*, u.username, u.email
     FROM shippers s JOIN users u ON s.user_id = u.id
     WHERE s.user_id = $1`,
    [userId]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy thông tin shipper');
  }
  return result.rows[0];
}

// Lấy danh sách đơn hàng có thể nhận
// Chỉ lấy đơn đã xác nhận, chưa có shipper, ưu tiên hàng dễ vỡ
async function getAvailableOrders() {
  const result = await pool.query(
    `SELECT o.id, o.total_amount, o.status, o.shipping_address, o.created_at,
            o.is_fragile, o.payment_method, o.is_paid, o.notes,
            (SELECT json_agg(json_build_object(
              'name', oi.product_name, 'quantity', oi.quantity
            ) ORDER BY oi.id)
             FROM order_items oi WHERE oi.order_id = o.id) AS items
     FROM orders o
     WHERE o.shipper_id IS NULL
       AND o.status IN ('Đã xác nhận', 'Chờ lấy hàng')
     ORDER BY o.is_fragile DESC, o.created_at ASC`
  );
  return result.rows;
}

// Lấy đơn đang giao của shipper hiện tại
async function getMyDeliveries(userId) {
  const shipperRes = await pool.query(
    'SELECT id FROM shippers WHERE user_id = $1',
    [userId]
  );
  if (shipperRes.rows.length === 0) return [];
  const shipperId = shipperRes.rows[0].id;

  const result = await pool.query(
    `SELECT o.id, o.total_amount, o.status, o.shipping_address, o.created_at,
            o.assigned_at, o.is_fragile, o.payment_method, o.is_paid, o.notes,
            (SELECT json_agg(json_build_object(
              'name', oi.product_name, 'quantity', oi.quantity
            ) ORDER BY oi.id)
             FROM order_items oi WHERE oi.order_id = o.id) AS items
     FROM orders o
     WHERE o.shipper_id = $1 AND o.status = 'Đang giao'
     ORDER BY o.assigned_at DESC`,
    [shipperId]
  );
  return result.rows;
}

// Lấy lịch sử giao hàng
async function getHistory(userId) {
  const shipperRes = await pool.query(
    'SELECT id FROM shippers WHERE user_id = $1',
    [userId]
  );
  if (shipperRes.rows.length === 0) return [];
  const shipperId = shipperRes.rows[0].id;

  const result = await pool.query(
    `SELECT sh.id, sh.order_id, sh.points_earned, sh.delivered_at, sh.notes,
            o.total_amount, o.shipping_address
     FROM shipper_history sh
     JOIN orders o ON sh.order_id = o.id
     WHERE sh.shipper_id = $1
     ORDER BY sh.delivered_at DESC`,
    [shipperId]
  );
  return result.rows;
}

// Shipper nhận đơn
async function acceptOrder(orderId, userId) {
  const shipperRes = await pool.query(
    'SELECT id FROM shippers WHERE user_id = $1',
    [userId]
  );
  if (shipperRes.rows.length === 0) {
    throw new NotFoundError('Không tìm thấy shipper');
  }
  const shipperId = shipperRes.rows[0].id;

  // Kiểm tra đơn còn chưa ai nhận không
  const check = await pool.query(
    'SELECT id, shipper_id FROM orders WHERE id = $1',
    [orderId]
  );
  if (check.rows.length === 0) {
    throw new NotFoundError('Đơn hàng không tồn tại');
  }
  if (check.rows[0].shipper_id) {
    throw new BadRequestError('Đơn hàng đã có người nhận');
  }

  await pool.query(
    `UPDATE orders SET shipper_id = $1, status = 'Đang giao', assigned_at = NOW() WHERE id = $2`,
    [shipperId, orderId]
  );
  return { success: true };
}

// Shipper xác nhận đã giao hàng thành công
// Cộng điểm cho shipper
async function completeDelivery(orderId, userId, notes) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const shipperRes = await client.query(
      'SELECT id FROM shippers WHERE user_id = $1',
      [userId]
    );
    if (shipperRes.rows.length === 0) {
      throw new NotFoundError('Không tìm thấy shipper');
    }
    const shipperId = shipperRes.rows[0].id;

    // Kiểm tra đơn thuộc shipper này và đang giao
    const orderCheck = await client.query(
      'SELECT id, shipper_id, status, payment_method FROM orders WHERE id = $1',
      [orderId]
    );
    if (orderCheck.rows.length === 0) {
      throw new NotFoundError('Đơn hàng không tồn tại');
    }
    const order = orderCheck.rows[0];
    if (order.shipper_id !== shipperId) {
      throw new ForbiddenError('Bạn không phải shipper của đơn này');
    }
    if (order.status !== 'Đang giao') {
      throw new BadRequestError('Đơn hàng không ở trạng thái đang giao');
    }

    // Cập nhật đơn hàng thành Hoàn thành
    // Nếu thanh toán COD thì đánh dấu đã thanh toán
    await client.query(
      `UPDATE orders
       SET status = 'Hoàn thành', delivered_at = NOW(),
           is_paid = CASE WHEN payment_method = 'COD' THEN TRUE ELSE is_paid END
       WHERE id = $1`,
      [orderId]
    );

    // Ghi lịch sử giao hàng
    await client.query(
      `INSERT INTO shipper_history (shipper_id, order_id, points_earned, notes)
       VALUES ($1, $2, $3, $4)`,
      [shipperId, orderId, POINTS_PER_DELIVERY, notes || null]
    );

    // Cộng điểm cho shipper
    await client.query(
      `UPDATE shippers
       SET total_points = total_points + $1,
           total_deliveries = total_deliveries + 1
       WHERE id = $2`,
      [POINTS_PER_DELIVERY, shipperId]
    );

    await client.query('COMMIT');
    return { success: true, pointsEarned: POINTS_PER_DELIVERY };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getMe,
  getAvailableOrders,
  getMyDeliveries,
  getHistory,
  acceptOrder,
  completeDelivery,
};