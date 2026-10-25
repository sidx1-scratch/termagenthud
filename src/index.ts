import { NativeJarvisWebServer } from './zero-web.js';
import { JarvisFighterHud } from './hud.js';

const isTerminalMode = process.argv.includes('--terminal') || process.argv.includes('-t');

if (isTerminalMode) {
  const hud = new JarvisFighterHud();
  hud.log('{cyan-fg}[JARVIS]{/cyan-fg} Tactical Terminal HUD active.');
} else {
  // Pure zero-dependency browser-based tactical HUD server
  const server = new NativeJarvisWebServer(3000);
  server.start(true);
}
