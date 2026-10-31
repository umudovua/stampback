import { NORMAL_PARCEL_KINDS, type NormalParcelKind } from '../parcels/normal';
import { SeededRandom } from './random';

/**
 * Normal bağlama ardıcıllığı: “7-bag” üsulu. Hər 7 bağlamada hər forma düz bir dəfə gəlir,
 * sıra seed-li qarışdırılır. Eyni seed bütün oyunçulara eyni ardıcıllığı verir (GDD, bölmə 4).
 */
export class ParcelSequence {
  private readonly rng: SeededRandom;
  private bag: NormalParcelKind[] = [];

  constructor(seed: number) {
    this.rng = new SeededRandom(seed);
  }

  next(): NormalParcelKind {
    this.fill();
    return this.bag.shift()!;
  }

  peek(): NormalParcelKind {
    this.fill();
    return this.bag[0]!;
  }

  private fill(): void {
    while (this.bag.length < 2) {
      const fresh = [...NORMAL_PARCEL_KINDS];
      for (let i = fresh.length - 1; i > 0; i--) {
        const j = this.rng.nextInt(i + 1);
        [fresh[i], fresh[j]] = [fresh[j]!, fresh[i]!];
      }
      this.bag.push(...fresh);
    }
  }
}
