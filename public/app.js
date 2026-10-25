// Tactical Radar Canvas Renderer
const radarCanvas = document.getElementById('radar-canvas');
const radarCtx = radarCanvas.getContext('2d');
let radarAngle = 0;

function drawRadar() {
  const width = radarCanvas.width;
  const height = radarCanvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const radius = cx - 10;

  radarCtx.clearRect(0, 0, width, height);

  // Concentric Rings
  radarCtx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
  radarCtx.lineWidth = 1;
  [0.33, 0.66, 1].forEach((fraction) => {
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, radius * fraction, 0, Math.PI * 2);
    radarCtx.stroke();
  });

  // Crosshairs
  radarCtx.beginPath();
  radarCtx.moveTo(cx, 10);
  radarCtx.lineTo(cx, height - 10);
  radarCtx.moveTo(10, cy);
  radarCtx.lineTo(width - 10, cy);
  radarCtx.stroke();

  // Sweeping Radar Line
  radarAngle += 0.035;
  const sweepX = cx + Math.cos(radarAngle) * radius;
  const sweepY = cy + Math.sin(radarAngle) * radius;

  const grad = radarCtx.createRadialGradient(cx, cy, 5, cx, cy, radius);
  grad.addColorStop(0, 'rgba(0, 243, 255, 0.4)');
  grad.addColorStop(1, 'rgba(0, 243, 255, 0)');

  radarCtx.beginPath();
  radarCtx.moveTo(cx, cy);
  radarCtx.arc(cx, cy, radius, radarAngle - 0.4, radarAngle);
  radarCtx.closePath();
  radarCtx.fillStyle = grad;
  radarCtx.fill();

  // Radar Blip (Antigravity CLI Agent)
  const blipX = cx + Math.cos(1.2) * (radius * 0.65);
  const blipY = cy + Math.sin(1.2) * (radius * 0.65);
  radarCtx.fillStyle = '#ffb800';
  radarCtx.beginPath();
  radarCtx.arc(blipX, blipY, 4, 0, Math.PI * 2);
  radarCtx.fill();

  requestAnimationFrame(drawRadar);
}
drawRadar();

// Audio Waveform Visualizer
const waveCanvas = document.getElementById('waveform-canvas');
const waveCtx = waveCanvas.getContext('2d');
let wavePhase = 0;

function drawWaveform() {
  const w = waveCanvas.width;
  const h = waveCanvas.height;
  waveCtx.clearRect(0, 0, w, h);

  waveCtx.lineWidth = 2;
  waveCtx.strokeStyle = '#00f3ff';
  waveCtx.beginPath();

  wavePhase += 0.05;
  for (let x = 0; x < w; x++) {
    const y = h / 2 + Math.sin(x * 0.04 + wavePhase) * 12 + Math.cos(x * 0.02 - wavePhase) * 6;
    if (x === 0) waveCtx.moveTo(x, y);
    else waveCtx.lineTo(x, y);
  }
  waveCtx.stroke();
  requestAnimationFrame(drawWaveform);
}
drawWaveform();

// HUD Clock
setInterval(() => {
  const now = new Date();
  document.getElementById('clock').innerText = now.toTimeString().split(' ')[0] + ' UTC';
}, 1000);

// WebSocket Connection to HUD Bridge / MCP
let ws;
const commsStream = document.getElementById('comms-stream');
const approvalBay = document.getElementById('approval-bay');
const approvalMsg = document.getElementById('approval-msg');
const approvalCmd = document.getElementById('approval-cmd');
const teleStatus = document.getElementById('tele-status');
const teleTool = document.getElementById('tele-tool');
const teleCwd = document.getElementById('tele-cwd');

if (teleCwd) {
  teleCwd.onclick = () => {
    const dir = prompt('Enter project directory for agent (e.g. /home/user/my-project):', teleCwd.innerText);
    if (dir && dir.trim()) {
      sendWs({ type: 'SET_CWD', cwd: dir.trim() });
      teleCwd.innerText = dir.trim();
    }
  };
}

