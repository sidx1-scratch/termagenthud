import { NativeJarvisWebServer } from './zero-web.js';
import { JarvisFighterHud } from './hud.js';

const isTerminalMode = process.argv.includes('--terminal') || process.argv.includes('-t');
const isMcpMode = process.argv.includes('--mcp');

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
  // 1. Starts background HTTP + WebSocket server
  const server = new NativeJarvisWebServer(3000);
  
  // 2. Automatically launches the target AI agent (agy by default or custom) in a real PTY session
  const agentBridge = (server as any).agentBridge;
  if (agentBridge) {
    const target = customAgentCommand || agentBridge.getActiveAgent().binaries[0];
    agentBridge.startAgent(target);
  }

  // 3. Automatically opens index.html in the user's browser
  server.start(true);
}
