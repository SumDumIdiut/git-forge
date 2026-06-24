// ── State ─────────────────────────────────────────────────────────────────────
let currentUser = null;
let _syncStatus = {};
let _syncPollTimer = null;
let _repoOwnerCache = {}; // { repoName: ownerUsername }
let currentRepo = null;
let currentBranch = 'main';
let currentRemote = 'origin';
let pendingDeleteRepo = null;
let pendingFileRepo = null;
let pendingPushPullRepo = null;
let pendingPushPullAction = 'push';
let pendingRemotesRepo = null;
let pendingIssueRepo = null;
let pendingIssueId = null;
let pendingBranchRepo = null;
let pendingTagRepo = null;
let pendingStashRepo = null;
let pendingWebhookRepo = null;
let pendingSettingsRepo = null;
let cmdHistory = [], cmdHistIdx = -1, terminalOpen = false;
let searchDebounce = null, searchActiveIdx = -1, searchItemEls = [], searchOpen = false;
let _allRepoCards = '';

// ── Icons ─────────────────────────────────────────────────────────────────────
const ICONS = {
  repo:    `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8V1.5Z"/></svg>`,
  dir:     `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"/></svg>`,
  file:    `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z"/></svg>`,
  book:    `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z"/></svg>`,
  commit:  `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.07a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>`,
  branch:  `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>`,
  clock:   `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/></svg>`,
  plus:    `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/></svg>`,
  trash:   `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675l.66 6.6a.25.25 0 0 0 .249.225h5.19a.25.25 0 0 0 .249-.225l.66-6.6a.75.75 0 0 1 1.492.149l-.66 6.6A1.748 1.748 0 0 1 10.595 15h-5.19a1.75 1.75 0 0 1-1.741-1.575l-.66-6.6a.75.75 0 1 1 1.492-.15ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25Z"/></svg>`,
  code:    `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Zm7.47 3.97a.75.75 0 0 1 1.06 1.06L9.06 8l1.22 1.22a.75.75 0 1 1-1.06 1.06l-1.75-1.75a.75.75 0 0 1 0-1.06Zm-4.94 1.06a.75.75 0 0 1 1.06-1.06l1.75 1.75a.75.75 0 0 1 0 1.06l-1.75 1.75a.75.75 0 1 1-1.06-1.06L5.44 8Z"/></svg>`,
  upload:  `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8.75 1.75a.75.75 0 0 0-1.5 0v5.19L5.03 4.72a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 6.94V1.75ZM1.5 9.25a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 12.75 13.5h-9.5A1.75 1.75 0 0 1 1.5 11.75v-2.5Z"/></svg>`,
  download:`<svg viewBox="0 0 16 16" fill="currentColor"><path d="M7.25 1.75a.75.75 0 0 1 1.5 0v5.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22V1.75ZM1.5 9.25a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 12.75 13.5h-9.5A1.75 1.75 0 0 1 1.5 11.75v-2.5Z"/></svg>`,
  link:    `<svg viewBox="0 0 16 16" fill="currentColor"><path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 2 2 0 0 0 2.83 0l2.5-2.5a2 2 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a2 2 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 2 2 0 0 0-2.83 0l-2.5 2.5a2 2 0 0 0 0 2.83Z"/></svg>`,
  issue:   `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/></svg>`,
  tag:     `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775Zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 0 0 .354 0l5.025-5.025a.25.25 0 0 0 0-.354l-6.25-6.25a.25.25 0 0 0-.177-.073H2.75a.25.25 0 0 0-.25.25ZM6 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"/></svg>`,
  stash:   `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v3c0 .378-.118.727-.318 1.015A1.75 1.75 0 0 1 16 8.75v3c0 .966-.784 1.75-1.75 1.75H1.75A1.75 1.75 0 0 1 0 11.75v-3c0-.567.27-1.072.682-1.395A1.75 1.75 0 0 1 0 5.75v-3C0 1.784.784 1 1.75 1ZM1.5 5.75c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-3a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25Zm.25 2.75a.25.25 0 0 0-.25.25v3c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-3a.25.25 0 0 0-.25-.25Z"/></svg>`,
  settings:`<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.012 8.012 0 0 1-.704-1.218c-.315-.675-.111-1.422.364-1.891l.814-.806c.049-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.814-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0Zm-.571 1.525c-.036.003-.108.036-.137.146l-.289 1.105c-.147.561-.549.967-.998 1.189-.173.086-.34.183-.5.29-.417.278-.97.423-1.529.27l-1.103-.303c-.109-.03-.175.016-.195.045-.22.312-.412.644-.573.99-.014.031-.021.11.059.19l.815.806c.411.406.562.957.53 1.456a4.709 4.709 0 0 0 0 .582c.032.499-.119 1.05-.53 1.456l-.815.806c-.081.08-.073.159-.059.19.162.346.353.677.573.989.02.03.085.076.195.046l1.102-.303c.56-.153 1.113-.008 1.53.27.161.107.328.204.501.29.447.222.85.629.997 1.189l.289 1.105c.029.109.101.143.137.146a6.6 6.6 0 0 0 1.142 0c.036-.003.108-.036.137-.146l.289-1.105c.147-.561.549-.967.998-1.189.173-.086.34-.183.5-.29.417-.278.97-.423 1.529-.27l1.103.303c.109.029.175-.016.195-.045.22-.313.411-.644.573-.99.014-.031.021-.11-.059-.19l-.815-.806c-.411-.406-.562-.957-.53-1.456a4.709 4.709 0 0 0 0-.582c-.032-.499.119-1.05.53-1.456l.815-.806c.081-.08.073-.159.059-.19a6.464 6.464 0 0 0-.573-.989c-.02-.03-.085-.076-.195-.046l-1.102.303c-.56.153-1.113.008-1.53-.27a4.44 4.44 0 0 0-.501-.29c-.447-.222-.85-.629-.997-1.189l-.289-1.105c-.029-.11-.101-.143-.137-.146a6.6 6.6 0 0 0-1.142 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM9.5 8a1.5 1.5 0 1 0-3.001.001A1.5 1.5 0 0 0 9.5 8Z"/></svg>`,
  graph:   `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1.5 1.75a.75.75 0 0 0-1.5 0v12.5c0 .414.336.75.75.75h14.5a.75.75 0 0 0 0-1.5H1.5V1.75Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 3.28 10.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l4.25-4.25a.75.75 0 0 1 1.06 0L9 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"/></svg>`,
  users:   `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.235A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z"/></svg>`,
  webhook: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 1.5A1.5 1.5 0 0 1 7 0h2a1.5 1.5 0 0 1 1.5 1.5v1A1.5 1.5 0 0 1 9 4H7a1.5 1.5 0 0 1-1.5-1.5v-1ZM6 8a1 1 0 1 1 2 0 1 1 0 0 1-2 0Zm.75 2.5a.75.75 0 0 0-1.5 0v1h-2v-1a.75.75 0 0 0-1.5 0V13a.75.75 0 0 0 .75.75h4.5A.75.75 0 0 0 7.75 13v-2.5Zm5-2.5a.75.75 0 0 0-1.5 0v1h-2v-1a.75.75 0 0 0-1.5 0V13a.75.75 0 0 0 .75.75h4.5a.75.75 0 0 0 .75-.75v-2.5Zm-5-5.5a.75.75 0 0 1 .75-.75h1a.75.75 0 0 1 0 1.5h-1A.75.75 0 0 1 6.75 2.5Z"/></svg>`,
};

function icon(name, cls='') { return `<span class="${cls}">${ICONS[name]||''}</span>`; }

// ── API ───────────────────────────────────────────────────────────────────────
async function api(method, url, body) {
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  let data;
  try { data = await r.json(); } catch { throw new Error(`Server error (${r.status}) — restart the server to apply latest changes`); }
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type='success') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

// ── Modals ────────────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(`modal-${id}`).classList.add('open');
  if (id === 'create-repo') {
    document.getElementById('repo-name').value = '';
    document.getElementById('repo-desc').value = '';
    document.getElementById('repo-readme').checked = true;
    document.getElementById('create-repo-error').style.display = 'none';
    setTimeout(() => document.getElementById('repo-name').focus(), 50);
  }
}
function closeModal(id) { document.getElementById(`modal-${id}`).classList.remove('open'); }
document.querySelectorAll('.overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
});

// ── Auth ──────────────────────────────────────────────────────────────────────
async function initAuth() {
  try {
    const status = await api('GET', '/api/auth/status');
    if (status.user) { currentUser = status.user; showMainApp(); }
    else if (status.setup) { await doSkipAuth(); }
    else { showAuthScreen('login'); }
  } catch { showAuthScreen('login'); }
}
function showAuthScreen(mode) {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
  const s = document.getElementById('auth-setup-section'), l = document.getElementById('auth-login-section');
  if (mode === 'setup') {
    s.style.display = 'block'; l.style.display = 'none';
    document.getElementById('setup-password').onkeydown = e => { if (e.key === 'Enter') doSetup(); };
    setTimeout(() => document.getElementById('setup-username').focus(), 50);
  } else {
    s.style.display = 'none'; l.style.display = 'block';
    document.getElementById('login-password').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
    setTimeout(() => document.getElementById('login-username').focus(), 50);
  }
}
function showMainApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  const initials = (currentUser.username || '?').slice(0, 2).toUpperCase();
  document.getElementById('user-avatar-circle').textContent = initials;
  document.getElementById('user-menu-name').textContent = currentUser.username;
  // Try to load real avatar; fall back to initials circle on error
  const avatarImg = document.getElementById('user-avatar-img');
  if (avatarImg) {
    avatarImg.alt = initials;
    avatarImg.src = `/api/avatar/${encodeURIComponent(currentUser.username)}`;
    avatarImg.style.display = 'block';
    document.getElementById('user-avatar-circle').style.display = 'none';
  }
  renderRoute(location.hash.slice(1) || '/');
}

function toggleUserMenu() {
  document.getElementById('user-menu-dropdown').classList.toggle('open');
}
function closeUserMenu() {
  document.getElementById('user-menu-dropdown').classList.remove('open');
}
document.addEventListener('click', e => {
  const menu = document.getElementById('user-menu');
  if (menu && !menu.contains(e.target)) closeUserMenu();
});
function setAuthError(msg) { document.querySelectorAll('.auth-error').forEach(el => { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }); }
async function doSetup() {
  const u = document.getElementById('setup-username').value.trim(), p = document.getElementById('setup-password').value;
  const btn = document.getElementById('setup-btn'); setAuthError(''); btn.disabled = true; btn.textContent = 'Creating…';
  try { currentUser = await api('POST', '/api/auth/setup', { username: u, password: p }); showMainApp(); }
  catch(e) { setAuthError(e.message); btn.disabled = false; btn.textContent = 'Create account'; }
}
async function doLogin() {
  const u = document.getElementById('login-username').value.trim(), p = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn'); setAuthError(''); btn.disabled = true; btn.textContent = 'Signing in…';
  try { currentUser = await api('POST', '/api/auth/login', { username: u, password: p }); showMainApp(); }
  catch(e) {
    if (e.message.toLowerCase().includes('not set up')) { showAuthScreen('setup'); return; }
    setAuthError(e.message); btn.disabled = false; btn.textContent = 'Sign in';
  }
}
async function doSkipAuth() { try { currentUser = await api('POST', '/api/auth/skip'); showMainApp(); } catch { showAuthScreen('login'); } }
async function doLogout() { try { await api('POST', '/api/auth/logout'); } catch {} currentUser = null; showAuthScreen('login'); }

// ── Router ────────────────────────────────────────────────────────────────────
function navigate(path, push=true) { if (push) location.hash = '#' + path; renderRoute(path); }
window.addEventListener('hashchange', () => { if (currentUser) renderRoute(location.hash.slice(1) || '/'); });

function renderRoute(path) {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="container"><div class="spinner"></div></div>';
  const m = {
    home:     path === '/' || path === '',
    profile:  path === '/profile',
    settings: path === '/settings',
    repo:     path.match(/^\/([^/]+)$/)?.at(1),
    commits:  path.match(/^\/([^/]+)\/commits$/)?.at(1),
    issues:   path.match(/^\/([^/]+)\/issues$/)?.at(1),
    issue:    path.match(/^\/([^/]+)\/issues\/(\d+)$/),
    branches: path.match(/^\/([^/]+)\/branches$/)?.at(1),
    tags:     path.match(/^\/([^/]+)\/tags$/)?.at(1),
    stash:    path.match(/^\/([^/]+)\/stash$/)?.at(1),
    graph:    path.match(/^\/([^/]+)\/graph$/)?.at(1),
    diff:     path.match(/^\/([^/]+)\/diff$/),
    blame:    path.match(/^\/([^/]+)\/blame\/(.*)$/),
    tree:     path.match(/^\/([^/]+)\/tree\/(.*)$/),
    blob:     path.match(/^\/([^/]+)\/blob\/(.*)$/),
  };
  if (m.home)          { renderHome(); startSyncPolling(); }
  else if (m.profile)  { stopSyncPolling(); renderProfile(); }
  else if (m.settings) { stopSyncPolling(); renderAccountSettings(); }
  else if (m.commits)  { stopSyncPolling(); renderCommits(m.commits); }
  else if (m.issue)    renderIssueDetail(m.issue[1], parseInt(m.issue[2]));
  else if (m.issues)   renderIssues(m.issues);
  else if (m.branches) renderBranches(m.branches);
  else if (m.tags)     renderTags(m.tags);
  else if (m.stash)    renderStash(m.stash);
  else if (m.graph)    renderGraph(m.graph);
  else if (m.diff)     renderDiff(m.diff[1], new URLSearchParams(location.hash.split('?')[1]));
  else if (m.blame)    renderBlame(m.blame[1], m.blame[2]);
  else if (m.tree)     renderRepo(m.tree[1], m.tree[2]);
  else if (m.blob)     renderBlob(m.blob[1], m.blob[2]);
  else if (m.repo)     renderRepo(m.repo, '');
  else                 renderHome();
}

// ── Home ──────────────────────────────────────────────────────────────────────
const LANG_COLORS = {js:'#f1e05a',ts:'#3178c6',py:'#3572A5',go:'#00ADD8',rs:'#dea584',java:'#b07219',cs:'#178600',cpp:'#f34b7d',c:'#555555',rb:'#701516',php:'#4F5D95',html:'#e34c26',css:'#563d7c',scss:'#c6538c',md:'#083fa1',sh:'#89e051',swift:'#F05138',kt:'#A97BFF',vue:'#41b883',svelte:'#ff3e00'};
function langColor(name) { const ext = (name||'').split('.').pop().toLowerCase(); return LANG_COLORS[ext] || '#8b949e'; }
function topLang(files) { if(!files||!files.length) return null; const counts={}; files.forEach(f=>{if(f.type==='file'){const e=f.name.split('.').pop().toLowerCase();counts[e]=(counts[e]||0)+1;}}); return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||null; }

