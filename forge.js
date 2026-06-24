#!/usr/bin/env node
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');
const { exec } = require('child_process');

const FORGE_DIR = __dirname;
const REPOS_DIR = path.join(FORGE_DIR, 'repos');
const AUTH_FILE = path.join(os.homedir(), '.forge-auth');
const GITHUB_AUTH_FILE = path.join(os.homedir(), '.forge-github');
const PORT = 3000;

// ── ANSI colours ──────────────────────────────────────────────────────────────
const R = '\x1b[0m';
const BOLD = s => `\x1b[1m${s}${R}`;
const DIM  = s => `\x1b[2m${s}${R}`;
const ORG  = s => `\x1b[38;5;208m${s}${R}`;
const GRN  = s => `\x1b[32m${s}${R}`;
const RED  = s => `\x1b[31m${s}${R}`;
const BLU  = s => `\x1b[34m${s}${R}`;
const CYN  = s => `\x1b[36m${s}${R}`;
const YLW  = s => `\x1b[33m${s}${R}`;
const GRY  = s => `\x1b[90m${s}${R}`;

// ── Credentials ───────────────────────────────────────────────────────────────
function loadAuth() {
  if (!fs.existsSync(AUTH_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8')); } catch { return null; }
}
function saveAuth(data) {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(data), { mode: 0o600 });
}
function clearAuth() {
  if (fs.existsSync(AUTH_FILE)) fs.unlinkSync(AUTH_FILE);
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(method, urlPath, body, { token } = {}) {
  return new Promise((resolve, reject) => {
    const auth = token || loadAuth()?.token || '';
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: PORT, path: urlPath, method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { 'Authorization': `Bearer ${auth}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      }
    };
    const req = http.request(opts, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          if (res.statusCode === 401) reject(Object.assign(new Error(json.error || 'Not authenticated'), { code: 'UNAUTH' }));
          else if (res.statusCode >= 400) reject(new Error(json.error || raw));
          else resolve(json);
        } catch { reject(new Error(raw)); }
      });
    });
    req.on('error', () => reject(new Error(
      `Cannot reach Forge server at http://localhost:${PORT}\n  Start it with: node server.js`
    )));
    if (data) req.write(data);
    req.end();
  });
}

// ── Prompts ───────────────────────────────────────────────────────────────────
function prompt(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, ans => { rl.close(); resolve(ans.trim()); });
  });
}
function promptPassword(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    process.stdout.write(question);
    rl.question('', pw => {
      rl.close();
      process.stdout.write('\n');
      resolve(pw);
    });
  });
}

// ── Repo detection ────────────────────────────────────────────────────────────
function detectRepo() {
  const cwd = process.cwd().replace(/\\/g, '/');
  const base = REPOS_DIR.replace(/\\/g, '/');
  if (cwd.startsWith(base + '/') || cwd.startsWith(base + '\\')) {
    const rel = cwd.slice(base.length + 1);
    return rel.split('/')[0] || null;
  }
  return null;
}

async function resolveRepo(name) {
  if (name) return name;
  const detected = detectRepo();
  if (detected) return detected;
  throw new Error('No repo specified and not inside a Forge repo directory.\n  Usage: forge <reponame> <command>');
}

// ── Commands ──────────────────────────────────────────────────────────────────
async function cmdRepos() {
  const repos = await request('GET', '/api/repos');
  if (!repos.length) {
    console.log(DIM('  No repositories. Create one: forge new <name>'));
    return;
  }
  console.log('');
  console.log(BOLD(`  Repositories (${repos.length})`));
  console.log('');
  for (const r of repos) {
    const br = BLU(`[${r.branch || 'main'}]`);
    const msg = r.lastCommit ? GRY(` — ${r.lastCommit.message.slice(0, 55)}`) : GRY(' — no commits');
    console.log(`  ${ORG(BOLD(r.name))} ${br}${msg}`);
    if (r.description) console.log(`  ${GRY(r.description)}`);
  }
  console.log('');
}

async function cmdNew(args) {
  const name = args[0];
  if (!name) {
    console.error(RED('✗') + ' Usage: forge new <name> [description]');
    process.exit(1);
  }
  const description = args.slice(1).join(' ');
  await request('POST', '/api/repos', { name, description, initWithReadme: true });
  console.log(GRN('✓') + ` Repository ${BOLD(name)} created`);
  console.log(GRY(`  Path: ${path.join(REPOS_DIR, name)}`));
}

async function cmdOpen(name) {
  const repo = await resolveRepo(name);
  const url = `http://localhost:${PORT}/#/${repo}`;
  exec(`start "" "${url}"`);
  console.log(GRN('✓') + ` Opened ${CYN(url)}`);
}

