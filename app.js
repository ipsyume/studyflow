/* ═══════════════════════════════════════════════
   StudyFlow Kawaii — app.js
   ═══════════════════════════════════════════════ */

// ═══ STATE ═══════════════════════════════════════
let state = {
  subjects: [],
  decks: [],
  stats: {
    sessions: 0,
    streak: 0,
    studyMins: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    lastStudyDate: null,
  },
  weekData: [0, 0, 0, 0, 0, 0, 0],
  currentPage: 'dashboard',
  settings: {
    focusMins: 25,
    shortMins: 5,
    longMins: 15,
    soundEnabled: true,
  },
};

const STORAGE_KEY = 'studyflow_kawaii_v2';

// ═══ PERSISTENCE ════════════════════════════════
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save state:', e);
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Deep merge to keep any new keys from code updates
      state = {
        ...state,
        ...parsed,
        stats: { ...state.stats, ...(parsed.stats || {}) },
        settings: { ...state.settings, ...(parsed.settings || {}) },
      };
    }
  } catch (e) {
    console.warn('Could not load state:', e);
  }
}

// ═══ SOUND ══════════════════════════════════════
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound(type) {
  if (!state.settings.soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    const presets = {
      complete: [
        { freq: 523.25, time: 0,    dur: 0.15, gain: 0.3 },
        { freq: 659.25, time: 0.15, dur: 0.15, gain: 0.3 },
        { freq: 783.99, time: 0.30, dur: 0.25, gain: 0.4 },
        { freq: 1046.5, time: 0.55, dur: 0.4,  gain: 0.35 },
      ],
      tick: [
        { freq: 880, time: 0, dur: 0.06, gain: 0.08 },
      ],
      correct: [
        { freq: 659.25, time: 0,    dur: 0.1,  gain: 0.25 },
        { freq: 880,    time: 0.1,  dur: 0.18, gain: 0.3 },
      ],
      wrong: [
        { freq: 220, time: 0,   dur: 0.12, gain: 0.2 },
        { freq: 185, time: 0.1, dur: 0.2,  gain: 0.15 },
      ],
      pop: [
        { freq: 440, time: 0, dur: 0.08, gain: 0.2 },
      ],
    };

    const notes = presets[type] || presets.pop;
    notes.forEach(({ freq, time, dur, gain }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g);
      g.connect(gainNode);
      osc.type = type === 'wrong' ? 'sawtooth' : 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + time;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(gain, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    });
  } catch (e) {
    // silently fail if audio not available
  }
}

// ═══ NAVIGATION ═════════════════════════════════
const pageConfig = {
  dashboard:  { title: 'Dashboard ✨',    sub: 'Welcome back, cutie — ready to study? 🌸', action: '＋ Subject', modal: 'modal-subject' },
  subjects:   { title: 'My Subjects 📚',  sub: 'Manage your study modules',                 action: '＋ Subject', modal: 'modal-subject' },
  pomodoro:   { title: 'Focus Timer ⏱️',  sub: 'Stay focused, study smart 🍵',             action: null },
  flashcards: { title: 'Flashcards 🃏',   sub: 'Quiz yourself, ace everything 💫',          action: '＋ Card',    modal: 'modal-card' },
  progress:   { title: 'Progress 📊',     sub: 'See how far you\'ve come 🌟',               action: null },
};

function showPage(name, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + name);
  if (pg) pg.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  state.currentPage = name;

  const cfg = pageConfig[name];
  document.getElementById('topbar-title').textContent = cfg.title;
  document.getElementById('topbar-sub').textContent   = cfg.sub;
  const btn = document.getElementById('topbar-action-btn');
  if (cfg.action) {
    btn.style.display = '';
    document.getElementById('topbar-action-label').textContent = cfg.action;
  } else {
    btn.style.display = 'none';
  }
  renderPage(name);
  playSound('pop');
}

function handleTopbarAction() {
  const cfg = pageConfig[state.currentPage];
  if (cfg?.modal) openModal(cfg.modal);
}

