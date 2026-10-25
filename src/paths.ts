import * as os from 'os';
import * as path from 'path';

export function getAppDataDir(): string {
  // If running with sudo, prefer the actual invoking user's home directory
  const homeDir = process.env.SUDO_USER && process.env.SUDO_USER !== 'root'
    ? path.join('/home', process.env.SUDO_USER)
    : (process.env.HOME || os.homedir());

  return path.join(homeDir, '.config', 'termagenthud');
}

export function getVenvPython(): string {
  return path.join(getAppDataDir(), 'venv', 'bin', 'python');
}

export function getModelsDir(): string {
  return path.join(getAppDataDir(), 'models');
}

export function getPiperModelPath(): string {
  return path.join(getModelsDir(), 'voice.onnx');
}

export function getPiperConfigPath(): string {
  return path.join(getModelsDir(), 'voice.onnx.json');
}
