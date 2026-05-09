let currentUser = null;

const games = [
  { name: "卡坦島", players: "3-4", time: "60-120", style: "策略", complexity: "中等", description: "資源管理與貿易的經典策略遊戲。" },
  { name: "瘋狂農場", players: "2-6", time: "30-45", style: "派對", complexity: "簡單", description: "輕鬆有趣的卡牌遊戲，適合多人。" },
  { name: "Ticket to Ride", players: "2-5", time: "30-60", style: "策略", complexity: "簡單", description: "鐵路建設的策略遊戲。" },
  { name: "Codenames", players: "2-8", time: "15-30", style: "派對", complexity: "簡單", description: "團隊合作的猜詞遊戲。" }
];

// ===== 認證標籤切換 =====
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    const tab = this.getAttribute('data-tab');
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    this.classList.add('active');
    document.getElementById(tab + '-form').classList.add('active');
  });
});

// ===== 登入功能 =====
document.getElementById('login-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();

    if (data.success) {
      currentUser = username;
      document.getElementById('username-display').textContent = username;
      document.getElementById('auth-section').style.display = 'none';
      document.getElementById('main-section').style.display = 'flex';
    } else {
      alert('登入失敗: ' + data.error);
    }
  } catch (err) {
    alert('登入出錯: ' + err.message);
  }
});

// ===== 註冊功能 =====
document.getElementById('register-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const passwordConfirm = document.getElementById('register-password-confirm').value;

  // 前端驗證
  if (username.length < 3 || username.length > 20) {
    alert('用戶名長度必須在3-20字之間');
    return;
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    alert('用戶名只能包含英文、數字和底線');
    return;
  }

  if (password.length < 6) {
    alert('密碼長度必須至少6字');
    return;
  }

  if (password !== passwordConfirm) {
    alert('密碼不相符');
    return;
  }

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await response.json();

    if (data.success) {
      alert('註冊成功！請登入');
      document.getElementById('register-form').reset();
      document.querySelector('[data-tab="login"]').click();
    } else {
      alert('註冊失敗: ' + data.error);
    }
  } catch (err) {
    alert('註冊出錯: ' + err.message);
  }
});

// ===== 登出功能 =====
document.getElementById('logout-btn').addEventListener('click', async function() {
  try {
    const response = await fetch('/api/logout', { method: 'POST' });
    const data = await response.json();

    if (data.success) {
      currentUser = null;
      document.getElementById('auth-section').style.display = 'block';
      document.getElementById('main-section').style.display = 'none';
      document.getElementById('login-form').reset();
      document.getElementById('register-form').reset();
      document.querySelector('[data-tab="login"]').click();
    }
  } catch (err) {
    alert('登出出錯: ' + err.message);
  }
});

// ===== 多頁面切換 =====
document.querySelectorAll('.page-link').forEach(link => {
  link.addEventListener('click', function(e) {
    e.preventDefault();
    const page = this.getAttribute('data-page');
    
    document.querySelectorAll('.page-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    this.classList.add('active');
    document.getElementById(page + '-page').classList.add('active');

    if (page === 'history') {
      loadUserRatings();
    }
  });
});

// ===== 推薦系統 =====
document.getElementById('recommendation-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const players = document.getElementById('players').value;
  const time = document.getElementById('time').value;
  const style = document.getElementById('style').value;
  const complexity = document.getElementById('complexity').value;

  const filtered = games.filter(game => {
    if (players === '1-2' && !game.players.includes('2')) return false;
    if (players === '3-4' && !game.players.includes('3') && !game.players.includes('4')) return false;
    if (players === '5+' && !game.players.includes('5') && !game.players.includes('6') && !game.players.includes('8')) return false;
    if (time === '30' && !game.time.includes('30')) return false;
    if (time === '60' && !game.time.includes('60')) return false;
    if (time === '120+' && !game.time.includes('120')) return false;
    if (style !== game.style) return false;
    if (complexity !== game.complexity) return false;
    return true;
  });

  fetchUserPreference().then(preference => {
    displayResults(filtered, preference);
  });
});

