/**
 * Determinizm testi üçün jurnalları yaradır: TowerSim-də bir botu oynadır və buraxılma hadisələrini yazır.
 * Jurnallar bir dəfə yaradılıb repo-da saxlanılır; test həmişə eyni faylları istifadə edir.
 * İşlətmə: pnpm --filter @stampback/determinism-check generate
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Belt,
  BOT_PROFILES,
  BotPlayer,
  ParcelSequence,
  POST_OFFICE,
  TowerSim,
} from '@stampback/shared';
import type { Fixture } from './scenario';

/** Hər jurnal təxminən 4 dəqiqəlik oyundur. */
const TICKS = 60 * 240;

async function generate(name: string, seed: number, profileIndex: number): Promise<Fixture> {
  const sim = await TowerSim.create(POST_OFFICE);
  const profile = { ...BOT_PROFILES[profileIndex]!, seed, accuracy: 0.5 };
  const bot = new BotPlayer(sim, new Belt(new ParcelSequence(seed)), profile);
  for (let t = 0; t < TICKS; t++) {
    bot.tick();
    sim.step();
  }
  const fixture: Fixture = { name, seed, ticks: sim.tick, events: [...sim.log] };
  console.log(
    `${name}: ${fixture.events.length} buraxılma, ${fixture.ticks} tick, itirilən: ${sim.lostCount}, hündürlük: ${sim.getHeight().toFixed(2)}`,
  );
  sim.dispose();
  return fixture;
}

const outDir = fileURLToPath(new URL('../fixtures/', import.meta.url));
for (const [name, seed, profile] of [
  ['log-a', 1, 0],
  ['log-b', 2, 1],
  ['log-c', 3, 2],
] as const) {
  const fixture = await generate(name, seed, profile);
  writeFileSync(`${outDir}${name}.json`, `${JSON.stringify(fixture)}\n`);
}
