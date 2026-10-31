import { parcelSize, type ParcelRotation } from '../parcels/catalog';
import { Y_STEPS_PER_CELL } from '../physics/constants';
import type { TowerSim } from '../physics/TowerSim';
import type { Belt } from '../rules/belt';
import { SeededRandom } from '../rules/random';

/** Botun xarakteri: nə qədər dəqiq və nə qədər tez oynadığı. */
export interface BotProfile {
  seed: number;
  /** 0–1: ən yaxşı planı seçmə ehtimalı. Qalan hallarda bir az pis variant seçir. */
  accuracy: number;
  /** İki bağlama arasında düşünmə müddəti (tick), [min, max]. */
  thinkTicks: readonly [number, number];
}

export const BOT_PROFILES: readonly BotProfile[] = [
  { seed: 101, accuracy: 0.75, thinkTicks: [60, 110] },
  { seed: 202, accuracy: 0.6, thinkTicks: [80, 140] },
  { seed: 303, accuracy: 0.85, thinkTicks: [70, 120] },
];

interface Candidate {
  slot: number;
  rot: ParcelRotation;
  x: number;
  score: number;
}

/** Mərkəzdən uzaqlaşmanın cəzası: botlar qülləni platformanın ortasında saxlamağa çalışır. */
const CENTER_PENALTY = 0.15;
/** Qüllə hələ hərəkətdədirsə, bot gözləyir; ən çox bu qədər tick. */
const MAX_WAIT_FOR_SETTLE = 90;

/**
 * Sadə qaydalarla oynayan bot (GDD, bölmə 7): lentdəki 3 bağlamanı, hər iki dönməni və bütün
 * mövqeləri yoxlayır; ən aşağı və mərkəzə yaxın yeri seçir, arabir qəsdən səhv edir.
 * İnsan tempində oynayır. Yalnız seed-li təsadüfilik istifadə edir, ona görə deterministikdir.
 */
export class BotPlayer {
  private readonly rng: SeededRandom;
  private wait: number;
  private waitedForSettle = 0;

  constructor(
    readonly sim: TowerSim,
    private readonly belt: Belt,
    private readonly profile: BotProfile,
  ) {
    this.rng = new SeededRandom(profile.seed);
    this.wait = this.randomThink();
  }

  /** Hər tick-də `sim.step()`-dən əvvəl çağırılır. */
  tick(): void {
    if (this.wait > 0) {
      this.wait--;
      return;
    }
    // Ehtiyatlı oyunçu kimi: qüllə yırğalanırsa, bir az gözləyir.
    if (!this.sim.isSettled() && this.waitedForSettle < MAX_WAIT_FOR_SETTLE) {
      this.waitedForSettle++;
      return;
    }
    this.waitedForSettle = 0;

    const choice = this.choose();
    if (choice) {
      const item = this.belt.take(choice.slot);
      if (item) this.sim.dropAt(item.kind, choice.rot, choice.x);
    }
    this.wait = this.randomThink();
  }

  private randomThink(): number {
    const [min, max] = this.profile.thinkTicks;
    return min + this.rng.nextInt(max - min + 1);
  }

  private choose(): Candidate | null {
    const sim = this.sim;
    const candidates: Candidate[] = [];
    this.belt.slots.forEach((item, slot) => {
      for (const rot of [0, 1] as const) {
        const { w, h } = parcelSize(item.kind, rot);
        if (rot === 1 && w === h) continue;
        const { min, max } = sim.xRange(item.kind, rot);
        for (let x = min; x <= max; x += 2) {
          const landing = sim.landingY(item.kind, rot, x);
          if (landing === null) continue;
          const top = landing / Y_STEPS_PER_CELL + h;
          const center = x / 4 + w / 2;
          // Aşağı və mərkəzə yaxın, həm də enli/alçaq qutuları (sabit) üstün tutur.
          const score = top + Math.abs(center) * CENTER_PENALTY + h * 0.2 - w * 0.05;
          candidates.push({ slot, rot, x, score });
        }
      }
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.score - b.score || a.slot - b.slot || a.x - b.x || a.rot - b.rot);
    const best = this.rng.nextInt(1000) < this.profile.accuracy * 1000;
    return candidates[best ? 0 : this.rng.nextInt(Math.min(6, candidates.length))]!;
  }
}
