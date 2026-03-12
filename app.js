/* =============================================
   DESERT BLOOM — app.js
   ============================================= */

// ─── STORAGE KEYS ────────────────────────────
const TASKS_KEY     = 'desertbloom_tasks';
const HISTORY_KEY   = 'desertbloom_history';
const STREAK_KEY    = 'desertbloom_streak';
const LASTDAY_KEY   = 'desertbloom_lastday';
const GROWTH_KEY    = 'desertbloom_growth';
const LASTRESET_KEY = 'desertbloom_lastreset';
const NOTIF_KEY     = 'desertbloom_notif';
const FIRSTRUN_KEY  = 'desertbloom_firstrun';

const GROWTH_THRESHOLDS = [10, 10, 15, 15, 20, 20, 25, 25, 30, 30];

// ─── STARTER TASKS ───────────────────────────
function makeStarterTasks() {
  return [
    { id: uid(), name: 'Blood sugar check', time: '08:00', repeat: 'daily', status: 'pending', createdAt: Date.now() },
    { id: uid(), name: 'Take Metformin',    time: '08:30', repeat: 'daily', status: 'pending', createdAt: Date.now() }
  ];
}

// ─── STATE ────────────────────────────────────
let tasks   = [];
let history = [];
let streak  = 0;
let growth  = 0;

