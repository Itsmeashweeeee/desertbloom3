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
const BS_KEY        = 'desertbloom_bs';
const WATER_KEY     = 'desertbloom_water';
const FLOW_KEY      = 'desertbloom_flow';

const GROWTH_THRESHOLDS = [10, 10, 15, 15, 20, 20, 25, 25, 30, 30];

// ─── STARTER TASKS ───────────────────────────
function makeStarterTasks() {
  return [
    { id: uid(), name: 'Blood sugar check', time: '08:00', repeat: 'daily', status: 'pending', createdAt: Date.now(), isBloodSugar: true },
    { id: uid(), name: 'Take Metformin',    time: '08:30', repeat: 'daily', status: 'pending', createdAt: Date.now() }
  ];
}

// ─── STATE ────────────────────────────────────
let tasks       = [];
let history     = [];
let streak      = 0;
let growth      = 0;
let bsReadings  = []; // [{value, ts}]
let bsPeriod    = 'week';
let waterIntake = {}; // { 'YYYY-MM-DD': glasses }
let flowLog     = {}; // { 'YYYY-MM-DD': 'none' | 'light' | 'medium' | 'heavy' }

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
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 2500);
}
function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

// ─── PERSIST ──────────────────────────────────
function save() {
  localStorage.setItem(TASKS_KEY,   JSON.stringify(tasks));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  localStorage.setItem(STREAK_KEY,  String(streak));
  localStorage.setItem(GROWTH_KEY,  String(growth));
  localStorage.setItem(BS_KEY,      JSON.stringify(bsReadings));
  localStorage.setItem(WATER_KEY,   JSON.stringify(waterIntake));
  localStorage.setItem(FLOW_KEY,    JSON.stringify(flowLog));
}
function load() {
  const t = localStorage.getItem(TASKS_KEY);
  const h = localStorage.getItem(HISTORY_KEY);
  const b = localStorage.getItem(BS_KEY);
  const w = localStorage.getItem(WATER_KEY);
  const f = localStorage.getItem(FLOW_KEY);

  tasks       = t ? JSON.parse(t) : makeStarterTasks();
  history     = h ? JSON.parse(h) : [];
  bsReadings  = b ? JSON.parse(b) : [];
  waterIntake = w ? JSON.parse(w) : {};
  flowLog     = f ? JSON.parse(f) : {};

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

// ─── WELLNESS ─────────────────────────────────
function getTodayWater() {
  return waterIntake[todayStr()] || 0;
}
function setTodayWater(value) {
  waterIntake[todayStr()] = clamp(parseInt(value || 0, 10), 0, 24);
  save();
  renderWellness();
  renderHome();
}
function getTodayFlow() {
  return flowLog[todayStr()] || 'none';
}
function setTodayFlow(level) {
  flowLog[todayStr()] = ['none', 'light', 'medium', 'heavy'].includes(level) ? level : 'none';
  save();
  renderWellness();
  renderHome();
}
function getWellnessMood() {
  const water = getTodayWater();
  const flow = getTodayFlow();

  let hydration = 'dry';
  if (water >= 8) hydration = 'hydrated';
  else if (water >= 4) hydration = 'okay';

  return { water, flow, hydration };
}
function renderWellness() {
  const waterCount = document.getElementById('water-count');
  const flowInput  = document.getElementById('flow-input');
  const flowToday  = document.getElementById('flow-today');

  if (!waterCount || !flowInput || !flowToday) return;

  const water = getTodayWater();
  const flow  = getTodayFlow();

  waterCount.textContent = water;
  flowInput.value = flow;

  const labels = {
    none: 'No flow',
    light: 'Light flow',
    medium: 'Medium flow',
    heavy: 'Heavy flow'
  };
  flowToday.textContent = labels[flow] || 'No flow';
}
function pruneWellnessData() {
  const today = new Date(todayStr() + 'T00:00:00');
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - 90);

  const keepRecent = obj =>
    Object.fromEntries(
      Object.entries(obj).filter(([date]) => new Date(date + 'T00:00:00') >= cutoff)
    );

  waterIntake = keepRecent(waterIntake);
  flowLog = keepRecent(flowLog);
}

