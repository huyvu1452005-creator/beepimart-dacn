// Chuẩn hóa response trả về cho client
// Mọi API đều trả theo format { success, data } hoặc { success, error }

const success = (res, data, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    data,
  });
};

const error = (res, message, statusCode = 500, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(errors && { errors }),
  });
};

module.exports = { success, error };