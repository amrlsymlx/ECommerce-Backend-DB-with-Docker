const express = require('express');
const { getAllOrders } = require('../controllers/order.controller');
const authMiddleware = require('../middleware/auth.middleware');
const adminMiddleware = require('../middleware/admin.middleware');

const router = express.Router();

router.get('/orders', authMiddleware, adminMiddleware, getAllOrders);

module.exports = router;
