#!/usr/bin/env node
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distIndex = path.join(rootDir, 'dist', 'index.js');

// If user explicitly asks for foreground or terminal mode:
const isForeground = process.argv.includes('--foreground') || process.argv.includes('-f') || process.argv.includes('--terminal') || process.argv.includes('-t') || process.argv.includes('--mcp');
const isDaemonWorker = process.env.__TERMAGENTHUD_DAEMON === '1';

if (isForeground || isDaemonWorker) {
  // Execute HUD server directly
  import('../dist/index.js');
} else {
  // Spawn detached in the background so terminal prompt is immediately freed!
  const logDir = path.join(process.env.HOME || '/tmp', '.config', 'termagenthud');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, 'hud.log');
  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  const child = spawn(process.execPath, [distIndex, ...process.argv.slice(2)], {
    detached: true,
    stdio: ['ignore', out, err],
    cwd: process.cwd(),
    env: {
      ...process.env,
      __TERMAGENTHUD_DAEMON: '1',
    },
  });

  child.unref();

  console.log(`\n===============================================================`);
  console.log(`🚀 TermAgentHUD background service launched! (PID: ${child.pid})`);
  console.log(`🌐 Opening Web HUD in browser: http://localhost:3000`);
  console.log(`📝 Live Daemon Log: ${logFile}`);
  console.log(`⚡ Your terminal is free! Use your terminal as normal.`);
  console.log(`===============================================================\n`);

  process.exit(0);
}
