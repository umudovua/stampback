import { describe, expect, it } from 'vitest';
import { NORMAL_PARCEL_KINDS } from '../parcels/normal';
import { ParcelSequence } from './sequence';
import { isPerfectPlacement } from './perfect';

describe('ParcelSequence', () => {
  it('deals every kind exactly once per bag of seven', () => {
    const seq = new ParcelSequence(5);
    for (let bag = 0; bag < 4; bag++) {
      const drawn = Array.from({ length: 7 }, () => seq.next()).sort();
      expect(drawn).toEqual([...NORMAL_PARCEL_KINDS].sort());
    }
  });

  it('gives the same sequence to everyone with the same seed', () => {
    const a = new ParcelSequence(99);
    const b = new ParcelSequence(99);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });

  it('peek shows the next parcel without consuming it', () => {
    const seq = new ParcelSequence(3);
    const peeked = seq.peek();
    expect(seq.next()).toBe(peeked);
  });
});

describe('isPerfectPlacement', () => {
  it('needs a quick calm and at least 80% support', () => {
    expect(isPerfectPlacement({ ticksToCalm: 30, support: 1 })).toBe(true);
    expect(isPerfectPlacement({ ticksToCalm: 30, support: 0.75 })).toBe(false);
    expect(isPerfectPlacement({ ticksToCalm: 90, support: 1 })).toBe(false);
  });
});
