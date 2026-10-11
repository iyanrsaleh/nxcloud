import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { isWindows } from './platform.js';

const execFileAsync = promisify(execFile);

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writePid(filePath, pid) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, String(pid), 'utf8');
}

export function readPid(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    const pid = Number(raw);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function removePid(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

export function isProcessRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err && err.code === 'EPERM') return true;
    return false;
  }
}

export async function killProcess(pid, signal = 'SIGTERM') {
  if (!pid || !isProcessRunning(pid)) return false;

  try {
    if (isWindows()) {
      await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F']);
    } else {
      process.kill(pid, signal);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Find an executable on PATH (cross-platform).
 */
export async function which(command) {
  const finder = isWindows() ? 'where' : 'which';
  try {
    const { stdout } = await execFileAsync(finder, [command]);
    const line = stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean);
    return line || null;
  } catch {
    return null;
  }
}

export function spawnDetached(command, args, options = {}) {
  const child = spawn(command, args, {
    detached: true,
    stdio: options.stdio ?? 'ignore',
    shell: isWindows(),
    env: options.env ?? process.env,
    cwd: options.cwd,
    windowsHide: true
  });
  child.unref();
  return child;
}

export function spawnAttached(command, args, options = {}) {
  return spawn(command, args, {
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: options.env ?? process.env,
    cwd: options.cwd,
    windowsHide: true
  });
}