// ═══ RENDER ══════════════════════════════════════
function renderPage(name) {
  if (name === 'dashboard')  renderDashboard();
  if (name === 'subjects')   renderSubjects();
  if (name === 'flashcards') renderDecks();
  if (name === 'progress')   renderProgress();
}

/* ── Dashboard ── */
function renderDashboard() {
  const allCards = state.decks.reduce((a, d) => a + d.cards.length, 0);
  const total    = state.stats.correctAnswers + state.stats.wrongAnswers;
  const pct      = total > 0 ? Math.round(state.stats.correctAnswers / total * 100) : null;

  document.getElementById('dash-subjects').textContent = state.subjects.length;
  document.getElementById('dash-sessions').textContent = state.stats.sessions;
  document.getElementById('dash-cards').textContent    = allCards;
  document.getElementById('dash-accuracy').textContent = pct !== null ? pct + '%' : '—';
  document.getElementById('subject-badge').textContent = state.subjects.length;

  // Subject mini-list
  const el = document.getElementById('dash-subject-list');
  if (state.subjects.length === 0) {
    el.innerHTML = emptyStateHTML('📭', 'No subjects yet', 'Add your first subject to get started');
  } else {
    el.innerHTML = state.subjects.slice(0, 4).map(subjectItemHTML).join('');
  }

  renderWeekChart('week-chart', state.weekData);
  renderAchievements('achievements-grid');
}

