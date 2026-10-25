import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { getVenvPython, getPiperModelPath, getPiperConfigPath, getAppDataDir } from './paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export interface VoiceEvent {
  text: string;
  isWakeWord: boolean;
  wakeWord?: string;
  command?: string;
  raw: string;
}

export class VoiceEngine extends EventEmitter {
  private listenerProcess: ChildProcess | null = null;
  private ttsQueue: string[] = [];
  private isSpeaking = false;
  private venvPython: string;
  private piperModel: string;
  private piperConfig: string;
  public enabled = false;

  constructor() {
    super();
    this.venvPython = getVenvPython();
    this.piperModel = getPiperModelPath();
    this.piperConfig = getPiperConfigPath();

    this.checkAvailability();
  }

  public checkAvailability(): boolean {
    const hasVenv = fs.existsSync(this.venvPython);
    const hasModel = fs.existsSync(this.piperModel);
    this.enabled = hasVenv && hasModel;
    return this.enabled;
  }

  public speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      this.ttsQueue.push(text);
      this.processQueue(resolve);
    });
  }

  private processQueue(onComplete?: () => void) {
    if (this.isSpeaking || this.ttsQueue.length === 0) {
      if (onComplete) onComplete();
      return;
    }

    this.isSpeaking = true;
    const text = this.ttsQueue.shift()!;
    this.emit('speaking', text);

    if (this.enabled) {
      // Piper TTS playback via aplay or paplay
      const piperCmd = path.join(path.dirname(this.venvPython), 'piper');
      const player = fs.existsSync('/usr/bin/aplay') ? 'aplay -q' : (fs.existsSync('/usr/bin/paplay') ? 'paplay' : 'aplay');

      const proc = spawn('bash', ['-c', `echo "${text.replace(/"/g, '\\"')}" | "${piperCmd}" --model "${this.piperModel}" --config "${this.piperConfig}" --output-raw | ${player} -r 22050 -f S16_LE -t raw -c 1`]);

      proc.on('close', () => {
        this.isSpeaking = false;
        this.emit('idle');
        this.processQueue();
        if (onComplete) onComplete();
      });

      proc.on('error', () => {
        this.isSpeaking = false;
        this.emit('idle');
        this.processQueue();
        if (onComplete) onComplete();
      });
    } else {
      // Fallback: simulated speech delay so the HUD animation and HUD log show up
      setTimeout(() => {
        this.isSpeaking = false;
        this.emit('idle');
        this.processQueue();
        if (onComplete) onComplete();
      }, Math.min(2500, Math.max(800, text.length * 45)));
    }
  }

  public startListening() {
    if (!this.enabled) {
      this.emit('status', 'Voice offline (models not yet downloaded). Ready in manual/test mode.');
      return;
    }

    const listenerScript = path.join(rootDir, 'scripts', 'stt_listener.py');
    if (!fs.existsSync(listenerScript)) {
      return;
    }

    this.listenerProcess = spawn(this.venvPython, [listenerScript]);

    this.listenerProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'transcript') {
            this.handleTranscript(parsed.text);
          } else if (parsed.type === 'status') {
            this.emit('status', parsed.message);
          }
        } catch {
          // Non-json log
        }
      }
    });

    this.listenerProcess.stderr?.on('data', (data) => {
      // Debug / log if needed
    });
  }

  public handleTranscript(rawText: string) {
    const text = rawText.trim();
    const lower = text.toLowerCase();
    
    // Check for wake words: "computer", "jarvis", "agent"
    const wakeWords = ['jarvis', 'computer', 'agent'];
    let detectedWakeWord: string | undefined;
    
    for (const ww of wakeWords) {
      if (lower.startsWith(ww) || lower.includes(ww)) {
        detectedWakeWord = ww;
        break;
      }
    }

    let command = text;
    if (detectedWakeWord) {
      const regex = new RegExp(`^.*?${detectedWakeWord}[,;:\\s]*`, 'i');
      command = text.replace(regex, '').trim();
    }

    const event: VoiceEvent = {
      text,
      isWakeWord: !!detectedWakeWord,
      wakeWord: detectedWakeWord,
      command: command || text,
      raw: text
    };

    this.emit('transcript', event);

    // If wake word is present or direct approval words
    if (detectedWakeWord) {
      this.emit('command', event);
    }
  }

  public stopListening() {
    if (this.listenerProcess) {
      this.listenerProcess.kill();
      this.listenerProcess = null;
    }
  }
}