async function cmdInfo(name) {
  const repo = await resolveRepo(name);
  const info = await request('GET', `/api/repos/${repo}`);
  console.log('');
  console.log(`  ${BOLD(ORG(info.name))}${info.description ? '  ' + GRY(info.description) : ''}`);
  console.log(`  Branch: ${BLU(info.currentBranch)}   Commits: ${BOLD(info.totalCommits)}`);
  if (info.remotes && info.remotes.length) {
    for (const r of info.remotes) {
      const url = (r.refs && (r.refs.fetch || r.refs.push)) || '';
      console.log(`  Remote: ${CYN(r.name)} ${GRY('→')} ${GRY(url)}`);
    }
  } else {
    console.log(`  ${YLW('No remotes')} — add one via the Forge UI or: forge ${repo} remote add origin <url>`);
  }
  if (info.status) {
    const s = info.status;
    const state = s.isClean
      ? GRN('clean')
      : YLW(`${s.modified} modified, ${s.staged} staged, ${s.untracked} untracked`);
    console.log(`  Status: ${state}`);
  }
  if (info.commits && info.commits.length) {
    console.log('');
    console.log(GRY('  Recent commits:'));
    info.commits.slice(0, 6).forEach(c => {
      console.log(`  ${GRY(c.hash)}  ${c.message.slice(0, 64).padEnd(64)}  ${GRY(c.relative)}`);
    });
  }
  console.log('');
}

async function cmdGit(repoName, gitArgs) {
  const repo = await resolveRepo(repoName);
  const command = gitArgs.join(' ');
  console.log(GRY(`$ git ${command}`));
  const result = await request('POST', `/api/repos/${repo}/exec`, { command });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) {
    const text = result.stderr.trim();
    if (text) process.stderr.write((result.code !== 0 ? RED(text) : GRY(text)) + '\n');
  }
  if (result.code !== 0) process.exit(result.code);
}

async function cmdRemoteAdd(repo, name, url) {
  if (!name || !url) {
    console.error(RED('✗') + ' Usage: forge <repo> remote add <name> <url>');
    process.exit(1);
  }
  await request('POST', `/api/repos/${repo}/remotes`, { name, url });
  console.log(GRN('✓') + ` Remote ${BOLD(name)} → ${GRY(url)}`);
}

async function cmdLogin() {
  const status = await request('GET', '/api/auth/status', null, { token: '' }).catch(() => ({ setup: false }));

  let username, token;
  if (status.setup) {
    console.log(DIM('  No accounts configured. Signing in as local guest…'));
    const data = await request('POST', '/api/auth/cli-login', {}, { token: '' });
    token = data.token; username = data.username;
  } else {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    username = await new Promise(r => rl.question(`  Username: `, a => r(a.trim())));
    const password = await new Promise(r => rl.question(`  Password: `, a => r(a)));
    rl.close();

    const data = await request('POST', '/api/auth/cli-login', { username, password }, { token: '' });
    token = data.token; username = data.username;
  }

  saveAuth({ token, username });
  console.log(GRN('✓') + ` Signed in as ${BOLD(username)}`);
  console.log(GRY(`  Credentials saved to ${AUTH_FILE}`));
}

async function cmdLogout() {
  const auth = loadAuth();
  if (!auth) { console.log(DIM('  Not signed in.')); return; }
  try { await request('POST', '/api/auth/cli-logout'); } catch {}
  clearAuth();
  console.log(GRN('✓') + ` Signed out`);
}

async function cmdWhoami() {
  const auth = loadAuth();
  if (!auth) {
    console.log(YLW('  Not signed in.') + '  Run: forge login');
    return;
  }
  try {
    await request('GET', '/api/repos'); // test the token
    console.log(GRN('✓') + ` Signed in as ${BOLD(auth.username)}`);
  } catch (err) {
    if (err.code === 'UNAUTH') {
      clearAuth();
      console.log(RED('✗') + ' Session expired. Run: forge login');
    } else throw err;
  }
}

async function cmdDelete(name) {
  const repo = await resolveRepo(name);
  const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  readline.question(`  Delete ${RED(repo)}? This cannot be undone. Type the name to confirm: `, async answer => {
    readline.close();
    if (answer.trim() !== repo) { console.log(GRY('Aborted.')); return; }
    await request('DELETE', `/api/repos/${repo}`);
    console.log(GRN('✓') + ` Repository ${repo} deleted`);
  });
}

