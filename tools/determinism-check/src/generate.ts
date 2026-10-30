/**
 * Determinizm testi üçün jurnalları yaradır: TowerSim-i skriptlə “oynayır” və buraxılma hadisələrini yazır.
 * Jurnallar bir dəfə yaradılıb repo-da saxlanılır; test həmişə eyni faylları istifadə edir.
 * İşlətmə: pnpm --filter @stampback/determinism-check generate
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  NORMAL_PARCEL_KINDS,
  POST_OFFICE,
  SeededRandom,
  TowerSim,
  type Rotation,
} from '@stampback/shared';
import type { Fixture } from './scenario';

const PARCELS_PER_LOG = 120;
const MAX_WAIT_TICKS = 180;

async function generate(name: string, seed: number): Promise<Fixture> {
  const rng = new SeededRandom(seed);
  const sim = await TowerSim.create(POST_OFFICE);
  for (let n = 0; n < PARCELS_PER_LOG; n++) {
    const kind = rng.pick(NORMAL_PARCEL_KINDS);
    if (!sim.spawnParcel(kind, rng.nextInt(4) as Rotation)) {
      // Qüllə spawn yerinə çatıbsa, bir az gözləyib yenidən cəhd edirik.
      for (let i = 0; i < 30; i++) sim.step();
      continue;
    }
    const shift = rng.nextInt(17) - 8;
    for (let i = 0; i < Math.abs(shift); i++) sim.move(shift < 0 ? -1 : 1);
    sim.setFastDrop(rng.nextInt(3) > 0);
    let waited = 0;
    while (sim.active && waited < 2000) {
      sim.step();
      waited++;
    }
    const pause = 20 + rng.nextInt(MAX_WAIT_TICKS);
    for (let i = 0; i < pause; i++) sim.step();
  }
  const fixture: Fixture = { name, seed, ticks: sim.tick, events: [...sim.log] };
  console.log(
    `${name}: ${fixture.events.length} buraxılma, ${fixture.ticks} tick, itirilən: ${sim.lostCount}, hündürlük: ${sim.getHeight().toFixed(2)}`,
  );
  sim.dispose();
  return fixture;
}

const outDir = fileURLToPath(new URL('../fixtures/', import.meta.url));
for (const [name, seed] of [
  ['log-a', 1],
  ['log-b', 2],
  ['log-c', 3],
] as const) {
  const fixture = await generate(name, seed);
  writeFileSync(`${outDir}${name}.json`, `${JSON.stringify(fixture)}\n`);
}
