import Phaser from 'phaser';
import { POST_OFFICE, TICK_RATE, X_STEPS_PER_CELL, Y_STEPS_PER_CELL } from '@stampback/shared';
import { OfflineMatch, type MatchPlayer } from '../game/OfflineMatch';
import { hudStore } from '../game/hudStore';
import { FINISH_HEIGHT } from '../game/players';
import { t } from '../i18n';
import { InputController } from '../input/InputController';
import { CARDBOARD, drawParcel } from '../render/parcelArt';
import { TowerRenderer, type TowerStyle } from '../render/TowerRenderer';

const STEP_MS = 1000 / TICK_RATE;
/** Arxa plandan qayıdanda bir kadrda ən çox neçə tick yetişdirilir (arxitektura, 5.1). */
const MAX_STEPS_PER_FRAME = 5;
/** Ekranın altında ipucu və debug mətni üçün saxlanılan yer (piksel). */
const BOTTOM_RESERVE_PX = 56;
/** Arxadakı rəqib qülləsinin şəffaflığı (“şüşə arxasında” görünüş). */
const RIVAL_ALPHA = 0.3;

/** Sadə, sakit fon: dekorasiya real qrafika gələnə qədər çıxarılıb. */
const BACKGROUND = 0xe9dcc6;
const COUNTER_TOP = 0x8a6545;
const COUNTER = 0x6b4b30;
const COUNTER_LINE = 0x5a3e27;
const FINISH = 0xb8322a;
const GHOST = 0xffffff;
/** Bir hərəkət addımı: yarım hüceyrə (2 X addımı). Alt qutularla düzləməni asanlaşdırır. */
const MOVE_STEPS = 2;
/** Aktiv bağlamanın ekranda yeni mövqeyə hamar çatma müddəti (ms, eksponensial). */
const MOVE_SMOOTH_MS = 45;

/**
 * Oflayn matç səhnəsi: öz qüllən ön planda, ən yaxın rəqibin qülləsi arxada yarımşəffaf,
 * botlar real vaxtda oynayır (docs/gdd.md, bölmə 3.3 və 6).
 */
export class MatchScene extends Phaser.Scene {
  private match: OfflineMatch | null = null;
  private controls: InputController | null = null;
  private myTower: TowerRenderer | null = null;
  private rivalTower: TowerRenderer | null = null;
  private rival: MatchPlayer | null = null;
  private accumulator = 0;
  private scalePx = 32;
  private cameraY = 0;
  private perfectCount = 0;
  private background!: Phaser.GameObjects.Graphics;
  private stage!: Phaser.GameObjects.Graphics;
  private activeGfx!: Phaser.GameObjects.Graphics;
  private finishLabel!: Phaser.GameObjects.Text;
  private fpsSamples: number[] = [];
  private physicsMsSamples: number[] = [];
  private hudTimer = 0;
  private generation = 0;
  private activeRef: object | null = null;
  private activeDrawX = 0;

  constructor() {
    super('MatchScene');
  }

