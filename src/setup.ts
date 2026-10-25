import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { getVenvPython, getPiperModelPath, getAppDataDir } from './paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const scriptPath = path.join(rootDir, 'scripts', 'setup_voice.sh');

export function autoInstallVoice(): boolean {
  const venvPython = getVenvPython();
  const piperModel = getPiperModelPath();

  if (fs.existsSync(venvPython) && fs.existsSync(piperModel)) {
    return true;
  }

  console.log(`[HUD] Voice models missing in ${getAppDataDir()}. Installing in background...`);
  try {
    execSync(`bash "${scriptPath}"`, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.warn('[HUD] Note: Voice installation failed or was deferred. Running in visual/browser mode.');
    return false;
  }
}

if (process.argv[1] === __filename) {
  autoInstallVoice();
}
