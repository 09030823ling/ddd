const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// 初始化資料庫
const dbPath = path.join(__dirname, 'data', 'app.db');
let db;

try {
  db = new Database(dbPath);
  console.log('Database connected at:', dbPath);

  // 建立表格（如果不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      game_name TEXT NOT NULL,
      rating TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
  console.log('Database tables created successfully');
} catch (err) {
  console.error('Database initialization error:', err);
  process.exit(1);
}

// 中間件設置
app.use(express.static('public'));
app.use(express.json());
app.use(session({
  secret: 'boardgame-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24小時
}));

// 認證中間件
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: '未登入' });
  }
  next();
}

// API: 用戶註冊
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  // 驗證輸入
  if (!username || !password) {
    return res.status(400).json({ error: '用戶名和密碼為必填' });
  }

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: '用戶名長度必須在3-20字之間' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: '密碼長度必須至少6字' });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ error: '用戶名只能包含英文、數字和底線' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    stmt.run(username, hashedPassword);
    res.json({ success: true, message: '註冊成功' });
  } catch (err) {
    console.error('Register error:', err);
    if (err.message && err.message.includes('UNIQUE')) {
      res.status(400).json({ error: '用戶名已存在' });
    } else {
      res.status(500).json({ error: '註冊失敗: ' + err.message });
    }
  }
});

// API: 用戶登入
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: '用戶名和密碼為必填' });
  }

  try {
    const stmt = db.prepare('SELECT id, username, password FROM users WHERE username = ?');
    const user = stmt.get(username);
    
    if (!user) {
      return res.status(401).json({ error: '用戶名或密碼錯誤' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: '用戶名或密碼錯誤' });
    }

    req.session.user = { id: user.id, username: user.username };
    res.json({ success: true, message: '登入成功' });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: '登入失敗: ' + err.message });
  }
});

// API: 用戶登出
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: '登出失敗' });
    }
    res.json({ success: true, message: '登出成功' });
  });
});

// API: 獲取當前用戶信息
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

// API: 保存評分
app.post('/api/rate', requireAuth, (req, res) => {
  const { gameName, rating } = req.body;
  const userId = req.session.user.id;

  if (!gameName || !rating) {
    return res.status(400).json({ error: '遊戲名稱和評分為必填' });
  }

  try {
    const stmt = db.prepare('INSERT INTO ratings (user_id, game_name, rating) VALUES (?, ?, ?)');
    stmt.run(userId, gameName, rating);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '評分保存失敗' });
  }
});

// API: 獲取用戶偏好
app.get('/api/preference', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  
  const stmt = db.prepare('SELECT game_name, rating FROM ratings WHERE user_id = ?');
  const userRatings = stmt.all(userId);

  const styleCounts = {};
  const gameStyles = {
    '卡坦島': '策略',
    '瘋狂農場': '派對',
    'Ticket to Ride': '策略',
    'Codenames': '派對'
  };

  userRatings.forEach(record => {
    if (record.rating === '喜歡') {
      const style = gameStyles[record.game_name];
      if (style) {
        styleCounts[style] = (styleCounts[style] || 0) + 1;
      }
    }
  });

  let preferredStyle = null;
  let maxCount = 0;
  for (const style in styleCounts) {
    if (styleCounts[style] > maxCount) {
      maxCount = styleCounts[style];
      preferredStyle = style;
    }
  }

  res.json({
    preferredStyle: preferredStyle,
    styleCounts: styleCounts,
    totalRatings: userRatings.length
  });
});

// API: 獲取用戶的遊玩紀錄
app.get('/api/user-ratings', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  
  const stmt = db.prepare(`
    SELECT game_name, rating, created_at FROM ratings 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `);
  const ratings = stmt.all(userId);
  
  res.json({ ratings });
});

// API: 刪除評分
app.delete('/api/rating/:gameName', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const gameName = req.params.gameName;

  try {
    const stmt = db.prepare('DELETE FROM ratings WHERE user_id = ? AND game_name = ?');
    stmt.run(userId, gameName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '刪除失敗' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});