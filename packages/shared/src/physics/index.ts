/**
 * Deterministik qüllə simulyasiyası (milestone M1).
 *
 * Determinizm qaydaları (bu qovluq üçün ESLint ilə məcburidir):
 * - Math.random / Math.sin / Math.cos / Math.tan və digər transendent funksiyalar qadağandır
 * - Date.now / performance.now qadağandır; vaxt tam ədədli tick sayıdır
 * - cisimlər yalnız tick sərhədində və sabit ardıcıllıqla yaradılır və silinir
 * Ətraflı: docs/architecture.md, bölmə 5.
 */
export * from './constants';
export { fnv1a32 } from './hash';
export { loadRapier } from './rapier';
export {
  TowerSim,
  type ActiveParcel,
  type BodyView,
  type ReleaseEvent,
  type SimEvent,
} from './TowerSim';
