const pool = require('../config/db');
const { errorResponse } = require('../utils/response');

async function createProduct(req, res) {
  const { name, description, price, stock } = req.body;

  if (!name || price === undefined) {
    return errorResponse(res, 400, 'Name and price are required');
  }
  if (Number(price) <= 0) {
    return errorResponse(res, 400, 'Price must be greater than 0');
  }
  if (stock !== undefined && Number(stock) < 0) {
    return errorResponse(res, 400, 'Stock cannot be negative');
  }

  try {
    const result = await pool.query(
      'INSERT INTO products (name, description, price, stock) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, description || null, price, stock ?? 0]
    );
    return res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, 'Something went wrong');
  }
}

async function listProducts(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, name, description, price, stock FROM products ORDER BY id'
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, 'Something went wrong');
  }
}

async function getProductById(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Product not found');
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, 'Something went wrong');
  }
}

async function updateProduct(req, res) {
  const { id } = req.params;
  const { name, description, price, stock } = req.body;

  if (price !== undefined && Number(price) <= 0) {
    return errorResponse(res, 400, 'Price must be greater than 0');
  }
  if (stock !== undefined && Number(stock) < 0) {
    return errorResponse(res, 400, 'Stock cannot be negative');
  }

  try {
    const existing = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return errorResponse(res, 404, 'Product not found');
    }
    const current = existing.rows[0];

    const result = await pool.query(
      `UPDATE products SET name = $1, description = $2, price = $3, stock = $4 WHERE id = $5 RETURNING *`,
      [
        name ?? current.name,
        description ?? current.description,
        price ?? current.price,
        stock ?? current.stock,
        id,
      ]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, 'Something went wrong');
  }
}

async function deleteProduct(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Product not found');
    }
    return res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error(err);
    return errorResponse(res, 500, 'Something went wrong');
  }
}

module.exports = {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};
