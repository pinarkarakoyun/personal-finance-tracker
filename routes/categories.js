const express = require('express');
const { sql, getPool } = require('../db');
const authenticate = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT CategoryId, Name, Type
        FROM Categories
        WHERE UserId = @userId
        ORDER BY Type, Name
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const name = (req.body.name || '').trim();
  const type = req.body.type;

  if (!name || name.length > 50) {
    return res
      .status(400)
      .json({ message: 'name is required and must be at most 50 characters' });
  }
  if (type !== 'Income' && type !== 'Expense') {
    return res
      .status(400)
      .json({ message: "type must be 'Income' or 'Expense'" });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input('userId', sql.Int, req.user.userId)
      .input('name', sql.NVarChar(50), name)
      .input('type', sql.NVarChar(10), type)
      .query(`
        INSERT INTO Categories (UserId, Name, Type)
        OUTPUT INSERTED.CategoryId, INSERTED.Name, INSERTED.Type
        VALUES (@userId, @name, @type)
      `);
    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;