/* ── Subjects ── */
function renderSubjects() {
  const el = document.getElementById('subjects-list');
  if (state.subjects.length === 0) {
    el.innerHTML = emptyStateHTML('📚', 'No subjects added yet', 'Click "+ Subject" to create your first module');
    return;
  }
  el.innerHTML = state.subjects.map(s => {
    const deadlineTag = s.deadline
      ? `<span class="tag" style="background:var(--bg3);color:var(--text2)">📅 ${formatDate(s.deadline)}</span>`
      : '';
    const notesHtml = s.notes
      ? `<div style="font-size:0.82rem;color:var(--text2);margin-bottom:12px;font-weight:600">${s.notes}</div>`
      : '';
    return `
      <div class="card" style="border-left:3px solid ${s.color};padding:20px">
        <div style="display:flex;align-items:flex-start;gap:14px">
          <div style="width:13px;height:13px;border-radius:50%;background:${s.color};box-shadow:0 0 12px ${s.color};flex-shrink:0;margin-top:5px"></div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
              <div style="font-family:'Fredoka One',cursive;font-size:1.05rem">${s.name}</div>
              <span class="tag" style="background:${priorityColor(s.priority)}22;color:${priorityColor(s.priority)}">${priorityEmoji(s.priority)} ${s.priority}</span>
              ${deadlineTag}
            </div>
            ${notesHtml}
            <div style="display:flex;align-items:center;gap:12px">
              <div style="flex:1;height:7px;background:var(--bg3);border-radius:7px;overflow:hidden">
                <div style="height:100%;width:${s.progress || 0}%;background:${s.color};border-radius:7px;transition:width 0.8s ease"></div>
              </div>
              <span style="font-size:0.78rem;font-family:'DM Mono',monospace;color:var(--text2);flex-shrink:0;font-weight:500">${s.progress || 0}%</span>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button class="btn btn-ghost btn-sm" onclick="editSubjectProgress('${s.id}')">✏️</button>
            <button class="btn btn-danger btn-sm" onclick="deleteSubject('${s.id}')">🗑️</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function subjectItemHTML(s) {
  return `<div class="subject-item">
    <div class="subject-dot" style="background:${s.color};color:${s.color}"></div>
    <div style="flex:1">
      <div class="subject-name">${s.name}</div>
      <div class="subject-meta">${s.priority} priority${s.deadline ? ' · ' + formatDate(s.deadline) : ''}</div>
    </div>
    <div class="subject-progress-bar">
      <div class="subject-progress-fill" style="width:${s.progress || 0}%;background:${s.color}"></div>
    </div>
    <span style="font-size:0.75rem;color:var(--text2);font-weight:700">${s.progress || 0}%</span>
  </div>`;
}

/* ── Week Bar Chart ── */
function renderWeekChart(containerId, data) {
  const days   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const colors = ['#ff85c2', '#c084fc', '#e879f9', '#7dd3fc', '#6ee7b7', '#fde68a', '#fca5a5'];
  const max    = Math.max(...data, 0.5);
  const el     = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = days.map((d, i) => `
    <div class="week-bar-wrap">
      <div class="week-bar-val">${data[i] ? data[i] + 'h' : ''}</div>
      <div class="week-bar-track">
        <div class="week-bar-fill" style="height:${Math.round(data[i]/max*100)}%;background:${colors[i]};box-shadow:0 0 10px ${colors[i]}50"></div>
      </div>
      <div class="week-bar-label">${d}</div>
    </div>`).join('');
}

/* ── Decks ── */
function renderDecks() {
  const el = document.getElementById('deck-list');
  const totalCards = state.decks.reduce((a, d) => a + d.cards.length, 0);
  document.getElementById('fc-badge').textContent = totalCards;

  if (state.decks.length === 0) {
    el.innerHTML = `<div class="empty-state" style="padding:24px">${emptyStateInner('📦', 'No decks yet', 'Create a deck to start studying')}</div>`;
    return;
  }
  el.innerHTML = state.decks.map(d => `
    <div class="fc-deck-item ${d.studying ? 'studying' : ''}" onclick="selectDeck('${d.id}')">
      <div class="fc-deck-icon">${d.emoji || '📖'}</div>
      <div>
        <div class="fc-deck-name">${d.name}</div>
        <div class="fc-deck-count">${d.cards.length} card${d.cards.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="fc-deck-actions">
        <button class="btn btn-danger btn-sm btn-icon" onclick="event.stopPropagation();deleteDeck('${d.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

/* ── Progress ── */
function renderProgress() {
  renderWeekChart('progress-week-chart', state.weekData);

  const subjEl = document.getElementById('progress-subject-list');
  if (state.subjects.length === 0) {
    subjEl.innerHTML = `<div class="empty-state" style="padding:24px">${emptyStateInner('📊', 'No data yet', 'Add subjects to track progress')}</div>`;
  } else {
    subjEl.innerHTML = state.subjects.map(s => `
      <div class="sp-item">
        <div class="sp-header">
          <span>${s.name}</span>
          <span style="color:${s.color};font-family:'DM Mono',monospace">${s.progress || 0}%</span>
        </div>
        <div class="sp-bar">
          <div class="sp-fill" style="width:${s.progress || 0}%;background:${s.color};opacity:0.85"></div>
        </div>
      </div>`).join('');
  }

  const total = state.stats.correctAnswers + state.stats.wrongAnswers;
  const pct   = total > 0 ? Math.round(state.stats.correctAnswers / total * 100) : null;
  document.getElementById('acc-right').textContent = state.stats.correctAnswers;
  document.getElementById('acc-wrong').textContent  = state.stats.wrongAnswers;
  document.getElementById('acc-total').textContent  = total;
  const big = document.getElementById('acc-big');
  big.textContent = pct !== null ? pct + '%' : '—';
  big.style.color = pct >= 80 ? 'var(--mint)' : pct >= 60 ? 'var(--yellow)' : pct !== null ? 'var(--peach)' : 'var(--text)';

  renderAchievements('progress-achievements');
  renderChartJS();
}

/* ── Chart.js doughnut ── */
let chartInstance = null;
function renderChartJS() {
  const canvas = document.getElementById('accuracy-chart');
  if (!canvas || !window.Chart) return;
  if (chartInstance) { chartInstance.destroy(); }
  const right = state.stats.correctAnswers;
  const wrong = state.stats.wrongAnswers;
  if (right + wrong === 0) return;
  chartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Correct ✓', 'Wrong ✗'],
      datasets: [{
        data: [right, wrong],
        backgroundColor: ['rgba(110,231,183,0.8)', 'rgba(252,165,165,0.7)'],
        borderColor: ['#6ee7b7', '#fca5a5'],
        borderWidth: 2,
        hoverOffset: 8,
      }],
    },
    options: {
      cutout: '70%',
      plugins: {
        legend: {
          labels: {
            color: getComputedStyle(document.documentElement).getPropertyValue('--text2').trim() || '#b89dcc',
            font: { family: 'Nunito', weight: '700', size: 13 },
          },
        },
      },
      animation: { animateRotate: true, duration: 800 },
    },
  });
}

/* ── Achievements ── */
const ACHIEVEMENTS = [
  { id: 'first_subject', icon: '📚', name: 'First Step',   check: s => s.subjects.length >= 1 },
  { id: 'five_subjects', icon: '🎓', name: 'Full Load',    check: s => s.subjects.length >= 5 },
  { id: 'first_session', icon: '⏱️', name: 'Focused',     check: s => s.stats.sessions >= 1 },
  { id: 'ten_sessions',  icon: '🔥', name: 'On Fire',      check: s => s.stats.sessions >= 10 },
  { id: 'first_card',    icon: '🃏', name: 'Card Shark',   check: s => s.decks.reduce((a, d) => a + d.cards.length, 0) >= 1 },
  { id: 'accuracy80',    icon: '🎯', name: 'Sharp Mind',   check: s => { const t = s.stats.correctAnswers + s.stats.wrongAnswers; return t > 0 && s.stats.correctAnswers/t >= 0.8; } },
  { id: 'streak5',       icon: '🌟', name: 'On a Roll',    check: s => s.stats.streak >= 5 },
  { id: 'study100',      icon: '🏆', name: 'Century',      check: s => s.stats.studyMins >= 100 },
];

function renderAchievements(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = a.check(state);
    return `<div class="achievement ${unlocked ? 'unlocked' : ''}">
      <div class="achievement-icon">${a.icon}</div>
      <div class="achievement-name">${a.name}</div>
    </div>`;
  }).join('');
}