// ── Clone from URL ────────────────────────────────────────────────────────────
async function cmdClone(args) {
  const url = args[0];
  if (!url) throw new Error('Usage: forge clone <url> [name]');
  const name = args[1] || url.split('/').pop().replace(/\.git$/, '');
  process.stdout.write(`  Cloning ${url} as ${BOLD(name)}…`);
  const result = await request('POST', '/api/clone', { url, name });
  process.stdout.write(' ' + GRN('✓') + '\n');
  console.log(GRY(`  Path: ${path.join(REPOS_DIR, result.name)}`));
}

// ── Import local repo ─────────────────────────────────────────────────────────
async function cmdImport(args) {
  const localPath = args[0] ? path.resolve(args[0]) : null;
  if (!localPath) throw new Error('Usage: forge import <path> [name]');
  const name = args[1] || path.basename(localPath);
  await request('POST', '/api/import', { localPath, name });
  console.log(GRN('✓') + ` Imported as ${BOLD(name)}`);
}

// ── GitHub helpers ────────────────────────────────────────────────────────────
function loadGithubAuth() {
  if (!fs.existsSync(GITHUB_AUTH_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(GITHUB_AUTH_FILE, 'utf-8')); } catch { return null; }
}
function saveGithubAuth(data) { fs.writeFileSync(GITHUB_AUTH_FILE, JSON.stringify(data), { mode: 0o600 }); }

function githubGet(apiPath, token) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const opts = {
      hostname: 'api.github.com', path: apiPath, method: 'GET',
      headers: { 'User-Agent': 'Forge-CLI/1.0', 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { const j = JSON.parse(raw); if (res.statusCode >= 400) reject(new Error(j.message || `HTTP ${res.statusCode}`)); else resolve(j); }
        catch { reject(new Error(raw.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── forge github-login ────────────────────────────────────────────────────────
async function cmdGithubLogin() {
  console.log(`\n  ${BOLD('GitHub Personal Access Token')}`);
  console.log(`  Generate one at: ${CYN('https://github.com/settings/tokens/new')}`);
  console.log(`  Required scopes: ${GRY('repo')} (private) or ${GRY('public_repo')} (public only)\n`);
  const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
  const token = await new Promise(r => rl2.question(`  Paste token: `, a => { rl2.close(); r(a.trim()); }));
  if (!token) throw new Error('No token provided');
  process.stdout.write('  Verifying… ');
  const user = await githubGet('/user', token);
  saveGithubAuth({ token, username: user.login, avatar: user.avatar_url });
  console.log(GRN('✓') + ` Authenticated as ${BOLD(user.login)} (@${user.login})`);
  console.log(GRY(`  ${user.public_repos} public repos, ${user.total_private_repos||0} private repos`));
}

// ── forge github-import ───────────────────────────────────────────────────────
async function cmdGithubImport(args) {
  let auth = loadGithubAuth();
  if (!auth) {
    console.log(YLW('  Not authenticated with GitHub. Running github-login first…\n'));
    await cmdGithubLogin();
    auth = loadGithubAuth();
  }

  console.log(GRY(`  Fetching repositories for @${auth.username}…`));
  let repos = [], page = 1;
  while (true) {
    const batch = await githubGet(`/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`, auth.token);
    if (!batch.length) break;
    repos.push(...batch);
    if (batch.length < 100) break;
    page++;
  }

  if (!repos.length) { console.log(GRY('  No repositories found.')); return; }

  // Filter out already imported ones
  const existing = new Set(fs.existsSync(REPOS_DIR) ? fs.readdirSync(REPOS_DIR) : []);

  console.log(`\n  ${BOLD(`Found ${repos.length} repositories on GitHub`)}\n`);
  repos.forEach((r, i) => {
    const priv = r.private ? YLW('[private]') : GRY('[public]');
    const already = existing.has(r.name) ? GRY(' (already imported)') : '';
    console.log(`  ${GRY((i+1).toString().padStart(3))}. ${BOLD(r.name)} ${priv}${already}${r.description ? GRY(' — ' + r.description.slice(0,50)) : ''}`);
  });

  console.log(`\n  Enter numbers to import (e.g. ${GRY('1,3,5')}), ${BOLD('all')} for all, or ${BOLD('new')} for not-yet-imported:`);
  const sel = await prompt('  > ');

  let toImport;
  if (sel.trim() === 'all') {
    toImport = repos;
  } else if (sel.trim() === 'new') {
    toImport = repos.filter(r => !existing.has(r.name));
  } else {
    const indices = sel.split(',').map(s => parseInt(s.trim()) - 1).filter(i => !isNaN(i) && i >= 0 && i < repos.length);
    toImport = indices.map(i => repos[i]);
  }

  if (!toImport.length) { console.log(GRY('  Nothing selected.')); return; }
  console.log('');

  let ok = 0, skip = 0, fail = 0;
  for (const repo of toImport) {
    if (existing.has(repo.name)) { console.log(YLW('~') + ` ${repo.name} — already exists, skipping`); skip++; continue; }
    process.stdout.write(`  ${GRY('↓')} ${repo.name.padEnd(40)}`);
    try {
      // Build authenticated clone URL
      const cloneUrl = repo.clone_url.replace('https://', `https://${auth.token}@`);
      await new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        const proc = spawn('git', ['clone', '--quiet', cloneUrl, path.join(REPOS_DIR, repo.name)], { stdio: 'pipe' });
        let stderr = '';
        proc.stderr.on('data', d => stderr += d);
        proc.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.trim().slice(0, 100))));
        proc.on('error', reject);
      });
      // Mark owner
      const who = loadAuth()?.username || 'local';
      try { fs.writeFileSync(path.join(REPOS_DIR, repo.name, '.git', 'forge-owner'), who); } catch {}
      process.stdout.write(GRN(' ✓') + '\n');
      ok++;
    } catch (e) {
      process.stdout.write(RED(' ✗') + ` ${e.message}\n`);
      fail++;
    }
  }

  console.log(`\n  ${GRN(`✓ ${ok} imported`)}${skip ? `  ${YLW(`${skip} skipped`)}` : ''}${fail ? `  ${RED(`${fail} failed`)}` : ''}\n`);
}