async function renderHome() {
  _allRepoCards = '';
  const app = document.getElementById('app');
  try {
    const [repos, activity, heatmap] = await Promise.all([
      api('GET', '/api/repos'),
      api('GET', '/api/activity?limit=20').catch(() => []),
      api('GET', '/api/heatmap').catch(() => ({}))
    ]);
    const totalCommits = Object.values(heatmap).reduce((a, b) => a + b, 0);
    const initials = (currentUser.username || '?').slice(0, 2).toUpperCase();

    // Sidebar repo list — only repos owned by the logged-in user
    const myRepos = repos.filter(r => !r.owner || r.owner === currentUser.username);
    const MAX_SIDEBAR = 7;
    const sidebarRepos = myRepos.slice(0, MAX_SIDEBAR);
    const sidebarItems = sidebarRepos.map(r => `
      <div class="sidebar-repo-item" onclick="navigate('/${r.name}')">
        <div class="sidebar-repo-dot">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8V1.5Z"/></svg>
        </div>
        <span class="sidebar-repo-name" title="${esc(r.name)}">${esc(r.owner||currentUser.username)}/<strong>${esc(r.name)}</strong></span>
      </div>`).join('');

    // Deterministic owner color
    function ownerColor(name) {
      const palette = ['#f97316','#3b82f6','#8b5cf6','#22c55e','#ec4899','#06b6d4','#eab308','#ef4444','#14b8a6','#a855f7','#84cc16','#f43f5e'];
      let h = 0; for (const c of name) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
      return palette[Math.abs(h) % palette.length];
    }

    // Build a feed card for a single repo
    function feedCard(r) {
      const owner  = r.owner || currentUser.username;
      const lang   = r.topLang || null;
      const langDot = lang ? (LANG_COLORS_MAP[lang] || '#8b949e') : null;
      const cnt    = r.commitCount || 0;
      const cntStr = cnt >= 1000 ? (cnt/1000).toFixed(1)+'k' : String(cnt);
      return `<div class="trending-item" onclick="navigate('/${r.name}')">
        <div class="trending-row">
          <div class="trending-left">
            <img class="gh-av gh-av-20" src="/api/avatar/${esc(owner)}" alt="${esc(owner)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="trending-owner-av" style="display:none;background:${ownerColor(owner)}">${esc(owner.slice(0,1).toUpperCase())}</div>
            <a class="trending-name" onclick="navigate('/${r.name}');event.stopPropagation()">${esc(owner)}/<strong>${esc(r.name)}</strong></a>
            <span id="sb-${esc(r.name)}" style="flex-shrink:0">${syncBadgeHtml(r.name)}</span>
          </div>
          <div class="trending-actions">
            <button class="trending-sync-icon" onclick="triggerSync('${esc(r.name)}',this);event.stopPropagation()" title="Sync from remote">
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M1.705 8.005a.75.75 0 0 1 .834.656 5.5 5.5 0 0 0 9.592 2.97l-1.204-1.204a.25.25 0 0 1 .177-.427h3.646a.25.25 0 0 1 .25.25v3.646a.25.25 0 0 1-.427.177l-1.38-1.38A7.002 7.002 0 0 1 1.05 8.84a.75.75 0 0 1 .656-.834ZM8 2.5a5.487 5.487 0 0 0-4.131 1.869l1.204 1.204A.25.25 0 0 1 4.896 6H1.25A.25.25 0 0 1 1 5.75V2.104a.25.25 0 0 1 .427-.177l1.38 1.38A7.002 7.002 0 0 1 14.95 7.16a.75.75 0 0 1-1.49.178A5.5 5.5 0 0 0 8 2.5Z"/></svg>
            </button>
            <button class="trending-star-btn" onclick="navigate('/${r.name}');event.stopPropagation()">
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>
              Star
              <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor"><path d="M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"/></svg>
            </button>
          </div>
        </div>
        ${r.description ? `<div class="trending-desc">${esc(r.description)}</div>` : ''}
        <div class="trending-meta">
          ${lang ? `<span class="trending-lang"><span class="trending-lang-dot" style="background:${langDot}"></span>${esc(lang)}</span>` : ''}
          ${cnt > 0 ? `<span class="trending-commits"><svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.07a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg> ${cntStr}</span>` : ''}
          ${r.lastCommit ? `<span class="trending-updated">Updated ${esc(r.lastCommit.relative)}</span>` : `<span style="color:var(--text-3)">No commits yet</span>`}
        </div>
      </div>`;
    }

    const trendingItems   = repos.slice(0, 2).map(feedCard).join('');
    const recommendedItem = repos[2] ? feedCard(repos[2]) : '';

    window._extraSidebarRepos = myRepos.slice(MAX_SIDEBAR).map(r => ({n: r.name, o: r.owner || currentUser.username}));

    const activityHtml = (activity||[]).slice(0,10).map(a => {
      const dotColor = {push:'blue',issue_open:'green',fork:'blue',clone:'blue',import:'blue'}[a.type]||'';
      const repo = esc(a.repo||'');
      const text = a.type==='push' ? `Pushed to ${repo}` :
                   a.type==='issue_open' ? `Opened issue in ${repo}` :
                   a.type==='fork' ? `Forked ${repo}` :
                   a.type==='clone' ? `Cloned ${repo}` :
                   a.type==='import' ? `Imported ${repo}` :
                   `${esc(a.type)} in ${repo}`;
      const rel = a.timestamp ? formatRelative(a.timestamp) : '';
      return `<div class="changelog-item"><div class="changelog-dot ${dotColor}"></div><div class="changelog-body"><div class="changelog-time">${rel}</div><div class="changelog-text" onclick="navigate('/${esc(a.repo||'')}')">${text}</div></div></div>`;
    }).join('') || '<p style="font-size:13px;color:var(--text-3);text-align:center;padding:12px 0">No recent activity</p>';

    // Commit-based changelog for right sidebar
    const changelogHtml = repos
      .filter(r => r.lastCommit)
      .sort((a, b) => new Date(b.lastCommit.date) - new Date(a.lastCommit.date))
      .slice(0, 6)
      .map((r, i) => {
        const owner = r.owner || currentUser.username;
        const dotColor = i === 0 ? 'blue' : i % 3 === 1 ? 'green' : '';
        const msg = r.lastCommit.message.slice(0, 60) + (r.lastCommit.message.length > 60 ? '…' : '');
        return `<div class="changelog-item">
          <div class="changelog-dot ${dotColor}"></div>
          <div class="changelog-body">
            <div class="changelog-time">${esc(r.lastCommit.relative)}</div>
            <div class="changelog-text" onclick="navigate('/${esc(r.name)}')">${esc(owner)}/<strong>${esc(r.name)}</strong></div>
            <div style="font-size:12px;color:var(--text-2);margin-top:2px;line-height:1.4">${esc(msg)}</div>
          </div>
        </div>`;
      }).join('') || '<p style="font-size:13px;color:var(--text-3);text-align:center;padding:12px 0">No recent commits</p>';

    app.innerHTML = `<div class="container-full">
      <div class="home-layout">
        <!-- Left Sidebar -->
        <aside class="home-sidebar">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <img class="gh-av gh-av-32" src="/api/avatar/${esc(currentUser.username)}" alt="${esc(initials)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" onclick="navigate('/profile')" style="cursor:pointer">
            <div class="sidebar-avatar" style="display:none">${esc(initials)}</div>
            <div>
              <div class="sidebar-name" onclick="navigate('/profile')" style="cursor:pointer" title="View profile">${esc(currentUser.username)}</div>
            </div>
          </div>
          <hr class="sidebar-divider">

          <div class="sidebar-section">
            <div class="sidebar-section-header">
              <span class="sidebar-section-label">Top repositories</span>
              <button class="btn btn-primary btn-sm" onclick="openModal('create-repo')" style="padding:2px 10px;font-size:12px">New</button>
            </div>
            <input class="sidebar-filter" placeholder="Find a repository…" oninput="filterSidebarRepos(this.value)" spellcheck="false">
            <div id="sidebar-repo-list">${sidebarItems}</div>
            ${myRepos.length > MAX_SIDEBAR ? `<a class="sidebar-show-more" onclick="showAllSidebarRepos(window._extraSidebarRepos)">Show ${myRepos.length - MAX_SIDEBAR} more →</a>` : ''}
          </div>

          <hr class="sidebar-divider">

          <div class="sidebar-section">
            <div class="sidebar-stat-row">
              <strong style="color:var(--text)">${myRepos.length}</strong>&nbsp;repositories &nbsp;·&nbsp; <strong style="color:var(--text)">${totalCommits}</strong>&nbsp;commits
            </div>
            ${buildHeatmap(heatmap)}
          </div>

          <hr class="sidebar-divider">
          <div style="font-size:13px;display:flex;flex-direction:column;gap:4px">
            <a style="color:var(--text-2);cursor:pointer;padding:3px 0;display:flex;align-items:center;gap:6px" onclick="openModal('add-user')">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.235A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z"/></svg>
              Manage users
            </a>
            <a style="color:var(--text-2);cursor:pointer;padding:3px 0;display:flex;align-items:center;gap:6px" onclick="navigate('/settings')">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.012 8.012 0 0 1-.704-1.218c-.315-.675-.111-1.422.364-1.891l.814-.806c.049-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.814-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
              Settings
            </a>
          </div>
        </aside>

        <!-- Main feed -->
        <main class="home-main">
          <h2 class="home-heading">Home</h2>

          <!-- Quick action buttons -->
          <div class="home-quick-btns">
            <button class="home-quick-btn" onclick="openModal('create-repo')">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M9.504.43a1.516 1.516 0 0 1 2.437 1.713L10.415 5.5h2.123c1.57 0 2.454 1.866 1.486 3.046L9.863 14.886a1.516 1.516 0 0 1-2.709-.706l-.371-2.972-1.053 1.88a1.516 1.516 0 0 1-2.462-1.76L4.61 9.5H2.48c-1.57 0-2.453-1.866-1.486-3.046L6.14 1.114A1.515 1.515 0 0 1 7.849.43L6.942 3.5h1.516L9.504.43Z"/></svg>
              New repo
            </button>
            <button class="home-quick-btn" onclick="createIssueFromHome()">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/></svg>
              Create issue
            </button>
            <button class="home-quick-btn" onclick="openModal('clone-url')">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688Z"/></svg>
              Write code
            </button>
            <button class="home-quick-btn" onclick="toggleTerminal()">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>
              Git
            </button>
            <button class="home-quick-btn" onclick="triggerSyncAll()">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/></svg>
              Pull requests
            </button>
          </div>

          ${repos.length === 0 ? `
            <div class="info-box">
              <svg style="width:48px;height:48px;fill:var(--border);margin:0 auto 16px;display:block" viewBox="0 0 16 16">${ICONS.repo}</svg>
              <p style="font-size:18px;font-weight:400;color:var(--text);margin-bottom:8px">No repositories yet</p>
              <p style="margin-bottom:20px;color:var(--text-2)">Create your first repository to get started with Forge.</p>
              <button class="btn btn-primary" onclick="openModal('create-repo')">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/></svg>
                New repository
              </button>
            </div>` : `
            <div class="feed-page-header">
              <span>Feed</span>
              <button class="btn btn-ghost btn-sm" onclick="triggerSyncAll()" style="font-size:12px">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M.75 3h14.5a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1 0-1.5ZM3 7.75A.75.75 0 0 1 3.75 7h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 3 7.75Zm3 4a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"/></svg>
                Filter
              </button>
            </div>

            <div class="trending-list">
              <div class="trending-section-hd">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.5 1.75a.75.75 0 0 0-1.5 0v12.5c0 .414.336.75.75.75h14.5a.75.75 0 0 0 0-1.5H1.5V1.75Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 3.28 10.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l4.25-4.25a.75.75 0 0 1 1.06 0L9 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"/></svg>
                Trending repositories
                <span class="trending-list-sep">·</span>
                <a class="trending-list-see-more" onclick="navigate('/')">See more</a>
              </div>
              ${trendingItems}
            </div>

            ${recommendedItem ? `
            <div class="trending-list" style="margin-top:16px">
              <div class="trending-section-hd">
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>
                Recommended for you
              </div>
              ${recommendedItem}
            </div>` : ''}`}
        </main>

        <!-- Right sidebar -->
        <aside class="home-right">
          <div class="changelog-title">Latest from our changelog</div>
          ${changelogHtml}
          <a class="changelog-more" onclick="navigate('/profile')">View changelog →</a>
        </aside>
      </div>
    </div>`;
  } catch(err) { app.innerHTML = `<div class="container"><div class="alert alert-error">${esc(err.message)}</div></div>`; }
}

function createIssueFromHome() {
  const item = document.querySelector('#sidebar-repo-list .sidebar-repo-item');
  if (!item) { toast('Create a repository first', 'info'); return; }
  const onclick = item.getAttribute('onclick') || '';
  const m = onclick.match(/'\/([^']+)'/);
  if (m) { pendingIssueRepo = m[1]; openModal('create-issue'); }
  else { toast('Select a repository first', 'info'); }
}

function filterSidebarRepos(q) {
  document.querySelectorAll('#sidebar-repo-list .sidebar-repo-item').forEach(el => {
    const name = el.querySelector('.sidebar-repo-name')?.textContent || '';
    el.style.display = (!q || name.toLowerCase().includes(q.toLowerCase())) ? '' : 'none';
  });
}

function showAllSidebarRepos(items) {
  const list = document.getElementById('sidebar-repo-list');
  if (!list) return;
  list.innerHTML += items.map(({n, o}) => `
    <div class="sidebar-repo-item" onclick="navigate('/${esc(n)}')">
      <div class="sidebar-repo-dot"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8V1.5Z"/></svg></div>
      <span class="sidebar-repo-name">${esc(o)}/<strong>${esc(n)}</strong></span>
    </div>`).join('');
  event.target.remove();
}

function filterRepoList(q) {
  document.querySelectorAll('.repo-list-item').forEach(el => {
    const name = el.querySelector('.repo-list-name')?.textContent || '';
    const desc = el.querySelector('.repo-list-desc')?.textContent || '';
    el.style.display = (!q || name.toLowerCase().includes(q.toLowerCase()) || desc.toLowerCase().includes(q.toLowerCase())) ? '' : 'none';
  });
}

function buildHeatmap(data) {
  const today = new Date(); const weeks = [];
  for (let w = 51; w >= 0; w--) {
    const days = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(today); date.setDate(date.getDate() - (w*7 + d));
      const key = date.toISOString().slice(0,10);
      const count = data[key] || 0;
      const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
      days.push(`<div class="heatmap-cell heatmap-${level}" title="${key}: ${count} commit${count!==1?'s':''}"></div>`);
    }
    weeks.push(`<div class="heatmap-week">${days.join('')}</div>`);
  }
  const total = Object.values(data).reduce((a,b) => a+b, 0);
  return `<div class="heatmap-wrap">
    <div class="heatmap-title">${total} commits in the last year</div>
    <div class="heatmap-grid">${weeks.join('')}</div>
    <div class="heatmap-legend">Less <div class="heatmap-cell heatmap-0"></div><div class="heatmap-cell heatmap-1"></div><div class="heatmap-cell heatmap-2"></div><div class="heatmap-cell heatmap-3"></div><div class="heatmap-cell heatmap-4"></div> More</div>
  </div>`;
}

function renderActivityItem(a) {
  const dots = { issue_open:'green', fork:'indigo', clone:'orange', import:'yellow', push:'orange' };
  const dot = dots[a.type] || 'indigo';
  let text = '';
  if (a.type === 'issue_open') text = `<strong>${esc(a.user)}</strong> opened issue <strong>#${a.issueId}</strong> in <strong>${esc(a.repo)}</strong>: ${esc((a.title||'').slice(0,50))}`;
  else if (a.type === 'fork') text = `<strong>${esc(a.user)}</strong> forked <strong>${esc(a.forkedFrom)}</strong> → <strong>${esc(a.repo)}</strong>`;
  else if (a.type === 'clone') text = `<strong>${esc(a.user)}</strong> cloned <strong>${esc(a.repo)}</strong>`;
  else if (a.type === 'import') text = `<strong>${esc(a.user)}</strong> imported <strong>${esc(a.repo)}</strong>`;
  else text = `${esc(a.type)} on <strong>${esc(a.repo||'')}</strong>`;
  const rel = a.timestamp ? formatRelative(a.timestamp) : '';
  return `<div class="activity-item"><div class="activity-dot activity-dot-${dot}"></div><div class="activity-text">${text}</div><div class="activity-time">${rel}</div></div>`;
}