// ═══ SUBJECTS ════════════════════════════════════
let selectedColor = '#ff85c2';

document.querySelectorAll('.color-option').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedColor = opt.dataset.color;
  });
});

function addSubject() {
  const name = document.getElementById('subj-name').value.trim();
  if (!name) { toast('💕 Please enter a subject name!', 'warning'); return; }

  const subject = {
    id: Date.now().toString(),
    name,
    color: selectedColor,
    deadline: document.getElementById('subj-deadline').value,
    priority: document.getElementById('subj-priority').value,
    notes: document.getElementById('subj-notes').value.trim(),
    progress: parseInt(document.getElementById('subj-progress').value) || 0,
    created: new Date().toISOString(),
  };

  state.subjects.push(subject);
  saveState();
  closeModal('modal-subject');

  // Reset form
  document.getElementById('subj-name').value = '';
  document.getElementById('subj-deadline').value = '';
  document.getElementById('subj-notes').value = '';
  document.getElementById('subj-progress').value = 0;

  toast('📚 Subject added! Let\'s learn! ✨', 'success');
  renderPage(state.currentPage);
  document.getElementById('subject-badge').textContent = state.subjects.length;
  playSound('complete');
}

function deleteSubject(id) {
  if (!confirm('Delete this subject? 🥺')) return;
  state.subjects = state.subjects.filter(s => s.id !== id);
  saveState();
  toast('Deleted 🗑️', 'info');
  renderPage(state.currentPage);
  document.getElementById('subject-badge').textContent = state.subjects.length;
}

function editSubjectProgress(id) {
  const s = state.subjects.find(x => x.id === id);
  if (!s) return;
  const val = prompt(`Update progress for "${s.name}" (0-100):`, s.progress || 0);
  if (val === null) return;
  s.progress = Math.min(100, Math.max(0, parseInt(val) || 0));
  saveState();
  if (s.progress === 100) { spawnConfetti(); toast('🎉 Subject complete! You\'re amazing!', 'success'); }
  else toast(`Progress updated to ${s.progress}% 💪`, 'success');
  renderPage(state.currentPage);
}

// ═══ POMODORO ════════════════════════════════════
let timerMode = 'focus';
let timerSecs = 25 * 60;
let timerTotal = 25 * 60;
let timerRunning = false;
let timerInterval = null;
const CIRCUMFERENCE = 2 * Math.PI * 91;

