import {
  Belt,
  BOT_PROFILES,
  BotPlayer,
  ParcelSequence,
  POST_OFFICE,
  TowerSim,
  type SimEvent,
} from '@stampback/shared';
import { BOT_NAMES, FINISH_HEIGHT, PLAYER_COLORS } from './players';

export interface MatchPlayer {
  id: number;
  name: string;
  color: number;
  isMe: boolean;
  sim: TowerSim;
  belt: Belt;
  bot: BotPlayer | null;
}

/**
 * Oflayn matç: oyunçu + botlar, hər biri öz qülləsində və öz lentində, hamı eyni bağlama ardıcıllığı ilə.
 * M3-də botların yerinə şəbəkədən gələn real oyunçular gələcək; səhnə eyni interfeysi görəcək.
 */
export class OfflineMatch {
  readonly players: MatchPlayer[] = [];
  winner: MatchPlayer | null = null;

  static async create(seed: number, myName: string, botCount = 3): Promise<OfflineMatch> {
    const match = new OfflineMatch();
    match.players.push({
      id: 0,
      name: myName,
      color: PLAYER_COLORS[0],
      isMe: true,
      sim: await TowerSim.create(POST_OFFICE),
      belt: new Belt(new ParcelSequence(seed)),
      bot: null,
    });
    for (let i = 0; i < botCount; i++) {
      const sim = await TowerSim.create(POST_OFFICE);
      const belt = new Belt(new ParcelSequence(seed));
      const profile = BOT_PROFILES[i % BOT_PROFILES.length]!;
      match.players.push({
        id: i + 1,
        name: BOT_NAMES[i % BOT_NAMES.length]!,
        color: PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length]!,
        isMe: false,
        sim,
        belt,
        bot: new BotPlayer(sim, belt, { ...profile, seed: profile.seed + seed }),
      });
    }
    return match;
  }

  get me(): MatchPlayer {
    return this.players[0]!;
  }

  /** Bir tick: botlar qərar verir, bütün qüllələr bir addım irəliləyir. Oyunçunun hadisələrini qaytarır. */
  step(): SimEvent[] {
    if (this.winner) return [];
    for (const player of this.players) {
      player.bot?.tick();
      player.sim.step();
    }
    for (const player of this.players) {
      if (player.sim.getHeight() >= FINISH_HEIGHT) {
        this.winner = player;
        break;
      }
    }
    return this.me.sim.drainEvents();
  }

  /** Oyunçu lentdən bağlamanı götürüb x mövqeyindən buraxır. */
  dropFromBelt(slot: number, x: number): void {
    if (this.winner) return;
    const item = this.me.belt.slots[slot];
    if (!item) return;
    this.me.belt.take(slot);
    this.me.sim.dropAt(item.kind, item.rot, x);
  }

  /**
   * Ən yaxın rəqib (GDD, bölmə 3.3): hündürlükdə bir pillə yuxarıdakı oyunçu.
   * Lider özüdürsə, ikinci yerdəki oyunçu.
   */
  target(): MatchPlayer | null {
    const ranked = [...this.players].sort(
      (a, b) => b.sim.getHeight() - a.sim.getHeight() || a.id - b.id,
    );
    const myIndex = ranked.findIndex((p) => p.isMe);
    if (myIndex > 0) return ranked[myIndex - 1]!;
    return ranked[1] ?? null;
  }

  dispose(): void {
    for (const player of this.players) player.sim.dispose();
  }
}