// ─── UTILS ────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function prevDay(d) {
  const dt = new Date(d + 'T00:00:00');
  dt.setDate(dt.getDate() - 1);
  return dt.toISOString().slice(0, 10);
}
function timeLabel(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'AM' : 'PM'}`;
}
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 2500);
}

// ─── PERSIST ──────────────────────────────────
function save() {
  localStorage.setItem(TASKS_KEY,   JSON.stringify(tasks));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  localStorage.setItem(STREAK_KEY,  String(streak));
  localStorage.setItem(GROWTH_KEY,  String(growth));
}
function load() {
  const t = localStorage.getItem(TASKS_KEY);
  const h = localStorage.getItem(HISTORY_KEY);
  tasks   = t ? JSON.parse(t) : makeStarterTasks();
  history = h ? JSON.parse(h) : [];
  streak  = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);
  growth  = parseInt(localStorage.getItem(GROWTH_KEY) || '0', 10);
  if (!t) save();
}

// ─── STREAK ───────────────────────────────────
function tickStreak() {
  const today = todayStr();
  const last  = localStorage.getItem(LASTDAY_KEY);
  if (last === today) return;
  streak = (last === prevDay(today)) ? streak + 1 : 1;
  localStorage.setItem(LASTDAY_KEY, today);
  save();
}

// ─── LEVEL ────────────────────────────────────
function getLevel() {
  let rem = growth, level = 0;
  while (level < GROWTH_THRESHOLDS.length && rem >= GROWTH_THRESHOLDS[level]) {
    rem -= GROWTH_THRESHOLDS[level];
    level++;
  }
  return { level, remaining: rem, threshold: GROWTH_THRESHOLDS[level] || 30 };
}

// ─── DAILY RESET ──────────────────────────────
function dailyReset() {
  const today = todayStr();
  if (localStorage.getItem(LASTRESET_KEY) === today) return;
  tasks.forEach(t => { if (t.repeat === 'daily' && (t.status === 'done' || t.status === 'skipped')) t.status = 'pending'; });
  localStorage.setItem(LASTRESET_KEY, today);
  save();
}

// ─── TASK ACTIONS ─────────────────────────────
function markDone(id) {
  const task = tasks.find(t => t.id === id);
  if (!task || task.status === 'done') return;
  task.status = 'done';
  growth++;
  tickStreak();
  history.unshift({ name: task.name, completedAt: new Date().toLocaleString(), repeat: task.repeat });
  if (history.length > 200) history.length = 200;
  if (task.repeat === 'once') tasks = tasks.filter(t => t.id !== id);
  save();
  renderAll();
  showToast('✅ Done! Cactus is growing.');
}

function toggleSnooze(id) {
  const task = tasks.find(t => t.id === id);
  if (!task || task.status === 'done') return;
  task.status = task.status === 'snoozed' ? 'pending' : 'snoozed';
  save();
  renderAll();
  showToast(task.status === 'snoozed' ? '💤 Snoozed.' : '🔔 Back on the list.');
}

function markSkipped(id) {
  const task = tasks.find(t => t.id === id);
  if (!task || task.status === 'done') return;
  task.status = 'skipped';
  // One-time tasks get removed when skipped
  if (task.repeat === 'once') tasks = tasks.filter(t => t.id !== id);
  save();
  renderAll();
  showToast('⏭ Skipped for today.');
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save();
  renderAll();
  showToast('🗑 Task removed.');
}

function addTask() {
  const nameEl   = document.getElementById('task-name-input');
  const timeEl   = document.getElementById('task-time-input');
  const repeatEl = document.getElementById('task-repeat-input');
  const name = nameEl.value.trim();
  if (!name) { showToast('Give your task a name first.'); return; }
  tasks.push({ id: uid(), name, time: timeEl.value || '', repeat: repeatEl.value, status: 'pending', createdAt: Date.now() });
  nameEl.value = ''; timeEl.value = ''; repeatEl.value = 'daily';
  save();
  renderAll();
  showToast('🌱 Task added.');
}

// ─── EDIT TASK DRAWER ─────────────────────────
function openEditDrawer(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  document.getElementById('edit-task-id').value     = id;
  document.getElementById('edit-task-name').value   = task.name;
  document.getElementById('edit-task-time').value   = task.time || '';
  document.getElementById('edit-task-repeat').value = task.repeat;

  document.getElementById('edit-overlay').classList.remove('hidden');
  // Focus the name field for quick editing
  setTimeout(() => document.getElementById('edit-task-name').focus(), 80);
}

function closeEditDrawer() {
  document.getElementById('edit-overlay').classList.add('hidden');
}

function saveEditedTask() {
  const id     = document.getElementById('edit-task-id').value;
  const name   = document.getElementById('edit-task-name').value.trim();
  const time   = document.getElementById('edit-task-time').value;
  const repeat = document.getElementById('edit-task-repeat').value;

  if (!name) { showToast('Task name can\'t be empty.'); return; }

  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.name   = name;
  task.time   = time;
  task.repeat = repeat;

  save();
  renderAll();
  closeEditDrawer();
  showToast('✏️ Task updated.');
}

function deleteFromDrawer() {
  const id = document.getElementById('edit-task-id').value;
  if (!confirm('Delete this task?')) return;
  closeEditDrawer();
  deleteTask(id);
}

// ─── HISTORY ACTIONS ──────────────────────────
function deleteHistoryEntry(index) {
  history.splice(index, 1);
  save();
  renderHistory();
  showToast('Entry removed.');
}

function clearHistory() {
  if (!confirm('Clear all history? This can\'t be undone.')) return;
  history = [];
  save();
  renderHistory();
  showToast('History cleared.');
}

// ─── RENDER ───────────────────────────────────
function renderAll() {
  renderStreak();
  renderHome();
  renderTasks();
  renderHistory();
  renderSettings();
}

function renderStreak() {
  document.getElementById('streak-count').textContent = streak;
}

function renderHome() {
  const h = new Date().getHours();
  document.getElementById('greeting-text').textContent =
    h < 11 ? 'Good morning.' : h < 16 ? 'Good afternoon.' : 'Good evening.';

  const pending  = tasks.filter(t => t.status === 'pending');
  const snoozed  = tasks.filter(t => t.status === 'snoozed');
  const done     = tasks.filter(t => t.status === 'done');
  const allToday = [...pending, ...snoozed, ...done];

  const total    = allToday.length;
  const doneCount = done.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  document.getElementById('today-progress-fill').style.width = pct + '%';
  document.getElementById('today-progress-label').textContent = `${doneCount} of ${total} done`;

  const remaining = pending.length;
  document.getElementById('home-subtext').textContent =
    remaining > 0 ? `${remaining} task${remaining > 1 ? 's' : ''} left today.` :
    doneCount > 0 ? 'All done for today!' : 'No tasks yet — add some in Tasks.';

  const list = document.getElementById('home-task-list');
  list.innerHTML = '';
  const allDoneBanner = document.getElementById('all-done-banner');

  if (allToday.length === 0) {
    list.innerHTML = '<li class="empty-state">No tasks. Add some in the Tasks tab.</li>';
    allDoneBanner.classList.add('hidden');
    return;
  }

  if (pending.length === 0 && snoozed.length === 0) {
    allDoneBanner.classList.remove('hidden');
  } else {
    allDoneBanner.classList.add('hidden');
    allToday.forEach(task => list.appendChild(buildChecklistItem(task)));
  }

  const { level, remaining, threshold } = getLevel();
  document.getElementById('growth-level').textContent    = level;
  document.getElementById('total-completed').textContent = growth;
  document.getElementById('desert-streak').textContent   = streak + ' day' + (streak !== 1 ? 's' : '');
  const gpct = Math.round((remaining / threshold) * 100);
  document.getElementById('growth-bar').style.width = gpct + '%';
  document.getElementById('progress-label').textContent = `${remaining} / ${threshold} to level ${level + 1}`;
  drawCactus('main-cactus', 300, 260, level, streak, false);
}

function buildChecklistItem(task) {
  const li = document.createElement('li');
  li.className = `checklist-item ${task.status}`;

  const meta = [];
  if (task.time) meta.push(timeLabel(task.time));
  meta.push(task.repeat);

  const isActive = task.status === 'pending' || task.status === 'snoozed';
  li.innerHTML = `
    <div class="check-circle" data-action="done" data-id="${task.id}"></div>
    <div class="check-info" data-action="done" data-id="${task.id}">
      <div class="check-name">${escHtml(task.name)}</div>
      <div class="check-meta">${meta.join(' · ')}</div>
    </div>
    ${isActive ? `
      <div class="checklist-btns">
        <button class="snooze-btn" data-action="snooze" data-id="${task.id}">${task.status === 'snoozed' ? 'Wake up' : 'Snooze'}</button>
        <button class="skip-btn" data-action="skip" data-id="${task.id}">Skip</button>
      </div>` : ''}
  `;
  return li;
}

function renderTasks() {
  const list = document.getElementById('all-task-list');
  list.innerHTML = '';
  if (tasks.length === 0) {
    list.innerHTML = '<li class="empty-state">No tasks yet.</li>';
    return;
  }
  const order = { pending: 0, snoozed: 1, done: 2 };
  [...tasks]
    .sort((a, b) => order[a.status] - order[b.status])
    .forEach(t => list.appendChild(buildTaskManageItem(t)));
}

function buildTaskManageItem(task) {
  const li = document.createElement('li');
  li.className = `task-item ${task.status}`;
  li.dataset.id = task.id;

  const meta = [];
  if (task.time) meta.push(timeLabel(task.time));
  meta.push(task.repeat);

  // Status indicator emoji
  const statusIcon = task.status === 'done' ? '✓' : task.status === 'snoozed' ? '💤' : '○';

  li.innerHTML = `
    <div class="task-info">
      <div class="task-name">${escHtml(task.name)}</div>
      <div class="task-meta">${statusIcon} ${meta.join(' · ')}</div>
    </div>
    <span class="task-edit-hint">Edit →</span>
  `;

  // Whole row opens the edit drawer
  li.addEventListener('click', () => openEditDrawer(task.id));
  return li;
}

function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if (history.length === 0) {
    list.innerHTML = '<li class="empty-state">Complete a task to see it here.</li>';
    return;
  }
  history.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `
      <div>
        <div class="history-name">${escHtml(entry.name)}</div>
        <div class="history-time">${entry.completedAt}</div>
      </div>
      <div class="history-right">
        <span class="history-badge">Done</span>
        <span class="history-delete-hint">✕ remove</span>
      </div>
    `;
    li.addEventListener('click', () => {
      if (confirm(`Remove "${entry.name}" from history?`)) {
        deleteHistoryEntry(index);
      }
    });
    list.appendChild(li);
  });
}

function renderSettings() {
  // Notification UI
  const notif      = getNotifSettings();
  const toggle     = document.getElementById('notif-toggle');
  const timeRow    = document.getElementById('notif-time-row');
  const testBtn    = document.getElementById('test-notif-btn');
  const statusText = document.getElementById('notif-status-text');
  const timeInput  = document.getElementById('notif-time-input');

  toggle.checked  = notif.enabled;
  timeInput.value = notif.time || '08:00';

  if (notif.enabled) {
    timeRow.style.display  = 'flex';
    testBtn.style.display  = 'block';
    statusText.textContent = `On — reminding you at ${timeLabel(notif.time || '08:00')}`;
  } else {
    timeRow.style.display  = 'none';
    testBtn.style.display  = 'none';
    statusText.textContent = Notification.permission === 'denied'
      ? 'Blocked by browser — check site settings'
      : 'Off';
  }
}

// ─── NOTIFICATIONS ────────────────────────────
function getNotifSettings() {
  const raw = localStorage.getItem(NOTIF_KEY);
  return raw ? JSON.parse(raw) : { enabled: false, time: '08:00' };
}
function saveNotifSettings(enabled, time) {
  localStorage.setItem(NOTIF_KEY, JSON.stringify({ enabled, time }));
}
async function requestNotifPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}
function sendNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, {
    body,
    icon: 'https://em-content.zobj.net/source/apple/354/cactus_1f335.png'
  });
}
function startNotifChecker() {
  setInterval(() => {
    const notif = getNotifSettings();
    if (!notif.enabled || !notif.time) return;
    if (Notification.permission !== 'granted') return;
    const now   = new Date();
    const nowHH = String(now.getHours()).padStart(2,'0');
    const nowMM = String(now.getMinutes()).padStart(2,'0');
    const today = todayStr();
    if (`${nowHH}:${nowMM}` === notif.time && localStorage.getItem('desertbloom_lastnotif') !== today) {
      const pending = tasks.filter(t => t.status === 'pending').length;
      sendNotification('🌵 Desert Bloom',
        pending > 0
          ? `You have ${pending} task${pending > 1 ? 's' : ''} to complete today.`
          : 'Time to check in with your desert!');
      localStorage.setItem('desertbloom_lastnotif', today);
    }
  }, 60000);
}

// ─── NOTIFICATION MODAL ───────────────────────
function showNotifModal() { document.getElementById('notif-modal').classList.remove('hidden'); }
function hideNotifModal() { document.getElementById('notif-modal').classList.add('hidden'); }

// ─── CACTUS DRAWING ───────────────────────────
function drawCactus(canvasId, w, h, level, streakCount, mini) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const sc = mini ? 0.25 : 1;

  if (!mini) {
    ctx.fillStyle = '#C8DDE8'; ctx.fillRect(0, 0, w, h * 0.6);
    ctx.fillStyle = '#E8D3A8'; ctx.fillRect(0, h * 0.6, w, h * 0.4);
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.12, 26, 0, Math.PI * 2);
    ctx.fillStyle = '#F5C842'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, h * 0.6); ctx.lineTo(w, h * 0.6);
    ctx.strokeStyle = '#C1A570'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  const cx   = w / 2;
  const gndY = mini ? h * 0.85 : h * 0.6;
  const bodyH = (48 + level * 14) * sc;
  const bodyW = (16 + level * 2.5) * sc;
  const topY  = gndY - bodyH;

  drawRR(ctx, cx - bodyW, topY, bodyW * 2, bodyH, bodyW);
  ctx.fillStyle = '#4E7A52'; ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - bodyW * 0.18, topY + bodyH * 0.08);
  ctx.lineTo(cx - bodyW * 0.18, gndY - bodyH * 0.08);
  ctx.strokeStyle = 'rgba(130,210,130,0.3)';
  ctx.lineWidth = bodyW * 0.22; ctx.lineCap = 'round'; ctx.stroke();

  if (!mini) {
    ctx.strokeStyle = 'rgba(255,255,220,0.65)'; ctx.lineWidth = 0.8;
    for (let r = 0; r < 4; r++) {
      const sy = topY + bodyH * (0.2 + r * 0.2);
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(cx + side * bodyW, sy); ctx.lineTo(cx + side * (bodyW + 7), sy - 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + side * bodyW, sy + 5); ctx.lineTo(cx + side * (bodyW + 7), sy + 9); ctx.stroke();
      }
    }
  }

  if (level >= 2) drawArm(ctx, cx, topY, bodyH, bodyW, sc,  1, level);
  if (level >= 4) drawArm(ctx, cx, topY, bodyH, bodyW, sc, -1, level);

  const blooms = Math.min(streakCount, 6);
  if (blooms > 0) drawBlooms(ctx, cx, topY, bodyH, bodyW, sc, blooms, level);

  if (!mini) {
    ctx.beginPath(); ctx.ellipse(cx, gndY, bodyW * 1.15, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#C1A570'; ctx.fill();
  }
}

function drawRR(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawArm(ctx, cx, topY, bodyH, bodyW, sc, dir, level) {
  const startY = topY + bodyH * (dir === 1 ? 0.32 : 0.48);
  const armLen = (22 + level * 3) * sc;
  const armW   = (9 + level) * sc;
  const ex     = cx + dir * (bodyW + armLen);
  const tipY   = startY - (14 + level * 2) * sc;
  ctx.save();
  ctx.strokeStyle = '#4E7A52'; ctx.lineWidth = armW; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx + dir * bodyW, startY); ctx.lineTo(ex, startY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(ex, startY); ctx.lineTo(ex, tipY); ctx.stroke();
  ctx.restore();
  ctx.beginPath(); ctx.arc(ex, tipY, armW / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#4E7A52'; ctx.fill();
}

function drawBlooms(ctx, cx, topY, bodyH, bodyW, sc, count, level) {
  const al = (22 + level * 3) * sc;
  const positions = [
    { x: cx,              y: topY },
    { x: cx + bodyW,      y: topY + bodyH * 0.14 },
    { x: cx - bodyW,      y: topY + bodyH * 0.14 },
    { x: cx + bodyW + al, y: topY + bodyH * 0.32 - (14 + level * 2) * sc },
    { x: cx - bodyW - al, y: topY + bodyH * 0.48 - (14 + level * 2) * sc },
    { x: cx,              y: topY + bodyH * 0.07 },
  ];
  const colors = ['#E85D75','#F2A65A','#F7E27A','#D966A0','#FF8FAB','#FBBF67'];
  for (let i = 0; i < count && i < positions.length; i++) {
    const p = positions[i];
    const r = (5 + i * 0.5) * sc;
    for (let a = 0; a < 5; a++) {
      const angle = (a / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(p.x + Math.cos(angle) * r * 1.4, p.y + Math.sin(angle) * r * 1.4, r * 0.9, r * 0.5, angle, 0, Math.PI * 2);
      ctx.fillStyle = colors[i % colors.length]; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FBECD0'; ctx.fill();
  }
}

// ─── TAB SWITCHING ────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  document.querySelector(`[data-tab="${name}"]`).classList.add('active');
  if (name === 'settings') renderSettings();
  if (name === 'home')     renderHome();
}

// ─── HOME CHECKLIST CLICKS ────────────────────
function handleChecklistClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'done')   markDone(id);
  if (action === 'snooze') toggleSnooze(id);
  if (action === 'skip')   markSkipped(id);
}

// ─── INIT ─────────────────────────────────────
function init() {
  load();
  dailyReset();
  renderAll();
  startNotifChecker();

  // Tab bar
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Add task
  document.getElementById('add-task-btn').addEventListener('click', addTask);
  document.getElementById('task-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  // Home checklist
  document.getElementById('home-task-list').addEventListener('click', handleChecklistClick);

  // Edit drawer buttons
  document.getElementById('edit-save-btn').addEventListener('click', saveEditedTask);
  document.getElementById('edit-cancel-btn').addEventListener('click', closeEditDrawer);
  document.getElementById('edit-delete-btn').addEventListener('click', deleteFromDrawer);

  // Close drawer on overlay click
  document.getElementById('edit-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeEditDrawer();
  });

  // Save on Enter in edit name field
  document.getElementById('edit-task-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEditedTask();
    if (e.key === 'Escape') closeEditDrawer();
  });

  // Clear history
  document.getElementById('clear-history-btn').addEventListener('click', clearHistory);

  // Notification toggle
  document.getElementById('notif-toggle').addEventListener('change', async function() {
    if (this.checked) {
      const granted = await requestNotifPermission();
      if (!granted) {
        this.checked = false;
        showToast('Notifications blocked. Check browser settings.');
        return;
      }
      const time = document.getElementById('notif-time-input').value || '08:00';
      saveNotifSettings(true, time);
      showToast(`✅ Reminders set for ${timeLabel(time)}`);
    } else {
      saveNotifSettings(false, document.getElementById('notif-time-input').value);
      showToast('Reminders off.');
    }
    renderSettings();
  });

  // Notification time — auto-saves on change
  document.getElementById('notif-time-input').addEventListener('change', function() {
    const notif = getNotifSettings();
    saveNotifSettings(notif.enabled, this.value);
    if (notif.enabled) showToast(`Reminder time updated to ${timeLabel(this.value)}`);
    renderSettings();
  });

  // Test notification
  document.getElementById('test-notif-btn').addEventListener('click', () => {
    sendNotification('🌵 Desert Bloom', 'This is a test. Your cactus says hi.');
    showToast('Test notification sent.');
  });

  // Reset all data
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (!confirm('Reset everything? This cannot be undone.')) return;
    [TASKS_KEY, HISTORY_KEY, STREAK_KEY, GROWTH_KEY, LASTDAY_KEY, LASTRESET_KEY, 'desertbloom_lastnotif']
      .forEach(k => localStorage.removeItem(k));
    load();
    renderAll();
    showToast('Reset done. Fresh start.');
  });

  // First-run notification modal
  const firstRun = !localStorage.getItem(FIRSTRUN_KEY);
  if (firstRun && 'Notification' in window && Notification.permission !== 'denied') {
    showNotifModal();
  }
  localStorage.setItem(FIRSTRUN_KEY, '1');

  document.getElementById('notif-allow-btn').addEventListener('click', async () => {
    const time    = document.getElementById('modal-notif-time').value || '08:00';
    const granted = await requestNotifPermission();
    if (granted) {
      saveNotifSettings(true, time);
      showToast(`✅ Reminders set for ${timeLabel(time)}`);
    } else {
      showToast('Notifications blocked by browser.');
    }
    hideNotifModal();
    renderSettings();
  });

  document.getElementById('notif-skip-btn').addEventListener('click', hideNotifModal);

  // Close notif modal on overlay click
  document.getElementById('notif-modal').addEventListener('click', function(e) {
    if (e.target === this) hideNotifModal();
  });
}

document.addEventListener('DOMContentLoaded', init);