function getModes() {
  return {
    focus: { label: 'Focus Time 🎯',  mins: state.settings.focusMins,  color: '#ff85c2' },
    short: { label: 'Short Break ☕', mins: state.settings.shortMins, color: '#6ee7b7' },
    long:  { label: 'Long Break 🛋️',  mins: state.settings.longMins,  color: '#7dd3fc' },
  };
}

function setMode(mode, btn) {
  const modes = getModes();
  timerMode = mode;
  if (timerRunning) { clearInterval(timerInterval); timerRunning = false; }
  timerSecs  = modes[mode].mins * 60;
  timerTotal = timerSecs;

  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else {
    const btns = document.querySelectorAll('.mode-btn');
    const idx = ['focus','short','long'].indexOf(mode);
    if (btns[idx]) btns[idx].classList.add('active');
  }

  document.getElementById('timer-toggle-btn').textContent = '▶';
  document.getElementById('pomodoro-wrap').classList.remove('pulsing');
  const ring = document.getElementById('ring-fg');
  if (ring) {
    ring.style.stroke  = modes[mode].color;
    ring.style.filter  = `drop-shadow(0 0 14px ${modes[mode].color})`;
  }
  updateTimerDisplay();
}

function toggleTimer() {
  const wrap = document.getElementById('pomodoro-wrap');
  if (timerRunning) {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('timer-toggle-btn').textContent = '▶';
    wrap.classList.remove('pulsing');
  } else {
    timerRunning = true;
    document.getElementById('timer-toggle-btn').textContent = '⏸';
    wrap.classList.add('pulsing');
    timerInterval = setInterval(() => {
      timerSecs--;
      updateTimerDisplay();
      if (timerSecs % 60 === 0 && timerSecs > 0) playSound('tick');
      if (timerSecs <= 0) finishTimer();
    }, 1000);
  }
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSecs  = getModes()[timerMode].mins * 60;
  timerTotal = timerSecs;
  document.getElementById('timer-toggle-btn').textContent = '▶';
  document.getElementById('pomodoro-wrap').classList.remove('pulsing');
  updateTimerDisplay();
}

function skipTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  finishTimer();
}

function finishTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById('timer-toggle-btn').textContent = '▶';
  document.getElementById('pomodoro-wrap').classList.remove('pulsing');
  playSound('complete');

  const modes = getModes();
  if (timerMode === 'focus') {
    state.stats.sessions++;
    state.stats.studyMins += modes.focus.mins;

    // Weekly data
    const day = new Date().getDay();
    const idx = day === 0 ? 6 : day - 1;
    state.weekData[idx] = +(state.weekData[idx] + (modes.focus.mins / 60)).toFixed(2);

    logSession(modes.focus.label, modes.focus.mins);
    document.getElementById('pomo-count').textContent = state.stats.sessions;
    document.getElementById('pomo-mins').textContent  = state.stats.studyMins;

    saveState();
    spawnConfetti(15);
    toast('🎉 Focus session complete! Take a break, cutie! 🍵', 'success');
    setTimeout(() => setMode('short', null), 600);
  } else {
    toast('☀️ Break over! Back to studying! 💪', 'info');
    setTimeout(() => setMode('focus', null), 600);
  }

  timerSecs  = getModes()[timerMode].mins * 60;
  timerTotal = timerSecs;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m = String(Math.floor(timerSecs / 60)).padStart(2, '0');
  const s = String(timerSecs % 60).padStart(2, '0');
  const disp = document.getElementById('timer-display');
  const lbl  = document.getElementById('timer-mode-label');
  const ring = document.getElementById('ring-fg');
  if (disp) disp.textContent = `${m}:${s}`;
  if (lbl)  lbl.textContent  = getModes()[timerMode].label;
  if (ring) {
    const progress = timerTotal > 0 ? timerSecs / timerTotal : 0;
    ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
  }
  // Browser tab title
  if (timerRunning) document.title = `⏱️ ${m}:${s} — StudyFlow`;
  else document.title = '🌸 StudyFlow';
}

