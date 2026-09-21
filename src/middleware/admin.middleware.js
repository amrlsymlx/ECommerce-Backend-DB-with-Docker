const { errorResponse } = require('../utils/response');

function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return errorResponse(res, 403, 'Forbidden');
  }
  next();
}

module.exports = adminMiddleware;
