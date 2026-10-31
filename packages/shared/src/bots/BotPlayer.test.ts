import { describe, expect, it } from 'vitest';
import { POST_OFFICE } from '../maps';
import { TowerSim } from '../physics/TowerSim';
import { Belt } from '../rules/belt';
import { ParcelSequence } from '../rules/sequence';
import { BOT_PROFILES, BotPlayer } from './BotPlayer';

async function runBot(profileIndex: number, ticks: number) {
  const sim = await TowerSim.create(POST_OFFICE);
  const bot = new BotPlayer(sim, new Belt(new ParcelSequence(11)), BOT_PROFILES[profileIndex]!);
  for (let t = 0; t < ticks; t++) {
    bot.tick();
    sim.step();
  }
  return sim;
}

describe('BotPlayer', () => {
  it('builds a tower over 60 seconds without losing most parcels', async () => {
    const sim = await runBot(0, 60 * 60);
    expect(sim.log.length).toBeGreaterThan(10);
    expect(sim.getHeight()).toBeGreaterThan(4);
    expect(sim.lostCount).toBeLessThan(sim.log.length / 2);
    sim.dispose();
  });

  it('plays deterministically for the same profile and seed', async () => {
    const a = await runBot(1, 60 * 20);
    const b = await runBot(1, 60 * 20);
    expect(a.snapshotHash()).toBe(b.snapshotHash());
    a.dispose();
    b.dispose();
  });
});