// ── Language color map ────────────────────────────────────────────────────────
const LANG_COLORS_MAP = {'JavaScript':'#f1e05a','TypeScript':'#3178c6','Python':'#3572A5','Ruby':'#701516','Go':'#00ADD8','Rust':'#dea584','C':'#555555','C++':'#f34b7d','C#':'#178600','Java':'#b07219','PHP':'#4F5D95','HTML':'#e34c26','CSS':'#563d7c','SCSS':'#c6538c','Shell':'#89e051','Swift':'#F05138','Kotlin':'#A97BFF','Vue':'#41b883','Svelte':'#ff3e00','Markdown':'#083fa1','Lua':'#000080','Dart':'#00B4AB','R':'#276DC3','CMake':'#DA3434','HCL':'#844FBA','Elixir':'#6e4a7e','Haskell':'#5e5086','Scala':'#c22d40','GraphQL':'#e10098','Astro':'#ff5a03','Makefile':'#427819','Dockerfile':'#384d54','JSON':'#6b737c','YAML':'#cb171e','TOML':'#9c4221'};

// ── Repo view ─────────────────────────────────────────────────────────────────
async function renderRepo(name, subPath) {
  currentRepo = name; setTerminalCtx(name);
  const appEl = document.getElementById('app');
  try {
    const [info, files, issues] = await Promise.all([
      api('GET', `/api/repos/${name}`),
      api('GET', `/api/repos/${name}/tree/${subPath}`).catch(() => []),
      api('GET', `/api/repos/${name}/issues?state=open`).catch(() => []),
    ]);
    currentBranch = info.currentBranch || 'main';
    currentRemote = (info.remotes && info.remotes[0]) ? info.remotes[0].name : 'origin';
    if (info.owner) _repoOwnerCache[name] = info.owner;

    const owner      = info.owner || currentUser.username;
    const ownerInit  = owner.slice(0, 2).toUpperCase();
    const isOwner    = !info.owner || info.owner === currentUser.username;
    const cloneUrl   = `${location.origin}/repos/${name}`;
    const latestCommit = info.commits[0];
    const hasFiles   = files.length > 0;
    const readmeFile = !subPath && files.find(f => /^readme\.md$/i.test(f.name) && f.type === 'file');

    // Sub-path breadcrumb
    const crumbParts = subPath ? subPath.split('/').filter(Boolean) : [];
    const crumbHtml  = crumbParts.map((part, i) => {
      const partPath = crumbParts.slice(0, i + 1).join('/');
      return `<span class="gh-breadcrumb-sep">/</span><span class="gh-breadcrumb-sub" onclick="navigate('/${name}/tree/${partPath}')" style="cursor:pointer;color:var(--accent);font-size:18px">${esc(part)}</span>`;
    }).join('');

    // File rows
    const parentRow = subPath ? `<div class="gh-file-row" onclick="navigate('/${name}${getParentPath(subPath)}')"><div class="gh-file-icon-dir">${ICONS.dir}</div><div class="gh-file-name-cell">..</div><div></div><div></div></div>` : '';
    const fileRows  = files.map(f => {
      const isDir = f.type === 'dir';
      const ic   = isDir ? `<div class="gh-file-icon-dir">${ICONS.dir}</div>` : `<div class="gh-file-icon-file" style="color:${langColor(f.name)}">${ICONS.file}</div>`;
      const href = isDir ? `navigate('/${name}/tree/${f.path}')` : `navigate('/${name}/blob/${f.path}')`;
      return `<div class="gh-file-row" onclick="${href}">${ic}<div class="gh-file-name-cell">${esc(f.name)}</div><div class="gh-file-msg-cell">${f.lastCommit?esc(f.lastCommit.message):''}</div><div class="gh-file-date-cell">${f.lastCommit?esc(f.lastCommit.relative):''}</div></div>`;
    }).join('');

    const authorInit = latestCommit ? (latestCommit.author||'?').slice(0,2).toUpperCase() : '';
    const statusBadge = info.status?.isClean
      ? `<span style="display:flex;align-items:center;gap:5px;font-size:13px;color:var(--green)"><span class="status-dot status-clean"></span>Clean</span>`
      : info.status ? `<span style="font-size:13px;color:var(--yellow)">Modified</span>` : '';

    appEl.innerHTML = `<div class="gh-repo-page">

      <!-- Repo header + tab nav -->
      <div class="gh-repo-header">
        <div class="gh-repo-title-row">
          <div class="gh-repo-title">
            <img class="gh-av gh-av-20" src="/api/avatar/${esc(owner)}" alt="${esc(ownerInit)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="gh-owner-avatar" style="display:none">${esc(ownerInit)}</div>
            <span class="gh-breadcrumb-owner" onclick="navigate('/')">${esc(owner)}</span>
            <span class="gh-breadcrumb-sep">/</span>
            <span class="gh-breadcrumb-repo" onclick="navigate('/${name}')">${esc(name)}</span>
            ${crumbHtml}
            <span class="gh-visibility-badge">Public</span>
          </div>
          <div class="gh-repo-actions">
            <button class="gh-action-btn" onclick="openPushPull('${esc(name)}','pull',${JSON.stringify(info.remotes||[])},'${esc(info.currentBranch)}')">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M7.25 1.75a.75.75 0 0 1 1.5 0v5.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22V1.75ZM1.5 9.25a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 12.75 13.5h-9.5A1.75 1.75 0 0 1 1.5 11.75v-2.5Z"/></svg>
              Pull
            </button>
            <button class="gh-action-btn" ${!isOwner?'disabled':''} ${isOwner?`onclick="openPushPull('${esc(name)}','push',${JSON.stringify(info.remotes||[])},'${esc(info.currentBranch)}')"`:''}">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8.75 1.75a.75.75 0 0 0-1.5 0v5.19L5.03 4.72a.75.75 0 0 0-1.06 1.06l3.5 3.5a.75.75 0 0 0 1.06 0l3.5-3.5a.75.75 0 0 0-1.06-1.06L8.75 6.94V1.75ZM1.5 9.25a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 12.75 13.5h-9.5A1.75 1.75 0 0 1 1.5 11.75v-2.5Z"/></svg>
              Push
            </button>
            <button class="gh-action-btn" onclick="openRepoSettings('${esc(name)}','${esc(info.description||'')}')">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.038.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.012 8.012 0 0 1-.704-1.218c-.315-.675-.111-1.422.364-1.891l.814-.806c.049-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c.01-.147-.038-.246-.088-.294l-.814-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.009.645 6.556.095 7.299.03 7.53.01 7.764 0 8 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
              Settings
            </button>
          </div>
        </div>

        <nav class="gh-tab-nav">
          <button class="gh-tab-item active">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Zm7.47 3.97a.75.75 0 0 1 1.06 1.06L9.06 8l1.22 1.22a.75.75 0 1 1-1.06 1.06l-1.75-1.75a.75.75 0 0 1 0-1.06Zm-4.94 1.06a.75.75 0 0 1 1.06-1.06l1.75 1.75a.75.75 0 0 1 0 1.06l-1.75 1.75a.75.75 0 1 1-1.06-1.06L5.44 8Z"/></svg>
            Code
          </button>
          <button class="gh-tab-item" onclick="navigate('/${name}/issues')">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/></svg>
            Issues <span class="gh-tab-count">${issues.length}</span>
          </button>
          <button class="gh-tab-item" onclick="navigate('/${name}/commits')">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.07a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>
            Commits <span class="gh-tab-count">${info.totalCommits}</span>
          </button>
          <button class="gh-tab-item" onclick="navigate('/${name}/branches')">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Z"/></svg>
            Branches <span class="gh-tab-count">${info.branches.length||1}</span>
          </button>
          <button class="gh-tab-item" onclick="navigate('/${name}/tags')">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775Z"/></svg>
            Tags
          </button>
          <button class="gh-tab-item" onclick="navigate('/${name}/stash')">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.75 1h12.5c.966 0 1.75.784 1.75 1.75v3c0 .378-.118.727-.318 1.015A1.75 1.75 0 0 1 16 8.75v3c0 .966-.784 1.75-1.75 1.75H1.75A1.75 1.75 0 0 1 0 11.75v-3c0-.567.27-1.072.682-1.395A1.75 1.75 0 0 1 0 5.75v-3C0 1.784.784 1 1.75 1Z"/></svg>
            Stash
          </button>
          <button class="gh-tab-item" onclick="navigate('/${name}/graph')">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.5 1.75a.75.75 0 0 0-1.5 0v12.5c0 .414.336.75.75.75h14.5a.75.75 0 0 0 0-1.5H1.5V1.75Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 3.28 10.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l4.25-4.25a.75.75 0 0 1 1.06 0L9 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"/></svg>
            Graph
          </button>
        </nav>
      </div>

      <!-- Body -->
      <div class="gh-repo-body">
        <!-- Main: file browser + readme -->
        <div>
          ${hasFiles || subPath ? `
          <div class="gh-file-browser">
            <div class="gh-file-toolbar">
              <button class="gh-branch-btn">
                <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Z"/></svg>
                ${esc(info.currentBranch)}
                <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor" style="margin-left:2px"><path d="M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"/></svg>
              </button>
              <a class="gh-toolbar-link" onclick="navigate('/${name}/branches')">${info.branches.length||1} Branch${(info.branches.length||1)===1?'':'es'}</a>
              <div class="gh-toolbar-sep"></div>
              <a class="gh-toolbar-link" onclick="navigate('/${name}/tags')">0 Tags</a>
              <div class="gh-toolbar-spacer"></div>
              <button class="btn btn-ghost btn-sm" onclick="openCreateFile('${esc(name)}','${esc(subPath||'')}')">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/></svg>
                Add file
              </button>
              <div class="gh-code-wrap">
                <button class="gh-code-btn" onclick="toggleClonePopup()">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0 1 14.25 16H1.75A1.75 1.75 0 0 1 0 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V1.75a.25.25 0 0 0-.25-.25Z"/></svg>
                  Code
                  <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor"><path d="M4.427 7.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 0 11.396 7H4.604a.25.25 0 0 0-.177.427Z"/></svg>
                </button>
                <div class="gh-clone-popup" id="clone-popup" style="display:none">
                  <div class="gh-clone-popup-header">
                    <button class="gh-clone-tab active">HTTPS</button>
                    <button class="gh-clone-tab" onclick="toast('SSH not configured on Forge')">SSH</button>
                  </div>
                  <div class="gh-clone-body">
                    <p style="font-size:12px;color:var(--text-2);margin-bottom:8px">Clone using the web URL.</p>
                    <div class="gh-clone-url-row">
                      <input class="gh-clone-url-inp" readonly value="${esc('git clone ' + cloneUrl)}" onclick="this.select()">
                      <button class="clone-url-copy-btn" onclick="navigator.clipboard.writeText('git clone ${esc(cloneUrl)}');toast('Copied!')">Copy</button>
                    </div>
                    <hr style="border:none;border-top:1px solid var(--border);margin:10px 0">
                    <a href="/api/repos/${name}/export.zip" style="font-size:13px;color:var(--accent);display:flex;align-items:center;gap:6px;text-decoration:none">
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M7.25 1.75a.75.75 0 0 1 1.5 0v5.19l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22V1.75ZM1.5 9.25a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 12.75 13.5h-9.5A1.75 1.75 0 0 1 1.5 11.75v-2.5Z"/></svg>
                      Download ZIP
                    </a>
                  </div>
                </div>
              </div>
            </div>

            ${latestCommit ? `<div class="gh-commit-row">
              <div class="gh-commit-author-avatar">${esc(authorInit)}</div>
              <strong class="gh-commit-author">${esc(latestCommit.author||'')}</strong>
              <span class="gh-commit-msg-inline">${esc(latestCommit.message)}</span>
              <code class="gh-commit-hash" onclick="navigator.clipboard.writeText('${esc(latestCommit.fullHash)}');toast('Hash copied!')" title="${esc(latestCommit.fullHash)}">${esc(latestCommit.hash)}</code>
              <span class="gh-commit-age">· ${esc(latestCommit.relative)}</span>
              <a class="gh-commit-count-link" onclick="navigate('/${name}/commits')">
                <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.07a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>
                ${info.totalCommits} Commits
              </a>
            </div>` : ''}

            <div>${parentRow}${fileRows}</div>
          </div>` : `
          <div class="info-box" style="margin-bottom:16px">
            <svg style="width:48px;height:48px;fill:var(--border);margin:0 auto 16px;display:block" viewBox="0 0 16 16">${ICONS.repo}</svg>
            <p style="font-size:18px;font-weight:400;color:var(--text);margin-bottom:8px">This repository is empty.</p>
            <p style="margin-bottom:20px">Get started by creating your first file.</p>
            <button class="btn btn-primary" onclick="openCreateFile('${esc(name)}','')">
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M7.75 2a.75.75 0 0 1 .75.75V7h4.25a.75.75 0 0 1 0 1.5H8.5v4.25a.75.75 0 0 1-1.5 0V8.5H2.75a.75.75 0 0 1 0-1.5H7V2.75A.75.75 0 0 1 7.75 2Z"/></svg>
              Create new file
            </button>
          </div>`}

          <div id="drop-zone-container"></div>
          <div id="readme-area"></div>
        </div>

        <!-- About sidebar -->
        <aside class="gh-about">
          <h2 class="gh-about-heading">About</h2>
          ${info.description
            ? `<p class="gh-about-desc">${esc(info.description)}</p>`
            : `<p class="gh-about-no-desc">No description provided. — <a onclick="openRepoSettings('${esc(name)}','')" style="cursor:pointer">Edit</a></p>`}

          <div class="gh-stat-list">
            <div class="gh-stat-item" onclick="navigate('/${name}/commits')">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.07a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>
              <strong>${info.totalCommits}</strong> commit${info.totalCommits===1?'':'s'}
            </div>
            <div class="gh-stat-item" onclick="navigate('/${name}/branches')">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.492 2.492 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Z"/></svg>
              <strong>${info.branches.length||1}</strong> branch${(info.branches.length||1)===1?'':'es'}
            </div>
            <div class="gh-stat-item" onclick="navigate('/${name}/issues')">
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/></svg>
              <strong>${issues.length}</strong> open issue${issues.length===1?'':'s'}
            </div>
            ${statusBadge ? `<div class="gh-stat-item">${statusBadge}</div>` : ''}
            ${!isOwner ? `<div class="gh-stat-item" style="color:var(--text-3)"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.235A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5Z"/></svg> Owned by <strong style="color:var(--text)">${esc(info.owner)}</strong></div>` : ''}
          </div>

          <hr class="gh-about-divider">

          <div style="margin-bottom:16px">
            <h3 class="gh-about-section-title">Releases</h3>
            <p class="gh-about-empty">No releases published.<br><a onclick="navigate('/${name}/tags')" style="cursor:pointer">Create a new release</a></p>
          </div>

          <hr class="gh-about-divider">

          <div id="contributors-section" style="margin-bottom:16px">
            <h3 class="gh-about-section-title">Contributors <span>…</span></h3>
          </div>

          <hr class="gh-about-divider">

          <div id="languages-section" style="margin-bottom:16px">
            <h3 class="gh-about-section-title">Languages <span>…</span></h3>
          </div>

          <hr class="gh-about-divider">

          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="openWebhooks('${esc(name)}')" style="width:100%;justify-content:flex-start;gap:8px">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">${ICONS.webhook}</svg> Webhooks
            </button>
            <button class="btn btn-ghost btn-sm" onclick="openRemotes('${esc(name)}')" style="width:100%;justify-content:flex-start;gap:8px">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">${ICONS.link}</svg> Remotes
            </button>
            ${isOwner ? `<button class="btn btn-ghost btn-sm" onclick="rewriteAuthors('${esc(name)}')" style="width:100%;justify-content:flex-start;gap:8px;color:var(--yellow)">✎ Rewrite authors</button>` : ''}
          </div>
        </aside>
      </div>
    </div>`;

    setupDropZone(name, subPath);

    // README async
    if (readmeFile) {
      api('GET', `/api/repos/${name}/blob/${readmeFile.path}`).then(blob => {
        const el = document.getElementById('readme-area');
        if (el) el.innerHTML = `<div class="readme-box"><div class="readme-header">${ICONS.book} README.md</div><div class="readme-body">${renderMarkdown(blob.content)}</div></div>`;
        if (window.Prism) setTimeout(() => Prism.highlightAll(), 50);
      }).catch(() => {});
    }

    // Languages async
    api('GET', `/api/repos/${name}/languages`).then(langs => {
      const el = document.getElementById('languages-section');
      if (!el) return;
      if (!langs.length) { el.innerHTML = '<h3 class="gh-about-section-title">Languages</h3><p class="gh-about-empty">No language data.</p>'; return; }
      const bar  = langs.map(l => `<div class="lang-bar-seg" style="flex:${l.pct};background:${LANG_COLORS_MAP[l.name]||'#8b949e'}" title="${esc(l.name)} ${l.pct}%"></div>`).join('');
      const list = langs.map(l => `<div class="lang-item"><span class="lang-dot-sm" style="background:${LANG_COLORS_MAP[l.name]||'#8b949e'}"></span><span class="lang-item-name">${esc(l.name)}</span><span class="lang-item-pct">${l.pct}%</span></div>`).join('');
      el.innerHTML = `<h3 class="gh-about-section-title">Languages</h3><div class="languages-bar" style="margin-bottom:10px">${bar}</div><div class="lang-list">${list}</div>`;
    }).catch(() => {});

    // Contributors from commit log
    (() => {
      const el = document.getElementById('contributors-section');
      if (!el) return;
      const authors = {};
      (info.commits || []).forEach(c => { if (c.author) authors[c.author] = (authors[c.author]||0)+1; });
      const contribs = Object.entries(authors).sort((a,b)=>b[1]-a[1]).slice(0,8);
      if (!contribs.length) { el.innerHTML = '<h3 class="gh-about-section-title">Contributors</h3><p class="gh-about-empty">No commits yet.</p>'; return; }
      const chips = contribs.map(([a,n]) => `<div class="contrib-chip" title="${esc(a)} · ${n} commit${n>1?'s':''}"><div class="contrib-av">${esc(a.slice(0,2).toUpperCase())}</div><span>${esc(a)}</span></div>`).join('');
      el.innerHTML = `<h3 class="gh-about-section-title">Contributors <span>${contribs.length}</span></h3><div class="contrib-grid">${chips}</div>`;
    })();

  } catch(err) { appEl.innerHTML = `<div class="container"><div class="alert alert-error">${esc(err.message)}</div></div>`; }
}

function toggleClonePopup() {
  const p = document.getElementById('clone-popup');
  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
}
document.addEventListener('click', e => {
  const p = document.getElementById('clone-popup');
  const w = p?.closest('.gh-code-wrap');
  if (p && w && !w.contains(e.target)) p.style.display = 'none';
});

function setupDropZone(name, subPath) {
  const c = document.getElementById('drop-zone-container'); if (!c) return;
  c.innerHTML = `<div class="drop-zone" id="drop-zone" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="handleDrop(event,'${esc(name)}','${esc(subPath||'')}')">
    ${ICONS.upload}<span>Drop files here to upload and commit</span></div>`;
}

async function handleDrop(e, name, subPath) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files);
  if (!files.length) return;
  const fd = new FormData();
  files.forEach(f => fd.append('files', f));
  fd.append('subPath', subPath || '');
  fd.append('message', `Upload ${files.length} file(s) via browser`);
  try {
    const r = await fetch(`/api/repos/${name}/upload`, { method:'POST', body: fd });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    toast(`Uploaded ${data.files.length} file(s)!`);
    renderRepo(name, subPath);
  } catch(err) { toast(err.message, 'error'); }
}

function setTab(tab, btn, name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderRepo(name, '');
}
function getParentPath(p) { const parts = p.split('/').filter(Boolean); parts.pop(); return parts.length ? '/tree/' + parts.join('/') : ''; }

// ── Commits ───────────────────────────────────────────────────────────────────
async function renderCommits(name) {
  currentRepo = name; setTerminalCtx(name);
  const app = document.getElementById('app');
  try {
    const info = await api('GET', `/api/repos/${name}`);
    app.innerHTML = `<div class="container">${repoNav(name)}
      <div class="tabs"><button class="tab" onclick="navigate('/${name}')">${icon('code')} Code</button><button class="tab active">${icon('commit')} Commits <span class="tab-badge">${info.totalCommits}</span></button></div>
      ${buildCommitList(info.commits)||'<div class="info-box"><p>No commits yet.</p></div>'}
    </div>`;
  } catch(e) { app.innerHTML = err(e); }
}

function buildCommitList(commits) {
  if (!commits?.length) return '';
  const groups = {};
  commits.forEach(c => { const d = new Date(c.date).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}); (groups[d]||(groups[d]=[])).push(c); });
  return Object.entries(groups).map(([date,cs]) => `
    <div class="commit-group">
      <div class="commit-group-header">Commits on ${date}</div>
      <div class="commit-list">
        ${cs.map(c=>`<div class="commit-item"><div class="commit-main"><div class="commit-msg">${esc(c.message)}</div><div class="commit-sub">${esc(c.author||'Unknown')} committed ${esc(c.relative)}</div></div><span class="commit-hash-btn" title="${esc(c.fullHash)}">${esc(c.hash)}</span></div>`).join('')}
      </div>
    </div>`).join('');
}

// ── Issues ────────────────────────────────────────────────────────────────────
async function renderIssues(name) {
  currentRepo = name; setTerminalCtx(name);
  const app = document.getElementById('app');
  try {
    const [open, closed] = await Promise.all([api('GET',`/api/repos/${name}/issues?state=open`), api('GET',`/api/repos/${name}/issues?state=closed`)]);
    let showClosed = false;
    const renderList = (issues, state) => issues.length ? issues.map(i => `
      <div class="issue-row issue-${state}" onclick="navigate('/${name}/issues/${i.id}')">
        <div class="issue-icon">${ICONS.issue}</div>
        <div class="issue-body">
          <div class="issue-title">${esc(i.title)} ${(i.labels||[]).map(l=>`<span class="issue-label">${esc(l)}</span>`).join('')}</div>
          <div class="issue-meta">#${i.id} opened ${formatRelative(i.createdAt)} by ${esc(i.author||'unknown')}</div>
        </div>
        <span style="font-size:12px;color:var(--text-3)">${(i.comments||[]).length} 💬</span>
      </div>`).join('') : `<div style="padding:20px 16px;text-align:center;color:var(--text-2);font-size:13px">No ${state} issues.</div>`;

    app.innerHTML = `<div class="container">${repoNav(name)}
      <div class="section-header">
        <div class="issue-tabs">
          <button class="issue-tab active" onclick="showIssueState(false)">◉ Open (${open.length})</button>
          <button class="issue-tab" onclick="showIssueState(true)">✓ Closed (${closed.length})</button>
        </div>
        <button class="btn btn-primary btn-sm" onclick="openIssueModal('${esc(name)}')">${icon('plus')} New issue</button>
      </div>
      <div id="issue-open-list" class="issue-list">${renderList(open,'open')}</div>
      <div id="issue-closed-list" class="issue-list" style="display:none">${renderList(closed,'closed')}</div>
    </div>`;
  } catch(e) { app.innerHTML = err(e); }
}

window.showIssueState = (closed) => {
  document.getElementById('issue-open-list').style.display = closed ? 'none' : '';
  document.getElementById('issue-closed-list').style.display = closed ? '' : 'none';
  document.querySelectorAll('.issue-tab').forEach((t,i) => t.classList.toggle('active', i === (closed?1:0)));
};

async function renderIssueDetail(name, id) {
  currentRepo = name; setTerminalCtx(name);
  const app = document.getElementById('app');
  try {
    const issues = await api('GET', `/api/repos/${name}/issues`);
    const issue = issues.find(i => i.id === id);
    if (!issue) { app.innerHTML = `<div class="container"><div class="alert alert-error">Issue not found</div></div>`; return; }
    const isOpen = issue.state === 'open';
    app.innerHTML = `<div class="container">${repoNav(name)}
      <button class="back-btn" onclick="navigate('/${name}/issues')">${ICONS.arrow} Back to issues</button>
      <div class="issue-detail">
        <div class="issue-detail-title">${esc(issue.title)} <span style="color:var(--text-2);font-weight:400">#${issue.id}</span></div>
        <div style="margin-bottom:12px">${(issue.labels||[]).map(l=>`<span class="issue-label">${esc(l)}</span>`).join('')}
          <span style="font-size:12px;color:var(--text-2);margin-left:4px">Opened ${formatRelative(issue.createdAt)} by ${esc(issue.author||'unknown')}</span>
        </div>
        ${issue.body ? `<div class="readme-body" style="border:1px solid var(--border);border-radius:6px;padding:14px;margin-bottom:16px">${renderMarkdown(issue.body)}</div>` : ''}
        <div style="display:flex;gap:8px;margin-bottom:20px">
          <button class="btn btn-${isOpen?'ghost':'primary'} btn-sm" onclick="toggleIssue('${name}',${id},'${isOpen?'closed':'open'}')">${isOpen?'✓ Close issue':'↺ Reopen issue'}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteIssueAction('${name}',${id})">Delete</button>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:10px">Comments (${(issue.comments||[]).length})</div>
        ${(issue.comments||[]).map(c=>`<div class="issue-comment"><div class="issue-comment-header"><strong>${esc(c.author)}</strong> · ${formatRelative(c.createdAt)}</div><div>${esc(c.body)}</div></div>`).join('')}
        <div style="margin-top:16px">
          <textarea class="form-textarea" id="comment-body" rows="4" placeholder="Leave a comment..."></textarea>
          <div style="margin-top:8px"><button class="btn btn-primary btn-sm" onclick="postComment('${name}',${id})">Comment</button></div>
        </div>
      </div>
    </div>`;
  } catch(e) { app.innerHTML = err(e); }
}

async function toggleIssue(name, id, state) {
  try { await api('PATCH', `/api/repos/${name}/issues/${id}`, { state }); navigate(`/${name}/issues/${id}`); } catch(e) { toast(e.message,'error'); }
}
async function deleteIssueAction(name, id) {
  try { await api('DELETE', `/api/repos/${name}/issues/${id}`); navigate(`/${name}/issues`); } catch(e) { toast(e.message,'error'); }
}
async function postComment(name, id) {
  const body = document.getElementById('comment-body').value.trim();
  if (!body) return;
  try { await api('PATCH', `/api/repos/${name}/issues/${id}`, { comment: body }); navigate(`/${name}/issues/${id}`); } catch(e) { toast(e.message,'error'); }
}
function openIssueModal(name) {
  pendingIssueRepo = name; pendingIssueId = null;
  document.getElementById('issue-title').value = '';
  document.getElementById('issue-labels').value = '';
  document.getElementById('issue-body').value = '';
  document.getElementById('issue-modal-title').textContent = 'New issue';
  document.getElementById('create-issue-error').style.display = 'none';
  openModal('create-issue');
  setTimeout(() => document.getElementById('issue-title').focus(), 50);
}
async function submitIssue() {
  const title = document.getElementById('issue-title').value.trim();
  const body = document.getElementById('issue-body').value.trim();
  const labels = document.getElementById('issue-labels').value.split(',').map(s=>s.trim()).filter(Boolean);
  const btn = document.getElementById('create-issue-btn');
  if (!title) { showModalError('create-issue','Title is required'); return; }
  btn.disabled = true; btn.textContent = 'Submitting…';
  try {
    const issue = await api('POST', `/api/repos/${pendingIssueRepo}/issues`, { title, body, labels });
    closeModal('create-issue');
    toast(`Issue #${issue.id} created`);
    navigate(`/${pendingIssueRepo}/issues/${issue.id}`);
  } catch(e) { showModalError('create-issue', e.message); btn.disabled=false; btn.textContent='Submit issue'; }
}

