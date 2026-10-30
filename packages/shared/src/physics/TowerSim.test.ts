import { describe, expect, it } from 'vitest';
import { POST_OFFICE } from '../maps';
import { parcelCells, rotateCells } from '../parcels/normal';
import { TowerSim, type ReleaseEvent } from './TowerSim';
import { SETTLE_TICKS, Y_STEPS_PER_CELL } from './constants';

/** Bağlamanı buraxır və hamısı sabitləşənə qədər (maks. 20 s) simulyasiyanı işlədir. */
function dropAndSettle(sim: TowerSim, maxTicks = 1200): void {
  sim.setFastDrop(true);
  let ticks = 0;
  while (sim.active && ticks < maxTicks) {
    sim.step();
    ticks++;
  }
  while (!sim.isSettled() && ticks < maxTicks) {
    sim.step();
    ticks++;
  }
  for (let i = 0; i < SETTLE_TICKS; i++) sim.step();
}

describe('parcelCells', () => {
  it('rotates the I piece into a vertical bar', () => {
    expect(parcelCells('I', 1)).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ]);
  });

  it('returns to the original shape after four rotations', () => {
    for (const kind of ['I', 'O', 'T', 'L', 'J', 'S', 'Z'] as const) {
      expect(parcelCells(kind, 0)).toHaveLength(4);
      expect(rotateCells(parcelCells(kind, 1), 3)).toEqual(parcelCells(kind, 0));
    }
  });
});

describe('TowerSim', () => {
  it('starts empty with zero height', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    expect(sim.getHeight()).toBe(0);
    expect(sim.isSettled()).toBe(true);
    sim.dispose();
  });

  it('settles a flat I piece on the platform at height 1', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    expect(sim.spawnParcel('I')).toBe(true);
    dropAndSettle(sim);
    expect(sim.active).toBeNull();
    expect(sim.log).toHaveLength(1);
    expect(sim.getHeight()).toBeCloseTo(1, 1);
    expect(sim.lostCount).toBe(0);
    sim.dispose();
  });

  it('stacks two O pieces to height 4', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    sim.spawnParcel('O');
    dropAndSettle(sim);
    sim.spawnParcel('O');
    dropAndSettle(sim);
    expect(sim.getHeight()).toBeCloseTo(4, 1);
    sim.dispose();
  });

  it('counts a vertical I piece as height 4', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    sim.spawnParcel('I', 1);
    dropAndSettle(sim);
    expect(sim.getHeight()).toBeCloseTo(4, 1);
    sim.dispose();
  });

  it('spawns new parcels above the tower', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    sim.spawnParcel('O');
    dropAndSettle(sim);
    sim.spawnParcel('I');
    expect(sim.active!.y / Y_STEPS_PER_CELL).toBeGreaterThan(sim.getHeight());
    sim.dispose();
  });

  it('moves and rotates the active parcel when space is free', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    sim.spawnParcel('O');
    const x0 = sim.active!.x;
    expect(sim.move(1)).toBe(true);
    expect(sim.active!.x).toBe(x0 + 1);
    expect(sim.rotate()).toBe(true);
    sim.dispose();
  });

  it('loses a parcel released beyond the platform', async () => {
    const sim = await TowerSim.create(POST_OFFICE);
    sim.spawnParcel('O');
    for (let i = 0; i < 40; i++) sim.move(1);
    sim.release();
    for (let i = 0; i < 300; i++) sim.step();
    expect(sim.lostCount).toBe(1);
    expect(sim.getHeight()).toBe(0);
    sim.dispose();
  });

  it('replays a log to an identical world state', async () => {
    const live = await TowerSim.create(POST_OFFICE);
    const kinds = ['L', 'T', 'S', 'O', 'J', 'Z', 'I'] as const;
    kinds.forEach((kind, i) => {
      live.spawnParcel(kind, (i % 4) as 0 | 1 | 2 | 3);
      for (let m = 0; m < i; m++) live.move(i % 2 === 0 ? 1 : -1);
      dropAndSettle(live);
    });
    const log: ReleaseEvent[] = [...live.log];
    const replayed = await TowerSim.replay(POST_OFFICE, log, live.tick);
    expect(replayed.tick).toBe(live.tick);
    expect(replayed.snapshotHash()).toBe(live.snapshotHash());
    live.dispose();
    replayed.dispose();
  });
});
