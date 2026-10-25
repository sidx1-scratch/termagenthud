import { VoiceEngine } from './voice-engine.js';
import { runMcpServer } from './mcp-server.js';
import assert from 'assert';

console.log('=== RUNNING TERMAGENTHUD TESTS ===');

// Test 1: VoiceEngine wake-word parser
console.log('[TEST 1] Testing Wake Word parsing & Voice event handling...');
const voice = new VoiceEngine();

let detectedWake: string | undefined = undefined;
let detectedCmd: string | undefined = undefined;

voice.on('command', (evt) => {
  detectedWake = evt.wakeWord;
  detectedCmd = evt.command;
});

// Test "jarvis approve"
voice.handleTranscript('jarvis approve');
assert.strictEqual(detectedWake, 'jarvis');
assert.strictEqual(detectedCmd, 'approve');
console.log('  ✔ Jarvis wake word passed.');

// Test "computer status report"
voice.handleTranscript('computer status report');
assert.strictEqual(detectedWake, 'computer');
assert.strictEqual(detectedCmd, 'status report');
console.log('  ✔ Computer wake word passed.');

// Test "agent cancel operation"
voice.handleTranscript('agent cancel operation');
assert.strictEqual(detectedWake, 'agent');
assert.strictEqual(detectedCmd, 'cancel operation');
console.log('  ✔ Agent wake word passed.');

console.log('[TEST 2] Testing MCP Server Tool schema...');
assert.strictEqual(typeof runMcpServer, 'function');
console.log('  ✔ MCP Server exports correctly.');

console.log('\n>>> ALL 2/2 TEST SUITES PASSED CLEANLY! <<<');
process.exit(0);

