#!/usr/bin/env node
import { JarvisWebServer } from './web-server.js';
import { JarvisFighterHud } from './hud.js';

const isTerminalMode = process.argv.includes('--terminal') || process.argv.includes('-t');

if (isTerminalMode) {
  const hud = new JarvisFighterHud();
  hud.log('{cyan-fg}[JARVIS]{/cyan-fg} Tactical Terminal HUD active.');
} else {
  // Default mode: launches the polished browser-based tactical HUD and leaves terminal clean in the background
  const server = new JarvisWebServer(3000);
  server.start(true);
}
