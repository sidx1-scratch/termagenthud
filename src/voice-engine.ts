import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { getPiperModelPath, getPiperConfigPath } from './paths.js';

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
  private piperModel: string;
  private piperConfig: string;
  public enabled = false;

  constructor() {
    super();
    this.piperModel = getPiperModelPath();
    this.piperConfig = getPiperConfigPath();
    this.checkAvailability();
  }

  public checkAvailability(): boolean {
    const hasModel = fs.existsSync(this.piperModel);
    this.enabled = hasModel;
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

    const hasPiper = fs.existsSync(this.piperModel);
    if (hasPiper) {
      const player = fs.existsSync('/usr/bin/aplay') ? 'aplay -q' : (fs.existsSync('/usr/bin/paplay') ? 'paplay' : 'aplay');
      const piperCmd = `echo "${text.replace(/"/g, '\\"')}" | python3 -m piper --model "${this.piperModel}" --config "${this.piperConfig}" --output-raw | ${player} -r 16000 -f S16_LE -t raw -c 1`;

      const proc = spawn('bash', ['-c', piperCmd]);

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
      setTimeout(() => {
        this.isSpeaking = false;
        this.emit('idle');
        this.processQueue();
        if (onComplete) onComplete();
      }, 1000);
    }
  }

  public startListening() {
    const listenerScript = path.join(rootDir, 'scripts', 'stt_listener.py');
    if (!fs.existsSync(listenerScript)) return;

    this.listenerProcess = spawn('python3', [listenerScript]);

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
        } catch {}
      }
    });

    this.listenerProcess.stderr?.on('data', (data) => {});
  }

  public handleTranscript(rawText: string) {
    const text = rawText.trim();
    const lower = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');

    // Wake words and phonetic variations to catch misheard syllables
    const wakeWords = ['jarvis', 'travis', 'harvest', 'service', 'computer', 'agent'];
    let detectedWakeWord: string | undefined;

    for (const ww of wakeWords) {
      if (lower.startsWith(ww) || lower.includes(` ${ww}`) || lower.includes(`${ww} `)) {
        detectedWakeWord = (ww === 'travis' || ww === 'harvest' || ww === 'service') ? 'jarvis' : ww;
        break;
      }
    }

    let command = text;
    if (detectedWakeWord) {
      const regex = new RegExp(`^.*?(${detectedWakeWord}|travis|harvest|service)[,;:\\s]*`, 'i');
      command = text.replace(regex, '').trim();
    }

    const event: VoiceEvent = {
      text,
      isWakeWord: !!detectedWakeWord,
      wakeWord: detectedWakeWord,
      command: command || text,
      raw: text,
    };

    this.emit('transcript', event);

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
