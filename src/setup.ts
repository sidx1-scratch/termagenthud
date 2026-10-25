import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const scriptPath = path.join(rootDir, 'scripts', 'install.sh');

export function autoInstallVoice(): boolean {
  const venvPython = path.join(rootDir, '.venv', 'bin', 'python');
  const piperModel = path.join(rootDir, 'models', 'voice.onnx');

  if (fs.existsSync(venvPython) && fs.existsSync(piperModel)) {
    return true;
  }

  console.log('[HUD] Voice models or environment missing. Running automatic setup...');
  try {
    execSync(`bash "${scriptPath}"`, { stdio: 'inherit', cwd: rootDir });
    return true;
  } catch (err) {
    console.warn('[HUD] Note: Automatic voice dependencies download requires network/python3-venv. Fallback mock voice enabled if offline.');
    return false;
  }
}

if (process.argv[1] === __filename) {
  autoInstallVoice();
}