// ─── DAILY RESET ──────────────────────────────
function dailyReset() {
  const today = todayStr();
  if (localStorage.getItem(LASTRESET_KEY) === today) return;
  tasks.forEach(t => {
    if (t.repeat === 'daily' && (t.status === 'done' || t.status === 'skipped')) {
      t.status = 'pending';
    }
  });
  pruneWellnessData();
  localStorage.setItem(LASTRESET_KEY, today);
  save();
}

// ─── TASK ACTIONS ─────────────────────────────
function markDone(id) {
  const task = tasks.find(t => t.id === id);
  if (!task || task.status === 'done') return;
  if (task.isBloodSugar) {
    showBSModal(id);
    return;
  }
  _completeDone(task);
}

function _completeDone(task) {
  if (!task) return;
  task.status = 'done';
  growth++;
  tickStreak();
  history.unshift({ name: task.name, completedAt: new Date().toLocaleString(), repeat: task.repeat });
  if (history.length > 200) history.length = 200;
  if (task.repeat === 'once') tasks = tasks.filter(t => t.id !== task.id);
  save();
  renderAll();
  showToast('✅ Done! Cactus is growing.');
}

// ─── BLOOD SUGAR MODAL ────────────────────────
function showBSModal(taskId) {
  document.getElementById('bs-task-id').value     = taskId;
  document.getElementById('bs-value-input').value = '';
  document.getElementById('bs-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('bs-value-input').focus(), 80);
}

function hideBSModal() {
  document.getElementById('bs-modal').classList.add('hidden');
}

function confirmBSReading() {
  const raw = document.getElementById('bs-value-input').value;
  const val = parseFloat(raw);
  if (!raw || isNaN(val) || val < 20 || val > 600) {
    showToast('Enter a valid reading (20–600 mg/dL).');
    return;
  }
  bsReadings.push({ value: val, ts: new Date().toISOString() });
  const id   = document.getElementById('bs-task-id').value;
  const task = tasks.find(t => t.id === id);
  hideBSModal();
  _completeDone(task);
}

function skipBSReading() {
  const id   = document.getElementById('bs-task-id').value;
  const task = tasks.find(t => t.id === id);
  hideBSModal();
  _completeDone(task);
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
  nameEl.value = '';
  timeEl.value = '';
  repeatEl.value = 'daily';
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
  document.getElementById('edit-bs-toggle').checked = !!task.isBloodSugar;

  document.getElementById('edit-overlay').classList.remove('hidden');
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
  const isBS   = document.getElementById('edit-bs-toggle').checked;

  if (!name) { showToast('Task name can\'t be empty.'); return; }

  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.name         = name;
  task.time         = time;
  task.repeat       = repeat;
  task.isBloodSugar = isBS;

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

// ─── BLOOD SUGAR GRAPH ────────────────────────
function bsStatus(val) {
  if (val === null || val === undefined) return { label: '—', color: '#A07850' };
  if (val < 70)  return { label: 'Low',      color: '#e67e22' };
  if (val > 180) return { label: 'High',     color: '#c0392b' };
  return             { label: 'In range',  color: '#4E7A52' };
}

function getBSSummary() {
  const today         = todayStr();
  const todayReadings = bsReadings.filter(r => r.ts.slice(0, 10) === today);
  const last          = bsReadings.length > 0 ? bsReadings[bsReadings.length - 1] : null;
  const avg           = todayReadings.length > 0
    ? Math.round(todayReadings.reduce((s, r) => s + r.value, 0) / todayReadings.length)
    : null;
  return { last, avg, todayCount: todayReadings.length };
}

function renderBSGraph() {
  const canvas  = document.getElementById('bs-graph-canvas');
  const noData  = document.getElementById('bs-no-data');
  const summary = document.getElementById('bs-summary');
  if (!canvas || !noData || !summary) return;

  const { last, avg, todayCount } = getBSSummary();
  const lastSt = bsStatus(last ? last.value : null);
  const avgSt  = bsStatus(avg);
  summary.innerHTML = `
    <div class="bs-stat">
      <span class="bs-stat-label">Last reading</span>
      <span class="bs-stat-val" style="color:${lastSt.color}">${last ? last.value + ' mg/dL' : '—'}</span>
      <span class="bs-stat-tag" style="background:${lastSt.color}22;color:${lastSt.color}">${lastSt.label}</span>
    </div>
    <div class="bs-stat">
      <span class="bs-stat-label">Today's avg</span>
      <span class="bs-stat-val" style="color:${avgSt.color}">${avg !== null ? avg + ' mg/dL' : '—'}</span>
      <span class="bs-stat-tag" style="background:${avgSt.color}22;color:${avgSt.color}">${todayCount} reading${todayCount !== 1 ? 's' : ''}</span>
    </div>
  `;

  const now = new Date();
  let cutoff;
  if      (bsPeriod === 'day')   cutoff = new Date(now - 24 * 3600 * 1000);
  else if (bsPeriod === 'week')  cutoff = new Date(now - 7  * 24 * 3600 * 1000);
  else                           cutoff = new Date(now - 30 * 24 * 3600 * 1000);

  const filtered = bsReadings.filter(r => new Date(r.ts) >= cutoff);

  if (filtered.length === 0) {
    canvas.style.display = 'none';
    noData.style.display = 'block';
    return;
  }
  canvas.style.display = 'block';
  noData.style.display = 'none';

  let points = [];
  if (bsPeriod === 'day') {
    points = filtered.map(r => {
      const d = new Date(r.ts);
      const h = d.getHours(), m = d.getMinutes();
      return { y: r.value, label: `${h % 12 || 12}:${String(m).padStart(2,'0')}${h < 12 ? 'a' : 'p'}` };
    });
  } else {
    const byDay = {};
    filtered.forEach(r => {
      const d = r.ts.slice(0, 10);
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(r.value);
    });
    points = Object.entries(byDay).sort().map(([d, vals]) => ({
      y: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      label: d.slice(5).replace('-', '/')
    }));
  }

  const W = canvas.parentElement.clientWidth - 32 || 300;
  const H = 170;
  canvas.width  = W;
  canvas.height = H;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const PAD = { top: 20, right: 14, bottom: 28, left: 42 };
  const gW  = W - PAD.left - PAD.right;
  const gH  = H - PAD.top  - PAD.bottom;
  const n   = points.length;

  const vals   = points.map(p => p.y);
  const minV   = Math.max(0,   Math.min(60, ...vals) - 10);
  const maxV   =              Math.max(200, ...vals) + 10;
  const vRange = maxV - minV;

  const toX = i => PAD.left + (n > 1 ? (i / (n - 1)) * gW : gW / 2);
  const toY = v => PAD.top  + gH - ((v - minV) / vRange) * gH;

  ctx.fillStyle = 'rgba(78, 122, 82, 0.08)';
  ctx.fillRect(PAD.left, toY(180), gW, toY(70) - toY(180));

  [[70, 'rgba(230,126,34,0.4)'], [140, 'rgba(78,122,82,0.4)'], [180, 'rgba(192,57,43,0.4)']].forEach(([v, col]) => {
    const y = toY(v);
    if (y < PAD.top - 2 || y > H - PAD.bottom + 2) return;
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = col;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + gW, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(106,78,53,0.55)';
    ctx.font      = '8px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(v, PAD.left - 4, y + 3);
  });

  if (n > 1) {
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(points[0].y));
    for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(points[i].y));
    ctx.strokeStyle = '#C1714A';
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    ctx.lineCap     = 'round';
    ctx.setLineDash([]);
    ctx.stroke();
  }

  points.forEach((p, i) => {
    const x   = toX(i);
    const y   = toY(p.y);
    const col = p.y > 180 ? '#c0392b' : p.y < 70 ? '#e67e22' : '#4E7A52';

    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle   = col;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    if (n <= 7 || i === 0 || i === n - 1) {
      ctx.fillStyle = col;
      ctx.font      = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.y, x, y - 9);
    }
  });

  ctx.fillStyle = '#A07850';
  ctx.font      = '8px sans-serif';
  ctx.textAlign = 'center';
  const maxLabels = 7;
  const step = Math.max(1, Math.ceil(n / maxLabels));
  points.forEach((p, i) => {
    if (i % step === 0 || i === n - 1) {
      ctx.fillText(p.label, toX(i), H - 6);
    }
  });
}

