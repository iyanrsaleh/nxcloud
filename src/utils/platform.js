import os from 'node:os';

export function getPlatform() {
  return process.platform;
}

export function isWindows() {
  return process.platform === 'win32';
}

export function isLinux() {
  return process.platform === 'linux';
}

export function platformLabel() {
  const map = {
    win32: 'Windows',
    linux: 'Linux',
    darwin: 'macOS'
  };
  return map[process.platform] || process.platform;
}

export function hostname() {
  return os.hostname();
}
