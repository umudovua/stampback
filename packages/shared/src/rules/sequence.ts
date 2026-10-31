import { PARCEL_KINDS, PARCELS, type ParcelKind } from '../parcels/catalog';
import { SeededRandom } from './random';

/**
 * Bağlama ardıcıllığı: kataloqdakı çəkilərə görə seed-li seçim.
 * Eyni seed bütün oyunçulara eyni ardıcıllığı verir (GDD, bölmə 4).
 */
export class ParcelSequence {
  private readonly rng: SeededRandom;
  private readonly totalWeight: number;

  constructor(seed: number) {
    this.rng = new SeededRandom(seed);
    this.totalWeight = PARCEL_KINDS.reduce((sum, kind) => sum + PARCELS[kind].weight, 0);
  }

  next(): ParcelKind {
    let roll = this.rng.nextInt(this.totalWeight);
    for (const kind of PARCEL_KINDS) {
      roll -= PARCELS[kind].weight;
      if (roll < 0) return kind;
    }
    return PARCEL_KINDS[0]!;
  }
}
