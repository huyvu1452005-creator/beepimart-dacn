const { pool } = require('../config/database');
const logger = require('./logger');

// Ghi log hành động quan trọng vào DB
// Dùng cho audit trail: biết ai làm gì, khi nào, từ IP nào
async function writeAuditLog({ userId, action, entity, entityId, ip, userAgent, metadata }) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId || null,
        action,
        entity || null,
        entityId || null,
        ip || null,
        userAgent || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    // Không throw lỗi vì audit log không nên làm hỏng flow chính
    logger.error('Audit log failed', { error: err.message, action });
  }
}

module.exports = { writeAuditLog };