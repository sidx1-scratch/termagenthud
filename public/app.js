// Tactical Arc Reactor & Radar Core Canvas Renderer
const radarCanvas = document.getElementById('radar-canvas');
const radarCtx = radarCanvas.getContext('2d');
let radarAngle = 0;

function drawCore() {
  const width = radarCanvas.width;
  const height = radarCanvas.height;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = cx - 12;

  radarCtx.clearRect(0, 0, width, height);

  // Concentric Tactical Circles
  [0.25, 0.5, 0.75, 1].forEach((fraction, idx) => {
    radarCtx.strokeStyle = idx === 3 ? 'rgba(0, 243, 255, 0.4)' : 'rgba(0, 243, 255, 0.15)';
    radarCtx.lineWidth = 1;
    radarCtx.beginPath();
    radarCtx.arc(cx, cy, maxRadius * fraction, 0, Math.PI * 2);
    radarCtx.stroke();
  });

  // Crosshairs with Tick Marks
  radarCtx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
  radarCtx.beginPath();
  radarCtx.moveTo(cx, 12);
  radarCtx.lineTo(cx, height - 12);
  radarCtx.moveTo(12, cy);
  radarCtx.lineTo(width - 12, cy);
  radarCtx.stroke();

  // Sweeping Harmonic Beam
  radarAngle += 0.035;
  const sweepX = cx + Math.cos(radarAngle) * maxRadius;
  const sweepY = cy + Math.sin(radarAngle) * maxRadius;

  const grad = radarCtx.createRadialGradient(cx, cy, 10, cx, cy, maxRadius);
  grad.addColorStop(0, 'rgba(0, 243, 255, 0.35)');
  grad.addColorStop(1, 'rgba(0, 243, 255, 0)');

  radarCtx.beginPath();
  radarCtx.moveTo(cx, cy);
  radarCtx.arc(cx, cy, maxRadius, radarAngle - 0.45, radarAngle);
  radarCtx.closePath();
  radarCtx.fillStyle = grad;
  radarCtx.fill();

  // AI Agent Node Blip
  const blipX = cx + Math.cos(2.4) * (maxRadius * 0.65);
  const blipY = cy + Math.sin(2.4) * (maxRadius * 0.65);
  radarCtx.fillStyle = '#00ff88';
  radarCtx.shadowColor = '#00ff88';
  radarCtx.shadowBlur = 8;
  radarCtx.beginPath();
  radarCtx.arc(blipX, blipY, 4, 0, Math.PI * 2);
  radarCtx.fill();
  radarCtx.shadowBlur = 0;

  requestAnimationFrame(drawCore);
}
drawCore();

// Harmonic Audio Frequency Waveform
const waveCanvas = document.getElementById('waveform-canvas');
const waveCtx = waveCanvas.getContext('2d');
let wavePhase = 0;

function drawWaveform() {
  const w = waveCanvas.width;
  const h = waveCanvas.height;
  waveCtx.clearRect(0, 0, w, h);

  waveCtx.lineWidth = 2;
  waveCtx.strokeStyle = '#00f3ff';
  waveCtx.shadowColor = '#00f3ff';
  waveCtx.shadowBlur = 4;
  waveCtx.beginPath();

  wavePhase += 0.04;
  for (let x = 0; x < w; x++) {
    const y = h / 2 + Math.sin(x * 0.04 + wavePhase) * 10 + Math.cos(x * 0.02 - wavePhase) * 5;
    if (x === 0) waveCtx.moveTo(x, y);
    else waveCtx.lineTo(x, y);
  }
  waveCtx.stroke();
  waveCtx.shadowBlur = 0;
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
let activeApprovalRequestId;
const commsStream = document.getElementById('comms-stream');
const approvalBay = document.getElementById('approval-bay');
const approvalMsg = document.getElementById('approval-msg');
const approvalCmd = document.getElementById('approval-cmd');
const teleStatus = document.getElementById('tele-status');
const teleTool = document.getElementById('tele-tool');
const teleCwd = document.getElementById('tele-cwd');
const agentSelect = document.getElementById('agent-select');

if (agentSelect) {
  agentSelect.onchange = () => {
    sendWs({ type: 'SELECT_AGENT', agentId: agentSelect.value });
    appendLog(`[TARGET SWITCH] Agent set to: ${agentSelect.options[agentSelect.selectedIndex].text}`, 'agent');
  };
}

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
  line.className = `stream-row ${type}`;
  const now = new Date().toTimeString().split(' ')[0];
  line.innerHTML = `<span class="timestamp">[${now}]</span> ${text}`;
  commsStream.appendChild(line);
  commsStream.scrollTop = commsStream.scrollHeight;
}

