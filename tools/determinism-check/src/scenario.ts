import { POST_OFFICE, TowerSim, type ReleaseEvent } from '@stampback/shared';

/** Determinizm testi üçün hazır giriş jurnalı. */
export interface Fixture {
  name: string;
  seed: number;
  /** Simulyasiyanın neçə tick oynadılacağı. */
  ticks: number;
  events: ReleaseEvent[];
}

export interface ScenarioResult {
  name: string;
  /** Hər CHECKPOINT_EVERY tick-dən bir və sonda alınan dünya hash-ləri. */
  checkpoints: string[];
}

export const CHECKPOINT_EVERY = 600;

/**
 * Jurnalı təkrar oynadır və aralıq hash-ləri qaytarır.
 * Bu funksiya həm Node-da, həm brauzerdə eyni kodla işləyir.
 */
export async function runScenario(fixture: Fixture): Promise<ScenarioResult> {
  const checkpoints: string[] = [];
  const sim = await TowerSim.replay(POST_OFFICE, fixture.events, fixture.ticks, (s) => {
    if (s.tick % CHECKPOINT_EVERY === 0) checkpoints.push(s.snapshotHash());
  });
  checkpoints.push(sim.snapshotHash());
  sim.dispose();
  return { name: fixture.name, checkpoints };
}
