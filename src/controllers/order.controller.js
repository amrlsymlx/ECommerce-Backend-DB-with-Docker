const pool = require('../config/db');
const { errorResponse } = require('../utils/response');

async function placeOrder(req, res) {
  const userId = req.user.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const cartResult = await client.query(
      `SELECT ci.id AS cart_item_id, ci.product_id, ci.quantity, p.price, p.stock, p.name
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = $1
       FOR UPDATE OF p`,
      [userId]
    );

    if (cartResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return errorResponse(res, 400, 'Cart is empty');
    }

    for (const item of cartResult.rows) {
      if (item.stock < item.quantity) {
        await client.query('ROLLBACK');
        return errorResponse(res, 400, `Insufficient stock for ${item.name}`);
      }
    }

    const totalAmount = cartResult.rows.reduce(
      (sum, item) => sum + Number(item.price) * item.quantity,
      0
    );

    const orderResult = await client.query(
      'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING id, status',
      [userId, totalAmount.toFixed(2), 'PENDING']
    );
    const order = orderResult.rows[0];

    for (const item of cartResult.rows) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [order.id, item.product_id, item.quantity, item.price]
      );

      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [
        item.quantity,
        item.product_id,
      ]);
    }

    await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    await client.query('COMMIT');

    return res.status(201).json({ orderId: order.id, status: order.status });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return errorResponse(res, 500, 'Something went wrong');
  } finally {
    client.release();
  }
}

async function getUserOrders(req, res) {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      'SELECT id, total_amount, status, created_at FROM orders WHERE user_id = $1 ORDER BY id DESC',
      [userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, 'Something went wrong');
  }
}

async function getOrderDetail(req, res) {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (orderResult.rows.length === 0) {
      return errorResponse(res, 404, 'Order not found');
    }

    const itemsResult = await pool.query(
      `SELECT oi.product_id AS "productId", p.name, oi.quantity, oi.price
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = $1`,
      [id]
    );

    return res.json({ ...orderResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, 'Something went wrong');
  }
}

async function getAllOrders(req, res) {
  try {
    const result = await pool.query(
      `SELECT o.id, o.user_id AS "userId", u.email, o.total_amount, o.status, o.created_at
       FROM orders o
       JOIN users u ON u.id = o.user_id
       ORDER BY o.id DESC`
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, 'Something went wrong');
  }
}

module.exports = { placeOrder, getUserOrders, getOrderDetail, getAllOrders };