// 從後端獲取用戶偏好
async function fetchUserPreference() {
  try {
    const response = await fetch('/api/preference');
    if (!response.ok) return null;
    const data = await response.json();
    return data.preferredStyle;
  } catch (err) {
    console.error('Error fetching preference:', err);
    return null;
  }
}

// 顯示推薦結果
function displayResults(results, preference) {
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '';
  
  if (results.length === 0) {
    resultsDiv.innerHTML = '<p>沒有符合條件的桌遊。</p>';
    return;
  }
  
  results.forEach(game => {
    const div = document.createElement('div');
    let reason = '根據您的條件，這款遊戲很適合！';
    if (preference) {
      reason += ` 根據您過去的評價，您偏好${preference}類型桌遊，因此推薦這款${game.style}遊戲。`;
    }
    
    div.innerHTML = `
      <h3>${game.name}</h3>
      <p>人數: ${game.players}</p>
      <p>時間: ${game.time} 分鐘</p>
      <p>風格: ${game.style}</p>
      <p>複雜度: ${game.complexity}</p>
      <p>描述: ${game.description}</p>
      <p>推薦理由: ${reason}</p>
      <div class="rating">
        <label>您的評分:</label>
        <button class="rate-btn like" data-game="${game.name}" data-rating="喜歡">👍 喜歡</button>
        <button class="rate-btn normal" data-game="${game.name}" data-rating="普通">😐 普通</button>
        <button class="rate-btn dislike" data-game="${game.name}" data-rating="不喜歡">👎 不喜歡</button>
      </div>
    `;
    resultsDiv.appendChild(div);
  });

  document.querySelectorAll('.rate-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const gameName = this.getAttribute('data-game');
      const rating = this.getAttribute('data-rating');
      saveRating(gameName, rating);
    });
  });
}

// 儲存評分到後端
async function saveRating(gameName, rating) {
  try {
    const response = await fetch('/api/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameName, rating })
    });
    const data = await response.json();
    if (data.success) {
      alert(`已記錄 ${gameName} 的評分: ${rating}`);
    }
  } catch (err) {
    alert('評分保存失敗: ' + err.message);
  }
}

// ===== 遊玩紀錄頁面 =====
async function loadUserRatings() {
  const historyContent = document.getElementById('history-content');
  historyContent.innerHTML = '<p>載入中...</p>';

  try {
    const response = await fetch('/api/user-ratings');
    if (!response.ok) {
      historyContent.innerHTML = '<p>無法載入遊玩紀錄</p>';
      return;
    }
    
    const data = await response.json();
    const ratings = data.ratings;

    if (ratings.length === 0) {
      historyContent.innerHTML = '<p>您還沒有任何評分紀錄。</p>';
      return;
    }

    let html = '<table class="ratings-table"><thead><tr><th>遊戲名稱</th><th>評分</th><th>時間</th><th>操作</th></tr></thead><tbody>';
    ratings.forEach(record => {
      const date = new Date(record.created_at).toLocaleDateString('zh-TW');
      html += `
        <tr>
          <td>${record.game_name}</td>
          <td><span class="rating-badge rating-${record.rating}">${record.rating}</span></td>
          <td>${date}</td>
          <td><button class="delete-btn" data-game="${record.game_name}">刪除</button></td>
        </tr>
      `;
    });
    html += '</tbody></table>';
    historyContent.innerHTML = html;

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const gameName = this.getAttribute('data-game');
        if (confirm(`確定要刪除 ${gameName} 的評分嗎？`)) {
          await deleteRating(gameName);
          loadUserRatings(); // 重新載入
        }
      });
    });
  } catch (err) {
    historyContent.innerHTML = '<p>載入失敗: ' + err.message + '</p>';
  }
}

// 刪除評分
async function deleteRating(gameName) {
  try {
    const response = await fetch(`/api/rating/${gameName}`, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) {
      alert('已刪除評分');
    }
  } catch (err) {
    alert('刪除失敗: ' + err.message);
  }
}