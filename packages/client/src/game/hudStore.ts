import type { NormalParcelKind } from '@stampback/shared';

/** Oyun səhnəsi ilə Preact HUD arasında paylaşılan vəziyyət. */
export interface HudState {
  ready: boolean;
  height: number;
  perfect: number;
  lost: number;
  next: NormalParcelKind | null;
  fps: number;
  physicsMs: number;
}

type Listener = (state: HudState) => void;

let state: HudState = {
  ready: false,
  height: 0,
  perfect: 0,
  lost: 0,
  next: null,
  fps: 0,
  physicsMs: 0,
};
const listeners = new Set<Listener>();
const restartListeners = new Set<() => void>();

export const hudStore = {
  get: (): HudState => state,
  set(patch: Partial<HudState>): void {
    state = { ...state, ...patch };
    for (const listener of listeners) listener(state);
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** HUD-dakı “Yenidən” düyməsi səhnəyə xəbər verir. */
  requestRestart(): void {
    for (const listener of restartListeners) listener();
  },
  onRestart(listener: () => void): () => void {
    restartListeners.add(listener);
    return () => restartListeners.delete(listener);
  },
};
