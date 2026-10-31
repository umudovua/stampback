import { describe, expect, it } from 'vitest';
import { PARCEL_KINDS } from '../parcels/catalog';
import { Belt, BELT_SLOTS } from './belt';
import { isPerfectPlacement } from './perfect';
import { ParcelSequence } from './sequence';

describe('ParcelSequence', () => {
  it('gives the same sequence to everyone with the same seed', () => {
    const a = new ParcelSequence(99);
    const b = new ParcelSequence(99);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });

  it('eventually deals every kind', () => {
    const seq = new ParcelSequence(4);
    const seen = new Set(Array.from({ length: 300 }, () => seq.next()));
    expect([...seen].sort()).toEqual([...PARCEL_KINDS].sort());
  });
});

describe('Belt', () => {
  it('always holds three parcels and refills after a take', () => {
    const belt = new Belt(new ParcelSequence(1));
    expect(belt.slots).toHaveLength(BELT_SLOTS);
    const second = belt.slots[1]!;
    const taken = belt.take(1);
    expect(taken).toBe(second);
    expect(belt.slots).toHaveLength(BELT_SLOTS);
    expect(belt.slots.map((i) => i.serial)).toEqual([0, 2, 3]);
  });

  it('rotates an item in place', () => {
    const belt = new Belt(new ParcelSequence(1));
    belt.rotate(0);
    expect(belt.slots[0]!.rot).toBe(1);
    belt.rotate(0);
    expect(belt.slots[0]!.rot).toBe(0);
  });
});

describe('isPerfectPlacement', () => {
  it('needs a quick calm and at least 80% support', () => {
    expect(isPerfectPlacement({ ticksToCalm: 30, support: 1 })).toBe(true);
    expect(isPerfectPlacement({ ticksToCalm: 30, support: 0.75 })).toBe(false);
    expect(isPerfectPlacement({ ticksToCalm: 90, support: 1 })).toBe(false);
  });
});
