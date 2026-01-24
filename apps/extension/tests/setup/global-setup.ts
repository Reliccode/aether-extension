import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function ensureBrowserInstalled() {
  const execPath = chromium.executablePath();
  if (!execPath || !existsSync(execPath)) {
    execSync('npx playwright install chromium', { stdio: 'inherit' });
  }
}

export default async function globalSetup() {
  ensureBrowserInstalled();

  const distPath = path.resolve(__dirname, '..', '..', 'dist');
  if (!existsSync(distPath)) {
    execSync('npm run build', { stdio: 'inherit' });
  }
}
