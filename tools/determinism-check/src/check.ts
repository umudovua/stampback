/**
 * Determinizm testi (docs/architecture.md, bölmə 11): eyni jurnallar Node.js, Chromium, Firefox və
 * WebKit-də oynadılır və dünya hash-ləri müqayisə olunur. Fərq olarsa, proses 1 kodu ilə bitir.
 *
 * DETERMINISM_BROWSERS mühit dəyişəni ilə brauzerlər seçilir (məs. "chromium,webkit" və ya "none").
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium, firefox, webkit, type BrowserType } from 'playwright';
import { CHECKPOINT_EVERY, runScenario, type Fixture, type ScenarioResult } from './scenario';

const fixturesDir = fileURLToPath(new URL('../fixtures/', import.meta.url));
const fixtures: Fixture[] = readdirSync(fixturesDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(`${fixturesDir}${f}`, 'utf8')) as Fixture);

const engines: Record<string, BrowserType> = { chromium, firefox, webkit };
const requested = (process.env.DETERMINISM_BROWSERS ?? 'chromium,firefox,webkit')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s && s !== 'none');

async function bundleHarness(): Promise<string> {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('./harness.ts', import.meta.url))],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    write: false,
  });
  const file = result.outputFiles[0];
  if (!file) throw new Error('Harness bundle is empty');
  return file.text;
}

async function runInBrowser(name: string, script: string): Promise<ScenarioResult[]> {
  const engine = engines[name];
  if (!engine) throw new Error(`Naməlum brauzer: ${name}`);
  const browser = await engine.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: script });
    return await page.evaluate((f) => window.runDeterminism(f), fixtures);
  } finally {
    await browser.close();
  }
}

const results: Record<string, ScenarioResult[]> = {};
console.log(`Jurnallar: ${fixtures.map((f) => `${f.name} (${f.events.length})`).join(', ')}`);

const nodeResults: ScenarioResult[] = [];
for (const fixture of fixtures) nodeResults.push(await runScenario(fixture));
results.node = nodeResults;
console.log('node: hazır');

if (requested.length > 0) {
  const script = await bundleHarness();
  for (const name of requested) {
    results[name] = await runInBrowser(name, script);
    console.log(`${name}: hazır`);
  }
}

let failed = false;
const environments = Object.keys(results);
for (const [index, fixture] of fixtures.entries()) {
  const reference = results.node![index]!.checkpoints;
  for (const env of environments) {
    const actual = results[env]![index]!.checkpoints;
    const diverged = reference.findIndex((hash, i) => hash !== actual[i]);
    if (diverged !== -1 || actual.length !== reference.length) {
      failed = true;
      const at = diverged === -1 ? reference.length : diverged;
      console.error(
        `FƏRQ: ${fixture.name}, ${env} mühiti node-dan ${at}-cü yoxlama nöqtəsində ayrıldı ` +
          `(~${(at + 1) * CHECKPOINT_EVERY}-ci tick): ${reference[at]} != ${actual[at]}`,
      );
    }
  }
  console.log(
    `${fixture.name}: son hash ${reference.at(-1)} (${reference.length} yoxlama nöqtəsi)`,
  );
}

if (failed) {
  console.error('Determinizm testi UĞURSUZ oldu.');
  process.exit(1);
}
console.log(`Determinizm testi keçdi: ${environments.join(', ')} eyni nəticə verdi.`);
