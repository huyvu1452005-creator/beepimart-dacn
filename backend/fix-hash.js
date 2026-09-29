// Script update hash mới cho tất cả user
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

const users = [
  { username: 'admin', password: 'admin123' },
  { username: 'customer', password: 'user123' },
  { username: 'customer2', password: 'user123' },
  { username: 'shipper1', password: 'ship123' },
  { username: 'shipper2', password: 'ship123' },
];

(async () => {
  try {
    for (const u of users) {
      const hash = bcrypt.hashSync(u.password, 10);
      const result = await pool.query(
        'UPDATE users SET password_hash = $1 WHERE username = $2',
        [hash, u.username]
      );
      console.log(`Updated ${u.username}: ${result.rowCount} row(s), hash length = ${hash.length}`);
    }

    // Verify
    console.log('\n=== VERIFY ===');
    for (const u of users) {
      const r = await pool.query('SELECT password_hash FROM users WHERE username = $1', [u.username]);
      const storedHash = r.rows[0].password_hash;
      const match = bcrypt.compareSync(u.password, storedHash);
      console.log(`${u.username}: length=${storedHash.length}, match=${match}`);
    }
  } catch (err) {
    console.error('Lỗi:', err.message);
  } finally {
    await pool.end();
  }
})();