// ── Branches ──────────────────────────────────────────────────────────────────
async function renderBranches(name) {
  currentRepo = name; setTerminalCtx(name);
  const app = document.getElementById('app');
  try {
    const data = await api('GET', `/api/repos/${name}/branches`);
    const rows = data.branches.map(b => `
      <div class="branch-row">
        <div class="branch-name">${esc(b.name)} ${b.current?'<span class="branch-current-badge">current</span>':''}</div>
        <div class="branch-hash">${esc(b.commit?.slice(0,7)||'')}</div>
        <div class="branch-actions">
          ${!b.current?`<button class="btn btn-outline btn-sm" onclick="checkoutBranch('${name}','${esc(b.name)}')">Switch</button>`:''}
          ${!b.current?`<button class="btn btn-danger btn-sm" onclick="deleteBranch('${name}','${esc(b.name)}')">Delete</button>`:''}
        </div>
      </div>`).join('');
    app.innerHTML = `<div class="container">${repoNav(name)}
      <div class="section-header"><div class="section-title">Branches</div>
        <button class="btn btn-primary btn-sm" onclick="openBranchModal('${name}')">${icon('plus')} New branch</button>
      </div>
      <div class="branch-list">${rows||'<div style="padding:16px;color:var(--text-2)">No branches found.</div>'}</div>
    </div>`;
  } catch(e) { app.innerHTML = err(e); }
}
function openBranchModal(name) {
  pendingBranchRepo = name;
  document.getElementById('branch-name').value = '';
  document.getElementById('branch-from').value = '';
  document.getElementById('create-branch-error').style.display = 'none';
  openModal('create-branch');
  setTimeout(() => document.getElementById('branch-name').focus(), 50);
}
async function submitBranch() {
  const name = document.getElementById('branch-name').value.trim();
  const from = document.getElementById('branch-from').value.trim();
  const btn = document.getElementById('create-branch-btn');
  if (!name) { showModalError('create-branch','Branch name required'); return; }
  btn.disabled=true; btn.textContent='Creating…';
  try { await api('POST',`/api/repos/${pendingBranchRepo}/branches`,{name,from}); closeModal('create-branch'); toast(`Branch "${name}" created`); navigate(`/${pendingBranchRepo}/branches`); }
  catch(e) { showModalError('create-branch',e.message); btn.disabled=false; btn.textContent='Create branch'; }
}
async function checkoutBranch(repo, branch) {
  try { await api('POST',`/api/repos/${repo}/checkout`,{branch}); toast(`Switched to ${branch}`); navigate(`/${repo}`); }
  catch(e) { toast(e.message,'error'); }
}
async function deleteBranch(repo, branch) {
  try { await api('DELETE',`/api/repos/${repo}/branches/${encodeURIComponent(branch)}`); toast(`Deleted branch "${branch}"`); navigate(`/${repo}/branches`); }
  catch(e) { toast(e.message,'error'); }
}

