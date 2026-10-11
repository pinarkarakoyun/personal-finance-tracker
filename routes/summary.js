const express = require('express');
const { sql, getPool } = require('../db');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return null;
  }
  const [year, mon] = month.split('-').map(Number);
  const nextYear = mon === 12 ? year + 1 : year;
  const nextMon = mon === 12 ? 1 : mon + 1;
  return {
    start: `${month}-01`,
    end: `${nextYear}-${String(nextMon).padStart(2, '0')}-01`,
  };
}

const round2 = (n) => Math.round(n * 100) / 100;

router.get('/', async (req, res) => {
  const range = monthRange(req.query.month || '');
  if (!range) {
    return res
      .status(400)
      .json({ message: 'month is required in YYYY-MM format' });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('userId', sql.Int, req.user.userId)
      .input('start', sql.VarChar(10), range.start)
      .input('end', sql.VarChar(10), range.end)
      .query(`
        SELECT c.CategoryId AS categoryId,
               c.Name       AS name,
               c.Type       AS type,
               SUM(t.Amount) AS total,
               COUNT(*)      AS count
        FROM Transactions t
        JOIN Categories c ON c.CategoryId = t.CategoryId
        WHERE t.UserId = @userId
          AND t.TransactionDate >= CAST(@start AS DATE)
          AND t.TransactionDate <  CAST(@end AS DATE)
        GROUP BY c.CategoryId, c.Name, c.Type
        ORDER BY c.Type, total DESC
      `);

    const byCategory = result.recordset;
    const sumOf = (type) =>
      round2(
        byCategory
          .filter((row) => row.type === type)
          .reduce((acc, row) => acc + row.total, 0)
      );

    const totalIncome = sumOf('Income');
    const totalExpense = sumOf('Expense');

    res.json({
      month: req.query.month,
      totalIncome,
      totalExpense,
      balance: round2(totalIncome - totalExpense),
      byCategory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;