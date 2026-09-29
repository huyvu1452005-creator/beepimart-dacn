// Script kiểm tra hash trong DB có khớp với password không
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'beepi_admin',
  password: process.env.DB_PASSWORD || 'BeepiSecurePassword2026',
  database: process.env.DB_NAME || 'beepimart_db',
  port: process.env.DB_PORT || 5432,
});

(async () => {
  try {
    const r = await pool.query("SELECT username, password_hash FROM users WHERE username = 'admin'");
    if (r.rows.length === 0) {
      console.log('KHÔNG TÌM THẤY USER admin');
      process.exit(1);
    }
    const hash = r.rows[0].password_hash;
    console.log('Username:', r.rows[0].username);
    console.log('Hash length:', hash.length);
    console.log('Hash:', hash);
    console.log('Match admin123:', bcrypt.compareSync('admin123', hash));
  } catch (err) {
    console.error('Lỗi:', err.message);
  } finally {
    await pool.end();
  }
})();