// ─── RENDER ───────────────────────────────────
function renderAll() {
  renderStreak();
  renderHome();
  renderTasks();
  renderHistory();
  renderSettings();
  renderWellness();
}

function renderStreak() {
  const el = document.getElementById('streak-count');
  if (el) el.textContent = streak;
}

function renderHome() {
  const h = new Date().getHours();
  const greeting = document.getElementById('greeting-text');
  if (greeting) {
    greeting.textContent = h < 11 ? 'Good morning.' : h < 16 ? 'Good afternoon.' : 'Good evening.';
  }

  const pending   = tasks.filter(t => t.status === 'pending');
  const snoozed   = tasks.filter(t => t.status === 'snoozed');
  const done      = tasks.filter(t => t.status === 'done');
  const allToday  = [...pending, ...snoozed, ...done];

  const total     = allToday.length;
  const doneCount = done.length;
  const pct       = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  const progressFill = document.getElementById('today-progress-fill');
  const progressLabel = document.getElementById('today-progress-label');
  if (progressFill) progressFill.style.width = pct + '%';
  if (progressLabel) progressLabel.textContent = `${doneCount} of ${total} done`;

  const remaining = pending.length;
  const subtextEl = document.getElementById('home-subtext');
  if (subtextEl) {
    const mood = getWellnessMood();
    if (remaining > 0) {
      if (mood.hydration === 'hydrated') {
        subtextEl.textContent = `${remaining} task${remaining > 1 ? 's' : ''} left. You’re hydrated and rolling.`;
      } else if (mood.hydration === 'okay') {
        subtextEl.textContent = `${remaining} task${remaining > 1 ? 's' : ''} left today. Keep going.`;
      } else {
        subtextEl.textContent = `${remaining} task${remaining > 1 ? 's' : ''} left today. Grab some water too.`;
      }
    } else if (doneCount > 0) {
      subtextEl.textContent = mood.hydration === 'hydrated'
        ? 'All done for today. Your cactus looks happy.'
        : 'All done for today!';
    } else {
      subtextEl.textContent = 'No tasks yet — add some in Tasks.';
    }
  }

  const list = document.getElementById('home-task-list');
  const allDoneBanner = document.getElementById('all-done-banner');
  if (!list) return;
  list.innerHTML = '';

  if (allToday.length === 0) {
    list.innerHTML = '<li class="empty-state">No tasks. Add some in the Tasks tab.</li>';
    if (allDoneBanner) allDoneBanner.classList.add('hidden');
  } else if (pending.length === 0 && snoozed.length === 0) {
    if (allDoneBanner) allDoneBanner.classList.remove('hidden');
  } else {
    if (allDoneBanner) allDoneBanner.classList.add('hidden');
    allToday.forEach(task => list.appendChild(buildChecklistItem(task)));
  }

  const { level, remaining: growthRem, threshold } = getLevel();
  const growthLevel = document.getElementById('growth-level');
  const totalCompleted = document.getElementById('total-completed');
  const desertStreak = document.getElementById('desert-streak');
  const growthBar = document.getElementById('growth-bar');
  const progressText = document.getElementById('progress-label');

  if (growthLevel) growthLevel.textContent = level;
  if (totalCompleted) totalCompleted.textContent = growth;
  if (desertStreak) desertStreak.textContent = streak + ' day' + (streak !== 1 ? 's' : '');
  if (growthBar) {
    const gpct = Math.round((growthRem / threshold) * 100);
    growthBar.style.width = gpct + '%';
  }
  if (progressText) progressText.textContent = `${growthRem} / ${threshold} to level ${level + 1}`;

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
  if (!list) return;
  list.innerHTML = '';
  if (tasks.length === 0) {
    list.innerHTML = '<li class="empty-state">No tasks yet.</li>';
    return;
  }
  const order = { pending: 0, snoozed: 1, done: 2, skipped: 3 };
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
  if (task.isBloodSugar) meta.push('🩸 tracked');

  const statusIcon = task.status === 'done' ? '✓' : task.status === 'snoozed' ? '💤' : task.status === 'skipped' ? '⏭' : '○';

  li.innerHTML = `
    <div class="task-info">
      <div class="task-name">${escHtml(task.name)}</div>
      <div class="task-meta">${statusIcon} ${meta.join(' · ')}</div>
    </div>
    <span class="task-edit-hint">Edit →</span>
  `;

  li.addEventListener('click', () => openEditDrawer(task.id));
  return li;
}

