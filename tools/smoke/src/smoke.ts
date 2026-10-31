/**
 * Smoke test: client build-ini telefon ölçülü Chromium-da açır, bir neçə bağlama düşürür,
 * səhifə xətalarını yoxlayır və ekran şəklini `tools/smoke/out/` qovluğuna yazır.
 * Əvvəlcə `pnpm build` işlədilməlidir. İşlətmə: pnpm smoke
 */
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const distDir = fileURLToPath(new URL('../../../packages/client/dist/', import.meta.url));
const outDir = fileURLToPath(new URL('../out/', import.meta.url));
if (!existsSync(join(distDir, 'index.html'))) {
  console.error('packages/client/dist tapılmadı: əvvəlcə `pnpm build` işlədin.');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/'));
  let file = join(distDir, path);
  if (!file.startsWith(distDir) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(distDir, 'index.html');
  }
  res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
});
await new Promise<void>((resolve) => server.listen(4173, resolve));

const errors: string[] = [];
let summary = '';
const browser = await chromium.launch();
let page0: import('playwright').Page | undefined;
try {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  page0 = page;
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto('http://localhost:4173/?seed=7&debug');
  await page.waitForSelector('.hud-stats', { timeout: 30_000 });
  await page.screenshot({ path: join(outDir, '1-start.png') });

  // 6 bağlama: hərəsini bir az sürüşdürüb sürətli endiririk.
  const box = page.viewportSize()!;
  for (let i = 0; i < 6; i++) {
    const shift = (i % 3) - 1;
    for (let m = 0; m < Math.abs(shift); m++) {
      await page.keyboard.press(shift < 0 ? 'ArrowLeft' : 'ArrowRight');
    }
    if (i % 2 === 1) await page.touchscreen.tap(box.width / 2, box.height / 2);
    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(1500);
    await page.keyboard.up('ArrowDown');
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(outDir, '2-tower.png') });

  const stats = await page.$$eval('.hud-stats strong', (els) => els.map((el) => el.textContent));
  const debug = await page.textContent('.hud-debug');
  summary = `HUD: hündürlük=${stats[0]}, mükəmməl=${stats[1]}, itirilən=${stats[2]}, növbəti=${stats[3]} | ${debug}`;
  console.log(summary);

  const height = Number(stats[0]);
  if (!(height > 0))
    errors.push(`Qüllə hündürlüyü 0-dır: bağlamalar yerləşmədi (${stats.join(', ')})`);
} catch (error) {
  errors.push(
    `exception: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
  );
  await page0?.screenshot({ path: join(outDir, '0-failure.png') }).catch(() => undefined);
} finally {
  await browser.close();
  server.close();
}

// GitHub Actions-da nəticə annotasiya kimi də yazılır ki, API ilə oxuna bilsin.
const inCi = Boolean(process.env.GITHUB_ACTIONS);
const annotate = (level: 'error' | 'notice', message: string) => {
  if (inCi) console.log(`::${level} title=Smoke::${message.replace(/\r?\n/g, ' ')}`);
};

if (errors.length > 0) {
  console.error('Smoke test UĞURSUZ:');
  for (const error of errors) {
    console.error(`  ${error}`);
    annotate('error', error);
  }
  process.exit(1);
}
annotate('notice', summary);
console.log('Smoke test keçdi. Ekran şəkilləri: tools/smoke/out/');