function logSession(label, mins) {
  const logEl = document.getElementById('session-log');
  if (!logEl) return;
  const now     = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const item    = document.createElement('div');
  item.className = 'session-log-item';
  item.innerHTML = `<div><span class="session-dot" style="background:var(--pink)"></span>${label} — ${mins} min</div><div class="session-log-time">${timeStr}</div>`;
  if (logEl.querySelector('.empty-state')) logEl.innerHTML = '';
  logEl.insertBefore(item, logEl.firstChild);
}

// ═══ FLASHCARDS ══════════════════════════════════
let activeDeckId = null;
let fcIndex      = 0;
let fcFlipped    = false;

function addDeck() {
  const name = document.getElementById('deck-name').value.trim();
  if (!name) { toast('💕 Enter a deck name!', 'warning'); return; }

  const deck = {
    id: Date.now().toString(),
    name,
    emoji: document.getElementById('deck-emoji').value || '📖',
    cards: [],
    studying: false,
    created: new Date().toISOString(),
  };

  state.decks.push(deck);
  saveState();
  closeModal('modal-deck');
  document.getElementById('deck-name').value = '';
  document.getElementById('deck-emoji').value = '📖';
  toast('📦 Deck created! Add some cards! ✨', 'success');
  renderDecks();
  playSound('pop');
}

function deleteDeck(id) {
  if (!confirm('Delete this deck? All cards will be lost 🥺')) return;
  state.decks = state.decks.filter(d => d.id !== id);
  if (activeDeckId === id) { activeDeckId = null; resetStudyArea(); }
  saveState();
  toast('Deck deleted 🗑️', 'info');
  renderDecks();
}

function selectDeck(id) {
  activeDeckId = id;
  state.decks.forEach(d => d.studying = false);
  const deck = state.decks.find(d => d.id === id);
  deck.studying = true;
  fcIndex   = 0;
  fcFlipped = false;
  renderDecks();
  renderStudyArea(deck);
  playSound('pop');
}

function resetStudyArea() {
  document.getElementById('fc-study-area').innerHTML = `
    <div class="empty-state" style="padding:48px 24px">
      <div class="icon">🎴</div>
      <h3>Select a deck to study</h3>
      <p>Choose a flashcard deck from the left to begin your quiz 🌸</p>
    </div>`;
}

