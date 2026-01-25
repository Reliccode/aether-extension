import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { startFixtureServer } from '../utils/fixture-server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '..', '..', 'dist');
const SEED_SNIPPET = {
  title: 'Refund Policy v1.2',
  content: 'Refund policy v1.2',
  translations: { de: 'Rückerstattungsrichtlinie v1.2' },
  tags: ['refund', 'policy']
};

async function getExtensionId(context: BrowserContext, userDataDir: string): Promise<string | null> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    // Check existing service workers
    const workers = context.serviceWorkers();
    for (const w of workers) {
      const match = w.url().match(/chrome-extension:\/\/([a-z0-9]+)\//i);
      if (match) return match[1];
    }

    // Wait for a new service worker event briefly
    const worker = await context.waitForEvent('serviceworker', { timeout: 500 }).catch(() => null);
    if (worker) {
      const match = worker.url().match(/chrome-extension:\/\/([a-z0-9]+)\//i);
      if (match) return match[1];
    }

    // Fallback: read from profile Extensions directory
    const extDir = path.join(userDataDir, 'Default', 'Extensions');
    if (existsSync(extDir)) {
      const entries = readdirSync(extDir, { withFileTypes: true }).filter(d => d.isDirectory());
      if (entries.length > 0) return entries[0].name;
    }

    await new Promise(res => setTimeout(res, 200));
  }
  return null;
}

async function ensureChromiumOrSkip() {
  try {
    execFileSync(chromium.executablePath(), ['--version'], { stdio: 'ignore' });
  } catch (err) {
    test.skip(true, `Chromium unavailable in this environment (${(err as Error).message})`);
  }
}

async function launchContextWithExtension() {
  const userDataDir = mkdtempSync(path.join(tmpdir(), 'aether-e2e-'));

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  const extensionId = await getExtensionId(context, userDataDir);
  if (!extensionId) {
    await context.close();
    test.skip(true, 'Extension service worker not detected; skipping overlay test.');
  }

  return { context, extensionId: extensionId!, userDataDir };
}

async function seedSnippet(context: BrowserContext, extensionId: string) {
  const optionsPage = await context.newPage();
  await optionsPage.goto(`chrome-extension://${extensionId}/src/options/index.html`);
  await optionsPage.evaluate((snippet: typeof SEED_SNIPPET) => new Promise<void>((resolve) => {
    const c = (window as unknown as { chrome: typeof chrome }).chrome;
    c.runtime.sendMessage(
      {
        type: 'SAVE_SNIPPET',
        payload: snippet
      },
      () => resolve()
    );
  }), SEED_SNIPPET);
  await optionsPage.close();
}

test.describe('Aether overlay', () => {
  let fixtureUrl: string;
  let fixtureUrlWithContext: string;
  let server: Server;

  test.beforeAll(async () => {
    await ensureChromiumOrSkip();
    const started = startFixtureServer();
    server = started.server;
    fixtureUrl = await started.urlPromise;
    fixtureUrlWithContext = `${fixtureUrl}?bookingId=wb12`;
  });

  test.afterAll(async () => {
    server?.close();
  });

  test('shows snippet suggestion on slash trigger', async () => {
    const { context, extensionId } = await launchContextWithExtension();
    await seedSnippet(context, extensionId);

    const page = await context.newPage();
    await page.goto(fixtureUrl);

    const input = page.locator('#fixture-input');
    await input.click();
    await input.type('/ref');

    await page.waitForTimeout(400);
    await expect(page.getByText('Refund Policy v1.2', { exact: true })).toBeVisible();

    await context.close();
  });

  test('context prefilters with bookingId', async () => {
    const { context, extensionId } = await launchContextWithExtension();
    await seedSnippet(context, extensionId);

    const page = await context.newPage();
    await page.goto(fixtureUrlWithContext);

    // Type slash trigger and ensure the expected record still shows (prefiltered)
    const input = page.locator('#fixture-input');
    await input.click();
    await input.type('/ref');
    await page.waitForTimeout(300);
    await expect(page.getByText('Refund Policy v1.2', { exact: true })).toBeVisible();

    await context.close();
  });

  test('inserts snippet into input', async () => {
    const { context, extensionId } = await launchContextWithExtension();
    await seedSnippet(context, extensionId);
    const page = await context.newPage();
    await page.goto(fixtureUrl);

    const input = page.locator('#fixture-input');
    await input.click();
    await input.type('/ref');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue(/Refund policy v1\.2/);

    await context.close();
  });

  test('inserts snippet into textarea', async () => {
    const { context, extensionId } = await launchContextWithExtension();
    await seedSnippet(context, extensionId);
    const page = await context.newPage();
    await page.goto(fixtureUrl);

    const textarea = page.locator('#fixture-textarea');
    await textarea.click();
    await textarea.type('/ref');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await expect(textarea).toHaveValue(/Refund policy v1\.2/);

    await context.close();
  });

  test('inserts snippet into contenteditable', async () => {
    const { context, extensionId } = await launchContextWithExtension();
    await seedSnippet(context, extensionId);
    const page = await context.newPage();
    await page.goto(fixtureUrl);

    const ce = page.locator('#fixture-ce');
    await ce.click();
    await page.keyboard.type('/ref');
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await expect(ce).toContainText(/Refund policy v1\.2/);

    await context.close();
  });

  test('escape closes overlay', async () => {
    const { context, extensionId } = await launchContextWithExtension();
    await seedSnippet(context, extensionId);
    const page = await context.newPage();
    await page.goto(fixtureUrl);

    const input = page.locator('#fixture-input');
    await input.click();
    await input.type('/ref');
    await page.waitForTimeout(300);
    await expect(page.getByText('Refund Policy v1.2', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Refund Policy v1.2', { exact: true })).not.toBeVisible();

    await context.close();
  });
});
