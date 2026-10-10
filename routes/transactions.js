const express = require('express');
const { sql, getPool } = require('../db');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// Validates and cleans the body shared by POST and PUT.
// Returns { error } or { value }.
function parseTransactionBody(body = {}) {
  const { categoryId, amount, description, date } = body;

  if (!Number.isInteger(categoryId)) {
    return { error: 'categoryId must be an integer' };
  }

  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum >= 1e10) {
    return { error: 'amount must be a positive number' };
  }

  const desc = typeof description === 'string' ? description.trim() : null;
  if (desc && desc.length > 255) {
    return { error: 'description must be at most 255 characters' };
  }

  if (
    date !== undefined &&
    date !== null &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)))
  ) {
    return { error: 'date must be in YYYY-MM-DD format' };
  }

  return {
    value: {
      categoryId,
      amount: amountNum,
      description: desc || null,
      date: date || null,
    },
  };
}

// True only if the category exists AND belongs to this user.
async function categoryBelongsToUser(pool, categoryId, userId) {
  const result = await pool
    .request()
    .input('categoryId', sql.Int, categoryId)
    .input('userId', sql.Int, userId)
    .query(
      'SELECT CategoryId FROM Categories WHERE CategoryId = @categoryId AND UserId = @userId'
    );
  return result.recordset.length > 0;
}

router.post('/', async (req, res) => {
  const { error, value } = parseTransactionBody(req.body);
  if (error) {
    return res.status(400).json({ message: error });
  }

  try {
    const pool = await getPool();

    if (!(await categoryBelongsToUser(pool, value.categoryId, req.user.userId))) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const result = await pool
      .request()
      .input('userId', sql.Int, req.user.userId)
      .input('categoryId', sql.Int, value.categoryId)
      .input('amount', sql.Decimal(12, 2), value.amount)
      .input('description', sql.NVarChar(255), value.description)
      .input('date', sql.VarChar(10), value.date)
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

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'id must be an integer' });
  }

  const { error, value } = parseTransactionBody(req.body);
  if (error) {
    return res.status(400).json({ message: error });
  }

  try {
    const pool = await getPool();

    if (!(await categoryBelongsToUser(pool, value.categoryId, req.user.userId))) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('userId', sql.Int, req.user.userId)
      .input('categoryId', sql.Int, value.categoryId)
      .input('amount', sql.Decimal(12, 2), value.amount)
      .input('description', sql.NVarChar(255), value.description)
      .input('date', sql.VarChar(10), value.date)
      .query(`
        UPDATE Transactions
        SET CategoryId = @categoryId,
            Amount = @amount,
            Description = @description,
            TransactionDate = ISNULL(CAST(@date AS DATE), TransactionDate)
        OUTPUT INSERTED.TransactionId,
               INSERTED.CategoryId,
               INSERTED.Amount,
               INSERTED.Description,
               CONVERT(VARCHAR(10), INSERTED.TransactionDate, 23) AS TransactionDate
        WHERE TransactionId = @id AND UserId = @userId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id)) {
    return res.status(400).json({ message: 'id must be an integer' });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('id', sql.Int, id)
      .input('userId', sql.Int, req.user.userId)
      .query(
        'DELETE FROM Transactions WHERE TransactionId = @id AND UserId = @userId'
      );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;