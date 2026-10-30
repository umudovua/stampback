/**
 * Seed-li psevdo-təsadüfi ədəd generatoru (mulberry32).
 * Yalnız tam ədəd əməliyyatlarıdır: eyni seed hər platformada eyni ardıcıllığı verir.
 * Simulyasiyada `Math.random` əvəzinə yalnız bu istifadə olunur.
 */
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Növbəti 32-bit işarəsiz tam ədəd. */
  nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** [0, maxExclusive) aralığında tam ədəd. */
  nextInt(maxExclusive: number): number {
    return this.nextUint32() % maxExclusive;
  }

  /** Massivdən təsadüfi element. */
  pick<T>(items: readonly T[]): T {
    const item = items[this.nextInt(items.length)];
    if (item === undefined) throw new Error('pick() on an empty array');
    return item;
  }
}