// ── Tags ──────────────────────────────────────────────────────────────────────
async function renderTags(name) {
  currentRepo = name; setTerminalCtx(name);
  const app = document.getElementById('app');
  try {
    const tags = await api('GET', `/api/repos/${name}/tags`);
    const rows = tags.map(t => `
      <div class="tag-row">
        <div class="tag-name">${icon('tag')} ${esc(t.name)}</div>
        <div class="tag-commit">${t.commit?esc(t.commit.hash+' · '+t.commit.message.slice(0,40)):''}</div>
        <div style="color:var(--text-3);font-size:12px">${t.commit?esc(t.commit.relative):''}</div>
        <button class="btn btn-danger btn-sm" onclick="deleteTag('${name}','${esc(t.name)}')">Delete</button>
      </div>`).join('');
    app.innerHTML = `<div class="container">${repoNav(name)}
      <div class="section-header"><div class="section-title">Tags</div>
        <button class="btn btn-primary btn-sm" onclick="openTagModal('${name}')">${icon('plus')} New tag</button>
      </div>
      <div class="tag-list">${rows||'<div style="padding:16px;color:var(--text-2)">No tags yet.</div>'}</div>
    </div>`;
  } catch(e) { app.innerHTML = err(e); }
}
function openTagModal(name) {
  pendingTagRepo = name;
  document.getElementById('tag-name').value = '';
  document.getElementById('tag-message').value = '';
  document.getElementById('create-tag-error').style.display = 'none';
  openModal('create-tag');
  setTimeout(() => document.getElementById('tag-name').focus(), 50);
}
async function submitTag() {
  const name = document.getElementById('tag-name').value.trim();
  const message = document.getElementById('tag-message').value.trim();
  const btn = document.getElementById('create-tag-btn');
  if (!name) { showModalError('create-tag','Tag name required'); return; }
  btn.disabled=true; btn.textContent='Creating…';
  try { await api('POST',`/api/repos/${pendingTagRepo}/tags`,{name,message}); closeModal('create-tag'); toast(`Tag "${name}" created`); navigate(`/${pendingTagRepo}/tags`); }
  catch(e) { showModalError('create-tag',e.message); btn.disabled=false; btn.textContent='Create tag'; }
}
async function deleteTag(repo, tag) {
  try { await api('DELETE',`/api/repos/${repo}/tags/${encodeURIComponent(tag)}`); toast(`Deleted tag "${tag}"`); navigate(`/${repo}/tags`); }
  catch(e) { toast(e.message,'error'); }
}

// ── Stash ─────────────────────────────────────────────────────────────────────
async function renderStash(name) {
  currentRepo = name; setTerminalCtx(name);
  const app = document.getElementById('app');
  try {
    const entries = await api('GET', `/api/repos/${name}/stash`);
    const rows = entries.map(s => `
      <div class="stash-row">
        <div class="stash-ref">${esc(s.ref)}</div>
        <div class="stash-msg">${esc(s.message)}</div>
        <div class="stash-date">${esc(s.date)}</div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-outline btn-sm" onclick="applyStash('${name}',${s.index},false)">Apply</button>
          <button class="btn btn-primary btn-sm" onclick="applyStash('${name}',${s.index},true)">Pop</button>
          <button class="btn btn-danger btn-sm" onclick="dropStash('${name}',${s.index})">Drop</button>
        </div>
      </div>`).join('');
    app.innerHTML = `<div class="container">${repoNav(name)}
      <div class="section-header"><div class="section-title">Stash</div>
        <button class="btn btn-primary btn-sm" onclick="openStashModal('${name}')">${icon('stash')} Stash changes</button>
      </div>
      <div class="stash-list">${rows||'<div style="padding:16px;color:var(--text-2)">Stash is empty.</div>'}</div>
    </div>`;
  } catch(e) { app.innerHTML = err(e); }
}
function openStashModal(name) { pendingStashRepo = name; document.getElementById('stash-message').value = ''; openModal('stash-push'); setTimeout(()=>document.getElementById('stash-message').focus(),50); }
async function submitStash() {
  const message = document.getElementById('stash-message').value.trim();
  try { await api('POST',`/api/repos/${pendingStashRepo}/stash`,{message}); closeModal('stash-push'); toast('Changes stashed'); navigate(`/${pendingStashRepo}/stash`); }
  catch(e) { toast(e.message,'error'); }
}
async function applyStash(name,index,pop) {
  try { await api('POST',`/api/repos/${name}/stash/${index}/apply`,{pop}); toast(pop?'Stash popped':'Stash applied'); navigate(`/${name}/stash`); }
  catch(e) { toast(e.message,'error'); }
}
async function dropStash(name,index) {
  try { await api('DELETE',`/api/repos/${name}/stash/${index}`); toast('Stash entry dropped'); navigate(`/${name}/stash`); }
  catch(e) { toast(e.message,'error'); }
}

// ── Commit graph ──────────────────────────────────────────────────────────────
async function renderGraph(name) {
  currentRepo = name; setTerminalCtx(name);
  const app = document.getElementById('app');
  try {
    const data = await api('GET', `/api/repos/${name}/graph`);
    const lines = (data.graph||'').split('\n').map(l => `<div class="graph-line">${escHtml(l)
      .replace(/([0-9a-f]{7})/g, '<span class="g-hash">$1</span>')
      .replace(/\(([^)]+)\)/g, '(<span class="g-ref">$1</span>)')
    }</div>`).join('');
    app.innerHTML = `<div class="container">${repoNav(name)}
      <div class="section-title" style="margin-bottom:14px">Commit graph</div>
      <div class="graph-wrap">${lines||'<div style="color:var(--text-3)">No commits yet.</div>'}</div>
    </div>`;
  } catch(e) { app.innerHTML = err(e); }
}

// ── Diff viewer ───────────────────────────────────────────────────────────────
async function renderDiff(name, params) {
  currentRepo = name; setTerminalCtx(name);
  const app = document.getElementById('app');
  const base = params?.get('base') || '', head = params?.get('head') || '';
  try {
    const data = await api('GET', `/api/repos/${name}/diff?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`);
    app.innerHTML = `<div class="container">${repoNav(name)}
      <div class="section-title" style="margin-bottom:6px">Diff${base?` <span style="font-size:13px;font-weight:400;color:var(--text-2)">${esc(base)}${head?' → '+esc(head):''}</span>`:''}</div>
      <div class="diff-toolbar">
        <input class="form-input" id="diff-base" placeholder="base commit or branch" value="${esc(base)}" style="max-width:200px">
        <input class="form-input" id="diff-head" placeholder="head commit (optional)" value="${esc(head)}" style="max-width:200px">
        <button class="btn btn-primary btn-sm" onclick="loadDiff('${esc(name)}')">Compare</button>
      </div>
      ${buildDiffView(data.diff)}
    </div>`;
  } catch(e) { app.innerHTML = err(e); }
}
window.loadDiff = (name) => {
  const base = document.getElementById('diff-base').value.trim();
  const head = document.getElementById('diff-head').value.trim();
  navigate(`/${name}/diff?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`);
};

function buildDiffView(diff) {
  if (!diff || !diff.trim()) return `<div class="empty-inline">No changes</div>`;
  const files = diff.split(/^diff --git /m).filter(Boolean);
  let added = 0, removed = 0;
  const parts = files.map(f => {
    const headerMatch = f.match(/^a\/.+ b\/(.+)\n/);
    const fileName = headerMatch ? headerMatch[1] : 'file';
    const lines = f.split('\n');
    const rows = lines.map(l => {
      if (l.startsWith('@@')) return `<div class="diff-hunk">${escHtml(l)}</div>`;
      if (l.startsWith('+') && !l.startsWith('+++')) { added++; return `<div class="diff-line diff-add"><span class="diff-content">${escHtml(l)}</span></div>`; }
      if (l.startsWith('-') && !l.startsWith('---')) { removed++; return `<div class="diff-line diff-del"><span class="diff-content">${escHtml(l)}</span></div>`; }
      if (l.startsWith('diff')||l.startsWith('index')||l.startsWith('---')||l.startsWith('+++')) return '';
      return `<div class="diff-line diff-ctx"><span class="diff-content">${escHtml(l)}</span></div>`;
    }).join('');
    return `<div class="diff-wrap" style="margin-bottom:14px">
      <div class="diff-file-header">${ICONS.file} ${esc(fileName)}</div>
      ${rows}
    </div>`;
  }).join('');
  return `<div class="diff-stats"><span class="diff-stat-add">+${added}</span> additions <span class="diff-stat-del">-${removed}</span> deletions</div>${parts}`;
}

// ── Blame viewer ──────────────────────────────────────────────────────────────
async function renderBlame(name, filePath) {
  currentRepo = name; setTerminalCtx(name);
  const app = document.getElementById('app');
  try {
    const data = await api('GET', `/api/repos/${name}/blame/${filePath}`);
    const rows = data.lines.map(l => `
      <div class="blame-row">
        <span class="blame-hash" title="${esc(l.summary)}">${esc(l.hash)}</span>
        <span class="blame-author">${esc(l.author)}</span>
        <span class="blame-time">${esc(l.time)}</span>
        <span class="blame-src">${escHtml(l.content)}</span>
      </div>`).join('');
    app.innerHTML = `<div class="container">${repoNav(name)}
      <div class="breadcrumb" style="margin-bottom:12px">
        <span class="bc-link" onclick="navigate('/${name}')">Code</span>
        <span class="bc-sep">/</span>
        <span class="bc-link" onclick="navigate('/${name}/blob/${filePath}')">${esc(filePath)}</span>
        <span class="bc-sep">/</span><span class="bc-cur">blame</span>
      </div>
      <div class="blame-wrap">${rows||'<div style="padding:16px;color:var(--text-2)">Empty file.</div>'}</div>
    </div>`;
  } catch(e) { app.innerHTML = err(e); }
}

// ── Blob viewer ───────────────────────────────────────────────────────────────
async function renderBlob(name, filePath) {
  currentRepo = name; setTerminalCtx(name);
  const app = document.getElementById('app');
  try {
    const blob = await api('GET', `/api/repos/${name}/blob/${filePath}`);
    const ext = filePath.split('.').pop().toLowerCase();
    const lang = langFromExt(ext);
    const lines = blob.content.split('\n');
    const codeRows = lines.map((l,i) => `<div class="code-row"><span class="code-ln">${i+1}</span><span class="code-src">${escHtml(l)}</span></div>`).join('');

    const parts = filePath.split('/');
    const crumbs = parts.map((p,i) => {
      const pth = parts.slice(0,i+1).join('/'); const isLast = i===parts.length-1;
      if (isLast) return `<span class="bc-cur">${esc(p)}</span>`;
      return `<span class="bc-link" onclick="navigate('/${name}/tree/${pth}')">${esc(p)}</span><span class="bc-sep">/</span>`;
    }).join('');

    app.innerHTML = `<div class="container">
      ${repoNav(name)}
      <div class="breadcrumb" style="margin-bottom:16px">
        <span class="bc-link" onclick="navigate('/${name}')">${esc(name)}</span><span class="bc-sep">/</span>${crumbs}
      </div>
      <div class="file-viewer">
        <div class="file-viewer-header">
          <span class="file-info">${lines.length} lines · <span>${formatBytes(blob.size)}</span></span>
          <div style="display:flex;gap:6px">
            <button class="btn btn-outline btn-sm" onclick="navigate('/${name}/blame/${filePath}')">Blame</button>
            <button class="btn btn-outline btn-sm" onclick="navigate('/${name}/diff?base=HEAD&file=${encodeURIComponent(filePath)}')">Diff</button>
            <button class="btn btn-outline btn-sm" onclick="openEditFile('${esc(name)}','${esc(filePath)}')">${icon('plus')} Edit</button>
          </div>
        </div>
        <div class="file-code">
          ${lang ? `<pre class="language-${lang}" style="margin:0;border-radius:0;background:var(--bg)"><code class="language-${lang}">${escHtml(blob.content)}</code></pre>` : `<div class="code-table">${codeRows}</div>`}
        </div>
      </div>
    </div>`;
    if (lang && window.Prism) setTimeout(() => Prism.highlightAll(), 50);
  } catch(e) { app.innerHTML = err(e); }
}

function langFromExt(ext) {
  return {js:'javascript',ts:'typescript',py:'python',rb:'ruby',go:'go',rs:'rust',java:'java',c:'c',cpp:'cpp',cs:'csharp',php:'php',html:'html',css:'css',scss:'scss',json:'json',yaml:'yaml',yml:'yaml',sh:'bash',bash:'bash',md:'markdown',sql:'sql',xml:'xml',toml:'toml',kt:'kotlin',swift:'swift',r:'r'}[ext] || '';
}

// ── Create repo ───────────────────────────────────────────────────────────────
async function createRepo() {
  const name = document.getElementById('repo-name').value.trim();
  const desc = document.getElementById('repo-desc').value.trim();
  const readme = document.getElementById('repo-readme').checked;
  const btn = document.getElementById('create-repo-btn');
  document.getElementById('create-repo-error').style.display = 'none';
  if (!name) { showModalError('create-repo','Name is required.'); return; }
  btn.disabled=true; btn.textContent='Creating…';
  try { await api('POST','/api/repos',{name,description:desc,initWithReadme:readme}); closeModal('create-repo'); toast(`Repository "${name}" created!`); navigate(`/${name}`); }
  catch(e) { showModalError('create-repo',e.message); btn.disabled=false; btn.textContent='Create repository'; }
}
document.getElementById('repo-name').addEventListener('keydown', e => { if (e.key==='Enter') createRepo(); });

// ── Create / edit file ────────────────────────────────────────────────────────
function openCreateFile(repoName, subPath) {
  pendingFileRepo = repoName;
  document.getElementById('create-file-title').textContent = 'New file';
  document.getElementById('file-path').value = subPath ? subPath+'/' : '';
  document.getElementById('file-path').readOnly = false;
  document.getElementById('file-content').value = '';
  document.getElementById('file-commit-msg').value = '';
  document.getElementById('create-file-error').style.display = 'none';
  openModal('create-file');
  setTimeout(() => document.getElementById('file-path').focus(), 50);
}
function openEditFile(repoName, filePath) {
  pendingFileRepo = repoName;
  document.getElementById('create-file-title').textContent = 'Edit file';
  document.getElementById('file-path').value = filePath;
  document.getElementById('file-path').readOnly = true;
  document.getElementById('file-commit-msg').value = '';
  document.getElementById('create-file-error').style.display = 'none';
  api('GET',`/api/repos/${repoName}/blob/${filePath}`).then(b => { document.getElementById('file-content').value = b.content; });
  openModal('create-file');
}
async function createFile() {
  const filePath = document.getElementById('file-path').value.trim();
  const content = document.getElementById('file-content').value;
  const msg = document.getElementById('file-commit-msg').value.trim();
  const btn = document.getElementById('create-file-btn');
  document.getElementById('create-file-error').style.display = 'none';
  if (!filePath) { showModalError('create-file','File path is required.'); return; }
  btn.disabled=true; btn.textContent='Committing…';
  try { await api('POST',`/api/repos/${pendingFileRepo}/files`,{path:filePath,content,message:msg}); closeModal('create-file'); document.getElementById('file-path').readOnly=false; toast('File committed!'); navigate(`/${pendingFileRepo}`); }
  catch(e) { showModalError('create-file',e.message); btn.disabled=false; btn.textContent='Commit file'; }
}

// ── Delete repo ───────────────────────────────────────────────────────────────
function confirmDelete(name) { pendingDeleteRepo=name; document.getElementById('delete-repo-name').textContent=name; openModal('delete-repo'); }
async function deleteRepo() {
  const btn = document.getElementById('delete-repo-btn'); btn.disabled=true; btn.textContent='Deleting…';
  try { await api('DELETE',`/api/repos/${pendingDeleteRepo}`); closeModal('delete-repo'); toast(`Repository deleted.`); navigate('/'); }
  catch(e) { toast(e.message,'error'); btn.disabled=false; btn.textContent='Delete'; }
}

