// third test commit
const express = require('express');
const simpleGit = require('simple-git');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');

const realApp = express();
// `app` is shadowed as a Router (not the real Express app) so every existing
// app.get/post/patch/delete call below mounts under BASE_PATH without being
// touched individually — see realApp.use(BASE_PATH, app) near the bottom.
const app = express.Router();
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, '');
const PORT = parseInt(process.env.PORT || '3000', 10);
const REPOS_DIR = path.join(__dirname, 'repos');
const USERS_FILE = path.join(__dirname, 'users.json');
const SECRET_FILE = path.join(__dirname, '.forge-secret');
const SESSIONS_DIR = path.join(__dirname, '.sessions');

if (!fs.existsSync(REPOS_DIR)) fs.mkdirSync(REPOS_DIR, { recursive: true });
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

// Persist session secret across restarts
let sessionSecret;
if (fs.existsSync(SECRET_FILE)) {
  sessionSecret = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
} else {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_FILE, sessionSecret);
}

app.use(express.json());
app.use(session({
  store: new FileStore({ path: SESSIONS_DIR, ttl: 7 * 24 * 3600, retries: 0, logFn: () => {} }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true }
}));

// Inject window.__BASE_PATH__ so app.js can prefix its own fetch()/src/href
// calls when mounted under a prefix (e.g. behind the portal at /forge).
let _indexHtmlWithBase = null;
app.get('/', (req, res) => {
  if (!_indexHtmlWithBase) {
    const html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf-8');
    _indexHtmlWithBase = html.replace('</head>', `<script>window.__BASE_PATH__=${JSON.stringify(BASE_PATH)};</script></head>`);
  }
  res.send(_indexHtmlWithBase);
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    }
  }
}));

// ── Users ─────────────────────────────────────────────────────────────────────
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')); } catch { return []; }
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  // CLI bearer token
  const auth = req.headers['authorization'];
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const users = loadUsers();
    // Guest token (no accounts configured)
    if (users.length === 0 && token === 'guest') {
      req.user = { username: 'local', guest: true };
      return next();
    }
    // Per-user CLI token
    const found = users.find(u => u.cliToken === token);
    if (found) {
      req.user = { username: found.username };
      return next();
    }
    return res.status(401).json({ error: 'Invalid token. Run: forge login' });
  }
  // Browser session
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Auth endpoints ────────────────────────────────────────────────────────────
app.get('/api/auth/status', (req, res) => {
  res.json({ setup: loadUsers().length === 0, user: req.session.user || null });
});

app.post('/api/auth/setup', async (req, res) => {
  if (loadUsers().length > 0) return res.status(403).json({ error: 'Already set up' });
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) return res.status(400).json({ error: 'Username: letters, numbers, .-_ only' });
  const hash = await bcrypt.hash(password, 12);
  saveUsers([{ username, password: hash, createdAt: new Date().toISOString() }]);
  req.session.user = { username };
  res.json({ username });
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const users = loadUsers();
  if (users.length === 0) return res.status(403).json({ error: 'Forge is not set up yet' });
  const user = users.find(u => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Invalid credentials' });
  req.session.user = { username };
  res.json({ username });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.post('/api/auth/skip', (req, res) => {
  req.session.user = { username: 'local', guest: true };
  res.json({ username: 'local', guest: true });
});

// CLI token login — returns a persistent bearer token
app.post('/api/auth/cli-login', async (req, res) => {
  const users = loadUsers();
  // No accounts: return guest token
  if (users.length === 0) {
    return res.json({ token: 'guest', username: 'local', guest: true });
  }
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const user = users.find(u => u.username === username);
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: 'Invalid credentials' });
  if (!user.cliToken) {
    user.cliToken = crypto.randomBytes(28).toString('hex');
    saveUsers(users);
  }
  res.json({ token: user.cliToken, username: user.username });
});

