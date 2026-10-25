import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export function configureAgentMcp(agentId: string, mcpServerPath: string): string[] {
  const home = process.env.SUDO_USER && process.env.SUDO_USER !== 'root'
    ? path.join('/home', process.env.SUDO_USER)
    : (process.env.HOME || os.homedir());

  const results: string[] = [];

  const mcpConfigEntry = {
    command: 'node',
    args: [mcpServerPath],
  };

  const targets: Record<string, string[]> = {
    'antigravity': [
      path.join(home, '.gemini', 'antigravity', 'mcp_config.json'),
      path.join(home, '.gemini', 'config', 'mcp_config.json'),
      path.join(home, '.gemini', 'antigravity-cli', 'mcp_config.json'),
      path.join(home, '.gemini', 'antigravity-cli', 'mcp.json'),
    ],
    'claude': [
      path.join(home, '.config', 'Claude', 'claude_desktop_config.json'),
      path.join(home, '.claude', 'settings.json'),
      path.join(home, '.claude', 'mcp.json'),
    ],
    'opencode': [
      path.join(home, '.config', 'opencode', 'mcp.json'),
      path.join(home, '.opencode', 'mcp.json'),
    ],
    'openclaw': [
      path.join(home, '.config', 'openclaw', 'mcp.json'),
      path.join(home, '.openclaw', 'mcp.json'),
    ],
    'codex': [
      path.join(home, '.config', 'codex', 'mcp.json'),
      path.join(home, '.codex', 'mcp.json'),
    ],
    'cursor': [
      path.join(home, '.cursor', 'mcp.json'),
      path.join(home, '.config', 'Cursor', 'mcp.json'),
    ],
  };

  const configFiles = targets[agentId] || targets['antigravity'];

  for (const file of configFiles) {
    try {
      const dir = path.dirname(file);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let json: any = { mcpServers: {} };
      if (fs.existsSync(file)) {
        try {
          const content = fs.readFileSync(file, 'utf8');
          json = JSON.parse(content || '{}');
          if (!json.mcpServers) json.mcpServers = {};
        } catch {
          json = { mcpServers: {} };
        }
      }

      json.mcpServers['jarvis-hud'] = mcpConfigEntry;
      fs.writeFileSync(file, JSON.stringify(json, null, 2), 'utf8');
      results.push(file);
    } catch (e: any) {
      // Skip unwritable locations
    }
  }

  return results;
}
