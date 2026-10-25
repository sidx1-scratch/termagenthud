import { VoiceEngine } from './voice-engine.js';
import { NativeWebSocketServer, NativeWebSocket } from './zero-ws.js';
import { AgentSessionBridge } from './agent-bridge.js';
import * as net from 'net';
import assert from 'assert';

console.log('=== RUNNING TERMAGENTHUD COMPREHENSIVE ZERO-DEP TESTS ===');

// 1. Test Voice Engine wake-word parser & command routing
console.log('[TEST 1] Testing Wake Word parsing & Voice instruction routing...');
const voice = new VoiceEngine();
let detectedCmd: string | undefined = undefined;

voice.on('command', (evt) => {
  detectedCmd = evt.command;
});

voice.handleTranscript('jarvis build a weather app with react');
assert.strictEqual(detectedCmd, 'build a weather app with react');
console.log('  ✔ "jarvis build <app idea>" parsing verified.');

voice.handleTranscript('jarvis /model default');
assert.strictEqual(detectedCmd, '/model default');
console.log('  ✔ "/model <name>" slash command routing verified.');

voice.handleTranscript('computer approve');
assert.strictEqual(detectedCmd, 'approve');
console.log('  ✔ "computer approve" voice approval verified.');

// 2. Test Agent Session Bridge interactive prompt detector
console.log('[TEST 2] Testing Agent Session Bridge interactive prompt detection...');
const bridge = new AgentSessionBridge();
let detectedApproval = false;
let detectedSubagent = false;

bridge.on('approval_required', (info) => {
  detectedApproval = true;
  assert.ok(info.promptText.includes('Do you want to proceed? [y/N]'));
});

bridge.on('subagent', (info) => {
  detectedSubagent = true;
});

// Simulate agent output with ANSI escape sequences
(bridge as any).handleOutput('Running task step 1...\nDo you want to proceed? [y/N]\n');
assert.strictEqual(detectedApproval, true);
console.log('  ✔ Agent [y/N] interactive confirmation prompt detection passed.');

(bridge as any).handleOutput('invoke_subagent: Research subagent analyzing codebase...\n');
assert.strictEqual(detectedSubagent, true);
console.log('  ✔ Subagent invocation detection passed.');

// 3. Test Zero-Dependency RFC6455 Native WebSocket Handshake & Server
console.log('[TEST 3] Testing Zero-Dependency RFC6455 WebSocket implementation...');
const TEST_PORT = 19855;
const wss = new NativeWebSocketServer(TEST_PORT);

const rawSocket = net.connect({ port: TEST_PORT, host: '127.0.0.1' }, () => {
  const req = [
    'GET / HTTP/1.1',
    'Host: localhost:19855',
    'Upgrade: websocket',
    'Connection: Upgrade',
    'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
    'Sec-WebSocket-Version: 13',
    '\r\n',
  ].join('\r\n');
  rawSocket.write(req);
});

rawSocket.on('data', (data) => {
  const res = data.toString();
  assert.ok(res.includes('101 Switching Protocols'));
  assert.ok(res.includes('Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo='));
  console.log('  ✔ Zero-dep RFC6455 SHA1 handshake passed.');
  rawSocket.destroy();
  wss.close();

  console.log('\n>>> ALL 3/3 ZERO-DEPENDENCY TEST SUITES PASSED CLEANLY! <<<');
  process.exit(0);
});
