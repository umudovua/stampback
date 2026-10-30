/**
 * FNV-1a 32-bit hash. Determinizm testində Rapier snapshot-larını müqayisə etmək üçün.
 * Yalnız tam ədəd əməliyyatları istifadə edir.
 */
export function fnv1a32(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i] ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