function renderHistory() {
  renderBSGraph();

  const list = document.getElementById('history-list');
  if (!list) return;
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
  const notif      = getNotifSettings();
  const toggle     = document.getElementById('notif-toggle');
  const timeRow    = document.getElementById('notif-time-row');
  const testBtn    = document.getElementById('test-notif-btn');
  const statusText = document.getElementById('notif-status-text');
  const timeInput  = document.getElementById('notif-time-input');

  if (!toggle || !timeRow || !testBtn || !statusText || !timeInput) return;

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
      sendNotification(
        '🌵 Desert Bloom',
        pending > 0
          ? `You have ${pending} task${pending > 1 ? 's' : ''} to complete today.`
          : 'Time to check in with your desert!'
      );
      localStorage.setItem('desertbloom_lastnotif', today);
    }
  }, 60000);
}

// ─── NOTIFICATION MODAL ───────────────────────
function showNotifModal() {
  const el = document.getElementById('notif-modal');
  if (el) el.classList.remove('hidden');
}
function hideNotifModal() {
  const el = document.getElementById('notif-modal');
  if (el) el.classList.add('hidden');
}

// ─── CACTUS DRAWING ───────────────────────────
function drawCactus(canvasId, w, h, level, streakCount, mini) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  const sc = mini ? 0.25 : 1;
  const mood = getWellnessMood();

  if (!mini) {
    const skyTop = mood.hydration === 'hydrated' ? '#D7E9F2' : '#C8DDE8';
    const skyMid = mood.hydration === 'dry' ? '#BDD3DE' : '#C8DDE8';
    const sand   = mood.hydration === 'hydrated' ? '#EEDBAF' : '#E8D3A8';

    const grad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(1, skyMid);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h * 0.6);

    ctx.fillStyle = sand;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);

    ctx.beginPath();
    ctx.arc(w * 0.82, h * 0.12, 26, 0, Math.PI * 2);
    ctx.fillStyle = mood.hydration === 'hydrated' ? '#FFD45C' : '#F5C842';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, h * 0.6);
    ctx.lineTo(w, h * 0.6);
    ctx.strokeStyle = '#C1A570';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const cx    = w / 2;
  const gndY  = mini ? h * 0.85 : h * 0.6;
  const droop = mood.hydration === 'dry' ? 4 : 0;
  const perk  = mood.hydration === 'hydrated' ? 4 : 0;

  const bodyH = (48 + level * 14 + perk - droop) * sc;
  const bodyW = (16 + level * 2.5 + (mood.hydration === 'hydrated' ? 1.5 : 0)) * sc;
  const topY  = gndY - bodyH;

  if (!mini && mood.hydration === 'hydrated') {
    ctx.save();
    ctx.shadowColor = 'rgba(120, 210, 140, 0.25)';
    ctx.shadowBlur = 24;
  }

  drawRR(ctx, cx - bodyW, topY, bodyW * 2, bodyH, bodyW);
  ctx.fillStyle = mood.hydration === 'dry' ? '#5A855F' : '#4E7A52';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - bodyW * 0.18, topY + bodyH * 0.08);
  ctx.lineTo(cx - bodyW * 0.18, gndY - bodyH * 0.08);
  ctx.strokeStyle = 'rgba(130,210,130,0.3)';
  ctx.lineWidth = bodyW * 0.22;
  ctx.lineCap = 'round';
  ctx.stroke();

  if (!mini) {
    ctx.strokeStyle = 'rgba(255,255,220,0.65)';
    ctx.lineWidth = 0.8;
    for (let r = 0; r < 4; r++) {
      const sy = topY + bodyH * (0.2 + r * 0.2);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + side * bodyW, sy);
        ctx.lineTo(cx + side * (bodyW + 7), sy - 4);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(cx + side * bodyW, sy + 5);
        ctx.lineTo(cx + side * (bodyW + 7), sy + 9);
        ctx.stroke();
      }
    }
  }

  if (level >= 2) drawArm(ctx, cx, topY, bodyH, bodyW, sc,  1, level, mood);
  if (level >= 4) drawArm(ctx, cx, topY, bodyH, bodyW, sc, -1, level, mood);

  let blooms = Math.min(streakCount, 6);
  if (mood.hydration === 'hydrated') blooms = Math.min(6, blooms + 1);
  if (mood.flow === 'heavy') blooms = Math.max(1, blooms);
  if (blooms > 0) drawBlooms(ctx, cx, topY, bodyH, bodyW, sc, blooms, level, mood);

  if (!mini && mood.hydration === 'hydrated') {
    ctx.restore();
  }

  if (!mini) {
    ctx.beginPath();
    ctx.ellipse(cx, gndY, bodyW * 1.15, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#C1A570';
    ctx.fill();
  }
}