// ── Push / Pull ───────────────────────────────────────────────────────────────
function openPushPull(name, action, remotes, branch) {
  pendingPushPullRepo=name; pendingPushPullAction=action;
  document.getElementById('push-pull-title').textContent = action==='push'?'Push to remote':'Pull from remote';
  document.getElementById('pp-remote').value = (remotes&&remotes[0])?remotes[0].name:'origin';
  document.getElementById('pp-branch').value = branch||'main';
  document.getElementById('push-extra').style.display = action==='push'?'block':'none';
  if (action==='push') document.getElementById('pp-force').checked=false;
  document.getElementById('push-pull-btn').textContent = action==='push'?'Push':'Pull';
  openModal('push-pull');
}
async function executePushPull() {
  const remote = document.getElementById('pp-remote').value.trim()||'origin';
  const branch = document.getElementById('pp-branch').value.trim()||'main';
  const force = pendingPushPullAction==='push' && document.getElementById('pp-force').checked;
  closeModal('push-pull'); openTerminal();
  const cmd = pendingPushPullAction==='push' ? (force?`push --force ${remote} ${branch}`:`push ${remote} ${branch}`) : `pull ${remote} ${branch}`;
  appendTermLine(`git ${cmd}`, 'term-cmd');
  try {
    const result = await api('POST',`/api/repos/${pendingPushPullRepo}/exec`,{command:cmd});
    if (result.stdout) appendTermLine(result.stdout.trimEnd(),'term-stdout');
    if (result.stderr) appendTermLine(result.stderr.trimEnd(),'term-stderr');
    appendTermLine(result.code===0?'✓ Done':`✗ Exited ${result.code}`, result.code===0?'term-ok':'term-fail');
  } catch(e) { appendTermLine(e.message,'term-fail'); }
}

// ── Remotes ───────────────────────────────────────────────────────────────────
async function openRemotes(name) {
  pendingRemotesRepo=name;
  document.getElementById('remote-name-input').value='';
  document.getElementById('remote-url-input').value='';
  document.getElementById('remotes-error').style.display='none';
  await refreshRemotesList(name);
  openModal('remotes');
}
async function refreshRemotesList(name) {
  const repo = name||pendingRemotesRepo;
  try {
    const info = await api('GET',`/api/repos/${repo}`);
    const remotes = info.remotes||[];
    const listEl = document.getElementById('remotes-list');
    if (!remotes.length) { listEl.innerHTML=`<div style="color:var(--text-2);font-size:13px;padding:8px 0">No remotes configured.</div>`; return; }
    listEl.innerHTML = remotes.map(r=>`<div class="remote-row"><span class="remote-name">${esc(r.name)}</span><span class="remote-url">${esc(r.refs&&(r.refs.fetch||r.refs.push)||'')}</span><button class="remote-del" onclick="deleteRemote('${esc(r.name)}')">${ICONS.trash}</button></div>`).join('');
  } catch {}
}
async function saveRemote() {
  const name=document.getElementById('remote-name-input').value.trim(), url=document.getElementById('remote-url-input').value.trim();
  const errEl=document.getElementById('remotes-error'); errEl.style.display='none';
  if (!name||!url) { errEl.textContent='Name and URL required.'; errEl.style.display='block'; return; }
  try { await api('POST',`/api/repos/${pendingRemotesRepo}/remotes`,{name,url}); document.getElementById('remote-name-input').value=''; document.getElementById('remote-url-input').value=''; await refreshRemotesList(); toast(`Remote "${name}" saved.`); }
  catch(e) { errEl.textContent=e.message; errEl.style.display='block'; }
}
async function deleteRemote(remoteName) {
  try { await api('DELETE',`/api/repos/${pendingRemotesRepo}/remotes/${remoteName}`); await refreshRemotesList(); toast(`Remote "${remoteName}" removed.`); }
  catch(e) { toast(e.message,'error'); }
}

// ── Clone from URL ────────────────────────────────────────────────────────────
async function doClone() {
  const url = document.getElementById('clone-url-input').value.trim();
  let name = document.getElementById('clone-name-input').value.trim();
  if (!name) name = url.split('/').pop().replace(/\.git$/,'');
  const btn = document.getElementById('clone-btn');
  document.getElementById('clone-error').style.display='none';
  if (!url) { document.getElementById('clone-error').textContent='URL required'; document.getElementById('clone-error').style.display='block'; return; }
  btn.disabled=true; btn.textContent='Cloning…';
  try { await api('POST','/api/clone',{url,name}); closeModal('clone-url'); toast(`Cloned "${name}"!`); navigate(`/${name}`); }
  catch(e) { document.getElementById('clone-error').textContent=e.message; document.getElementById('clone-error').style.display='block'; btn.disabled=false; btn.textContent='Clone'; }
}

// ── Settings ──────────────────────────────────────────────────────────────────
function openRepoSettings(name, description) {
  pendingSettingsRepo = name;
  document.getElementById('settings-desc').value = description||'';
  document.getElementById('settings-name').value = name;
  document.getElementById('settings-error').style.display='none';
  openModal('settings');
}
async function saveSettings() {
  const newName = document.getElementById('settings-name').value.trim();
  const description = document.getElementById('settings-desc').value.trim();
  const errEl = document.getElementById('settings-error'); errEl.style.display='none';
  try {
    const r = await api('PATCH',`/api/repos/${pendingSettingsRepo}/settings`,{description,newName:newName!==pendingSettingsRepo?newName:undefined});
    closeModal('settings'); toast('Settings saved.'); navigate(`/${r.name||pendingSettingsRepo}`);
  } catch(e) { errEl.textContent=e.message; errEl.style.display='block'; }
}
async function rewriteAuthors(name) {
  openTerminal();
  appendTermLine(`Rewriting all commit authors in "${name}" → "${currentUser.username}"…`, 'term-dim');
  try {
    const result = await api('POST', `/api/repos/${name}/rewrite-authors`, { name: currentUser.username });
    if (result.stdout) appendTermLine(result.stdout.trimEnd(), 'term-stdout');
    if (result.stderr) appendTermLine(result.stderr.trimEnd(), result.code === 0 ? 'term-dim' : 'term-stderr');
    appendTermLine(result.code === 0 ? `✓ Done — all commits now show "${currentUser.username}"` : `✗ Failed (exit ${result.code})`, result.code === 0 ? 'term-ok' : 'term-fail');
    if (result.code === 0) setTimeout(() => navigate(`/${name}`), 600);
  } catch(e) { appendTermLine(e.message, 'term-fail'); }
}

async function doRewriteAuthors() {
  if (pendingSettingsRepo) await rewriteAuthors(pendingSettingsRepo);
  closeModal('settings');
}

async function doFork() {
  closeModal('settings');
  try { const r = await api('POST',`/api/repos/${pendingSettingsRepo}/fork`); toast(`Forked as "${r.name}"`); navigate(`/${r.name}`); }
  catch(e) { toast(e.message,'error'); }
}

// ── Webhooks ──────────────────────────────────────────────────────────────────
async function openWebhooks(name) {
  pendingWebhookRepo=name;
  document.getElementById('webhook-url').value='';
  document.getElementById('webhook-error').style.display='none';
  await refreshWebhooks(name);
  openModal('webhook');
}
async function refreshWebhooks(name) {
  const repo=name||pendingWebhookRepo;
  const hooks = await api('GET',`/api/repos/${repo}/webhooks`).catch(()=>[]);
  const listEl=document.getElementById('webhook-list');
  listEl.innerHTML = hooks.length ? hooks.map(h=>`<div class="webhook-row"><div class="webhook-url">${esc(h.url)}</div><div class="webhook-events">${(h.events||[]).join(', ')}</div><button class="webhook-del" onclick="deleteWebhook('${esc(h.id)}')">${ICONS.trash}</button></div>`).join('') : `<div style="color:var(--text-2);font-size:13px">No webhooks.</div>`;
}
async function submitWebhook() {
  const url=document.getElementById('webhook-url').value.trim();
  const events=[['wh-push','push'],['wh-issue','issues'],['wh-tag','tags']].filter(([id])=>document.getElementById(id).checked).map(([,e])=>e);
  const errEl=document.getElementById('webhook-error'); errEl.style.display='none';
  if (!url) { errEl.textContent='URL required'; errEl.style.display='block'; return; }
  try { await api('POST',`/api/repos/${pendingWebhookRepo}/webhooks`,{url,events}); document.getElementById('webhook-url').value=''; await refreshWebhooks(); toast('Webhook added.'); }
  catch(e) { errEl.textContent=e.message; errEl.style.display='block'; }
}
async function deleteWebhook(id) {
  try { await api('DELETE',`/api/repos/${pendingWebhookRepo}/webhooks/${id}`); await refreshWebhooks(); toast('Webhook removed.'); }
  catch(e) { toast(e.message,'error'); }
}

// ── Users ─────────────────────────────────────────────────────────────────────
async function submitAddUser() {
  const username=document.getElementById('new-user-name').value.trim();
  const password=document.getElementById('new-user-pass').value;
  const role=document.getElementById('new-user-role').value;
  const errEl=document.getElementById('add-user-error'); errEl.style.display='none';
  if (!username||!password) { errEl.textContent='Username and password required'; errEl.style.display='block'; return; }
  try { await api('POST','/api/users',{username,password,role}); closeModal('add-user'); toast(`User "${username}" added.`); }
  catch(e) { errEl.textContent=e.message; errEl.style.display='block'; }
}

// ── Terminal ──────────────────────────────────────────────────────────────────
function setTerminalCtx(n) { const c=document.getElementById('terminal-ctx'); if(c) c.textContent=n?`[${n}]`:''; }
function toggleTerminal() {
  const panel=document.getElementById('terminal-panel'); terminalOpen=!terminalOpen;
  panel.classList.toggle('collapsed',!terminalOpen);
  document.getElementById('terminal-toggle-btn').textContent=terminalOpen?'▼':'▲';
  if(terminalOpen) { setTimeout(()=>document.getElementById('terminal-input').focus(),50); scrollTerminal(); }
}
function openTerminal() { if(!terminalOpen) toggleTerminal(); }
function clearTerminal() { document.getElementById('terminal-output').innerHTML='<div class="term-line term-dim">── Forge Git Terminal ──</div>'; }
function appendTermLine(text, cls='term-stdout') {
  const out=document.getElementById('terminal-output');
  text.split('\n').forEach(l => { const d=document.createElement('div'); d.className=`term-line ${cls}`; d.textContent=l; out.appendChild(d); });
  scrollTerminal();
}
function scrollTerminal() { const o=document.getElementById('terminal-output'); if(o) o.scrollTop=o.scrollHeight; }
async function runTerminalCommand(raw) {
  if (!raw.trim()) return;
  if (!currentRepo) { appendTermLine('No repository selected.','term-fail'); return; }
  cmdHistory.unshift(raw); if(cmdHistory.length>50) cmdHistory.pop(); cmdHistIdx=-1;
  appendTermLine('git '+raw,'term-cmd');
  try {
    const result=await api('POST',`/api/repos/${currentRepo}/exec`,{command:raw});
    if(result.stdout) appendTermLine(result.stdout.trimEnd(),'term-stdout');
    if(result.stderr) appendTermLine(result.stderr.trimEnd(),'term-stderr');
    appendTermLine(result.code===0?'✓':`✗ exit ${result.code}`, result.code===0?'term-ok':'term-fail');
  } catch(e) { appendTermLine(e.message,'term-fail'); }
}
document.getElementById('terminal-input').addEventListener('keydown', async e => {
  const input=e.currentTarget;
  if(e.key==='Enter') { const cmd=input.value.trim(); input.value=''; await runTerminalCommand(cmd); }
  else if(e.key==='ArrowUp') { e.preventDefault(); if(cmdHistIdx<cmdHistory.length-1) input.value=cmdHistory[++cmdHistIdx]; }
  else if(e.key==='ArrowDown') { e.preventDefault(); if(cmdHistIdx>0) input.value=cmdHistory[--cmdHistIdx]; else { cmdHistIdx=-1; input.value=''; } }
});

// ── Search ────────────────────────────────────────────────────────────────────
let searchDebounceTimer = null;
function onSearchFocus() { const q=document.getElementById('search-input').value.trim(); if(q.length>=2) showSearchDropdown(document.getElementById('search-dropdown')._lastResults||[],q); }
function onSearchInput(e) {
  const q=e.target.value.trim(); searchActiveIdx=-1; filterRepoList(q);
  clearTimeout(searchDebounceTimer); if(q.length<2) { closeSearch(); return; }
  searchDebounceTimer=setTimeout(()=>runSearch(q),280);
}
function onSearchKey(e) {
  const dd=document.getElementById('search-dropdown');
  if(e.key==='Escape') { closeSearch(); e.target.blur(); return; }
  if(!searchOpen) return;
  if(e.key==='ArrowDown') { e.preventDefault(); searchActiveIdx=Math.min(searchActiveIdx+1,searchItemEls.length-1); updateSearchActive(); }
  else if(e.key==='ArrowUp') { e.preventDefault(); searchActiveIdx=Math.max(searchActiveIdx-1,0); updateSearchActive(); }
  else if(e.key==='Enter') { e.preventDefault(); if(searchActiveIdx>=0&&searchItemEls[searchActiveIdx]) searchItemEls[searchActiveIdx].click(); }
}
function updateSearchActive() { searchItemEls.forEach((el,i)=>el.classList.toggle('active',i===searchActiveIdx)); if(searchItemEls[searchActiveIdx]) searchItemEls[searchActiveIdx].scrollIntoView({block:'nearest'}); }
async function runSearch(q) {
  const dd=document.getElementById('search-dropdown'); dd.innerHTML=`<div class="search-empty">Searching…</div>`; dd.style.display='block'; searchOpen=true;
  try { const data=await api('GET',`/api/search?q=${encodeURIComponent(q)}`); dd._lastResults=data.results; showSearchDropdown(data.results,q); } catch { dd.innerHTML=`<div class="search-empty">Search failed</div>`; }
}
function showSearchDropdown(results, q) {
  const dd=document.getElementById('search-dropdown'); searchItemEls=[]; searchActiveIdx=-1;
  if(!results.length) { dd.innerHTML=`<div class="search-empty">No results for <strong>${esc(q)}</strong></div>`; dd.style.display='block'; searchOpen=true; return; }
  const groups={repo:[],file:[],content:[],commit:[]}; results.forEach(r=>groups[r.type]?.push(r));
  const sections=[];
  if(groups.repo.length) sections.push(renderSearchSection('Repositories',groups.repo.map(r=>({icon:ICONS.repo,title:highlight(r.repo,q),sub:r.description||'',tag:null,onclick:`navigate('/${r.repo}')`}))));
  if(groups.file.length) sections.push(renderSearchSection('Files',groups.file.map(r=>({icon:ICONS.file,title:highlight(r.path.split('/').pop(),q),sub:r.path,tag:r.repo,onclick:`navigate('/${r.repo}/blob/${r.path}')`}))));
  if(groups.content.length) sections.push(renderSearchSection('Content',groups.content.map(r=>({icon:ICONS.code,title:highlight(r.path.split('/').pop(),q),sub:r.path,tag:r.repo,onclick:`navigate('/${r.repo}/blob/${r.path}')`}))));
  if(groups.commit.length) sections.push(renderSearchSection('Commits',groups.commit.map(r=>({icon:ICONS.commit,title:highlight(r.message,q),sub:`${r.hash} · ${r.relative||''}`,tag:r.repo,onclick:`navigate('/${r.repo}/commits')`}))));
  dd.innerHTML=sections.join('<hr class="search-divider">'); dd.style.display='block'; searchOpen=true;
  searchItemEls=Array.from(dd.querySelectorAll('.search-item'));
  searchItemEls.forEach(el=>{ el.addEventListener('mouseenter',()=>{ searchActiveIdx=searchItemEls.indexOf(el); updateSearchActive(); }); });
}
function renderSearchSection(label, items) {
  return `<div class="search-section"><div class="search-section-label">${label}</div>${items.map(item=>`<div class="search-item" onclick="${item.onclick};closeSearch()"><span class="search-item-icon">${item.icon}</span><span class="search-item-body"><div class="search-item-title">${item.title}</div>${item.sub?`<div class="search-item-sub">${esc(item.sub)}</div>`:''}</span>${item.tag?`<span class="search-repo-tag">${esc(item.tag)}</span>`:''}</div>`).join('')}</div>`;
}
function highlight(text,q) { if(!text||!q) return esc(text||''); return esc(text).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),m=>`<mark>${m}</mark>`); }
function closeSearch() { const dd=document.getElementById('search-dropdown'); dd.style.display='none'; searchOpen=false; searchActiveIdx=-1; searchItemEls=[]; }
document.addEventListener('click', e => { const w=document.getElementById('search-wrap'); if(w&&!w.contains(e.target)) closeSearch(); });
document.addEventListener('keydown', e => { if(e.key==='/'&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='TEXTAREA') { e.preventDefault(); document.getElementById('search-input')?.focus(); } });
let _allRepoCards2='';

