import { describe, expect, it } from 'vitest';
import { POST_OFFICE } from '../maps';
import { TowerSim, type ReleaseEvent } from './TowerSim';
import { SETTLE_TICKS } from './constants';

/** Hamısı sabitləşənə qədər (maks. 20 s) simulyasiyanı işlədir. */
function settle(sim: TowerSim, maxTicks = 1200): void {
  let ticks = 0;
  while ((!sim.isSettled() || ticks < SETTLE_TICKS) && ticks < maxTicks) {
    sim.step();
    ticks++;
  }
}

describe('TowerSim', () => {
  it('starts empty with zero height', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    expect(sim.getHeight()).toBe(0);
    expect(sim.isSettled()).toBe(true);
    sim.dispose();
  });

  it('drops a cube from above the tower and settles it at height 1', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    const event = sim.dropAt('cube', 0, -2);
    expect(event.y).toBeGreaterThan(0);
    settle(sim);
    expect(sim.getHeight()).toBeCloseTo(1, 1);
    expect(sim.log).toHaveLength(1);
    sim.dispose();
  });

  it('stacks two big boxes to height 3', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    sim.dropAt('big', 0, -4);
    settle(sim);
    sim.dropAt('big', 0, -4);
    settle(sim);
    expect(sim.getHeight()).toBeCloseTo(3, 1);
    sim.dispose();
  });

  it('swaps width and height when rotated', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    sim.dropAt('long', 1, -2);
    settle(sim);
    expect(sim.getHeight()).toBeCloseTo(2.5, 1);
    sim.dispose();
  });

  it('keeps the drop line above everything that is still moving', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    sim.dropAt('crate', 0, -3);
    const line = sim.dropLineY();
    expect(line / 64).toBeGreaterThanOrEqual(sim.getTopAny() + 1 - 0.02);
    sim.dispose();
  });

  it('clamps drops so the parcel centre stays over the platform', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    const event = sim.dropAt('cube', 0, 999);
    expect(event.x).toBe(sim.xRange('cube', 0).max);
    sim.dispose();
  });

  it('predicts the landing height of a drop', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    sim.dropAt('big', 0, -4);
    settle(sim);
    // Fiziki bağlama altdakına azacıq batır, ona görə 2 Y addımı dözümlülük.
    const landing = sim.landingY('cube', 0, -2)!;
    expect(Math.abs(landing - (3 * 64) / 2)).toBeLessThanOrEqual(2);
    sim.dispose();
  });

  it('reports a flat drop on the platform as a perfect placement', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    sim.dropAt('brick', 0, -3);
    settle(sim);
    const events = sim.drainEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'settled', perfect: true, support: 1 });
    sim.dispose();
  });

  it('does not count an overhanging parcel as perfect', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    sim.dropAt('cube', 0, -2);
    settle(sim);
    sim.drainEvents();
    // Uzun qutu kubun üstündə əsasən boşluqdadır.
    sim.dropAt('long', 0, -2);
    settle(sim);
    const settled = sim.drainEvents().filter((e) => e.type === 'settled');
    expect(settled[0]).toMatchObject({ perfect: false });
    sim.dispose();
  });

  it('replays a log to an identical world state', async () => {
    const live = await TowerSim.create(POST_OFFICE);
    const drops = [
      ['big', 0, -4],
      ['brick', 1, -2],
      ['long', 0, -6],
      ['crate', 0, 1],
      ['tube', 0, -5],
      ['cube', 0, 2],
    ] as const;
    for (const [kind, rot, x] of drops) {
      live.dropAt(kind, rot, x);
      for (let i = 0; i < 70; i++) live.step();
    }
    const log: ReleaseEvent[] = [...live.log];
    const replayed = await TowerSim.replay(POST_OFFICE, log, live.tick);
    expect(replayed.snapshotHash()).toBe(live.snapshotHash());
    live.dispose();
    replayed.dispose();
  });
});
