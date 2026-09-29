const { validationResult } = require('express-validator');
const { BadRequestError } = require('../utils/errors');

// Middleware chạy sau các validator của express-validator
// Nếu có lỗi validation, ném BadRequestError với chi tiết
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(e => ({
      field: e.path,
      message: e.msg,
    }));
    const err = new BadRequestError('Dữ liệu không hợp lệ');
    err.errors = errorMessages;
    return next(err);
  }
  next();
};

module.exports = { validate };