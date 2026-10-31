/**
 * Bağlama kataloqu (GDD v1.1, bölmə 4): tetromino əvəzinə müxtəlif ölçülü real qutular.
 * Ölçülər yarım hüceyrə vahidindədir (1 vahid = ½ hüceyrə), ona görə qutular şəbəkəyə bağlı görünmür.
 */

export type ParcelKind = 'cube' | 'brick' | 'long' | 'tube' | 'big' | 'wide' | 'crate';

/** 0 = olduğu kimi, 1 = 90° döndərilmiş (düzbucaqlı qutu üçün yalnız iki vəziyyət fərqlidir). */
export type ParcelRotation = 0 | 1;

export interface ParcelDef {
  kind: ParcelKind;
  /** En və hündürlük, yarım hüceyrə vahidində. */
  w: number;
  h: number;
  /** Lentdə görünmə ehtimalının çəkisi. */
  weight: number;
}

/** Yarım hüceyrə vahidi: 2 vahid = 1 hüceyrə. */
export const UNITS_PER_CELL = 2;

export const PARCELS: Record<ParcelKind, ParcelDef> = {
  cube: { kind: 'cube', w: 2, h: 2, weight: 14 },
  brick: { kind: 'brick', w: 3, h: 2, weight: 20 },
  long: { kind: 'long', w: 5, h: 2, weight: 16 },
  tube: { kind: 'tube', w: 6, h: 1, weight: 8 },
  big: { kind: 'big', w: 4, h: 3, weight: 16 },
  wide: { kind: 'wide', w: 5, h: 3, weight: 12 },
  crate: { kind: 'crate', w: 3, h: 3, weight: 14 },
};

export const PARCEL_KINDS = Object.keys(PARCELS) as ParcelKind[];

/** Döndərilmiş ölçü, hüceyrə ilə. */
export function parcelSize(kind: ParcelKind, rot: ParcelRotation): { w: number; h: number } {
  const def = PARCELS[kind];
  const w = (rot === 0 ? def.w : def.h) / UNITS_PER_CELL;
  const h = (rot === 0 ? def.h : def.w) / UNITS_PER_CELL;
  return { w, h };
}
