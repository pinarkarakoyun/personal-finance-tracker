const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sql, getPool } = require('../db');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res
      .status(400)
      .json({ message: 'fullName, email and password are required' });
  }
  if (password.length < 8) {
    return res
      .status(400)
      .json({ message: 'Password must be at least 8 characters' });
  }

  try {
    const pool = await getPool();

    const existing = await pool
      .request()
      .input('email', sql.NVarChar(255), email)
      .query('SELECT UserId FROM Users WHERE Email = @email');

    if (existing.recordset.length > 0) {
      return res.status(409).json({ message: 'This email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool
      .request()
      .input('fullName', sql.NVarChar(100), fullName)
      .input('email', sql.NVarChar(255), email)
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .query(`
        INSERT INTO Users (FullName, Email, PasswordHash)
        OUTPUT INSERTED.UserId, INSERTED.FullName, INSERTED.Email
        VALUES (@fullName, @email, @passwordHash)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  try {
    const pool = await getPool();

    const result = await pool
      .request()
      .input('email', sql.NVarChar(255), email)
      .query(
        'SELECT UserId, FullName, Email, PasswordHash FROM Users WHERE Email = @email'
      );

    const user = result.recordset[0];

    const passwordOk = user
      ? await bcrypt.compare(password, user.PasswordHash)
      : false;

    if (!passwordOk) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.UserId }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({
      token,
      user: { UserId: user.UserId, FullName: user.FullName, Email: user.Email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;