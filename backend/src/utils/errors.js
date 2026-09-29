// Lớp lỗi cơ sở, mọi lỗi tự định nghĩa đều kế thừa từ đây
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Đánh dấu đây là lỗi có chủ đích, không phải bug
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Yêu cầu không hợp lệ') {
    super(message, 400);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Chưa đăng nhập') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Không có quyền truy cập') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Không tìm thấy') {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Dữ liệu đã tồn tại') {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};