import type { ParcelKind, ParcelRotation } from '../parcels/catalog';
import type { ParcelSequence } from './sequence';

/** Çeşidləmə lentindəki yuva sayı (GDD v1.1, bölmə 3.2). */
export const BELT_SLOTS = 3;

export interface BeltItem {
  /** Hər yeni bağlama üçün artan nömrə: animasiya və jurnal üçün. */
  serial: number;
  kind: ParcelKind;
  rot: ParcelRotation;
}

/**
 * Çeşidləmə lenti: oyunçu 3 bağlamadan istədiyini götürür, boşalan yer ardıcıllıqdan doldurulur.
 * Lentdəki bağlamanı döndərmək olar; döndərmə bağlama ilə birlikdə saxlanılır.
 */
export class Belt {
  private items: BeltItem[] = [];
  private serial = 0;

  constructor(private readonly sequence: ParcelSequence) {
    while (this.items.length < BELT_SLOTS) this.items.push(this.fresh());
  }

  get slots(): readonly BeltItem[] {
    return this.items;
  }

  rotate(slot: number): void {
    const item = this.items[slot];
    if (item) item.rot = item.rot === 0 ? 1 : 0;
  }

  /** Yuvadakı bağlamanı götürür; lent sola sürüşür və sona yeni bağlama gəlir. */
  take(slot: number): BeltItem | null {
    const item = this.items[slot];
    if (!item) return null;
    this.items.splice(slot, 1);
    this.items.push(this.fresh());
    return item;
  }

  private fresh(): BeltItem {
    return { serial: this.serial++, kind: this.sequence.next(), rot: 0 };
  }
}
