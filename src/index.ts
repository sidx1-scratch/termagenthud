import { NativeJarvisWebServer } from './zero-web.js';
import { JarvisFighterHud } from './hud.js';

const isTerminalMode = process.argv.includes('--terminal') || process.argv.includes('-t');
const isMcpMode = process.argv.includes('--mcp');

// Check for custom agent flag e.g. --agent="openclaw"
const agentArg = process.argv.find(arg => arg.startsWith('--agent='));
const customAgentCommand = agentArg ? agentArg.split('=')[1]?.replace(/^["']|["']$/g, '') : undefined;

if (isMcpMode) {
  import('./mcp-server.js').then(({ runMcpServer }) => {
    runMcpServer();
  });
} else if (isTerminalMode) {
  const hud = new JarvisFighterHud();
  hud.log('{cyan-fg}[JARVIS]{/cyan-fg} Tactical Terminal HUD active.');
} else {
  // Pure zero-dependency browser-based tactical HUD server
  const server = new NativeJarvisWebServer(3000);
  if (customAgentCommand) {
    (server as any).agentBridge?.startAgent(customAgentCommand);
  }
  server.start(true);
}