function printHelp() {
  console.log(`
  ${BOLD(ORG('forge'))} — local git repository manager

  ${BOLD('Usage:')}
    forge login                         Sign in (saves credentials)
    forge logout                        Sign out
    forge whoami                        Show current user

    forge repos                         List all repositories
    forge new <name> [description]      Create a repository
    forge clone <url> [name]            Clone from a remote URL
    forge import <path> [name]          Import an existing local git repo
    forge open [name]                   Open in browser
    forge delete <name>                 Delete a repository

    forge github-login                  Authenticate with GitHub (PAT)
    forge github-import                 Import repos from your GitHub account

    forge <name> status                 Git status
    forge <name> log [--oneline] [...]  Git log
    forge <name> push [remote] [branch] Push to remote
    forge <name> pull [remote] [branch] Pull from remote
    forge <name> diff [...]             Git diff
    forge <name> remote add <n> <url>   Add a remote
    forge <name> <any git subcommand>   Run any git command

  ${BOLD('Tip:')} ${GRY(`cd into a repo directory and omit the name:`)}
    cd ${GRY(REPOS_DIR)}\\myrepo
    forge status
    forge push origin main

  ${GRY(`Server: http://localhost:${PORT}`)}
`);
}

// ── Entry point ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (!args.length || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
  printHelp();
  process.exit(0);
}

(async () => {
  try {
    const cmd = args[0];

    if (cmd === 'login' || cmd === 'signin') {
      await cmdLogin();
    } else if (cmd === 'logout' || cmd === 'signout') {
      await cmdLogout();
    } else if (cmd === 'whoami') {
      await cmdWhoami();
    } else if (cmd === 'clone') {
      await cmdClone(args.slice(1));
    } else if (cmd === 'import') {
      await cmdImport(args.slice(1));
    } else if (cmd === 'github-login' || cmd === 'gh-login') {
      await cmdGithubLogin();
    } else if (cmd === 'github-import' || cmd === 'gh-import') {
      await cmdGithubImport(args.slice(1));
    } else if (cmd === 'repos' || cmd === 'list') {
      await cmdRepos();
    } else if (cmd === 'new' || cmd === 'create' || cmd === 'init') {
      await cmdNew(args.slice(1));
    } else if (cmd === 'open') {
      await cmdOpen(args[1]);
    } else if (cmd === 'delete' || cmd === 'rm') {
      await cmdDelete(args[1]);
    } else {
      // forge <reponame> [subcommand...]  OR  forge <subcommand> (detected repo)
      // Detect: is args[0] a known repo or a git subcommand when inside a repo?
      const sub = args.slice(1);

      if (!sub.length) {
        // forge <name>  — show info
        await cmdInfo(cmd);
      } else if (sub[0] === 'remote' && sub[1] === 'add') {
        await cmdRemoteAdd(cmd, sub[2], sub[3]);
      } else {
        // forge <name> <git args...>
        await cmdGit(cmd, sub);
      }
    }
  } catch (err) {
    if (err.code === 'UNAUTH') {
      console.error(RED('✗') + ' Not authenticated. Run: ' + BOLD('forge login'));
    } else {
      console.error(RED('✗') + ' ' + err.message);
    }
    process.exit(1);
  }
})();
