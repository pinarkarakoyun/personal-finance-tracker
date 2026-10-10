require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { getPool } = require('./db');
const authRoutes = require('./routes/auth'); 
const authenticate = require('./middleware/auth');
const categoryRoutes = require('./routes/categories');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes); 
app.use('/api/categories', categoryRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/me', authenticate, (req, res) => {
  res.json({ userId: req.user.userId });
});

app.get('/api/db-test', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query('SELECT COUNT(*) AS userCount FROM Users');
    res.json({ db: 'connected', userCount: result.recordset[0].userCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ db: 'error', message: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});