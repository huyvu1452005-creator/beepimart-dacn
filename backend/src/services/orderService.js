const { pool } = require('../config/database');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

// Tạo đơn hàng từ giỏ hàng
// Dùng TRANSACTION để đảm bảo toàn vẹn dữ liệu
async function checkout(userId, { cartItems, shipping_address, payment_method, notes }) {
  if (!cartItems || cartItems.length === 0) {
    throw new BadRequestError('Giỏ hàng đang trống');
  }

  const client = await pool.connect();
  try {
    // Bắt đầu transaction
    await client.query('BEGIN');

    let totalAmount = 0;
    let isFragile = false;

    // Bước 1: Validate từng sản phẩm, khóa row để tránh race condition
    for (const item of cartItems) {
      const prodRes = await client.query(
        'SELECT price, stock, name, is_fragile FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE',
        [item.product_id]
      );
      if (prodRes.rows.length === 0) {
        throw new BadRequestError(`Sản phẩm ID ${item.product_id} không tồn tại`);
      }
      const product = prodRes.rows[0];
      if (product.stock < item.quantity) {
        throw new BadRequestError(`Sản phẩm "${product.name}" không đủ tồn kho`);
      }
      if (product.is_fragile) isFragile = true;
      totalAmount += Number(product.price) * item.quantity;
    }

    // Bước 2: Tạo đơn hàng
    const orderRes = await client.query(
      `INSERT INTO orders (user_id, total_amount, status, shipping_address, payment_method, is_paid, is_fragile, notes)
       VALUES ($1, $2, 'Chờ xử lý', $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        userId,
        totalAmount,
        shipping_address,
        payment_method || 'COD',
        payment_method && payment_method !== 'COD',
        isFragile,
        notes || null,
      ]
    );
    const orderId = orderRes.rows[0].id;

    // Bước 3: Thêm order_items + trừ stock
    for (const item of cartItems) {
      const prodRes = await client.query(
        'SELECT price, name FROM products WHERE id = $1',
        [item.product_id]
      );
      const { price, name } = prodRes.rows[0];

      // Lưu tên sản phẩm tại thời điểm mua
      // để giữ lịch sử ngay cả khi sản phẩm đổi tên
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, price)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.product_id, name, item.quantity, price]
      );

      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // Commit transaction
    await client.query('COMMIT');
    return { orderId };
  } catch (err) {
    // Rollback nếu có lỗi, đảm bảo không có thay đổi dở dang
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Lấy đơn hàng của user
async function getMyOrders(userId) {
  const result = await pool.query(
    `SELECT o.id, o.total_amount, o.status, o.created_at, o.shipping_address,
            o.payment_method, o.is_paid, o.is_fragile, o.notes, o.cancel_reason,
            (SELECT json_agg(json_build_object(
              'name', oi.product_name,
              'quantity', oi.quantity,
              'price', oi.price,
              'image_url', p.image_url
            ) ORDER BY oi.id)
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = o.id) AS items
     FROM orders o
     WHERE o.user_id = $1
     ORDER BY o.id DESC`,
    [userId]
  );
  return result.rows;
}

// Lấy chi tiết đơn hàng
async function getDetail(orderId, userId) {
  const orderRes = await pool.query(
    'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
    [orderId, userId]
  );
  if (orderRes.rows.length === 0) {
    throw new NotFoundError('Đơn hàng không tồn tại');
  }

  const itemsRes = await pool.query(
    `SELECT oi.id, oi.quantity, oi.price, oi.product_name AS name, p.image_url
     FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1 ORDER BY oi.id`,
    [orderId]
  );

  return { ...orderRes.rows[0], items: itemsRes.rows };
}

// Tracking đơn hàng dạng timeline
async function getTracking(orderId, userId, userRole) {
  const orderRes = await pool.query(
    `SELECT o.*,
       (SELECT s.full_name FROM shippers s WHERE s.id = o.shipper_id) AS shipper_name,
       (SELECT s.phone FROM shippers s WHERE s.id = o.shipper_id) AS shipper_phone
     FROM orders o WHERE o.id = $1`,
    [orderId]
  );
  if (orderRes.rows.length === 0) {
    throw new NotFoundError('Đơn hàng không tồn tại');
  }
  const order = orderRes.rows[0];

  // Customer chỉ xem được đơn của mình
  if (userRole !== 'admin' && order.user_id !== userId) {
    throw new ForbiddenError('Không có quyền xem đơn này');
  }

  // Định nghĩa các bước trong timeline
  const statusFlow = [
    { key: 'Chờ xử lý',   label: 'Đặt hàng thành công',   icon: '📝', desc: 'Đã tiếp nhận đơn' },
    { key: 'Đã xác nhận', label: 'Đã xác nhận đơn',       icon: '✅', desc: 'Người bán đã xác nhận' },
    { key: 'Chờ lấy hàng',label: 'Chờ shipper lấy hàng',  icon: '📦', desc: 'Đang chờ shipper' },
    { key: 'Đang giao',   label: 'Đang giao hàng',        icon: '🚚', desc: 'Shipper đang giao' },
    { key: 'Hoàn thành',  label: 'Giao thành công',       icon: '🎉', desc: 'Đã nhận hàng' },
  ];
  if (order.status === 'Đã hủy') {
    statusFlow.push({ key: 'Đã hủy', label: 'Đơn đã hủy', icon: '❌', desc: 'Đã hủy' });
  }

  const currentIdx = statusFlow.findIndex(s => s.key === order.status);
  const timeline = statusFlow.map((step, idx) => ({
    ...step,
    completed: idx <= currentIdx,
    current: idx === currentIdx,
    timestamp: idx <= currentIdx ? order.created_at : null,
  }));

  return {
    order: {
      id: order.id,
      status: order.status,
      created_at: order.created_at,
      total_amount: order.total_amount,
      shipping_address: order.shipping_address,
      shipper_name: order.shipper_name,
      shipper_phone: order.shipper_phone,
      is_fragile: order.is_fragile,
      payment_method: order.payment_method,
      is_paid: order.is_paid,
    },
    timeline,
  };
}

// Customer hủy đơn (chỉ khi chưa giao)
async function cancel(orderId, userId, reason) {
  const check = await pool.query(
    'SELECT id, status FROM orders WHERE id = $1 AND user_id = $2',
    [orderId, userId]
  );
  if (check.rows.length === 0) {
    throw new NotFoundError('Đơn hàng không tồn tại');
  }

  const { status } = check.rows[0];
  if (['Đang giao', 'Hoàn thành', 'Đã hủy'].includes(status)) {
    throw new BadRequestError('Không thể hủy đơn ở trạng thái này');
  }

  await pool.query(
    `UPDATE orders SET status = 'Đã hủy', cancel_reason = $1, cancelled_at = NOW() WHERE id = $2`,
    [reason || 'Khách hàng hủy', orderId]
  );
  return { success: true };
}

// Customer xác nhận đã nhận hàng
async function confirmReceived(orderId, userId) {
  const check = await pool.query(
    'SELECT id, status FROM orders WHERE id = $1 AND user_id = $2',
    [orderId, userId]
  );
  if (check.rows.length === 0) {
    throw new NotFoundError('Đơn hàng không tồn tại');
  }
  const { status } = check.rows[0];
  if (status === 'Hoàn thành') {
    throw new BadRequestError('Đơn hàng đã hoàn thành');
  }
  if (status === 'Đã hủy') {
    throw new BadRequestError('Đơn hàng đã bị hủy');
  }

  await pool.query(
    "UPDATE orders SET status = 'Hoàn thành', delivered_at = NOW() WHERE id = $1",
    [orderId]
  );
  return { success: true };
}

module.exports = {
  checkout,
  getMyOrders,
  getDetail,
  getTracking,
  cancel,
  confirmReceived,
};