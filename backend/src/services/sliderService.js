const { pool } = require('../config/database');
const { NotFoundError } = require('../utils/errors');

// Lấy slider đang active cho trang chủ
async function getPublic() {
  const result = await pool.query(
    `SELECT id, title, description, image_url, link_url, button_text, tag_text, display_order
     FROM sliders WHERE is_active = TRUE
     ORDER BY display_order ASC, id ASC`
  );
  return result.rows;
}

// Admin: lấy tất cả slider
async function getAll() {
  const result = await pool.query(
    'SELECT * FROM sliders ORDER BY display_order ASC, id ASC'
  );
  return result.rows;
}

// Admin: tạo slider
async function create(data) {
  const result = await pool.query(
    `INSERT INTO sliders (title, description, image_url, link_url, button_text, tag_text, display_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [
      data.title,
      data.description,
      data.image_url,
      data.link_url || '#',
      data.button_text || 'Xem Thêm',
      data.tag_text,
      data.display_order || 0,
      data.is_active !== false,
    ]
  );
  return result.rows[0];
}

// Admin: cập nhật slider
async function update(id, data) {
  const result = await pool.query(
    `UPDATE sliders
     SET title = $1, description = $2, image_url = $3, link_url = $4,
         button_text = $5, tag_text = $6, display_order = $7, is_active = $8
     WHERE id = $9 RETURNING id, image_url`,
    [
      data.title,
      data.description,
      data.image_url,
      data.link_url || '#',
      data.button_text || 'Xem Thêm',
      data.tag_text,
      data.display_order || 0,
      data.is_active !== false,
      id,
    ]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Slider không tồn tại');
  }
  return result.rows[0];
}

// Admin: xóa slider
async function remove(id) {
  const result = await pool.query(
    'DELETE FROM sliders WHERE id = $1 RETURNING id, image_url',
    [id]
  );
  if (result.rows.length === 0) {
    throw new NotFoundError('Slider không tồn tại');
  }
  return result.rows[0];
}

module.exports = { getPublic, getAll, create, update, remove };