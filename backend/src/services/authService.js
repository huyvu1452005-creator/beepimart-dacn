const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { JWT, SECURITY } = require('../config/env');
const {
  BadRequestError,
  UnauthorizedError,
  ConflictError,
} = require('../utils/errors');

// Đăng ký tài khoản mới
async function register({ username, email, password }) {
  // Kiểm tra trùng username hoặc email
  const existing = await pool.query(
    'SELECT id FROM users WHERE username = $1 OR email = $2',
    [username, email]
  );
  if (existing.rows.length > 0) {
    throw new ConflictError('Tên đăng nhập hoặc email đã được sử dụng');
  }

  // Hash mật khẩu trước khi lưu
  // Không bao giờ lưu plain text password
  const passwordHash = await bcrypt.hash(password, SECURITY.bcryptCost);

  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $2, $3, 'customer')
     RETURNING id, username, email, role`,
    [username, email, passwordHash]
  );

  return result.rows[0];
}

// Đăng nhập
async function login({ username, password }) {
  const result = await pool.query(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );

  // Không tiết lộ username có tồn tại hay không
  // để tránh hacker enumeration
  if (result.rows.length === 0) {
    throw new UnauthorizedError('Tài khoản hoặc mật khẩu không chính xác');
  }

  const user = result.rows[0];

  // Kiểm tra tài khoản có đang bị khóa không
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
    throw new UnauthorizedError(`Tài khoản đang bị khóa. Thử lại sau ${minutesLeft} phút.`);
  }

  // Kiểm tra tài khoản có bị vô hiệu hóa không
  if (!user.is_active) {
    throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa');
  }

  // Verify mật khẩu
  const match = await bcrypt.compare(password, user.password_hash);

  if (!match) {
    // Tăng số lần đăng nhập sai
    const newAttempts = (user.failed_login_attempts || 0) + 1;

    // Nếu vượt ngưỡng, khóa tài khoản
    if (newAttempts >= SECURITY.maxLoginAttempts) {
      const lockUntil = new Date(Date.now() + SECURITY.lockTimeMinutes * 60 * 1000);
      await pool.query(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [newAttempts, lockUntil, user.id]
      );
      throw new UnauthorizedError(
        `Sai quá ${SECURITY.maxLoginAttempts} lần. Tài khoản khóa ${SECURITY.lockTimeMinutes} phút.`
      );
    }

    await pool.query(
      'UPDATE users SET failed_login_attempts = $1 WHERE id = $2',
      [newAttempts, user.id]
    );
    throw new UnauthorizedError('Tài khoản hoặc mật khẩu không chính xác');
  }

  // Đăng nhập thành công, reset số lần sai
  await pool.query(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = NOW() WHERE id = $1',
    [user.id]
  );

  // Tạo JWT token
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT.secret,
    { expiresIn: JWT.expiresIn }
  );

  return {
    token,
    username: user.username,
    role: user.role,
    full_name: user.full_name,
  };
}

// Lấy thông tin profile
async function getProfile(userId) {
  const result = await pool.query(
    'SELECT id, username, email, role, full_name, phone, address, created_at FROM users WHERE id = $1',
    [userId]
  );
  if (result.rows.length === 0) {
    throw new UnauthorizedError('Không tìm thấy người dùng');
  }
  return result.rows[0];
}

// Cập nhật profile
async function updateProfile(userId, { full_name, phone, address, email }) {
  // Kiểm tra email trùng nếu có đổi
  if (email) {
    const dup = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND id != $2',
      [email, userId]
    );
    if (dup.rows.length > 0) {
      throw new ConflictError('Email đã được sử dụng');
    }
  }

  const result = await pool.query(
    `UPDATE users
     SET full_name = COALESCE($1, full_name),
         phone = COALESCE($2, phone),
         address = COALESCE($3, address),
         email = COALESCE($4, email)
     WHERE id = $5
     RETURNING id, username, email, role, full_name, phone, address`,
    [full_name, phone, address, email, userId]
  );
  return result.rows[0];
}

// Đổi mật khẩu
async function changePassword(userId, oldPassword, newPassword) {
  const result = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );
  if (result.rows.length === 0) {
    throw new UnauthorizedError('Không tìm thấy người dùng');
  }

  const match = await bcrypt.compare(oldPassword, result.rows[0].password_hash);
  if (!match) {
    throw new BadRequestError('Mật khẩu cũ không chính xác');
  }

  const newHash = await bcrypt.hash(newPassword, SECURITY.bcryptCost);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
};