  create(): void {
    this.background = this.add.graphics().setScrollFactor(0).setDepth(-20);
    this.stage = this.add.graphics().setDepth(2);
    this.activeGfx = this.add.graphics().setDepth(10);
    this.finishLabel = this.add
      .text(0, 0, t('hud.finish'), {
        fontFamily: 'Trebuchet MS, Segoe UI, system-ui, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#b8322a',
      })
      .setOrigin(0, 1)
      .setDepth(3);

    this.controls = new InputController(this, {
      move: (dir) => this.moveActive(dir),
      rotate: () => this.match?.me.sim.rotate(),
      fastDrop: (on) => this.match?.me.sim.setFastDrop(on),
    });

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    const offRestart = hudStore.onRestart(() => void this.restart());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offRestart();
      this.controls?.destroy();
      this.match?.dispose();
    });

    void this.restart();
  }

  override update(_time: number, delta: number): void {
    const match = this.match;
    if (!match) return;

    this.accumulator += Math.min(delta, STEP_MS * MAX_STEPS_PER_FRAME);
    const t0 = performance.now();
    let steps = 0;
    while (this.accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      match.spawnForMe();
      this.myTower?.beginStep();
      this.rivalTower?.beginStep();
      for (const event of match.step()) {
        if (event.type === 'settled' && event.perfect) {
          this.perfectCount++;
          this.myTower?.pulse(event.id);
        }
      }
      this.myTower?.sync();
      this.rivalTower?.sync();
      this.accumulator -= STEP_MS;
      steps++;
    }
    if (steps > 0) this.physicsMsSamples.push((performance.now() - t0) / steps);

    this.updateRival();
    const alpha = this.accumulator / STEP_MS;
    this.rivalTower?.render(alpha);
    this.myTower?.render(alpha);
    this.renderActive(delta);
    this.followTower(delta);
    this.updateHud(delta);
  }

  private async restart(): Promise<void> {
    const generation = ++this.generation;
    this.match?.dispose();
    this.match = null;
    this.myTower?.clear();
    this.rivalTower?.clear();
    this.myTower = null;
    this.rivalTower = null;
    this.rival = null;
    this.perfectCount = 0;
    this.accumulator = 0;
    this.cameraY = 0;
    hudStore.set({ ready: false, winner: null });

    const seedParam = new URLSearchParams(location.search).get('seed');
    const seed = seedParam ? Number(seedParam) : Date.now() >>> 0;
    const match = await OfflineMatch.create(seed, t('hud.you'));
    if (generation !== this.generation) {
      match.dispose();
      return;
    }
    this.match = match;
    this.myTower = new TowerRenderer(this, match.me.sim, this.myStyle(), this.scalePx);
    hudStore.set({ ready: true, height: 0, perfect: 0, lost: 0 });
  }

  private myStyle(): TowerStyle {
    return { tape: this.match!.me.color, alpha: 1, depth: 5 };
  }

  private rivalStyle(player: MatchPlayer): TowerStyle {
    return { tape: player.color, alpha: RIVAL_ALPHA, depth: 1, tint: player.color };
  }

  /** Hədəf rəqib dəyişibsə, arxadakı qülləni ona keçirir. */
  private updateRival(): void {
    const target = this.match?.target() ?? null;
    if (!target) return;
    if (target === this.rival) return;
    this.rival = target;
    if (this.rivalTower) this.rivalTower.setSource(target.sim, this.rivalStyle(target));
    else
      this.rivalTower = new TowerRenderer(this, target.sim, this.rivalStyle(target), this.scalePx);
  }

  /** Yarım hüceyrə sürüşdürür; divara dəyib yarıda qalarsa, geri qaytarır ki, düzləmə pozulmasın. */
  private moveActive(dir: -1 | 1): void {
    const sim = this.match?.me.sim;
    if (!sim?.active) return;
    let moved = 0;
    while (moved < MOVE_STEPS && sim.move(dir)) moved++;
    if (moved > 0 && moved < MOVE_STEPS) {
      while (moved-- > 0) sim.move(dir === 1 ? -1 : 1);
    }
  }

  private renderActive(delta: number): void {
    const g = this.activeGfx;
    g.clear();
    const me = this.match?.me;
    const active = me?.sim.active;
    if (!me || !active) {
      this.activeRef = null;
      return;
    }
    const s = this.scalePx;
    const targetX = (active.x / X_STEPS_PER_CELL) * s;
    if (this.activeRef !== active) {
      this.activeRef = active;
      this.activeDrawX = targetX;
    }
    // Məntiqi mövqe dərhal dəyişir (kölgə dəqiqdir), ekrandakı bağlama isə ora hamar sürüşür.
    this.activeDrawX += (targetX - this.activeDrawX) * Math.min(1, delta / MOVE_SMOOTH_MS);
    if (Math.abs(targetX - this.activeDrawX) < 0.5) this.activeDrawX = targetX;
    const ox = this.activeDrawX;
    const ghostX = targetX;

    const ghostY = me.sim.ghostY();
    if (ghostY !== null) {
      const gy = (ghostY / Y_STEPS_PER_CELL) * s;
      g.fillStyle(GHOST, 0.28);
      for (const [c, r] of active.cells) g.fillRect(ghostX + c * s, -(gy + (r + 1) * s), s, s);
    }

    const oy = (active.y / Y_STEPS_PER_CELL) * s;
    g.save();
    g.translateCanvas(ox, -oy);
    drawParcel(g, active.cells, s, { fill: CARDBOARD[active.kind], tape: me.color });
    g.restore();
  }

  /** Kamera qüllələrin ən hündürünü yumşaq izləyir: zirvə ekranın yuxarı üçdə birində qalır. */
  private followTower(delta: number): void {
    const { height } = this.scale.gameSize;
    const s = this.scalePx;
    const mine = this.match?.me.sim.getHeight() ?? 0;
    const rival = this.rival?.sim.getHeight() ?? 0;
    const top = Math.max(mine, rival);
    const target = Math.max(0, top * s - (height - BOTTOM_RESERVE_PX) * 0.55);
    this.cameraY = Phaser.Math.Linear(this.cameraY, target, Math.min(1, delta / 300));
    this.cameras.main.scrollY = -(height - BOTTOM_RESERVE_PX - s) - this.cameraY;
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const cellsAcross = POST_OFFICE.platformWidth + 2;
    this.scalePx = Math.floor(Math.min(width / cellsAcross, height / 18));
    const s = this.scalePx;
    this.cameras.main.scrollX = -width / 2;
    this.controls?.setStepPixels((s * MOVE_STEPS) / X_STEPS_PER_CELL);
    this.myTower?.setScale(s);
    this.rivalTower?.setScale(s);

    this.background.clear().fillStyle(BACKGROUND, 1).fillRect(0, 0, width, height);

    // Platforma poçt piştaxtası kimi; finiş xətti qırıq qırmızı xətt.
    const half = (POST_OFFICE.platformWidth / 2) * s;
    const g = this.stage;
    g.clear();
    g.fillStyle(COUNTER, 1).fillRect(-half - s * 0.3, 0, half * 2 + s * 0.6, height);
    g.fillStyle(COUNTER_TOP, 1).fillRect(-half - s * 0.3, 0, half * 2 + s * 0.6, s * 0.35);
    g.fillStyle(COUNTER_LINE, 1);
    for (let x = -half + s; x < half; x += s * 2) g.fillRect(x, s * 0.35, 2, height);

    const finishY = -FINISH_HEIGHT * s;
    g.fillStyle(FINISH, 1);
    for (let x = -half; x < half; x += s * 0.6) g.fillRect(x, finishY - 1, s * 0.35, 3);
    this.finishLabel.setPosition(-half, finishY - 4);
  }

  private updateHud(delta: number): void {
    this.fpsSamples.push(delta > 0 ? 1000 / delta : 0);
    this.hudTimer += delta;
    const match = this.match;
    if (this.hudTimer < 200 || !match) return;
    this.hudTimer = 0;
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const target = match.target();
    hudStore.set({
      height: match.me.sim.getHeight(),
      perfect: this.perfectCount,
      lost: match.me.sim.lostCount,
      next: match.sequence.peek(),
      fps: avg(this.fpsSamples),
      physicsMs: avg(this.physicsMsSamples),
      finishHeight: FINISH_HEIGHT,
      players: match.players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        height: p.sim.getHeight(),
        isMe: p.isMe,
        isTarget: p === target,
      })),
      winner: match.winner ? { name: match.winner.name, isMe: match.winner.isMe } : null,
    });
    this.fpsSamples = [];
    this.physicsMsSamples = [];
  }
}
