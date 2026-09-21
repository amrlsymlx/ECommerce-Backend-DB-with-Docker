const pool = require('../config/db');
const { errorResponse } = require('../utils/response');

async function addToCart(req, res) {
  const userId = req.user.id;
  const { productId, quantity } = req.body;

  if (!productId || !quantity || Number(quantity) <= 0) {
    return errorResponse(res, 400, 'productId and a positive quantity are required');
  }

  try {
    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
      return errorResponse(res, 404, 'Product not found');
    }

    const product = productResult.rows[0];
    if (product.stock < quantity) {
      return errorResponse(res, 400, 'Insufficient stock');
    }

    const existingItem = await pool.query(
      'SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2',
      [userId, productId]
    );

    let result;
    if (existingItem.rows.length > 0) {
      const newQuantity = existingItem.rows[0].quantity + Number(quantity);
      if (product.stock < newQuantity) {
        return errorResponse(res, 400, 'Insufficient stock');
      }
      result = await pool.query(
        'UPDATE cart_items SET quantity = $1 WHERE id = $2 RETURNING *',
        [newQuantity, existingItem.rows[0].id]
      );
    } else {
      result = await pool.query(
        'INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3) RETURNING *',
        [userId, productId, quantity]
      );
    }

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, 'Something went wrong');
  }
}

async function getCart(req, res) {
  const userId = req.user.id;
  try {
    const result = await pool.query(
      `SELECT ci.id AS "itemId", p.id AS "productId", p.name, ci.quantity, p.price
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.user_id = $1
       ORDER BY ci.id`,
      [userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, 'Something went wrong');
  }
}

async function updateCartItem(req, res) {
  const userId = req.user.id;
  const { itemId } = req.params;
  const { quantity } = req.body;

  if (!quantity || Number(quantity) <= 0) {
    return errorResponse(res, 400, 'Quantity must be greater than 0');
  }

  try {
    const itemResult = await pool.query(
      'SELECT * FROM cart_items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );
    if (itemResult.rows.length === 0) {
      return errorResponse(res, 404, 'Cart item not found');
    }

    const productResult = await pool.query('SELECT * FROM products WHERE id = $1', [
      itemResult.rows[0].product_id,
    ]);
    if (productResult.rows[0].stock < quantity) {
      return errorResponse(res, 400, 'Insufficient stock');
    }

    const result = await pool.query(
      'UPDATE cart_items SET quantity = $1 WHERE id = $2 RETURNING *',
      [quantity, itemId]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, 'Something went wrong');
  }
}

async function removeCartItem(req, res) {
  const userId = req.user.id;
  const { itemId } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM cart_items WHERE id = $1 AND user_id = $2 RETURNING id',
      [itemId, userId]
    );
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Cart item not found');
    }
    return res.json({ message: 'Item removed from cart' });
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, 'Something went wrong');
  }
}

module.exports = { addToCart, getCart, updateCartItem, removeCartItem };