function connectWs() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.hostname}:19842`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    appendLog('Neural bridge established with TermAgentHUD server.', 'success');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleMessage(data);
    } catch {
      appendLog(event.data, 'sys');
    }
  };

  ws.onclose = () => {
    appendLog('Connection lost. Reconnecting to local agent daemon in 2s...', 'warn');
    setTimeout(connectWs, 2000);
  };
}

function handleMessage(msg) {
  if (msg.type === 'APPROVAL_REQUEST') {
    activeApprovalRequestId = msg.requestId;
    approvalBay.classList.remove('standby');
    approvalBay.classList.add('active');
    approvalMsg.innerText = `CONFIRMATION REQUIRED: ${msg.explanation || msg.command}`;
    approvalCmd.innerText = msg.command;
    appendLog(`[APPROVAL REQUEST] Command: ${msg.command}`, 'warn');
    playAlertTone();
  } else if (msg.type === 'AGENT_OUTPUT') {
    appendLog(msg.data, 'agent');
  } else if (msg.type === 'SUBAGENT_ACTIVITY') {
    appendLog(`[SUBAGENT] ${msg.name}: ${msg.action}`, 'agent');
  } else if (msg.type === 'AGENT_STATUS') {
    if (msg.cwd && teleCwd) teleCwd.innerText = msg.cwd;
    if (msg.agent && agentSelect) agentSelect.value = msg.agent.id;
    if (msg.running) {
      teleStatus.innerText = 'ENGAGED';
    }
  } else if (msg.type === 'SPEAK') {
    appendLog(`[JARVIS VOCAL] "${msg.message}"`, 'voice');
  } else if (msg.type === 'TELEMETRY') {
    if (msg.status) teleStatus.innerText = msg.status.toUpperCase();
    if (msg.activeTool) teleTool.innerText = msg.activeTool.toUpperCase();
    appendLog(`[TELEMETRY] Status: ${msg.status || 'ACTIVE'} | Tool: ${msg.activeTool || 'NONE'}`, 'agent');
  } else if (msg.type === 'LOG') {
    appendLog(msg.text, 'sys');
  }
}

function resolveApproval(approved) {
  approvalBay.classList.remove('active');
  approvalBay.classList.add('standby');
  approvalCmd.innerText = '// ALL SYSTEMS NOMINAL // WAITING FOR DIRECTIVE';
  
  if (approved) {
    approvalMsg.innerText = 'STATUS: AUTHORIZATION GRANTED.';
    appendLog('[APPROVAL] User authorized execution.', 'success');
    sendWs({ type: 'APPROVAL_RESPONSE', approved: true, requestId: activeApprovalRequestId });
  } else {
    approvalMsg.innerText = 'STATUS: AUTHORIZATION DENIED.';
    appendLog('[APPROVAL] User aborted execution.', 'warn');
    sendWs({ type: 'APPROVAL_RESPONSE', approved: false, requestId: activeApprovalRequestId });
  }
}

function sendWs(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
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
    explanation: 'Automated deployment sequence initiated by AI agent.',
  });
};

document.getElementById('btn-sim-voice').onclick = () => {
  const msg = 'Commander, all tactical JARVIS HUD cybernetic modules are online and responsive.';
  handleMessage({ type: 'SPEAK', message: msg });
};

document.getElementById('btn-clear').onclick = () => {
  commsStream.innerHTML = '';
};

// Direct Command Transmit
document.getElementById('btn-send').onclick = () => {
  const input = document.getElementById('manual-cmd');
  if (input.value.trim()) {
    appendLog(`[TRANSMIT] ${input.value.trim()}`, 'sys');
    sendWs({ type: 'TRANSMIT_COMMAND', command: input.value.trim() });
    input.value = '';
  }
};

document.getElementById('manual-cmd').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('btn-send').click();
  }
});

connectWs();
