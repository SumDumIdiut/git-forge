#!/usr/bin/env node
// seed-repos.js — clone popular GitHub repos into Forge, create bot accounts
// Usage:  node seed-repos.js
//         node seed-repos.js --dry-run       (show what would happen, no cloning)
//         node seed-repos.js --skip-existing (skip repos already on disk, default)

'use strict';

const { execSync } = require('child_process');
const https = require('https');
const fs   = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// ── Config ────────────────────────────────────────────────────────────────────
const REPOS_DIR  = path.join(__dirname, 'repos');
const USERS_FILE = path.join(__dirname, 'users.json');
const AVATAR_DIR = path.join(__dirname, '.avatar-cache');
const BOT_PASS   = 'bot';           // password for every bot account (< 6 chars — bypassed here)
const CLONE_DEPTH = 1;              // shallow clone; increase or set to 0 for full history
const CLONE_TIMEOUT_MS = 5 * 60 * 1000;  // 5 min per repo
const DRY_RUN = process.argv.includes('--dry-run');

// ── Repos to seed ─────────────────────────────────────────────────────────────
// Format: "owner/repo"  —  edit freely
const REPOS = [
  // React ecosystem
  'facebook/react',
  'facebook/relay',
  'reduxjs/redux',
  'pmndrs/zustand',
  'TanStack/query',

  // Vue / Svelte / Angular
  'vuejs/vue',
  'vuejs/core',
  'sveltejs/svelte',
  'angular/angular',

  // Meta-frameworks & build tools
  'vercel/next.js',
  'remix-run/remix',
  'vitejs/vite',
  'evanw/esbuild',
  'webpack/webpack',

  // Styling
  'tailwindlabs/tailwindcss',
  'shadcn-ui/ui',
  'emotion-js/emotion',

  // Runtime / Language
  'denoland/deno',
  'oven-sh/bun',
  'nicolo-ribaudo/tc39-proposal-decorators',

  // Backend / APIs
  'expressjs/express',
  'fastify/fastify',
  'trpc/trpc',
  'supabase/supabase',
  'prisma/prisma',

  // Mobile
  'facebook/react-native',
  'expo/expo',
  'flutter/flutter',

  // Python
  'django/django',
  'pallets/flask',
  'tiangolo/fastapi',
  'huggingface/transformers',
  'openai/openai-python',
  'anthropics/anthropic-sdk-python',

  // Infrastructure / DevOps
  'docker/compose',
  'hashicorp/terraform',
  'cli/cli',                   // GitHub CLI

  // Databases
  'redis/redis',
  'mongodb/mongo',

  // Editors / Tools
  'microsoft/vscode',
  'neovim/neovim',
  'prettier/prettier',
  'eslint/eslint',

  // AI / ML
  'ollama/ollama',
  'ggerganov/llama.cpp',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const log  = (...a) => console.log(...a);
const info = (...a) => console.log('\x1b[36m' + a.join(' ') + '\x1b[0m');
const ok   = (...a) => console.log('\x1b[32m✓\x1b[0m', ...a);
const warn = (...a) => console.log('\x1b[33m⚠\x1b[0m', ...a);
const fail = (...a) => console.log('\x1b[31m✗\x1b[0m', ...a);

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')); } catch { return []; }
}
function saveUsers(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }

// Sanitise a GitHub repo name into something Forge accepts (letters/nums/-._)
function safeName(str) { return str.replace(/[^a-zA-Z0-9_.-]/g, '-'); }

// ── User creation ─────────────────────────────────────────────────────────────
const userCache = new Set();

async function ensureUser(username) {
  if (userCache.has(username)) return;
  const users = loadUsers();
  if (users.find(u => u.username === username)) {
    userCache.add(username);
    return;
  }
  if (DRY_RUN) { log(`  [dry] would create user @${username}`); userCache.add(username); return; }

  // bcrypt cost 8 — fast enough for bulk, still hashed
  const hash = await bcrypt.hash(BOT_PASS, 8);
  users.push({
    username,
    password: hash,
    role: 'contributor',
    bot: true,
    createdAt: new Date().toISOString(),
  });
  saveUsers(users);
  ok(`created user @${username}  (password: "${BOT_PASS}")`);
  userCache.add(username);
}

