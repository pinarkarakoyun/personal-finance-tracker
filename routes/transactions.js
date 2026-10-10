const express = require('express');
const { sql, getPool } = require('../db');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post('/', async (req, res) => {
  const { categoryId, amount, description, date } = req.body;

  const amountNum = Number(amount);
  if (!Number.isInteger(categoryId)) {
    return res.status(400).json({ message: 'categoryId must be an integer' });
  }
  if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum >= 1e10) {
    return res.status(400).json({ message: 'amount must be a positive number' });
  }

  const desc = typeof description === 'string' ? description.trim() : null;
  if (desc && desc.length > 255) {
    return res
      .status(400)
      .json({ message: 'description must be at most 255 characters' });
  }

  if (
    date !== undefined &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)))
  ) {
    return res.status(400).json({ message: 'date must be in YYYY-MM-DD format' });
  }

  try {
    const pool = await getPool();

    const category = await pool
      .request()
      .input('categoryId', sql.Int, categoryId)
      .input('userId', sql.Int, req.user.userId)
      .query(
        'SELECT CategoryId FROM Categories WHERE CategoryId = @categoryId AND UserId = @userId'
      );

    if (category.recordset.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const result = await pool
      .request()
      .input('userId', sql.Int, req.user.userId)
      .input('categoryId', sql.Int, categoryId)
      .input('amount', sql.Decimal(12, 2), amountNum)
      .input('description', sql.NVarChar(255), desc || null)
      .input('date', sql.VarChar(10), date || null)
      .query(`
        INSERT INTO Transactions (UserId, CategoryId, Amount, Description, TransactionDate)
        OUTPUT INSERTED.TransactionId,
               INSERTED.CategoryId,
               INSERTED.Amount,
               INSERTED.Description,
               CONVERT(VARCHAR(10), INSERTED.TransactionDate, 23) AS TransactionDate
        VALUES (@userId, @categoryId, @amount, @description,
                ISNULL(CAST(@date AS DATE), CAST(SYSDATETIME() AS DATE)))
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT t.TransactionId,
               t.CategoryId,
               c.Name AS CategoryName,
               c.Type,
               t.Amount,
               t.Description,
               CONVERT(VARCHAR(10), t.TransactionDate, 23) AS TransactionDate
        FROM Transactions t
        JOIN Categories c ON c.CategoryId = t.CategoryId
        WHERE t.UserId = @userId
        ORDER BY t.TransactionDate DESC, t.TransactionId DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;