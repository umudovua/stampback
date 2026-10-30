import RAPIER from '@dimforge/rapier2d-deterministic-compat';

let ready: Promise<typeof RAPIER> | null = null;

/**
 * Rapier WASM modulunu bir dəfə başladır. Həm brauzerdə, həm Node-da işləyir.
 * Deterministik build: eyni versiya və eyni girişlər hər platformada eyni nəticə verir.
 */
export function loadRapier(): Promise<typeof RAPIER> {
  ready ??= RAPIER.init().then(() => RAPIER);
  return ready;
}

export type Rapier = typeof RAPIER;
