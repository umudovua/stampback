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

  // Lentdən 4 bağlamanı siçanla sürükləyib qüllənin üstünə buraxırıq, 2-sini klaviatura ilə.
  const box = page.viewportSize()!;
  const beltY = box.height - 30 - 52;
  const targets = [-40, 30, 0, -10];
  for (let i = 0; i < targets.length; i++) {
    const slotX = (box.width / 3) * ((i % 3) + 0.5);
    await page.mouse.move(slotX, beltY);
    await page.mouse.down();
    await page.mouse.move(box.width / 2 + targets[i]!, box.height * 0.35, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(1600);
    if (i === 1) await page.screenshot({ path: join(outDir, '1b-dragging.png') });
  }
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Digit2');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1600);
  }
  // Qüllənin sabitləşməsini gözləyirik: hündürlük yalnız sabit bağlamalarla ölçülür.
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(outDir, '2-tower.png') });

  const stats = await page.$$eval('.hud-stats strong', (els) => els.map((el) => el.textContent));
  const ladder = await page.$$eval('.ladder-name', (els) => els.map((el) => el.textContent));
  if (ladder.length < 2) errors.push(`Hündürlük nərdivanında rəqiblər yoxdur (${ladder.length})`);
  const debug = await page.textContent('.hud-debug');
  summary = `HUD: hündürlük=${stats[0]}, mükəmməl=${stats[1]}, itirilən=${stats[2]} | nərdivan: ${ladder.join(', ')} | ${debug}`;
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