function drawRR(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawArm(ctx, cx, topY, bodyH, bodyW, sc, dir, level, mood) {
  const startY = topY + bodyH * (dir === 1 ? 0.32 : 0.48);
  const armLen = (22 + level * 3 + (mood.hydration === 'hydrated' ? 1 : 0) - (mood.hydration === 'dry' ? 2 : 0)) * sc;
  const armW   = (9 + level) * sc;
  const ex     = cx + dir * (bodyW + armLen);
  const tipY   = startY - (14 + level * 2 + (mood.hydration === 'hydrated' ? 2 : 0) - (mood.hydration === 'dry' ? 3 : 0)) * sc;

  ctx.save();
  ctx.strokeStyle = mood.hydration === 'dry' ? '#5A855F' : '#4E7A52';
  ctx.lineWidth = armW;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(cx + dir * bodyW, startY);
  ctx.lineTo(ex, startY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(ex, startY);
  ctx.lineTo(ex, tipY);
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(ex, tipY, armW / 2, 0, Math.PI * 2);
  ctx.fillStyle = mood.hydration === 'dry' ? '#5A855F' : '#4E7A52';
  ctx.fill();
}

function drawBlooms(ctx, cx, topY, bodyH, bodyW, sc, count, level, mood) {
  const al = (22 + level * 3) * sc;
  const positions = [
    { x: cx,              y: topY },
    { x: cx + bodyW,      y: topY + bodyH * 0.14 },
    { x: cx - bodyW,      y: topY + bodyH * 0.14 },
    { x: cx + bodyW + al, y: topY + bodyH * 0.32 - (14 + level * 2) * sc },
    { x: cx - bodyW - al, y: topY + bodyH * 0.48 - (14 + level * 2) * sc },
    { x: cx,              y: topY + bodyH * 0.07 },
  ];

  let colors = ['#E85D75','#F2A65A','#F7E27A','#D966A0','#FF8FAB','#FBBF67'];
  if (mood.flow === 'heavy') colors = ['#C44569','#D96C8A','#E58BAA','#F4A8C4','#F2A65A','#F7E27A'];
  else if (mood.flow === 'light') colors = ['#FF8FAB','#F7C8D8','#F2A65A','#F7E27A','#D966A0','#FBBF67'];

  for (let i = 0; i < count && i < positions.length; i++) {
    const p = positions[i];
    const r = (5 + i * 0.5 + (mood.hydration === 'hydrated' ? 0.4 : 0)) * sc;
    for (let a = 0; a < 5; a++) {
      const angle = (a / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(
        p.x + Math.cos(angle) * r * 1.4,
        p.y + Math.sin(angle) * r * 1.4,
        r * 0.9,
        r * 0.5,
        angle,
        0,
        Math.PI * 2
      );
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FBECD0';
    ctx.fill();
  }
}

// ─── TAB SWITCHING ────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById('tab-' + name);
  const tab = document.querySelector(`[data-tab="${name}"]`);
  if (panel) panel.classList.add('active');
  if (tab) tab.classList.add('active');

  if (name === 'settings') renderSettings();
  if (name === 'home')     renderHome();
  if (name === 'history')  renderBSGraph();
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

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  document.getElementById('add-task-btn')?.addEventListener('click', addTask);
  document.getElementById('task-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTask();
  });

  document.getElementById('home-task-list')?.addEventListener('click', handleChecklistClick);

  document.getElementById('edit-save-btn')?.addEventListener('click', saveEditedTask);
  document.getElementById('edit-cancel-btn')?.addEventListener('click', closeEditDrawer);
  document.getElementById('edit-delete-btn')?.addEventListener('click', deleteFromDrawer);
  document.getElementById('edit-overlay')?.addEventListener('click', function(e) {
    if (e.target === this) closeEditDrawer();
  });
  document.getElementById('edit-task-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEditedTask();
    if (e.key === 'Escape') closeEditDrawer();
  });

  document.getElementById('bs-confirm-btn')?.addEventListener('click', confirmBSReading);
  document.getElementById('bs-skip-btn')?.addEventListener('click', skipBSReading);
  document.getElementById('bs-value-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter')  confirmBSReading();
    if (e.key === 'Escape') skipBSReading();
  });
  document.getElementById('bs-modal')?.addEventListener('click', function(e) {
    if (e.target === this) skipBSReading();
  });

  document.querySelectorAll('.bs-period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bsPeriod = btn.dataset.period;
      document.querySelectorAll('.bs-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderBSGraph();
    });
  });

  document.getElementById('clear-history-btn')?.addEventListener('click', clearHistory);

  document.getElementById('notif-toggle')?.addEventListener('change', async function() {
    if (this.checked) {
      const granted = await requestNotifPermission();
      if (!granted) {
        this.checked = false;
        showToast('Notifications blocked. Check browser settings.');
        return;
      }
      const time = document.getElementById('notif-time-input')?.value || '08:00';
      saveNotifSettings(true, time);
      showToast(`✅ Reminders set for ${timeLabel(time)}`);
    } else {
      saveNotifSettings(false, document.getElementById('notif-time-input')?.value || '08:00');
      showToast('Reminders off.');
    }
    renderSettings();
  });

  document.getElementById('notif-time-input')?.addEventListener('change', function() {
    const notif = getNotifSettings();
    saveNotifSettings(notif.enabled, this.value);
    if (notif.enabled) showToast(`Reminder time updated to ${timeLabel(this.value)}`);
    renderSettings();
  });

  document.getElementById('test-notif-btn')?.addEventListener('click', () => {
    sendNotification('🌵 Desert Bloom', 'This is a test. Your cactus says hi.');
    showToast('Test notification sent.');
  });

  document.getElementById('water-plus-btn')?.addEventListener('click', () => {
    setTodayWater(getTodayWater() + 1);
    showToast('💧 Water logged.');
  });
  document.getElementById('water-minus-btn')?.addEventListener('click', () => {
    setTodayWater(getTodayWater() - 1);
    showToast('💧 Water updated.');
  });
  document.getElementById('flow-input')?.addEventListener('change', e => {
    setTodayFlow(e.target.value);
    showToast('📝 Cycle updated.');
  });

  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (!confirm('Reset everything? This cannot be undone.')) return;
    [
      TASKS_KEY, HISTORY_KEY, STREAK_KEY, GROWTH_KEY, LASTDAY_KEY, LASTRESET_KEY,
      BS_KEY, WATER_KEY, FLOW_KEY, 'desertbloom_lastnotif'
    ].forEach(k => localStorage.removeItem(k));
    bsReadings = [];
    waterIntake = {};
    flowLog = {};
    load();
    renderAll();
    showToast('Reset done. Fresh start.');
  });

  const firstRun = !localStorage.getItem(FIRSTRUN_KEY);
  if (firstRun && 'Notification' in window && Notification.permission !== 'denied') {
    showNotifModal();
  }
  localStorage.setItem(FIRSTRUN_KEY, '1');

  document.getElementById('notif-allow-btn')?.addEventListener('click', async () => {
    const time    = document.getElementById('modal-notif-time')?.value || '08:00';
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

  document.getElementById('notif-skip-btn')?.addEventListener('click', hideNotifModal);
  document.getElementById('notif-modal')?.addEventListener('click', function(e) {
    if (e.target === this) hideNotifModal();
  });
}

document.addEventListener('DOMContentLoaded', init);