// ── Helpers ───────────────────────────────────────────────────────────────────
function repoNav(name, extra='') {
  const ownerFile = _repoOwnerCache[name] || currentUser?.username || '';
  return `<div style="margin-bottom:16px">
    <div class="repo-nav" style="font-size:16px">
      <span class="repo-nav-owner" onclick="navigate('/')">${esc(ownerFile)}</span>
      <span class="repo-nav-sep">/</span>
      <span class="repo-nav-name" onclick="navigate('/${name}')">${esc(name)}</span>
      <span class="repo-visibility">Public</span>
    </div>
    ${extra}
  </div>`;
}
function err(e) { return `<div class="container"><div class="alert alert-error">${esc(e.message)}</div></div>`; }
function showModalError(id, msg) { const el=document.getElementById(`${id}-error`); el.textContent=msg; el.style.display='block'; }
function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatBytes(b) { if(!b) return '0 B'; if(b<1024) return b+' B'; if(b<1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }
function formatRelative(d) { if(!d) return ''; const s=Math.floor((Date.now()-new Date(d))/1000); if(s<60) return `${s}s ago`; if(s<3600) return `${Math.floor(s/60)}m ago`; if(s<86400) return `${Math.floor(s/3600)}h ago`; if(s<2592000) return `${Math.floor(s/86400)}d ago`; return new Date(d).toLocaleDateString(); }
function getFileIcon(name) {
  const ext=name.split('.').pop().toLowerCase();
  const colors={md:'#fbbf24',js:'#f1e05a',ts:'#818cf8',json:'#a3e635',css:'#a78bfa',html:'#fb923c',py:'#60a5fa',go:'#34d399',rs:'#f97316',sh:'#4ade80',yml:'#f87171',yaml:'#f87171',txt:'#e2e8f0'};
  if(name.toLowerCase().startsWith('readme')) return `<span style="color:#fbbf24">${ICONS.file}</span>`;
  return `<span style="color:${colors[ext]||'var(--text-3)'}">${ICONS.file}</span>`;
}
function renderMarkdown(md) { if(window.marked){marked.setOptions({breaks:true,gfm:true});return marked.parse(md);} return '<pre style="white-space:pre-wrap;font-family:inherit">'+escHtml(md)+'</pre>'; }

// ── Account Settings ──────────────────────────────────────────────────────────
const ACCENT_COLORS = [
  { name:'Orange', value:'#f97316', light:'#fb923c', dim:'rgba(249,115,22,.1)', glow:'rgba(249,115,22,.18)' },
  { name:'Blue',   value:'#3b82f6', light:'#60a5fa', dim:'rgba(59,130,246,.1)', glow:'rgba(59,130,246,.18)' },
  { name:'Purple', value:'#8b5cf6', light:'#a78bfa', dim:'rgba(139,92,246,.1)', glow:'rgba(139,92,246,.18)' },
  { name:'Green',  value:'#22c55e', light:'#4ade80', dim:'rgba(34,197,94,.1)',  glow:'rgba(34,197,94,.18)'  },
  { name:'Pink',   value:'#ec4899', light:'#f472b6', dim:'rgba(236,72,153,.1)', glow:'rgba(236,72,153,.18)' },
  { name:'Cyan',   value:'#06b6d4', light:'#22d3ee', dim:'rgba(6,182,212,.1)',  glow:'rgba(6,182,212,.18)'  },
];

function applyAccent(color) {
  const r = document.documentElement.style;
  r.setProperty('--accent', color.value);
  r.setProperty('--accent-light', color.light);
  r.setProperty('--accent-dim', color.dim);
  r.setProperty('--accent-glow', color.glow);
  localStorage.setItem('forge-accent', color.name);
  document.querySelectorAll('.accent-swatch').forEach(s => s.classList.toggle('selected', s.dataset.name === color.name));
}

function loadSavedAccent() {
  const saved = localStorage.getItem('forge-accent');
  if (saved) { const c = ACCENT_COLORS.find(a => a.name === saved); if (c) applyAccent(c); }
}

let _acctSection = 'profile';

async function renderAccountSettings(section) {
  if (section) _acctSection = section;
  currentRepo = null; setTerminalCtx('');
  const app = document.getElementById('app');
  if (currentUser?.guest) {
    app.innerHTML = `<div class="container" style="padding-top:48px">
      <div class="info-box" style="max-width:480px;margin:0 auto;text-align:center">
        <div style="font-size:32px;margin-bottom:12px">🔒</div>
        <h2 style="font-size:17px;font-weight:700;margin-bottom:8px">Sign in to access settings</h2>
        <p style="font-size:13px;color:var(--text-2);margin-bottom:18px">Account settings are only available when you're signed in with a real account.</p>
        <button class="btn btn-primary btn-sm" onclick="doLogout()">Sign in / create account</button>
      </div>
    </div>`;
    return;
  }
  app.innerHTML = '<div class="container"><div class="spinner"></div></div>';
  try {
    const acct = await api('GET', '/api/account');
    const savedAccent = localStorage.getItem('forge-accent') || 'Orange';
    const initials = (acct.displayName || acct.username).slice(0,2).toUpperCase();

    const navItems = [
      { id:'profile',     label:'Public profile',       icon:'<path d="M10.25 0a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5ZM3 2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM12.5 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM10.25 8c2.07 0 3.76 1.234 4.547 3H16v1.25A1.75 1.75 0 0 1 14.25 14h-8.5A1.75 1.75 0 0 1 4 13.25V11h1.203C5.99 9.234 7.68 8 9.75 8h.5ZM1.5 11v2.25c0 .138.112.25.25.25H3v-2.5H1.5Zm13 0H13v2.5h.75a.25.25 0 0 0 .25-.25V11Z"/>' },
      { id:'password',    label:'Password & auth',       icon:'<path d="M.22 12.28a.75.75 0 0 1 0-1.06l1.22-1.22a.75.75 0 0 1 1.06 0l.72.72 1.97-1.97a.75.75 0 0 1 1.06 0l.72.72 1.97-1.97a.75.75 0 0 1 1.06 0l.72.72 1.97-1.97-.72-.72a.75.75 0 0 1 0-1.06l1.22-1.22a.75.75 0 0 1 1.06 0l3.5 3.5a.75.75 0 0 1 0 1.06l-1.22 1.22a.75.75 0 0 1-1.06 0l-.72-.72-1.97 1.97.72.72a.75.75 0 0 1 0 1.06l-1.22 1.22a.75.75 0 0 1-1.06 0l-.72-.72-1.97 1.97.72.72a.75.75 0 0 1 0 1.06l-1.22 1.22a.75.75 0 0 1-1.06 0l-3.5-3.5Z"/>' },
      { id:'tokens',      label:'Access tokens',         icon:'<path d="M6.75 0a6.75 6.75 0 0 1 6.695 7.555l2.995 3a.75.75 0 0 1 0 1.06l-1.5 1.5a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l.97-.97-.97-.97-1.06 1.061a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l1.061-1.06-1.574-1.575A6.75 6.75 0 1 1 6.75 0Zm0 1.5a5.25 5.25 0 1 0 0 10.5A5.25 5.25 0 0 0 6.75 1.5ZM8 6.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z"/>' },
      { id:'appearance',  label:'Appearance',            icon:'<path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm4.879-2.773 4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559V5.442a.25.25 0 0 1 .379-.215Z"/>' },
      { id:'danger',      label:'Danger zone',           icon:'<path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/>' },
    ];

    const navHtml = navItems.map(n => `
      <button class="settings-nav-item${_acctSection===n.id?' active':''}" onclick="renderAccountSettings('${n.id}')">
        <svg viewBox="0 0 16 16" fill="currentColor">${n.icon}</svg>${n.label}
      </button>`).join('');

    let contentHtml = '';

    if (_acctSection === 'profile') {
      contentHtml = `
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">Public profile</div>
            <div class="settings-section-desc">This information is visible to all users on your Forge instance.</div>
          </div>
          <div class="settings-section-body">
            <div class="settings-profile-header">
              <div class="settings-avatar">${esc(initials)}</div>
              <div><div class="settings-username-badge">${esc(acct.username)}</div><div class="settings-username-sub">Username · cannot be changed</div></div>
            </div>
            <div class="settings-row">
              <div class="settings-field"><label>Display name</label><input id="acct-display" value="${esc(acct.displayName)}" placeholder="${esc(acct.username)}"><div class="settings-hint">Your name as shown on commits and activity.</div></div>
              <div class="settings-field"><label>Email</label><input id="acct-email" type="email" value="${esc(acct.email)}" placeholder="you@example.com"><div class="settings-hint">Used for git commit metadata.</div></div>
            </div>
            <div class="settings-field"><label>Bio</label><textarea id="acct-bio" rows="3" placeholder="Tell us a little about yourself…">${esc(acct.bio)}</textarea><div class="settings-hint">Up to 500 characters.</div></div>
            <div class="settings-row">
              <div class="settings-field"><label>Location</label><input id="acct-location" value="${esc(acct.location)}" placeholder="Earth"></div>
              <div class="settings-field"><label>Website</label><input id="acct-website" value="${esc(acct.website)}" placeholder="https://"></div>
            </div>
            <div id="profile-error" class="alert alert-error" style="display:none;margin-bottom:12px"></div>
            <div class="settings-actions">
              <button class="btn btn-primary btn-sm" onclick="saveProfile()">Save profile</button>
              <span id="profile-ok" style="font-size:13px;color:var(--green);display:none">Saved!</span>
            </div>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">Account overview</div>
          </div>
          <div class="settings-section-body" style="font-size:13px;color:var(--text-2);display:flex;flex-direction:column;gap:8px">
            <div>Username: <strong style="color:var(--text)">${esc(acct.username)}</strong></div>
            <div>Role: <span class="role-badge">${esc(acct.role)}</span></div>
            ${acct.createdAt ? `<div>Member since: <strong style="color:var(--text)">${new Date(acct.createdAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</strong></div>` : ''}
          </div>
        </div>`;
    }

    if (_acctSection === 'password') {
      contentHtml = `
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">Change password</div>
            <div class="settings-section-desc">After changing your password, you will remain signed in.</div>
          </div>
          <div class="settings-section-body">
            <div class="settings-field"><label>Current password</label><input id="pwd-current" type="password" placeholder="Your current password" autocomplete="current-password"></div>
            <div class="settings-field"><label>New password</label><input id="pwd-new" type="password" placeholder="Min 6 characters" autocomplete="new-password"></div>
            <div class="settings-field"><label>Confirm new password</label><input id="pwd-confirm" type="password" placeholder="Repeat new password" autocomplete="new-password"></div>
            <div id="pwd-error" class="alert alert-error" style="display:none;margin-bottom:12px"></div>
            <div class="settings-actions">
              <button class="btn btn-primary btn-sm" onclick="changePassword()">Update password</button>
              <span id="pwd-ok" style="font-size:13px;color:var(--green);display:none">Password updated!</span>
            </div>
          </div>
        </div>`;
    }

    if (_acctSection === 'tokens') {
      const hasToken = acct.hasCliToken;
      const maskedToken = acct.cliToken ? acct.cliToken.slice(0,8) + '…' + acct.cliToken.slice(-4) : null;
      contentHtml = `
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">CLI access token</div>
            <div class="settings-section-desc">Used by the <code style="font-size:11px;background:var(--surface-3);padding:1px 5px;border-radius:4px">forge</code> CLI to authenticate. Treat it like a password.</div>
          </div>
          <div class="settings-section-body">
            ${hasToken ? `
              <div style="font-size:12px;color:var(--text-2);margin-bottom:10px">Your active token:</div>
              <div class="token-display" id="token-display">
                <span class="token-value" id="token-val" data-full="${esc(acct.cliToken)}">${maskedToken}</span>
                <button class="token-copy" onclick="toggleTokenReveal()">Reveal</button>
                <button class="token-copy" onclick="copyToken()">Copy</button>
              </div>
              <div id="token-error" class="alert alert-error" style="display:none;margin-bottom:12px"></div>
              <div class="settings-actions">
                <button class="btn btn-outline btn-sm" onclick="regenerateToken()">Regenerate token</button>
                <button class="btn btn-danger btn-sm" onclick="revokeToken()">Revoke token</button>
              </div>` : `
              <div style="font-size:13px;color:var(--text-2);margin-bottom:16px">No active CLI token. Generate one to use the forge CLI.</div>
              <div id="token-error" class="alert alert-error" style="display:none;margin-bottom:12px"></div>
              <button class="btn btn-primary btn-sm" onclick="regenerateToken()">Generate token</button>`}
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">Using your token</div>
          </div>
          <div class="settings-section-body">
            <div style="font-size:13px;color:var(--text-2);margin-bottom:10px">Run the following to authenticate the CLI:</div>
            <pre style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 16px;font-size:12px;overflow-x:auto;color:var(--text)">forge login</pre>
          </div>
        </div>`;
    }

    if (_acctSection === 'appearance') {
      contentHtml = `
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">Accent color</div>
            <div class="settings-section-desc">Choose your preferred accent color. Saved locally in your browser.</div>
          </div>
          <div class="settings-section-body">
            <div class="accent-picker">
              ${ACCENT_COLORS.map(c => `<div class="accent-swatch${savedAccent===c.name?' selected':''}" data-name="${c.name}" style="background:${c.value}" title="${c.name}" onclick="applyAccent(ACCENT_COLORS.find(a=>a.name==='${c.name}'))"></div>`).join('')}
            </div>
            <div style="margin-top:12px;font-size:12px;color:var(--text-3)">Current: <strong style="color:var(--text)">${savedAccent}</strong></div>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-section-title">Theme</div>
            <div class="settings-section-desc">Forge uses a dark theme by default.</div>
          </div>
          <div class="settings-section-body" style="font-size:13px;color:var(--text-2)">
            Only dark mode is currently supported.
          </div>
        </div>`;
    }

    if (_acctSection === 'danger') {
      contentHtml = `
        <div class="settings-danger-section">
          <div class="settings-section-header">
            <div class="settings-section-title">Danger zone</div>
          </div>
          <div class="settings-danger-item">
            <div class="settings-danger-item-info">
              <div class="settings-danger-item-title">Delete account</div>
              <div class="settings-danger-item-desc">Once deleted, your account cannot be recovered. Your repositories will remain.</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="confirmDeleteAccount()">Delete account</button>
          </div>
        </div>`;
    }

    app.innerHTML = `<div class="container">
      <div style="padding:28px 0 0;font-size:12px;color:var(--text-3)">
        <span style="cursor:pointer;color:var(--text-2)" onclick="navigate('/')">← Back to repos</span>
      </div>
      <h1 style="font-size:20px;font-weight:700;padding:16px 0 24px">Account Settings</h1>
      <div class="settings-layout">
        <nav class="settings-nav">
          <div class="settings-nav-label">Settings</div>
          ${navHtml}
        </nav>
        <div class="settings-content">${contentHtml}</div>
      </div>
    </div>`;
  } catch(e) { app.innerHTML = `<div class="container"><div class="alert alert-error">${esc(e.message)}</div></div>`; }
}

async function saveProfile() {
  const displayName = document.getElementById('acct-display').value.trim();
  const email = document.getElementById('acct-email').value.trim();
  const bio = document.getElementById('acct-bio').value.trim();
  const location = document.getElementById('acct-location').value.trim();
  const website = document.getElementById('acct-website').value.trim();
  const errEl = document.getElementById('profile-error');
  errEl.style.display = 'none';
  try {
    await api('PATCH', '/api/account', { displayName, email, bio, location, website });
    const okEl = document.getElementById('profile-ok');
    okEl.style.display = 'inline';
    setTimeout(() => { if (okEl) okEl.style.display = 'none'; }, 2500);
    toast('Profile saved!');
  } catch(e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
}

async function changePassword() {
  const current = document.getElementById('pwd-current').value;
  const next = document.getElementById('pwd-new').value;
  const confirm = document.getElementById('pwd-confirm').value;
  const errEl = document.getElementById('pwd-error');
  errEl.style.display = 'none';
  if (!current || !next) { errEl.textContent = 'All fields are required'; errEl.style.display = 'block'; return; }
  if (next !== confirm) { errEl.textContent = 'New passwords do not match'; errEl.style.display = 'block'; return; }
  if (next.length < 6) { errEl.textContent = 'Password must be at least 6 characters'; errEl.style.display = 'block'; return; }
  try {
    await api('POST', '/api/account/password', { currentPassword: current, newPassword: next });
    document.getElementById('pwd-current').value = '';
    document.getElementById('pwd-new').value = '';
    document.getElementById('pwd-confirm').value = '';
    const okEl = document.getElementById('pwd-ok');
    okEl.style.display = 'inline';
    setTimeout(() => { if (okEl) okEl.style.display = 'none'; }, 2500);
    toast('Password updated!');
  } catch(e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
}

async function regenerateToken() {
  try {
    const r = await api('POST', '/api/account/token/regenerate');
    toast('New token generated!');
    renderAccountSettings('tokens');
  } catch(e) {
    const el = document.getElementById('token-error');
    if (el) { el.textContent = e.message; el.style.display = 'block'; } else toast(e.message, 'error');
  }
}

async function revokeToken() {
  try {
    await api('DELETE', '/api/account/token');
    toast('Token revoked.');
    renderAccountSettings('tokens');
  } catch(e) {
    const el = document.getElementById('token-error');
    if (el) { el.textContent = e.message; el.style.display = 'block'; } else toast(e.message, 'error');
  }
}

let _tokenRevealed = false;
function toggleTokenReveal() {
  const valEl = document.getElementById('token-val');
  if (!valEl) return;
  const fullToken = valEl.dataset.full;
  _tokenRevealed = !_tokenRevealed;
  valEl.textContent = _tokenRevealed ? fullToken : fullToken.slice(0,8) + '…' + fullToken.slice(-4);
  const btn = valEl.nextElementSibling;
  if (btn) btn.textContent = _tokenRevealed ? 'Hide' : 'Reveal';
}
function copyToken() {
  const valEl = document.getElementById('token-val');
  if (!valEl) return;
  navigator.clipboard.writeText(valEl.dataset.full).then(() => toast('Token copied!'));
}

function confirmDeleteAccount() {
  const pw = prompt('Enter your password to permanently delete your account:');
  if (!pw) return;
  api('DELETE', '/api/account', { password: pw })
    .then(() => { currentUser = null; showAuthScreen('login'); toast('Account deleted.'); })
    .catch(e => toast(e.message, 'error'));
}

// ── Profile page ──────────────────────────────────────────────────────────────
async function renderProfile() {
  const appEl = document.getElementById('app');
  appEl.innerHTML = '<div class="container"><div class="spinner"></div></div>';
  try {
    const [repos, activity, heatmap, acct] = await Promise.all([
      api('GET', '/api/repos'),
      api('GET', '/api/activity?limit=30').catch(() => []),
      api('GET', '/api/heatmap').catch(() => ({})),
      api('GET', '/api/account').catch(() => ({})),
    ]);

    const myRepos = repos.filter(r => !r.owner || r.owner === currentUser.username);
    const totalCommits = Object.values(heatmap).reduce((a, b) => a + b, 0);
    const initials = currentUser.username.slice(0, 2).toUpperCase();
    const displayName = acct.displayName || currentUser.username;
    const bio = acct.bio || '';
    const location = acct.location || '';
    const website = acct.website || '';

    // Popular repos grid (top 6 by last commit date)
    const popularCards = myRepos.slice(0, 6).map(r => {
      const lang = r.lastCommit ? null : null; // language loaded separately per card
      return `<div class="popular-repo-card">
        <div class="popular-repo-card-header">
          <span class="popular-repo-name" onclick="navigate('/${r.name}')">${esc(r.name)}</span>
          <span class="popular-repo-public">Public</span>
        </div>
        ${r.description ? `<div class="popular-repo-desc">${esc(r.description)}</div>` : '<div class="popular-repo-desc" style="color:var(--text-3)">No description</div>'}
        <div class="popular-repo-meta">
          ${r.lastCommit ? `<span style="color:var(--text-3);font-size:12px">Updated ${esc(r.lastCommit.relative)}</span>` : ''}
        </div>
      </div>`;
    }).join('');

    // Heatmap with month labels
    const calHtml = buildProfileCalendar(heatmap);

    // Activity feed grouped by month
    const activityHtml = buildProfileActivity(activity, myRepos);

    appEl.innerHTML = `<div class="profile-layout">

      <!-- Left: profile sidebar -->
      <aside class="profile-sidebar">
        <div class="profile-avatar-wrap">
          <div class="profile-avatar-img">${esc(initials)}</div>
        </div>
        <div class="profile-display-name">${esc(displayName)}</div>
        <div class="profile-username">${esc(currentUser.username)}</div>
        <button class="profile-edit-btn" onclick="navigate('/settings')">Edit profile</button>
        ${bio ? `<div class="profile-bio">${esc(bio)}</div>` : ''}
        <div class="profile-meta">
          ${location ? `<div class="profile-meta-item"><svg viewBox="0 0 16 16"><path d="M8 0a5.53 5.53 0 0 0-3.594 1.342c-.766.66-1.321 1.52-1.464 2.383C1.266 4.095 0 5.555 0 7.318 0 9.366 1.552 11 3.761 11h7.508C13.414 11 15 9.377 15 7.318c0-1.763-1.266-3.223-2.942-3.593-.143-.863-.698-1.723-1.464-2.383A5.53 5.53 0 0 0 8 0Z"/></svg><span>${esc(location)}</span></div>` : ''}
          ${website ? `<div class="profile-meta-item"><svg viewBox="0 0 16 16"><path d="m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 2 2 0 0 0 2.83 0l2.5-2.5a2 2 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Z"/><path d="M4.355 12.725a3.5 3.5 0 0 0 4.95 0l1.25-1.25a.751.751 0 0 0-.018-1.042.751.751 0 0 0-1.042.018l-1.25 1.25a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l2.5-2.5a2 2 0 0 1 2.83 0 .751.751 0 0 0 1.042-.018.751.751 0 0 0 .018-1.042 3.5 3.5 0 0 0-4.95 0l-2.5 2.5a3.5 3.5 0 0 0 0 4.95Z"/></svg><a href="${esc(website)}" target="_blank">${esc(website.replace(/^https?:\/\//,''))}</a></div>` : ''}
          <div class="profile-meta-item">
            <svg viewBox="0 0 16 16"><path d="M2 2.75C2 1.784 2.784 1 3.75 1h8.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 12.25 15h-8.5A1.75 1.75 0 0 1 2 13.25Zm1.75-.25a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25Zm2 2.5a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm0 3a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"/></svg>
            <span>${myRepos.length} repositories</span>
          </div>
        </div>
        ${acct.createdAt ? `<div style="font-size:13px;color:var(--text-3);margin-top:4px">Member since ${new Date(acct.createdAt).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</div>` : ''}
      </aside>

      <!-- Right: main content -->
      <main class="profile-main">

        <!-- Popular repos -->
        ${myRepos.length ? `
        <div style="margin-bottom:24px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <h2 class="profile-section-title" style="margin:0">Popular repositories</h2>
            <a style="font-size:13px;color:var(--accent);cursor:pointer" onclick="navigate('/')">View all repositories →</a>
          </div>
          <div class="popular-repos-grid">${popularCards}</div>
        </div>` : ''}

        <!-- Contribution calendar -->
        <div class="profile-heatmap-wrap">
          <div class="profile-heatmap-header"><strong>${totalCommits}</strong> contributions in the last year</div>
          <div class="profile-calendar">${calHtml}</div>
        </div>

        <!-- Contribution activity -->
        <div class="profile-activity-section">
          <h2 class="profile-activity-header">Contribution activity</h2>
          ${activityHtml || '<p style="color:var(--text-3);font-size:13px">No recent activity.</p>'}
        </div>

      </main>
    </div>`;
  } catch(e) { appEl.innerHTML = `<div class="container"><div class="alert alert-error">${esc(e.message)}</div></div>`; }
}

function buildProfileCalendar(data) {
  const today = new Date();
  const weeks = [];
  const monthLabels = [];
  let lastMonth = -1;

  for (let w = 51; w >= 0; w--) {
    const days = [];
    for (let d = 0; d <= 6; d++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (w * 7 + (6 - d)));
      const key = date.toISOString().slice(0, 10);
      const count = data[key] || 0;
      const level = count === 0 ? 0 : count <= 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
      const colors = ['var(--surface-2)', 'rgba(63,185,80,.25)', 'rgba(63,185,80,.5)', 'rgba(63,185,80,.75)', 'var(--green)'];
      days.push(`<div class="profile-cal-cell" style="background:${colors[level]}" title="${key}: ${count} commit${count!==1?'s':''}"></div>`);
      if (d === 0) {
        const mo = date.getMonth();
        if (mo !== lastMonth) {
          monthLabels.push({ col: 51 - w, label: date.toLocaleString('en-US', { month: 'short' }) });
          lastMonth = mo;
        }
      }
    }
    weeks.push(`<div class="profile-cal-week">${days.join('')}</div>`);
  }

  // Month row
  const monthRow = `<div class="profile-cal-months">` +
    monthLabels.map((m, i) => {
      const next = monthLabels[i + 1];
      const span = next ? next.col - m.col : 52 - m.col;
      return `<div class="profile-cal-month" style="width:${span * 14}px">${m.label}</div>`;
    }).join('') + `</div>`;

  const legend = `<div class="profile-cal-legend">Less <div class="profile-cal-cell" style="background:var(--surface-2)"></div><div class="profile-cal-cell" style="background:rgba(63,185,80,.25)"></div><div class="profile-cal-cell" style="background:rgba(63,185,80,.5)"></div><div class="profile-cal-cell" style="background:rgba(63,185,80,.75)"></div><div class="profile-cal-cell" style="background:var(--green)"></div> More</div>`;

  const dayLabels = `<div class="profile-cal-days">
    <div class="profile-cal-day-label"></div>
    <div class="profile-cal-day-label">Mon</div>
    <div class="profile-cal-day-label"></div>
    <div class="profile-cal-day-label">Wed</div>
    <div class="profile-cal-day-label"></div>
    <div class="profile-cal-day-label">Fri</div>
    <div class="profile-cal-day-label"></div>
  </div>`;

  return `${monthRow}<div class="profile-cal-body">${dayLabels}<div class="profile-cal-weeks">${weeks.join('')}</div></div>${legend}`;
}

function buildProfileActivity(activity, myRepos) {
  if (!activity.length) return '';
  const grouped = {};
  activity.forEach(a => {
    const d = a.timestamp ? new Date(a.timestamp) : new Date();
    const key = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    (grouped[key] || (grouped[key] = [])).push(a);
  });

  return Object.entries(grouped).map(([month, items]) => {
    const actItems = items.map(a => {
      let title = '', repo = a.repo || '';
      if (a.type === 'push') title = `Pushed commits to`;
      else if (a.type === 'issue_open') title = `Opened an issue in`;
      else if (a.type === 'fork') title = `Forked ${esc(a.forkedFrom || '')} to`;
      else if (a.type === 'clone') title = `Cloned`;
      else if (a.type === 'import') title = `Imported`;
      else title = `Activity in`;
      const iconPath = a.type === 'issue_open'
        ? '<path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>'
        : '<path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.07a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/>';
      return `<div class="profile-activity-item">
        <div class="profile-activity-icon"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">${iconPath}</svg></div>
        <div class="profile-activity-body">
          <div class="profile-activity-title">${title} <span class="profile-activity-repo" onclick="navigate('/${repo}')">${esc(repo)}</span></div>
          ${a.type==='push'?`<div class="profile-activity-bar" style="width:${Math.min(100,60+Math.random()*40)}%"></div>`:''}
          <div style="font-size:12px;color:var(--text-3);margin-top:4px">${a.timestamp?formatRelative(a.timestamp):''}</div>
        </div>
      </div>`;
    }).join('');
    return `<div class="profile-activity-month">${month}</div>${actItems}`;
  }).join('');
}

// ── Sync polling ──────────────────────────────────────────────────────────────
function syncBadgeHtml(name) {
  const s = _syncStatus[name];
  if (!s || s.noRemote) return '';
  if (s.status === 'checking') return '<span class="sync-badge sync-checking">↻ Checking…</span>';
  if (s.status === 'pulling')  return '<span class="sync-badge sync-pulling">⬇ Pulling…</span>';
  if (s.status === 'error')    return `<span class="sync-badge sync-error" title="${esc(s.error||'')}">⚠ Sync error</span>`;
  if (s.lastUpdate)            return `<span class="sync-badge sync-updated">↑ Updated ${formatRelative(s.lastUpdate)}</span>`;
  if (s.lastCheck)             return `<span class="sync-badge sync-idle">✓ ${formatRelative(s.lastCheck)}</span>`;
  return '';
}

function applySync(data) {
  _syncStatus = data.repos || {};
  const indicator = document.getElementById('sync-indicator');
  const indicatorText = document.getElementById('sync-indicator-text');
  if (indicator) {
    if (data.syncing) {
      const count = Object.values(_syncStatus).filter(s => s.status === 'pulling').length;
      indicatorText.textContent = count > 0 ? `Pulling ${count} repo${count>1?'s':''}…` : 'Syncing…';
      indicator.classList.add('active');
    } else {
      indicator.classList.remove('active');
    }
  }
  // Update badges in-place (no re-render)
  Object.keys(_syncStatus).forEach(name => {
    const el = document.getElementById(`sb-${name}`);
    if (el) el.innerHTML = syncBadgeHtml(name);
  });
}

async function pollSyncStatus() {
  try { const d = await api('GET', '/api/sync-status'); applySync(d); } catch {}
}

function startSyncPolling() {
  stopSyncPolling();
  pollSyncStatus();
  _syncPollTimer = setInterval(pollSyncStatus, 8000);
}

function stopSyncPolling() {
  if (_syncPollTimer) { clearInterval(_syncPollTimer); _syncPollTimer = null; }
}

async function triggerSync(name, btn) {
  if (btn) { btn.disabled = true; btn.textContent = '…'; }
  try { await api('POST', `/api/repos/${name}/sync`); toast(`Syncing ${name}…`, 'info'); }
  catch(e) { toast(e.message, 'error'); }
  if (btn) { btn.disabled = false; btn.textContent = 'Sync'; }
}

async function triggerSyncAll() {
  try { await api('POST', '/api/sync-all'); toast('Sync started for all repos', 'info'); }
  catch(e) { toast(e.message, 'error'); }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => { loadSavedAccent(); initAuth(); });
window.addEventListener('hashchange', () => { if(currentUser) renderRoute(location.hash.slice(1)||'/'); });
