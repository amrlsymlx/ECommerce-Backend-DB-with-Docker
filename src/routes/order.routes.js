const express = require('express');
const { placeOrder, getUserOrders, getOrderDetail } = require('../controllers/order.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/', placeOrder);
router.get('/', getUserOrders);
router.get('/:id', getOrderDetail);

module.exports = router;