// Revoke CLI token
app.post('/api/auth/cli-logout', requireAuth, (req, res) => {
  const users = loadUsers();
  const user = users.find(u => u.username === (req.user || {}).username);
  if (user) { delete user.cliToken; saveUsers(users); }
  res.json({ ok: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function safeRepoPath(name) {
  if (!name || !/^[a-zA-Z0-9_.-]+$/.test(name)) return null;
  const p = path.join(REPOS_DIR, name);
  if (!p.startsWith(REPOS_DIR + path.sep) && p !== REPOS_DIR) return null;
  return p;
}
function safePath(repoPath, sub) {
  const full = path.normalize(path.join(repoPath, sub));
  if (!full.startsWith(repoPath)) return null;
  return full;
}
async function setGitUser(git, req) {
  const who = (req.user || {}).username || 'local';
  await git.addConfig('user.name', who);
  await git.addConfig('user.email', `${who}@forge.local`);
}

function getRepoOwner(rp) {
  const f = path.join(rp, '.git', 'forge-owner');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf-8').trim() : null;
}

function formatRelative(dateStr) {
  const d = new Date(dateStr), now = new Date();
  const s = Math.floor((now - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s/86400)}d ago`;
  return d.toLocaleDateString();
}

// ── Repos list & create ───────────────────────────────────────────────────────
app.get('/api/repos', requireAuth, async (req, res) => {
  try {
    const entries = fs.existsSync(REPOS_DIR) ? fs.readdirSync(REPOS_DIR) : [];
    const repos = await Promise.all(
      entries.filter(d => fs.existsSync(path.join(REPOS_DIR, d, '.git'))).map(async name => {
        const rp = path.join(REPOS_DIR, name);
        const git = simpleGit(rp);
        let description = '', lastCommit = null, branch = 'main';
        try {
          const descPath = path.join(rp, '.git', 'description');
          if (fs.existsSync(descPath)) {
            const d = fs.readFileSync(descPath, 'utf-8').trim();
            if (!d.startsWith('Unnamed repository')) description = d;
          }
          const log = await git.log(['--max-count=1']);
          if (log.latest) lastCommit = {
            message: log.latest.message, date: log.latest.date,
            relative: formatRelative(log.latest.date), hash: log.latest.hash.slice(0, 7)
          };
          branch = (await git.revparse(['--abbrev-ref', 'HEAD']).catch(() => 'main')).trim();
        } catch {}
        const owner = getRepoOwner(rp);
        // language detection
        let topLang = null;
        try {
          const lsOut = await gitRun(['ls-files'], rp).catch(() => '');
          const counts = {};
          lsOut.split('\n').filter(Boolean).forEach(f => {
            const base = path.basename(f).toLowerCase();
            const ext = base.includes('.') ? base.split('.').pop() : base;
            const lang = LANG_EXT[ext] || LANG_EXT[base];
            if (lang) counts[lang] = (counts[lang] || 0) + 1;
          });
          const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
          if (top) topLang = top[0];
        } catch {}
        // commit count
        let commitCount = 0;
        try {
          const cnt = await gitRun(['rev-list', '--count', 'HEAD'], rp).catch(() => '0');
          commitCount = parseInt(cnt.trim()) || 0;
        } catch {}
        return { name, description, lastCommit, branch, owner, createdAt: fs.statSync(rp).birthtime, topLang, commitCount };
      })
    );
    res.json(repos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/repos', requireAuth, async (req, res) => {
  const { name, description, initWithReadme } = req.body;
  const rp = safeRepoPath(name);
  if (!rp) return res.status(400).json({ error: 'Invalid name. Use letters, numbers, hyphens, underscores, dots.' });
  if (fs.existsSync(rp)) return res.status(409).json({ error: 'Repository already exists.' });
  try {
    fs.mkdirSync(rp, { recursive: true });
    const git = simpleGit(rp);
    await git.init();
    const uname = (req.user || req.session.user || {}).username || 'local';
    await git.addConfig('user.name', uname);
    await git.addConfig('user.email', `${uname}@forge.local`);
    fs.writeFileSync(path.join(rp, '.git', 'forge-owner'), uname);
    if (description) fs.writeFileSync(path.join(rp, '.git', 'description'), description);
    if (initWithReadme) {
      fs.writeFileSync(path.join(rp, 'README.md'), `# ${name}\n\n${description || 'A new repository.'}\n`);
      await git.add('README.md');
      await git.commit('Initial commit');
    }
    res.json({ name, description, branch: 'main' });
  } catch (err) {
    fs.rmSync(rp, { recursive: true, force: true });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/repos/:name', requireAuth, (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  try { fs.rmSync(rp, { recursive: true, force: true }); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Repo detail ───────────────────────────────────────────────────────────────
app.get('/api/repos/:name', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const git = simpleGit(rp);
  try {
    const [log, branches, remotes, status] = await Promise.all([
      git.log(['--max-count=30']).catch(() => ({ all: [], total: 0 })),
      git.branch().catch(() => ({ all: [], current: 'main' })),
      git.getRemotes(true).catch(() => []),
      git.status().catch(() => null)
    ]);
    const descPath = path.join(rp, '.git', 'description');
    let description = '';
    if (fs.existsSync(descPath)) {
      const d = fs.readFileSync(descPath, 'utf-8').trim();
      if (!d.startsWith('Unnamed repository')) description = d;
    }
    res.json({
      name: req.params.name, description,
      commits: log.all.map(c => ({
        hash: c.hash.slice(0, 7), fullHash: c.hash,
        message: c.message, author: c.author_name,
        date: c.date, relative: formatRelative(c.date)
      })),
      branches: branches.all, currentBranch: branches.current || 'main',
      totalCommits: log.total, remotes, owner: getRepoOwner(rp),
      status: status ? {
        isClean: status.isClean(),
        staged: status.staged.length,
        modified: status.modified.length,
        untracked: status.not_added.length
      } : null
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── File tree & blob ──────────────────────────────────────────────────────────
app.get('/api/repos/:name/tree/*', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const subPath = req.params[0] || '';
  const dirPath = safePath(rp, subPath);
  if (!dirPath) return res.status(403).json({ error: 'Forbidden' });
  if (!fs.existsSync(dirPath)) return res.status(404).json({ error: 'Path not found' });
  const git = simpleGit(rp);
  try {
    const entries = fs.readdirSync(dirPath).filter(e => e !== '.git');
    const files = await Promise.all(entries.map(async entry => {
      const full = path.join(dirPath, entry);
      const stat = fs.statSync(full);
      const isDir = stat.isDirectory();
      const rel = (subPath ? subPath + '/' : '') + entry;
      let lastCommit = null;
      try {
        const log = await git.log(['--max-count=1', '--', rel]);
        if (log.latest) lastCommit = {
          message: log.latest.message, date: log.latest.date,
          relative: formatRelative(log.latest.date), hash: log.latest.hash.slice(0, 7)
        };
      } catch {}
      return { name: entry, path: rel, type: isDir ? 'dir' : 'file', size: isDir ? null : stat.size, lastCommit };
    }));
    files.sort((a, b) => a.type !== b.type ? (a.type === 'dir' ? -1 : 1) : a.name.localeCompare(b.name));
    res.json(files);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/repos/:name/blob/*', requireAuth, (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const filePath = safePath(rp, req.params[0]);
  if (!filePath) return res.status(403).json({ error: 'Forbidden' });
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return res.status(404).json({ error: 'File not found' });
  try {
    const size = fs.statSync(filePath).size;
    if (size > 1024 * 1024) return res.status(413).json({ error: 'File too large to display (>1MB)' });
    res.json({ content: fs.readFileSync(filePath, 'utf-8'), path: req.params[0], size });
  } catch { res.status(500).json({ error: 'Could not read file (binary?)' }); }
});

app.post('/api/repos/:name/files', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const { path: filePath, content, message } = req.body;
  if (!filePath) return res.status(400).json({ error: 'path is required' });
  const fullPath = safePath(rp, filePath);
  if (!fullPath) return res.status(403).json({ error: 'Forbidden' });
  const git = simpleGit(rp);
  try {
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content || '');
    await setGitUser(git, req);
    await git.add(filePath.replace(/\\/g, '/'));
    await git.commit(message || `Add ${path.basename(filePath)}`);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Terminal exec (git commands only) ────────────────────────────────────────
app.post('/api/repos/:name/exec', requireAuth, (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const { command } = req.body;
  if (!command || typeof command !== 'string') return res.status(400).json({ error: 'command required' });
  const trimmed = command.trim();
  const normalized = /^git\s/.test(trimmed) ? trimmed : 'git ' + trimmed;
  if (!/^git(\s|$)/.test(normalized)) return res.status(400).json({ error: 'Only git commands allowed' });
  const args = normalized.split(/\s+/).slice(1);
  if (args[0] === 'push') {
    const owner = getRepoOwner(rp);
    const who = (req.user || {}).username;
    if (owner && owner !== who) {
      return res.status(403).json({ error: `Push denied: this repository belongs to "${owner}"` });
    }
  }
  const proc = spawn('git', args, { cwd: rp });
  let stdout = '', stderr = '';
  proc.stdout.on('data', d => { stdout += d.toString(); });
  proc.stderr.on('data', d => { stderr += d.toString(); });
  const timer = setTimeout(() => { proc.kill(); stderr += '\n[timed out after 30s]'; }, 30000);
  proc.on('close', code => { clearTimeout(timer); res.json({ stdout, stderr, code, cmd: normalized }); });
  proc.on('error', err => { clearTimeout(timer); res.json({ stdout: '', stderr: err.message, code: -1, cmd: normalized }); });
});

// ── Remotes ───────────────────────────────────────────────────────────────────
app.post('/api/repos/:name/remotes', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const { name: remoteName, url } = req.body;
  if (!remoteName || !url) return res.status(400).json({ error: 'name and url required' });
  if (!/^[a-zA-Z0-9_.-]+$/.test(remoteName)) return res.status(400).json({ error: 'Invalid remote name' });
  const git = simpleGit(rp);
  try {
    const existing = await git.getRemotes();
    if (existing.find(r => r.name === remoteName)) {
      await git.remote(['set-url', remoteName, url]);
    } else {
      await git.addRemote(remoteName, url);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/repos/:name/remotes/:remote', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  if (!/^[a-zA-Z0-9_.-]+$/.test(req.params.remote)) return res.status(400).json({ error: 'Invalid remote name' });
  const git = simpleGit(rp);
  try { await git.removeRemote(req.params.remote); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Search ────────────────────────────────────────────────────────────────────
function gitRun(args, cwd) {
  return new Promise(resolve => {
    execFile('git', args, { cwd, timeout: 8000, maxBuffer: 1024 * 512 }, (err, stdout) => {
      resolve(stdout || '');
    });
  });
}

app.get('/api/search', requireAuth, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json({ results: [], query: q });

  const qLower = q.toLowerCase();
  const entries = fs.existsSync(REPOS_DIR) ? fs.readdirSync(REPOS_DIR) : [];
  const repos = entries.filter(d => fs.existsSync(path.join(REPOS_DIR, d, '.git')));

  const allResults = [];

  await Promise.all(repos.map(async repoName => {
    const rp = path.join(REPOS_DIR, repoName);
    const local = [];

    // Repo name / description
    let description = '';
    try {
      const raw = fs.readFileSync(path.join(rp, '.git', 'description'), 'utf-8').trim();
      if (!raw.startsWith('Unnamed')) description = raw;
    } catch {}
    if (repoName.toLowerCase().includes(qLower) || description.toLowerCase().includes(qLower)) {
      local.push({ type: 'repo', repo: repoName, description });
    }

    // File paths
    try {
      const out = await gitRun(['ls-files'], rp);
      out.split('\n').filter(f => f && f.toLowerCase().includes(qLower)).slice(0, 5)
        .forEach(p => local.push({ type: 'file', repo: repoName, path: p }));
    } catch {}

    // Commit messages
    try {
      const git = simpleGit(rp);
      const log = await git.log([`--grep=${q}`, '-i', '--max-count=4']).catch(() => ({ all: [] }));
      log.all.forEach(c => local.push({
        type: 'commit', repo: repoName,
        hash: c.hash.slice(0, 7), message: c.message, relative: formatRelative(c.date)
      }));
    } catch {}

    // File contents (git grep)
    try {
      const out = await gitRun(['grep', '-il', q], rp);
      out.split('\n').filter(Boolean).slice(0, 4).forEach(p => {
        if (!local.find(r => r.type === 'file' && r.path === p))
          local.push({ type: 'content', repo: repoName, path: p });
      });
    } catch {}

    allResults.push(...local);
  }));

  res.json({ results: allResults.slice(0, 60), query: q });
});

// ── Rewrite commit authors ────────────────────────────────────────────────────
app.post('/api/repos/:name/rewrite-authors', requireAuth, (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const who = (req.user || {}).username || 'local';
  const newName = req.body.name || who;
  const newEmail = `${newName}@forge.local`;

  // Use fast-export | rewrite | fast-import — no bash required, works on Windows
  const exportProc = spawn('git', ['fast-export', '--all', '--signed-tags=strip'], { cwd: rp });
  const importProc = spawn('git', ['fast-import', '--force', '--quiet'], { cwd: rp });

  const chunks = [];
  exportProc.stdout.on('data', c => chunks.push(c));
  exportProc.on('close', exportCode => {
    if (exportCode !== 0) return res.json({ stdout: '', stderr: 'fast-export failed', code: exportCode });
    // Rewrite author/committer lines, preserving timestamps
    let text = Buffer.concat(chunks).toString('latin1');
    text = text.replace(
      /\n(author|committer) [^\n]+ <[^>]*> (\d+ [+-]\d{4})\n/g,
      `\n$1 ${newName} <${newEmail}> $2\n`
    );
    importProc.stdin.write(Buffer.from(text, 'latin1'));
    importProc.stdin.end();
  });

  let importOut = '';
  importProc.stderr.on('data', d => importOut += d.toString());
  importProc.on('close', async importCode => {
    if (importCode !== 0) return res.json({ stdout: '', stderr: importOut || 'fast-import failed', code: importCode });
    // Sync working tree to rewritten HEAD
    try {
      await gitRun(['reset', '--hard'], rp);
      res.json({ stdout: `✓ All commits rewritten — author is now "${newName}"`, stderr: importOut, code: 0 });
    } catch (e) {
      res.json({ stdout: `Rewritten but reset failed: ${e.message}`, stderr: importOut, code: 1 });
    }
  });

  exportProc.on('error', e => res.json({ stdout: '', stderr: e.message, code: -1 }));
  importProc.on('error', e => res.json({ stdout: '', stderr: e.message, code: -1 }));
});

// ── Activity log ──────────────────────────────────────────────────────────────
const ACTIVITY_FILE = path.join(__dirname, 'activity.json');
function logActivity(type, payload) {
  let log = [];
  try { if (fs.existsSync(ACTIVITY_FILE)) log = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf-8')); } catch {}
  log.unshift({ id: Date.now(), type, ...payload, timestamp: new Date().toISOString() });
  if (log.length > 1000) log.length = 1000;
  try { fs.writeFileSync(ACTIVITY_FILE, JSON.stringify(log)); } catch {}
}
app.get('/api/activity', requireAuth, (req, res) => {
  try {
    let log = [];
    if (fs.existsSync(ACTIVITY_FILE)) log = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf-8'));
    if (req.query.repo) log = log.filter(e => e.repo === req.query.repo);
    res.json(log.slice(0, parseInt(req.query.limit) || 60));
  } catch { res.json([]); }
});

// ── Issues ────────────────────────────────────────────────────────────────────
const issuesFile = rp => path.join(rp, '.git', 'forge-issues.json');
const loadIssues = rp => { try { return JSON.parse(fs.readFileSync(issuesFile(rp), 'utf-8')); } catch { return []; } };
const saveIssues = (rp, d) => fs.writeFileSync(issuesFile(rp), JSON.stringify(d, null, 2));

app.get('/api/repos/:name/issues', requireAuth, (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  let issues = loadIssues(rp);
  if (req.query.state) issues = issues.filter(i => i.state === req.query.state);
  res.json(issues);
});
app.post('/api/repos/:name/issues', requireAuth, (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const { title, body, labels } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  const issues = loadIssues(rp);
  const id = (issues.reduce((m, i) => Math.max(m, i.id), 0)) + 1;
  const issue = { id, title, body: body || '', labels: labels || [], state: 'open', author: (req.user || {}).username, createdAt: new Date().toISOString(), comments: [] };
  issues.push(issue);
  saveIssues(rp, issues);
  logActivity('issue_open', { repo: req.params.name, issueId: id, title, user: (req.user || {}).username });
  res.json(issue);
});
app.patch('/api/repos/:name/issues/:id', requireAuth, (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const issues = loadIssues(rp);
  const issue = issues.find(i => i.id === parseInt(req.params.id));
  if (!issue) return res.status(404).json({ error: 'Not found' });
  const { title, body, state, labels, comment } = req.body;
  if (title !== undefined) issue.title = title;
  if (body !== undefined) issue.body = body;
  if (state !== undefined) { issue.state = state; if (state === 'closed') issue.closedAt = new Date().toISOString(); }
  if (labels !== undefined) issue.labels = labels;
  if (comment) { (issue.comments = issue.comments || []).push({ body: comment, author: (req.user || {}).username, createdAt: new Date().toISOString() }); }
  saveIssues(rp, issues);
  res.json(issue);
});
app.delete('/api/repos/:name/issues/:id', requireAuth, (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const issues = loadIssues(rp);
  saveIssues(rp, issues.filter(i => i.id !== parseInt(req.params.id)));
  res.json({ success: true });
});

// ── Branches ──────────────────────────────────────────────────────────────────
app.get('/api/repos/:name/branches', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const git = simpleGit(rp);
  try {
    const b = await git.branch(['-v', '--no-abbrev']);
    res.json({ current: b.current, branches: Object.values(b.branches).map(br => ({ name: br.name, current: br.current, commit: br.commit, label: br.label })) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/repos/:name/branches', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const { name: br, from } = req.body;
  if (!br) return res.status(400).json({ error: 'name required' });
  const git = simpleGit(rp);
  try { await git.checkoutBranch(br, from || 'HEAD'); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/repos/:name/checkout', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const { branch } = req.body;
  if (!branch) return res.status(400).json({ error: 'branch required' });
  const git = simpleGit(rp);
  try { await git.checkout(branch); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/repos/:name/branches/:branch', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const git = simpleGit(rp);
  try { await git.deleteLocalBranch(req.params.branch, true); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/repos/:name/merge', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const { branch } = req.body;
  const git = simpleGit(rp);
  try { await git.merge([branch]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Tags ──────────────────────────────────────────────────────────────────────
app.get('/api/repos/:name/tags', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const git = simpleGit(rp);
  try {
    const tags = await git.tags(['--sort=-version:refname']);
    const details = await Promise.all(tags.all.map(async tag => {
      let commit = null;
      try { const l = await git.log([`${tag}^0`, '-1']); if (l.latest) commit = { hash: l.latest.hash.slice(0,7), message: l.latest.message, date: l.latest.date, relative: formatRelative(l.latest.date) }; } catch {}
      return { name: tag, commit };
    }));
    res.json(details);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/repos/:name/tags', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const { name: tagName, message } = req.body;
  if (!tagName) return res.status(400).json({ error: 'name required' });
  const git = simpleGit(rp);
  try {
    message ? await git.addAnnotatedTag(tagName, message) : await git.addTag(tagName);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/repos/:name/tags/:tag', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const git = simpleGit(rp);
  try { await git.tag(['-d', req.params.tag]); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Stash ─────────────────────────────────────────────────────────────────────
app.get('/api/repos/:name/stash', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  try {
    const out = await gitRun(['stash', 'list', '--format=%gd|||%s|||%ar'], rp);
    const entries = out.split('\n').filter(Boolean).map((line, i) => {
      const [ref, message, date] = line.split('|||');
      return { index: i, ref: (ref||'').trim(), message: (message||'').trim(), date: (date||'').trim() };
    });
    res.json(entries);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/repos/:name/stash', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const args = ['stash', 'push'];
  if (req.body.message) args.push('-m', req.body.message);
  try { await gitRun(args, rp); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/repos/:name/stash/:index/apply', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const cmd = req.body.pop ? 'pop' : 'apply';
  try { await gitRun(['stash', cmd, `stash@{${req.params.index}}`], rp); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/repos/:name/stash/:index', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  try { await gitRun(['stash', 'drop', `stash@{${req.params.index}}`], rp); res.json({ success: true }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Diff ──────────────────────────────────────────────────────────────────────
app.get('/api/repos/:name/diff', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const { base, head, file } = req.query;
  const args = ['diff', '--no-color'];
  if (base && head) args.push(`${base}..${head}`);
  else if (base) args.push(base);
  if (file) args.push('--', file);
  try { res.json({ diff: await gitRun(args, rp) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Blame ─────────────────────────────────────────────────────────────────────
app.get('/api/repos/:name/blame/*', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const filePath = req.params[0];
  try {
    const out = await gitRun(['blame', '--line-porcelain', filePath], rp);
    const lines = []; const commits = {}; let cur = null;
    for (const line of out.split('\n')) {
      if (/^[0-9a-f]{40}\s/.test(line)) {
        const p = line.split(' '); cur = { hash: p[0], lineNum: parseInt(p[2]) };
        if (!commits[cur.hash]) commits[cur.hash] = {};
      } else if (cur) {
        if (line.startsWith('author ')) commits[cur.hash].author = line.slice(7);
        else if (line.startsWith('author-time ')) commits[cur.hash].time = parseInt(line.slice(12));
        else if (line.startsWith('summary ')) commits[cur.hash].summary = line.slice(8);
        else if (line.startsWith('\t')) {
          const c = commits[cur.hash];
          lines.push({ lineNum: cur.lineNum, content: line.slice(1), hash: cur.hash.slice(0,7), author: c.author||'', time: c.time ? formatRelative(new Date(c.time*1000).toISOString()) : '', summary: c.summary||'' });
        }
      }
    }
    res.json({ lines, file: filePath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Commit graph ──────────────────────────────────────────────────────────────
app.get('/api/repos/:name/graph', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  try { res.json({ graph: await gitRun(['log', '--graph', '--format=%h %s %d', '--all', '--max-count=80'], rp) }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Zip export ────────────────────────────────────────────────────────────────
app.get('/api/repos/:name/export.zip', requireAuth, (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const archiver = require('archiver');
  const archive = archiver('zip', { zlib: { level: 6 } });
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}.zip"`);
  archive.pipe(res);
  archive.glob('**/*', { cwd: rp, ignore: ['.git/**'] });
  archive.finalize();
});

// ── File upload ───────────────────────────────────────────────────────────────
const multer = require('multer');
const upload = multer({ dest: path.join(__dirname, '.upload-tmp') });
app.post('/api/repos/:name/upload', requireAuth, upload.array('files'), async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const subPath = (req.body.subPath || '').replace(/\\/g, '/').replace(/^\//, '');
  const git = simpleGit(rp);
  const committed = [];
  try {
    for (const file of req.files || []) {
      const destRel = subPath ? `${subPath}/${file.originalname}` : file.originalname;
      const dest = safePath(rp, destRel);
      if (!dest) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(file.path, dest);
      await git.add(destRel);
      committed.push(destRel);
    }
    if (committed.length) { await setGitUser(git, req); await git.commit(req.body.message || `Upload ${committed.length} file(s)`); }
    res.json({ success: true, files: committed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Settings ──────────────────────────────────────────────────────────────────
app.patch('/api/repos/:name/settings', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const owner = getRepoOwner(rp), who = (req.user || {}).username;
  if (owner && owner !== who) return res.status(403).json({ error: 'Only the owner can change settings' });
  const { description, newName } = req.body;
  try {
    if (description !== undefined) fs.writeFileSync(path.join(rp, '.git', 'description'), description);
    if (newName && newName !== req.params.name) {
      const newRp = safeRepoPath(newName);
      if (!newRp) return res.status(400).json({ error: 'Invalid name' });
      if (fs.existsSync(newRp)) return res.status(409).json({ error: 'Name already taken' });
      fs.renameSync(rp, newRp);
      return res.json({ success: true, name: newName });
    }
    res.json({ success: true, name: req.params.name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Fork ──────────────────────────────────────────────────────────────────────
app.post('/api/repos/:name/fork', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const who = (req.user || {}).username;
  const forkName = req.body.name || `${req.params.name}-${who}`;
  const forkRp = safeRepoPath(forkName);
  if (!forkRp) return res.status(400).json({ error: 'Invalid fork name' });
  if (fs.existsSync(forkRp)) return res.status(409).json({ error: 'Name already taken' });
  try {
    await gitRun(['clone', '--local', rp, forkRp], __dirname);
    fs.writeFileSync(path.join(forkRp, '.git', 'forge-owner'), who);
    logActivity('fork', { repo: forkName, forkedFrom: req.params.name, user: who });
    res.json({ success: true, name: forkName });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Clone from URL ────────────────────────────────────────────────────────────
app.post('/api/clone', requireAuth, (req, res) => {
  const { url, name } = req.body;
  if (!url || !name) return res.status(400).json({ error: 'url and name required' });
  const rp = safeRepoPath(name);
  if (!rp) return res.status(400).json({ error: 'Invalid name' });
  if (fs.existsSync(rp)) return res.status(409).json({ error: 'Already exists' });
  const proc = spawn('git', ['clone', url, rp], { stdio: 'pipe' });
  let stderr = '';
  proc.stderr.on('data', d => stderr += d);
  proc.on('close', code => {
    if (code !== 0) { try { fs.rmSync(rp, { recursive: true, force: true }); } catch {} return res.status(500).json({ error: stderr || 'Clone failed' }); }
    const who = (req.user || {}).username;
    fs.writeFileSync(path.join(rp, '.git', 'forge-owner'), who);
    logActivity('clone', { repo: name, url, user: who });
    res.json({ success: true, name });
  });
  proc.on('error', err => res.status(500).json({ error: err.message }));
});

// ── Import local repo ─────────────────────────────────────────────────────────
app.post('/api/import', requireAuth, (req, res) => {
  const { localPath, name } = req.body;
  if (!localPath || !name) return res.status(400).json({ error: 'localPath and name required' });
  if (!fs.existsSync(path.join(localPath, '.git'))) return res.status(400).json({ error: 'Not a git repository' });
  const rp = safeRepoPath(name);
  if (!rp) return res.status(400).json({ error: 'Invalid name' });
  if (fs.existsSync(rp)) return res.status(409).json({ error: 'Already exists' });
  try {
    fs.cpSync(localPath, rp, { recursive: true });
    const who = (req.user || {}).username;
    fs.writeFileSync(path.join(rp, '.git', 'forge-owner'), who);
    logActivity('import', { repo: name, localPath, user: who });
    res.json({ success: true, name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Webhooks ──────────────────────────────────────────────────────────────────
const webhooksFile = rp => path.join(rp, '.git', 'forge-webhooks.json');
const loadWebhooks = rp => { try { return JSON.parse(fs.readFileSync(webhooksFile(rp), 'utf-8')); } catch { return []; } };
app.get('/api/repos/:name/webhooks', requireAuth, (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  res.json(loadWebhooks(rp));
});
app.post('/api/repos/:name/webhooks', requireAuth, (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  const { url, events } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  const hooks = loadWebhooks(rp);
  const hook = { id: Date.now().toString(), url, events: events || ['push'], active: true, createdAt: new Date().toISOString() };
  hooks.push(hook);
  fs.writeFileSync(webhooksFile(rp), JSON.stringify(hooks, null, 2));
  res.json(hook);
});
app.delete('/api/repos/:name/webhooks/:id', requireAuth, (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  fs.writeFileSync(webhooksFile(rp), JSON.stringify(loadWebhooks(rp).filter(h => h.id !== req.params.id), null, 2));
  res.json({ success: true });
});

// ── Contribution heatmap ──────────────────────────────────────────────────────
app.get('/api/heatmap', requireAuth, async (req, res) => {
  const entries = fs.existsSync(REPOS_DIR) ? fs.readdirSync(REPOS_DIR) : [];
  const repos = entries.filter(d => fs.existsSync(path.join(REPOS_DIR, d, '.git')));
  const counts = {};
  const since = new Date(); since.setFullYear(since.getFullYear() - 1);
  await Promise.all(repos.map(async name => {
    try {
      const out = await gitRun(['log', `--after=${since.toISOString()}`, '--format=%ad', '--date=short'], path.join(REPOS_DIR, name));
      out.split('\n').filter(Boolean).forEach(d => { counts[d] = (counts[d] || 0) + 1; });
    } catch {}
  }));
  res.json(counts);
});

// ── Users management ──────────────────────────────────────────────────────────
app.get('/api/users', requireAuth, (req, res) => {
  res.json(loadUsers().map(u => ({ username: u.username, createdAt: u.createdAt, role: u.role || 'owner' })));
});
app.post('/api/users', requireAuth, async (req, res) => {
  const users = loadUsers();
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (users.find(u => u.username === username)) return res.status(409).json({ error: 'Username taken' });
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) return res.status(400).json({ error: 'Invalid username' });
  if (password.length < 6) return res.status(400).json({ error: 'Password min 6 chars' });
  const hash = await bcrypt.hash(password, 12);
  users.push({ username, password: hash, role: role || 'contributor', createdAt: new Date().toISOString() });
  saveUsers(users);
  res.json({ username, role: role || 'contributor' });
});
app.delete('/api/users/:username', requireAuth, (req, res) => {
  saveUsers(loadUsers().filter(u => u.username !== req.params.username));
  res.json({ success: true });
});

// ── Account settings ──────────────────────────────────────────────────────────
app.get('/api/account', requireAuth, (req, res) => {
  const users = loadUsers();
  const user = users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    username: user.username,
    displayName: user.displayName || '',
    email: user.email || '',
    bio: user.bio || '',
    location: user.location || '',
    website: user.website || '',
    createdAt: user.createdAt,
    role: user.role || 'admin',
    hasCliToken: !!user.cliToken,
    cliToken: user.cliToken || null
  });
});

app.patch('/api/account', requireAuth, (req, res) => {
  const users = loadUsers();
  const user = users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { displayName, email, bio, location, website } = req.body;
  if (displayName !== undefined) user.displayName = String(displayName).trim().slice(0, 100);
  if (email !== undefined) user.email = String(email).trim().slice(0, 200);
  if (bio !== undefined) user.bio = String(bio).trim().slice(0, 500);
  if (location !== undefined) user.location = String(location).trim().slice(0, 100);
  if (website !== undefined) user.website = String(website).trim().slice(0, 200);
  saveUsers(users);
  res.json({ success: true });
});

app.post('/api/account/password', requireAuth, async (req, res) => {
  const users = loadUsers();
  const user = users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  if (!(await bcrypt.compare(currentPassword, user.password))) return res.status(401).json({ error: 'Current password is incorrect' });
  user.password = await bcrypt.hash(newPassword, 12);
  saveUsers(users);
  res.json({ success: true });
});

app.post('/api/account/token/regenerate', requireAuth, (req, res) => {
  const users = loadUsers();
  const user = users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.cliToken = crypto.randomBytes(28).toString('hex');
  saveUsers(users);
  res.json({ token: user.cliToken });
});

app.delete('/api/account/token', requireAuth, (req, res) => {
  const users = loadUsers();
  const user = users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  delete user.cliToken;
  saveUsers(users);
  res.json({ success: true });
});

app.delete('/api/account', requireAuth, async (req, res) => {
  const users = loadUsers();
  const user = users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required to confirm deletion' });
  if (!(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Incorrect password' });
  const remaining = users.filter(u => u.username !== req.user.username);
  const hasOtherAdmin = remaining.some(u => !u.role || u.role === 'admin');
  if (!hasOtherAdmin && (!user.role || user.role === 'admin')) {
    return res.status(403).json({ error: 'Cannot delete the last admin account' });
  }
  saveUsers(remaining);
  req.session.destroy(() => {});
  res.json({ success: true });
});

// ── Avatar proxy (fetches & caches GitHub avatars) ────────────────────────────
const https = require('https');
const AVATAR_DIR = path.join(__dirname, '.avatar-cache');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

function svgAvatar(username) {
  const palette = ['#f97316','#3b82f6','#8b5cf6','#22c55e','#ec4899','#06b6d4','#eab308','#ef4444','#14b8a6','#a855f7'];
  let h = 0; for (const c of String(username)) h = (Math.imul(31,h)+c.charCodeAt(0))|0;
  const fill = palette[Math.abs(h) % palette.length];
  const letter = String(username).slice(0,1).toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="${fill}"/><text x="20" y="27" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial" font-size="17" font-weight="700" fill="white">${letter}</text></svg>`;
}

app.get('/api/avatar/:username', (req, res) => {
  const raw = req.params.username.replace(/[^a-zA-Z0-9_.-]/g,'');
  if (!raw) { res.type('svg').send(svgAvatar('?')); return; }
  const cachePath = path.join(AVATAR_DIR, raw + '.img');
  const metaPath  = path.join(AVATAR_DIR, raw + '.ct');
  if (fs.existsSync(cachePath)) {
    const ct = fs.existsSync(metaPath) ? fs.readFileSync(metaPath,'utf-8') : 'image/jpeg';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public,max-age=86400');
    return fs.createReadStream(cachePath).pipe(res);
  }
  const url = `https://avatars.githubusercontent.com/${raw}?size=80`;
  const req2 = https.get(url, r => {
    if (r.statusCode !== 200) {
      res.type('svg').setHeader('Cache-Control','public,max-age=3600').send(svgAvatar(raw)); return;
    }
    const ct = r.headers['content-type'] || 'image/jpeg';
    const chunks = [];
    r.on('data', d => chunks.push(d));
    r.on('end', () => {
      const buf = Buffer.concat(chunks);
      try { fs.writeFileSync(cachePath, buf); fs.writeFileSync(metaPath, ct); } catch {}
      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'public,max-age=86400');
      res.end(buf);
    });
  });
  req2.on('error', () => res.type('svg').send(svgAvatar(raw)));
  req2.setTimeout(5000, () => { req2.destroy(); res.type('svg').send(svgAvatar(raw)); });
});

// ── Language stats ────────────────────────────────────────────────────────────
const LANG_EXT = {js:'JavaScript',mjs:'JavaScript',cjs:'JavaScript',jsx:'JavaScript',ts:'TypeScript',tsx:'TypeScript',py:'Python',rb:'Ruby',go:'Go',rs:'Rust',java:'Java',c:'C',cpp:'C++',cc:'C++',cxx:'C++',h:'C',hpp:'C++',cs:'C#',php:'PHP',swift:'Swift',kt:'Kotlin',kts:'Kotlin',vue:'Vue',svelte:'Svelte',html:'HTML',css:'CSS',scss:'SCSS',sass:'SCSS',sh:'Shell',bash:'Shell',zsh:'Shell',fish:'Shell',md:'Markdown',json:'JSON',yaml:'YAML',yml:'YAML',toml:'TOML',sql:'SQL',r:'R',lua:'Lua',dart:'Dart',ex:'Elixir',exs:'Elixir',hs:'Haskell',scala:'Scala',clj:'Clojure',ml:'OCaml',cmake:'CMake',makefile:'Makefile',dockerfile:'Dockerfile',astro:'Astro',tf:'HCL',proto:'Protobuf',graphql:'GraphQL',gql:'GraphQL'};

app.get('/api/repos/:name/languages', requireAuth, async (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  try {
    const out = await gitRun(['ls-files'], rp).catch(() => '');
    const counts = {};
    out.split('\n').filter(Boolean).forEach(f => {
      const base = path.basename(f).toLowerCase();
      const ext = base.includes('.') ? base.split('.').pop() : base;
      const lang = LANG_EXT[ext] || LANG_EXT[base];
      if (lang) counts[lang] = (counts[lang] || 0) + 1;
    });
    const total = Math.max(Object.values(counts).reduce((a, b) => a + b, 0), 1);
    const langs = Object.entries(counts)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, n]) => ({ name, pct: Math.round(n / total * 1000) / 10 }));
    res.json(langs);
  } catch { res.json([]); }
});

// ── Auto-sync (pull updates from GitHub remotes) ──────────────────────────────
const syncState = {};   // { [repoName]: { status, lastCheck, lastUpdate, error, commits } }
let _syncRunning = false;
const SYNC_INTERVAL_MS = 10 * 60 * 1000; // check every 10 minutes

async function syncOneRepo(name) {
  const rp = path.join(REPOS_DIR, name);
  if (!fs.existsSync(path.join(rp, '.git'))) return;

  const prev = syncState[name] || {};
  if (prev.status === 'checking' || prev.status === 'pulling') return;

  syncState[name] = { ...prev, status: 'checking', lastCheck: new Date().toISOString() };

  try {
    const git = simpleGit(rp);

    // Only sync repos with a GitHub remote
    const remotes = await git.getRemotes(true).catch(() => []);
    const origin  = remotes.find(r => r.name === 'origin');
    if (!origin) {
      syncState[name] = { ...prev, status: 'idle', noRemote: true, lastCheck: new Date().toISOString() };
      return;
    }
    const fetchUrl = origin.refs?.fetch || origin.refs?.push || '';
    if (!fetchUrl.includes('github.com')) {
      syncState[name] = { ...prev, status: 'idle', noRemote: true, lastCheck: new Date().toISOString() };
      return;
    }

    // Detect default branch
    const branch = (await git.revparse(['--abbrev-ref', 'HEAD']).catch(() => 'main')).trim() || 'main';

    // Shallow-fetch the latest commit from origin
    await git.fetch(['origin', branch, '--depth=1']);

    const localHead  = (await git.revparse(['HEAD']).catch(() => '')).trim();
    const remoteHead = (await git.revparse(['FETCH_HEAD']).catch(() => '')).trim();

    if (!remoteHead) {
      syncState[name] = { ...syncState[name], status: 'idle' };
      return;
    }

    if (localHead !== remoteHead) {
      syncState[name] = { ...syncState[name], status: 'pulling' };
      await git.reset(['--hard', 'FETCH_HEAD']);

      const newLog = await git.log(['--max-count=5']).catch(() => ({ all: [] }));
      syncState[name] = {
        ...syncState[name],
        status:     'idle',
        lastUpdate: new Date().toISOString(),
        commits:    newLog.all.map(c => ({ hash: c.hash.slice(0,7), message: c.message, author: c.author_name, date: c.date })),
        error:      null,
      };
      console.log(`  [sync] ${name} pulled new commits`);
    } else {
      syncState[name] = { ...syncState[name], status: 'idle', error: null };
    }
  } catch (err) {
    const msg = err.message?.split('\n').find(l => l.trim()) || err.message;
    syncState[name] = { ...syncState[name], status: 'error', error: msg.slice(0, 200) };
  }
}

async function syncAllRepos() {
  if (_syncRunning) return;
  _syncRunning = true;
  try {
    const entries = fs.existsSync(REPOS_DIR) ? fs.readdirSync(REPOS_DIR) : [];
    const repos   = entries.filter(d => fs.existsSync(path.join(REPOS_DIR, d, '.git')));
    console.log(`[sync] starting — ${repos.length} repos`);
    for (const name of repos) {
      await syncOneRepo(name);
    }
    console.log('[sync] cycle complete');
  } finally {
    _syncRunning = false;
  }
}

// Kick off 15s after startup, then repeat
setTimeout(syncAllRepos, 15_000);
setInterval(syncAllRepos, SYNC_INTERVAL_MS);

// ── Sync API ──────────────────────────────────────────────────────────────────
app.get('/api/sync-status', requireAuth, (_req, res) => {
  const syncing = Object.values(syncState).some(s => s.status === 'checking' || s.status === 'pulling');
  res.json({ syncing, repos: syncState });
});

app.post('/api/repos/:name/sync', requireAuth, (req, res) => {
  const rp = safeRepoPath(req.params.name);
  if (!rp || !fs.existsSync(path.join(rp, '.git'))) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
  syncOneRepo(req.params.name);   // fire-and-forget
});

app.post('/api/sync-all', requireAuth, (req, res) => {
  res.json({ ok: true });
  syncAllRepos();
});

realApp.use(BASE_PATH || '/', app);

realApp.listen(PORT, () => {
  console.log(`\n  Forge is running at http://localhost:${PORT}${BASE_PATH}\n`);
});
