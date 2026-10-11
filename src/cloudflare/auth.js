import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { findCloudflared } from './process.js';
import { isProcessRunning } from '../utils/process.js';
import { logger } from '../logger.js';

/**
 * Path cloudflared writes cert.pem to after a successful `tunnel login`.
 * Same path cloudflared itself checks (see its own error message: "at the
 * path ... .cloudflared/cert.pem").
 */
export function getCertPath() {
  return path.join(os.homedir(), '.cloudflared', 'cert.pem');
}

/**
 * Optimistic check: cert.pem existing means login was completed at some
 * point, NOT that the cert is still valid (could be revoked/expired on
 * Cloudflare's side — only a real tunnel start would reveal that). Kept
 * simple on purpose (see Plan-first-run-onboarding.md §3).
 */
export function isCloudflareLoggedIn() {
  return fs.existsSync(getCertPath());
}

/**
 * State proses `cloudflared tunnel login` yang ditangani server.
 *
 * cloudflared bisa gagal menulis sertifikat ("Failed to write the
 * certificate ... error=Failed to fetch resource") padahal user sudah
 * approve di browser. Tanpa state ini UI hanya bisa menebak dari
 * keberadaan cert.pem, sehingga user dibilang "belum login" tanpa
 * tahu penyebabnya.
 */
const loginState = {
  pending: false,
  url: null,
  error: null,
  message: null,
  startedAt: null,
  finishedAt: null,
  pid: null,
  capturingError: false
};

let certWatcher = null;

function stopCertWatcher() {
  if (certWatcher) {
    clearInterval(certWatcher);
    certWatcher = null;
  }
}

function stripLevel(line) {
  return line.replace(/^\S+\s+(INF|ERR|DBG|WRN|FTL)\s+/, '');
}

function onLoginOutput(chunk) {
  for (const raw of chunk.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const url = line.match(/https:\/\/dash\.cloudflare\.com\/argotunnel\S+/);
    if (url) loginState.url = url[0].replace(/[),.]+$/, '');

    if (/\bERR\b/.test(line)) loginState.capturingError = true;

    // Setelah baris ERR, sisa output (instruksi manual, detail error)
    // ikut disimpan agar UI bisa menampilkan penyebab lengkapnya.
    if (loginState.capturingError) {
      const text = stripLevel(line);
      loginState.error = [loginState.error, text].filter(Boolean).join('\n');
      continue;
    }

    loginState.message = stripLevel(line);
  }
}

function settleLogin(code) {
  if (!loginState.pending) return;
  stopCertWatcher();
  loginState.pending = false;
  loginState.capturingError = false;
  loginState.finishedAt = new Date().toISOString();

  if (isCloudflareLoggedIn()) {
    loginState.error = null;
    loginState.message = 'Login berhasil — cert.pem tersimpan.';
    logger.info('Cloudflare login completed (cert.pem written)');
    return;
  }

  if (!loginState.error) {
    loginState.error = `cloudflared login berhenti tanpa menulis cert.pem (exit code ${code}).`;
  }
  logger.warn(`Cloudflare login finished without cert.pem: ${loginState.error.split('\n')[0]}`);
}

/**
 * Snapshot state login untuk API (tidak membocorkan field internal).
 */
export function getLoginState() {
  return {
    pending: loginState.pending,
    url: loginState.url,
    error: loginState.error,
    message: loginState.message,
    startedAt: loginState.startedAt,
    finishedAt: loginState.finishedAt
  };
}

/**
 * Launch `cloudflared tunnel login` — it opens the user's browser for
 * Cloudflare OAuth and exits on its own once approved.
 *
 * Output cloudflared ditangkap (bukan di-ignore) supaya URL login dan
 * error penyimpanan sertifikat bisa diteruskan ke UI. Caller polling
 * getLoginState() / isCloudflareLoggedIn() (e.g. banner di Domain page).
 */
export async function triggerCloudflaredLogin() {
  if (isCloudflareLoggedIn()) {
    return { launched: false, alreadyLoggedIn: true, certPath: getCertPath(), login: getLoginState() };
  }

  if (loginState.pending && loginState.pid && isProcessRunning(loginState.pid)) {
    logger.info('Cloudflare login already running — reusing session');
    return { launched: false, pending: true, certPath: getCertPath(), login: getLoginState() };
  }

  const binary = await findCloudflared();
  if (!binary) {
    const err = new Error('cloudflared not found on PATH or .tools/');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  Object.assign(loginState, {
    pending: true,
    url: null,
    error: null,
    message: 'Menjalankan cloudflared tunnel login…',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    pid: null,
    capturingError: false
  });

  logger.info('Launching cloudflared tunnel login (opens browser)...');
  const child = spawn(binary, ['tunnel', 'login'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    windowsHide: true,
    env: process.env
  });
  child.unref();
  loginState.pid = child.pid ?? null;

  child.stdout?.on('data', (buf) => onLoginOutput(buf.toString()));
  child.stderr?.on('data', (buf) => onLoginOutput(buf.toString()));
  child.on('error', (err) => {
    logger.error(`Failed to launch cloudflared tunnel login: ${err.message}`);
    loginState.error = err.message;
    settleLogin(-1);
  });
  child.on('exit', (code) => settleLogin(code ?? 0));

  // cert.pem bisa terbentuk dari login session di luar server; pantau
  // terus agar status "terhubung" terdeteksi tanpa menunggu exit event.
  stopCertWatcher();
  certWatcher = setInterval(() => {
    if (isCloudflareLoggedIn()) settleLogin(0);
  }, 1000);
  certWatcher.unref?.();

  return { launched: true, certPath: getCertPath(), login: getLoginState() };
}