function renderStudyArea(deck) {
  const el = document.getElementById('fc-study-area');
  if (!el) return;

  if (deck.cards.length === 0) {
    el.innerHTML = `
      <div class="card-header">
        <div class="card-title">${deck.emoji} ${deck.name}</div>
      </div>
      <div class="empty-state" style="padding:32px">
        <div class="icon">🃏</div>
        <h3>No cards in this deck</h3>
        <p>Add flashcards to start studying 💖</p>
      </div>
      <button class="btn btn-primary" onclick="openModal('modal-card')" style="width:100%;margin-top:16px">＋ Add Flashcard</button>`;
    return;
  }

  const card = deck.cards[fcIndex];
  const pct  = Math.round(fcIndex / deck.cards.length * 100);

  el.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">${deck.emoji} ${deck.name}</div>
        <div class="card-sub">${deck.cards.length} card${deck.cards.length !== 1 ? 's' : ''}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="shuffleDeck()">🔀 Shuffle</button>
        <button class="btn btn-ghost btn-sm" onclick="openModal('modal-card')">＋ Add</button>
      </div>
    </div>
    <div class="flashcard-arena">
      <div style="width:100%">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span class="fc-counter">Card ${fcIndex + 1} of ${deck.cards.length}</span>
          <span class="fc-counter">${pct}% done ✨</span>
        </div>
        <div class="fc-progress-bar"><div class="fc-progress-fill" style="width:${pct}%"></div></div>
      </div>
      <div class="flashcard-scene" onclick="flipCard()">
        <div class="flashcard-inner ${fcFlipped ? 'flipped' : ''}" id="fc-inner">
          <div class="flashcard-face flashcard-front">
            <div class="fc-hint">✨ Question — tap to reveal ✨</div>
            <div class="fc-question">${escapeHTML(card.question)}</div>
          </div>
          <div class="flashcard-face flashcard-back">
            <div class="fc-hint">💖 Answer 💖</div>
            <div class="fc-answer">${escapeHTML(card.answer)}</div>
          </div>
        </div>
      </div>
      <div class="fc-actions">
        <button class="fc-btn fc-btn-wrong" onclick="answerCard(false)">✗ Didn't Know</button>
        <button class="fc-btn fc-btn-right" onclick="answerCard(true)">✓ Got It! 💪</button>
      </div>
    </div>`;
}

function flipCard() {
  fcFlipped = !fcFlipped;
  const inner = document.getElementById('fc-inner');
  if (inner) inner.classList.toggle('flipped', fcFlipped);
  playSound('tick');
}

function answerCard(correct) {
  if (correct) { state.stats.correctAnswers++; playSound('correct'); }
  else         { state.stats.wrongAnswers++;   playSound('wrong'); }

  const deck = state.decks.find(d => d.id === activeDeckId);
  fcIndex = (fcIndex + 1) % deck.cards.length;
  fcFlipped = false;

  if (fcIndex === 0) {
    const t = state.stats.correctAnswers + state.stats.wrongAnswers;
    const p = t > 0 ? Math.round(state.stats.correctAnswers / t * 100) : 0;
    spawnConfetti(20);
    toast(`🎉 Deck complete! Accuracy: ${p}% 🌸`, 'success');
  }

  saveState();
  renderStudyArea(deck);
}

function shuffleDeck() {
  const deck = state.decks.find(d => d.id === activeDeckId);
  if (!deck) return;
  deck.cards = [...deck.cards].sort(() => Math.random() - 0.5);
  fcIndex   = 0;
  fcFlipped = false;
  saveState();
  renderStudyArea(deck);
  toast('🔀 Deck shuffled! 🌟', 'info');
  playSound('pop');
}

function addCard() {
  const q = document.getElementById('card-question').value.trim();
  const a = document.getElementById('card-answer').value.trim();
  if (!q || !a) { toast('💕 Fill in both question and answer!', 'warning'); return; }

  const deck = activeDeckId
    ? state.decks.find(d => d.id === activeDeckId)
    : state.decks[state.decks.length - 1];

  if (!deck) { toast('Please select or create a deck first 📦', 'warning'); return; }

  deck.cards.push({ id: Date.now().toString(), question: q, answer: a });
  saveState();
  closeModal('modal-card');
  document.getElementById('card-question').value = '';
  document.getElementById('card-answer').value   = '';
  toast('🃏 Flashcard added! 💖', 'success');
  renderDecks();
  if (activeDeckId === deck.id) renderStudyArea(deck);
  playSound('pop');
}

// ═══ MODALS ══════════════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.add('open');
  playSound('pop');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// Escape key closes modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    document.getElementById('shortcuts-panel').classList.remove('open');
  }
});

// ═══ KEYBOARD SHORTCUTS ══════════════════════════
document.addEventListener('keydown', e => {
  // Don't fire when typing in inputs
  if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  if (document.querySelector('.modal-overlay.open')) return;

  const navItems = document.querySelectorAll('.nav-item');
  const keyMap = {
    '1': () => showPage('dashboard',  navItems[0]),
    '2': () => showPage('subjects',   navItems[1]),
    '3': () => showPage('pomodoro',   navItems[2]),
    '4': () => showPage('flashcards', navItems[3]),
    '5': () => showPage('progress',   navItems[4]),
    ' ': () => { if (state.currentPage === 'pomodoro') { e.preventDefault(); toggleTimer(); } },
    'r': () => { if (state.currentPage === 'pomodoro') resetTimer(); },
    'f': () => { if (state.currentPage === 'flashcards' && activeDeckId) flipCard(); },
    'ArrowRight': () => { if (state.currentPage === 'flashcards' && activeDeckId) answerCard(true); },
    'ArrowLeft':  () => { if (state.currentPage === 'flashcards' && activeDeckId) answerCard(false); },
    '?': () => document.getElementById('shortcuts-panel').classList.toggle('open'),
    'n': () => handleTopbarAction(),
  };

  if (keyMap[e.key]) keyMap[e.key]();
});

// ═══ EXPORT / IMPORT ═════════════════════════════
function exportData() {
  const dataStr = JSON.stringify(state, null, 2);
  const blob    = new Blob([dataStr], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `studyflow-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('📦 Data exported! Keep it safe 💖', 'success');
  playSound('complete');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (confirm('This will replace all your current data. Are you sure? 🥺')) {
        state = {
          ...state,
          ...data,
          stats: { ...state.stats, ...(data.stats || {}) },
          settings: { ...state.settings, ...(data.settings || {}) },
        };
        saveState();
        renderPage(state.currentPage);
        renderDashboard();
        toast('✅ Data imported successfully! 🌸', 'success');
        playSound('complete');
      }
    } catch {
      toast('❌ Invalid file — could not import!', 'warning');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function clearAllData() {
  if (!confirm('⚠️ Delete ALL data? This cannot be undone! 😱')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

// ═══ TOAST ═══════════════════════════════════════
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = msg;
  const colors = { success: 'var(--mint)', warning: 'var(--yellow)', info: 'var(--pink)' };
  el.style.borderLeft = `3px solid ${colors[type] || colors.info}`;
  const container = document.getElementById('toast-container');
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

// ═══ CONFETTI ════════════════════════════════════
function spawnConfetti(count = 30) {
  const colors = ['#ff85c2', '#c084fc', '#e879f9', '#fde68a', '#6ee7b7', '#7dd3fc', '#fca5a5'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle';
    p.style.cssText = `
      left: ${Math.random() * 100}vw;
      top: -10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${4 + Math.random() * 8}px;
      height: ${4 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      animation-duration: ${1.5 + Math.random() * 2}s;
      animation-delay: ${Math.random() * 0.5}s;
    `;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 4000);
  }
}

// ═══ UTILS ═══════════════════════════════════════
function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function priorityColor(p) {
  return p === 'high' ? 'var(--peach)' : p === 'medium' ? 'var(--yellow)' : 'var(--mint)';
}
function priorityEmoji(p) {
  return p === 'high' ? '🔴' : p === 'medium' ? '🟡' : '🟢';
}

function escapeHTML(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function emptyStateHTML(icon, title, desc) {
  return `<div class="empty-state"><div class="icon">${icon}</div><h3>${title}</h3><p>${desc}</p></div>`;
}

function emptyStateInner(icon, title, desc) {
  return `<div class="icon" style="font-size:2rem">${icon}</div><h3 style="font-size:0.9rem">${title}</h3><p>${desc}</p>`;
}

// ═══ THEME ═══════════════════════════════════════
function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('studyflow_theme', next);
  playSound('pop');

  updateThemeUI();
}

function updateThemeUI() {
  const theme = document.documentElement.getAttribute('data-theme');
  const label = document.getElementById('theme-label');
  const icon  = document.getElementById('theme-icon');

  if (!label || !icon) return;

  if (theme === 'dark') {
    label.textContent = 'Light Mode';
    icon.textContent = '☀️';
  } else {
    label.textContent = 'Dark Mode';
    icon.textContent = '🌙';
  }
}

function loadTheme() {
  const saved = localStorage.getItem('studyflow_theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
}

// ═══ CLOCK & GREETING ════════════════════════════
function updateClock() {
  const el = document.getElementById('live-clock');
  if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function setGreeting() {
  const h = new Date().getHours();
  const g = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  const emoji = h < 12 ? '☀️' : h < 17 ? '🌻' : '🌙';
  const gEl = document.getElementById('greeting-time');
  const dEl = document.getElementById('greeting-date');
  if (gEl) gEl.textContent = g + ' ' + emoji;
  if (dEl) dEl.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ═══ INIT ════════════════════════════════════════
loadTheme();
loadState();
updateThemeUI();
setGreeting();
updateClock();
setInterval(updateClock, 1000);
updateTimerDisplay();

renderDashboard();
document.getElementById('subject-badge').textContent = state.subjects.length;
document.getElementById('fc-badge').textContent      = state.decks.reduce((a, d) => a + d.cards.length, 0);
