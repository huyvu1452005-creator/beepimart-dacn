const { pool } = require('../config/database');

// Lấy tất cả danh mục kèm số sản phẩm
async function list() {
  const result = await pool.query(
    `SELECT c.id, c.name, c.slug, c.icon,
       (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = TRUE) AS product_count
     FROM categories c
     WHERE c.is_active = TRUE
     ORDER BY c.id ASC`
  );
  return result.rows;
}

module.exports = { list };