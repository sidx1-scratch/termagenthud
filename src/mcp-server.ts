import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { WebSocket } from 'ws';

const HUD_WS_PORT = Number(process.env.TERMAGENTHUD_WS_PORT || 19842);
let wsClient: WebSocket | null = null;
let requestCounter = 0;
const pendingApprovals = new Map<string, (approved: boolean) => void>();

function connectToHud() {
  try {
    wsClient = new WebSocket(`ws://127.0.0.1:${HUD_WS_PORT}`);
    wsClient.on('message', (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (message.type === 'APPROVAL_RESPONSE' && message.requestId) {
          pendingApprovals.get(message.requestId)?.(!!message.approved);
          pendingApprovals.delete(message.requestId);
        }
      } catch {
        // Ignore malformed HUD messages; MCP remains available.
      }
    });
    wsClient.on('error', () => {
      wsClient = null;
    });
  } catch {
    wsClient = null;
  }
}

connectToHud();
setInterval(() => {
  if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
    connectToHud();
  }
}, 3000);

function sendToHud(data: any) {
  if (wsClient && wsClient.readyState === WebSocket.OPEN) {
    wsClient.send(JSON.stringify(data));
  }
}

function waitForApproval(requestId: string, timeoutSec: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingApprovals.delete(requestId);
      resolve(false);
    }, Math.max(1, timeoutSec) * 1000);
    pendingApprovals.set(requestId, (approved) => {
      clearTimeout(timer);
      resolve(approved);
    });
  });
}

const server = new Server(
  {
    name: 'termagenthud-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'request_voice_approval',
        description:
          'Ask the user for voice approval before executing a sensitive bash command or file change. Speaks prompt via Piper TTS, displays fighter jet alert on HUD, and waits for voice approval (approve/proceed/yes or reject/cancel/no).',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command or operation requesting approval.',
            },
            explanation: {
              type: 'string',
              description: 'Clear concise reason why this command is needed.',
            },
            timeoutSec: {
              type: 'number',
              description: 'Timeout in seconds before defaulting to reject (default 30)',
            },
          },
          required: ['command', 'explanation'],
        },
      },
      {
        name: 'speak_hud_announcement',
        description: 'Announce a message to the user through Piper TTS and tactical HUD notification.',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The text message to speak out loud and show on HUD.',
            },
            level: {
              type: 'string',
              enum: ['info', 'warning', 'critical', 'success'],
              description: 'HUD alert level',
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'update_hud_telemetry',
        description: 'Update the agent HUD status, active tool, tokens, or tactical mission targets.',
        inputSchema: {
          type: 'object',
          properties: {
            status: { type: 'string', description: 'Agent operational status (e.g. ENGAGED, ANALYZING, IDLE)' },
            activeTool: { type: 'string', description: 'Current active MCP tool or command' },
            progress: { type: 'number', description: 'Task progress percentage (0-100)' },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'request_voice_approval') {
    const cmd = String(args?.command || '');
    const exp = String(args?.explanation || '');
    const timeout = Number(args?.timeoutSec || 30);
    const requestId = `approval-${++requestCounter}`;

    if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
      return {
        content: [{ type: 'text', text: '[HUD-VOICE] HUD is not connected. Start termagenthud in the foreground first.' }],
        isError: true,
      };
    }

    sendToHud({
      type: 'APPROVAL_REQUEST',
      requestId,
      command: cmd,
      explanation: exp,
      timeout,
    });

    const approved = await waitForApproval(requestId, timeout);
    return {
      content: [
        {
          type: 'text',
          text: approved
            ? `[HUD-VOICE] Approved: "${cmd}".`
            : `[HUD-VOICE] Rejected or timed out: "${cmd}".`,
        },
      ],
    };
  }

  if (name === 'speak_hud_announcement') {
    const message = String(args?.message || '');
    const level = String(args?.level || 'info');

    sendToHud({
      type: 'SPEAK',
      message,
      level,
    });

    return {
      content: [
        {
          type: 'text',
          text: `[HUD-VOICE] Broadcasted: "${message}" (${level})`,
        },
      ],
    };
  }

  if (name === 'update_hud_telemetry') {
    sendToHud({
      type: 'TELEMETRY',
      ...args,
    });

    return {
      content: [
        {
          type: 'text',
          text: `[HUD] Telemetry synchronized.`,
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

export async function runMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && process.argv[1].endsWith('mcp-server.js')) {
  runMcpServer().catch(console.error);
}