// ── Cloning ───────────────────────────────────────────────────────────────────
function cloneRepo(owner, repo, destName) {
  const destPath = path.join(REPOS_DIR, destName);

  if (fs.existsSync(path.join(destPath, '.git'))) {
    warn(`repo "${destName}" already on disk — skipping clone`);
    return { path: destPath, existed: true };
  }

  const url   = `https://github.com/${owner}/${repo}.git`;
  const depth = CLONE_DEPTH > 0 ? `--depth=${CLONE_DEPTH}` : '';
  const cmd   = `git clone ${depth} "${url}" "${destPath}"`.trim();

  log(`  cloning ${url} …`);

  if (DRY_RUN) { log(`  [dry] would run: ${cmd}`); return { path: destPath, existed: false }; }

  try {
    execSync(cmd, { stdio: 'inherit', timeout: CLONE_TIMEOUT_MS });
    return { path: destPath, existed: false };
  } catch (err) {
    fail(`clone failed for ${owner}/${repo}:`, err.message.split('\n')[0]);
    try { fs.rmSync(destPath, { recursive: true, force: true }); } catch {}
    return null;
  }
}

function setOwner(repoPath, username) {
  if (DRY_RUN) return;
  const f = path.join(repoPath, '.git', 'forge-owner');
  fs.writeFileSync(f, username);
}

// ── Avatar download ───────────────────────────────────────────────────────────
function downloadAvatar(username) {
  const cachePath = path.join(AVATAR_DIR, username + '.img');
  const metaPath  = path.join(AVATAR_DIR, username + '.ct');
  if (fs.existsSync(cachePath)) return Promise.resolve('cached');

  return new Promise(resolve => {
    const url = `https://avatars.githubusercontent.com/${username}?size=80`;
    const req = https.get(url, r => {
      if (r.statusCode !== 200) { r.resume(); resolve('fail'); return; }
      const ct = r.headers['content-type'] || 'image/jpeg';
      const chunks = [];
      r.on('data', d => chunks.push(d));
      r.on('end', () => {
        try {
          fs.writeFileSync(cachePath, Buffer.concat(chunks));
          fs.writeFileSync(metaPath, ct);
          resolve('ok');
        } catch { resolve('fail'); }
      });
      r.on('error', () => resolve('fail'));
    });
    req.on('error', () => resolve('fail'));
    req.setTimeout(10000, () => { req.destroy(); resolve('fail'); });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(REPOS_DIR, { recursive: true });

  log('\n\x1b[1m🔥 Forge repo seeder\x1b[0m');
  log(`   ${REPOS.length} repos · depth=${CLONE_DEPTH || 'full'} · password="${BOT_PASS}"`);
  if (DRY_RUN) log('   \x1b[33mDRY RUN — nothing will be written\x1b[0m');
  log('');

  const results = { cloned: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < REPOS.length; i++) {
    const slug = REPOS[i];
    const [owner, repo] = slug.split('/');
    if (!owner || !repo) { warn(`bad slug "${slug}", skipping`); continue; }

    const destName = safeName(repo);   // store by repo name; owner is forge-owner
    info(`[${String(i+1).padStart(2)}/${REPOS.length}] ${slug}  →  repos/${destName}`);

    await ensureUser(owner);

    const result = cloneRepo(owner, repo, destName);
    if (!result) { results.failed++; continue; }

    setOwner(result.path, owner);

    if (result.existed) { results.skipped++; ok(`already exists, owner set to @${owner}`); }
    else                { results.cloned++;  ok(`cloned  →  owned by @${owner}`); }

    log('');
  }

  // ── Profile pictures ──────────────────────────────────────────────────────
  const owners = [...new Set(REPOS.map(s => s.split('/')[0]).filter(Boolean))];
  info(`\nDownloading ${owners.length} profile pictures…`);

  if (DRY_RUN) {
    log(`  [dry] would download avatars for: ${owners.join(', ')}`);
  } else {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
    let avFresh = 0, avCached = 0, avFailed = 0;
    for (const owner of owners) {
      const r = await downloadAvatar(owner);
      if      (r === 'ok')     { avFresh++;  ok(`  ${owner}`); }
      else if (r === 'cached') { avCached++; }
      else                     { avFailed++; fail(`  ${owner}`); }
    }
    log(`  ${avFresh} downloaded · ${avCached} already cached · ${avFailed} failed`);
  }

  log('\n' + '─'.repeat(50));
  log(`\x1b[1mDone\x1b[0m  ·  ` +
      `\x1b[32m${results.cloned} cloned\x1b[0m  ·  ` +
      `${results.skipped} skipped  ·  ` +
      `\x1b[31m${results.failed} failed\x1b[0m`);
  log('');

  if (!DRY_RUN && results.cloned + results.skipped > 0) {
    log('Restart Forge (node server.js) if it was already running, then refresh.\n');
  }
}

main().catch(err => { fail('Fatal:', err.message); process.exit(1); });
