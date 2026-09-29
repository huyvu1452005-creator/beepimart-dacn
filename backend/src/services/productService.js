const { pool } = require('../config/database');
const { NotFoundError } = require('../utils/errors');

// ============================================================
// Lấy danh sách sản phẩm
// Filter theo search text hoặc category_id
// ============================================================
async function list({ search, category_id }) {
  let query = 'SELECT * FROM products WHERE is_active = TRUE';
  const params = [];

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    query += ` AND LOWER(name) LIKE $${params.length}`;
  }
  if (category_id && Number(category_id) !== 0) {
    params.push(Number(category_id));
    query += ` AND category_id = $${params.length}`;
  }
  query += ' ORDER BY id DESC';

  const result = await pool.query(query, params);
  return result.rows;
}

// ============================================================
// Lấy chi tiết sản phẩm kèm danh mục và sản phẩm liên quan
// ============================================================
async function getDetail(id) {
  const productRes = await pool.query(
    `SELECT p.*, c.name AS category_name, c.icon AS category_icon
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = $1 AND p.is_active = TRUE`,
    [id]
  );
  if (productRes.rows.length === 0) {
    throw new NotFoundError('Sản phẩm không tồn tại');
  }
  const product = productRes.rows[0];

  // Lấy 4 sản phẩm cùng danh mục, khác id
  const relatedRes = await pool.query(
    `SELECT id, name, price, image_url, stock FROM products
     WHERE category_id = $1 AND id != $2 AND is_active = TRUE
     ORDER BY RANDOM() LIMIT 4`,
    [product.category_id, product.id]
  );

  return { ...product, related: relatedRes.rows };
}

// ============================================================
// Lấy top sản phẩm bán chạy
//
// LOGIC:
// 1. Ưu tiên lấy sản phẩm từ các đơn hàng đã "Hoàn thành"
//    Sắp xếp theo tổng số lượng bán (SUM quantity)
// 2. Nếu chưa có đơn hàng nào (DB mới, demo):
//    -> Fallback: trả về 10 sản phẩm RANDOM đang active
//
// Nhờ vậy kệ "Sản Phẩm Bán Chạy" luôn hiển thị dữ liệu
// ============================================================
async function getBestSellers(limit = 10) {
  try {
    // Bước 1: Cố gắng lấy top sản phẩm bán chạy thật từ đơn hàng hoàn thành
    const result = await pool.query(
      `SELECT p.id, p.name, p.price, p.image_url, p.stock, p.is_fragile,
              p.category_id,
              COALESCE(SUM(oi.quantity), 0) AS total_sold
       FROM products p
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'Hoàn thành'
       WHERE p.is_active = TRUE
       GROUP BY p.id, p.name, p.price, p.image_url, p.stock, p.is_fragile, p.category_id
       HAVING COALESCE(SUM(oi.quantity), 0) > 0
       ORDER BY total_sold DESC, p.id ASC
       LIMIT $1`,
      [limit]
    );

    // Nếu có sản phẩm bán chạy -> trả về
    if (result.rows.length > 0) {
      return result.rows;
    }

    // Bước 2: Fallback - chưa có đơn hàng nào -> trả random 10 sản phẩm
    const randomRes = await pool.query(
      `SELECT id, name, price, image_url, stock, is_fragile, category_id,
              0 AS total_sold
       FROM products
       WHERE is_active = TRUE
       ORDER BY RANDOM()
       LIMIT $1`,
      [limit]
    );
    return randomRes.rows;
  } catch (err) {
    throw err;
  }
}

// ============================================================
// Admin: tạo sản phẩm mới
// ============================================================
async function create({ name, category_id, description, price, stock, image_url, is_fragile }) {
  const result = await pool.query(
    `INSERT INTO products (name, category_id, description, price, stock, image_url, is_fragile)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [name, category_id, description, price, stock, image_url, is_fragile || false]
  );
  return result.rows[0];
}

// ============================================================
// Admin: cập nhật sản phẩm
// ============================================================
async function update(id, { name, category_id, description, price, stock, image_url, is_fragile }) {
  const result = await pool.query(
    `UPDATE products
     SET name = $1, category_id = $2, description = $3, price = $4,
         stock = $5, image_url = $6, is_fragile = $7
     WHERE id = $8 RETURNING id, image_url`,
    [name, category_id, description, price, stock, image_url, is_fragile || false, id]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Sản phẩm không tồn tại');
  }
  return result.rows[0];
}

// ============================================================
// Admin: xóa mềm sản phẩm (đánh dấu is_active = false)
// Không xóa hẳn để giữ lịch sử đơn hàng
// ============================================================
async function remove(id) {
  const result = await pool.query(
    'UPDATE products SET is_active = FALSE WHERE id = $1 RETURNING id, image_url',
    [id]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Sản phẩm không tồn tại');
  }
  return result.rows[0];
}

module.exports = {
  list,
  getDetail,
  getBestSellers,
  create,
  update,
  remove
};