function appendLog(text, type = 'sys') {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.innerText = text;
  commsStream.appendChild(line);
  commsStream.scrollTop = commsStream.scrollHeight;
}

function connectWs() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.hostname}:19842`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    appendLog('[WEBSOCKET] Tactical link established with TermAgentHUD server.', 'success');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleMessage(data);
    } catch {
      appendLog(`[RAW] ${event.data}`, 'sys');
    }
  };

  ws.onclose = () => {
    appendLog('[WEBSOCKET] Connection lost. Retrying in 2s...', 'warn');
    setTimeout(connectWs, 2000);
  };
}

let pendingApprovalId = null;

function handleMessage(msg) {
  if (msg.type === 'APPROVAL_REQUEST') {
    approvalBay.classList.remove('waiting');
    approvalBay.classList.add('active');
    approvalMsg.innerText = `AUTHORIZATION REQUESTED: ${msg.explanation}`;
    approvalCmd.innerText = msg.command;
    appendLog(`[APPROVAL REQUEST] Command: ${msg.command}`, 'warn');
    playAlertTone();
  } else if (msg.type === 'SPEAK') {
    appendLog(`[PIPER TTS] "${msg.message}"`, 'voice');
    speakBrowser(msg.message);
  } else if (msg.type === 'AGENT_STATUS') {
    if (msg.cwd && teleCwd) teleCwd.innerText = msg.cwd;
    if (msg.running) {
      teleStatus.innerText = 'AGENT ENGAGED';
    }
  } else if (msg.type === 'TELEMETRY') {
    if (msg.status) teleStatus.innerText = msg.status.toUpperCase();
    if (msg.activeTool) teleTool.innerText = msg.activeTool.toUpperCase();
    appendLog(`[TELEMETRY] Status: ${msg.status || 'ACTIVE'} | Tool: ${msg.activeTool || 'NONE'}`, 'agent');
  }
}

function resolveApproval(approved) {
  approvalBay.classList.remove('active');
  approvalBay.classList.add('waiting');
  approvalCmd.innerText = 'NO PENDING COMMAND';
  
  if (approved) {
    approvalMsg.innerText = 'STATUS: AUTHORIZATION GRANTED.';
    appendLog('[APPROVAL] User authorized command execution.', 'success');
    sendWs({ type: 'APPROVAL_RESPONSE', approved: true });
  } else {
    approvalMsg.innerText = 'STATUS: AUTHORIZATION DENIED.';
    appendLog('[APPROVAL] User aborted command execution.', 'warn');
    sendWs({ type: 'APPROVAL_RESPONSE', approved: false });
  }
}

function sendWs(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// Browser Audio Synth Fallback / Echo
function speakBrowser(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    window.speechSynthesis.speak(utterance);
  }
}

function playAlertTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

// Button Listeners
document.getElementById('btn-approve').onclick = () => resolveApproval(true);
document.getElementById('btn-reject').onclick = () => resolveApproval(false);

document.addEventListener('keydown', (e) => {
  if (e.key === 'y' || e.key === 'Y') resolveApproval(true);
  if (e.key === 'n' || e.key === 'N') resolveApproval(false);
});

// Simulation & Quick Actions
document.getElementById('btn-sim-approval').onclick = () => {
  handleMessage({
    type: 'APPROVAL_REQUEST',
    command: 'git push origin main --force',
    explanation: 'Automated deployment sequence initiated by Antigravity CLI.',
  });
};

document.getElementById('btn-sim-voice').onclick = () => {
  const msg = 'Commander, all tactical fighter-jet HUD systems are online and responsive.';
  handleMessage({ type: 'SPEAK', message: msg });
};

document.getElementById('btn-clear').onclick = () => {
  commsStream.innerHTML = '';
};

// Direct Command Transmit
document.getElementById('btn-send').onclick = () => {
  const input = document.getElementById('manual-cmd');
  if (input.value.trim()) {
    appendLog(`[TACTICAL TRANSMISSION] ${input.value.trim()}`, 'sys');
    sendWs({ type: 'TRANSMIT_COMMAND', command: input.value.trim() });
    input.value = '';
  }
};

connectWs();
