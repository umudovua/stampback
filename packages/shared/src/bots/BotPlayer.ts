import { cellBounds, parcelCells, type NormalParcelKind, type Rotation } from '../parcels/normal';
import { Y_STEPS_PER_CELL } from '../physics/constants';
import type { TowerSim } from '../physics/TowerSim';
import { SeededRandom } from '../rules/random';
import type { ParcelSequence } from '../rules/sequence';

/** Botun xarakteri: nə qədər dəqiq və nə qədər tez oynadığı. */
export interface BotProfile {
  seed: number;
  /** 0–1: ən yaxşı planı seçmə ehtimalı. Qalan hallarda bir az pis variant seçir. */
  accuracy: number;
  /** Yeni bağlama gələndə düşünmə müddəti (tick), [min, max]. */
  thinkTicks: readonly [number, number];
  /** İki hərəkət arasında fasilə (tick). */
  actionTicks: number;
}

export const BOT_PROFILES: readonly BotProfile[] = [
  { seed: 101, accuracy: 0.75, thinkTicks: [20, 50], actionTicks: 5 },
  { seed: 202, accuracy: 0.6, thinkTicks: [30, 70], actionTicks: 7 },
  { seed: 303, accuracy: 0.85, thinkTicks: [25, 60], actionTicks: 6 },
];

interface Plan {
  rot: Rotation;
  x: number;
}

interface Candidate extends Plan {
  score: number;
}

/** Mərkəzdən uzaqlaşmanın cəzası: botlar qülləni platformanın ortasında saxlamağa çalışır. */
const CENTER_PENALTY = 0.12;

/**
 * Sadə qaydalarla oynayan bot (GDD, bölmə 7): ən aşağı yerə, mərkəzə yaxın qoymağa çalışır,
 * arabir qəsdən səhv edir. İnsan tempində hərəkət edir: düşünür, döndərir, sürüşdürür, endirir.
 * Yalnız seed-li təsadüfilik istifadə edir, ona görə deterministikdir.
 */
export class BotPlayer {
  private readonly rng: SeededRandom;
  private plan: Plan | null = null;
  private wait = 0;

  constructor(
    readonly sim: TowerSim,
    private readonly sequence: ParcelSequence,
    private readonly profile: BotProfile,
  ) {
    this.rng = new SeededRandom(profile.seed);
    this.wait = this.randomThink();
  }

  /** Hər tick-də `sim.step()`-dən əvvəl çağırılır. */
  tick(): void {
    const sim = this.sim;
    if (this.wait > 0) {
      this.wait--;
      return;
    }

    const active = sim.active;
    if (!active) {
      if (sim.spawnParcel(this.sequence.peek())) {
        this.sequence.next();
        this.plan = null;
        this.wait = this.randomThink();
      } else {
        this.wait = 30;
      }
      return;
    }

    if (!this.plan) {
      this.plan = this.choosePlan(active.kind);
      return;
    }

    if (active.rot !== this.plan.rot) {
      if (!sim.rotate()) this.plan.rot = active.rot;
    } else if (active.x !== this.plan.x) {
      const dir = this.plan.x > active.x ? 1 : -1;
      if (!sim.move(dir)) this.plan.x = active.x;
    } else {
      sim.setFastDrop(true);
      return;
    }
    this.wait = this.profile.actionTicks;
  }

  private randomThink(): number {
    const [min, max] = this.profile.thinkTicks;
    return min + this.rng.nextInt(max - min + 1);
  }

  /** Bütün dönmə və mövqeləri yoxlayır; ən aşağı və mərkəzə yaxın yeri seçir. */
  private choosePlan(kind: NormalParcelKind): Plan {
    const sim = this.sim;
    const candidates: Candidate[] = [];
    const seen = new Set<string>();
    for (let r = 0; r < 4; r++) {
      const rot = r as Rotation;
      const cells = parcelCells(kind, rot);
      const key = cells.map(([c, row]) => `${c},${row}`).join(';');
      if (seen.has(key)) continue;
      seen.add(key);
      const { width, height } = cellBounds(cells);
      const { min, max } = sim.xRange(kind, rot);
      for (let x = min; x <= max; x += 2) {
        const landing = sim.landingY(kind, rot, x);
        if (landing === null) continue;
        const top = landing / Y_STEPS_PER_CELL + height;
        const centerOffset = x / 4 + width / 2;
        const score = top + Math.abs(centerOffset) * CENTER_PENALTY;
        candidates.push({ rot, x, score });
      }
    }
    if (candidates.length === 0) return { rot: 0, x: sim.active?.x ?? 0 };
    candidates.sort((a, b) => a.score - b.score || a.x - b.x || a.rot - b.rot);
    const pickBest = this.rng.nextInt(1000) < this.profile.accuracy * 1000;
    const index = pickBest ? 0 : this.rng.nextInt(Math.min(5, candidates.length));
    const choice = candidates[index]!;
    return { rot: choice.rot, x: choice.x };
  }
}
