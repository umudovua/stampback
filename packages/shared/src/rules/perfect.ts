import { TICK_RATE } from '../physics/constants';

/**
 * Mükəmməl yerləşdirmə qaydası (GDD, bölmə 3.1): bağlama buraxıldıqdan sonra
 * 1 saniyə ərzində sakitləşir və alt səthinin ən azı 80%-i dəstəklənir.
 */
export const PERFECT_MAX_CALM_TICKS = TICK_RATE;
export const PERFECT_MIN_SUPPORT = 0.8;

export interface PlacementMeasure {
  /** Buraxılmadan sakitləşməyə qədər keçən tick sayı. */
  ticksToCalm: number;
  /** Alt səthin dəstəklənən hissəsi, 0–1. */
  support: number;
}

export function isPerfectPlacement(m: PlacementMeasure): boolean {
  return m.ticksToCalm <= PERFECT_MAX_CALM_TICKS && m.support >= PERFECT_MIN_SUPPORT;
}
