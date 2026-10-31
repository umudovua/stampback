import Phaser from 'phaser';
import {
  ParcelSequence,
  POST_OFFICE,
  TICK_RATE,
  TowerSim,
  X_STEPS_PER_CELL,
  Y_STEPS_PER_CELL,
  type BodyView,
  type Cell,
  type NormalParcelKind,
} from '@stampback/shared';
import { hudStore } from '../game/hudStore';
import { InputController } from '../input/InputController';

const STEP_MS = 1000 / TICK_RATE;
/** Ekranın altında ipucu və debug mətni üçün saxlanılan yer (piksel). */
const BOTTOM_RESERVE_PX = 56;
/** Arxa plandan qayıdanda bir kadrda ən çox neçə tick yetişdirilir (arxitektura, 5.1). */
const MAX_STEPS_PER_FRAME = 5;

const BACKGROUND = 0xc9a27e;
const PLATFORM = 0x6f5238;
const OUTLINE = 0x4a3524;
const TAPE = 0xe3cfa6;
/** Hər forma üçün bir az fərqli karton çaları: oxunaqlılıq üçün. */
const PARCEL_COLORS: Record<NormalParcelKind, number> = {
  I: 0xb3865d,
  O: 0xa8794f,
  T: 0xbf9468,
  L: 0x9e7148,
  J: 0xb98a5a,
  S: 0xa47a52,
  Z: 0xc49b70,
};

interface BodySprite {
  container: Phaser.GameObjects.Container;
  prev: { x: number; y: number; angle: number };
  curr: { x: number; y: number; angle: number };
}

/**
 * M1 prototip səhnəsi: bir qüllə, idarəetmə, kölgə və HUD (docs/dev-plan.md, M1-T3–T5).
 * Fizika TowerSim-dədir (shared); bu səhnə yalnız onu çəkir və input-u ötürür.
 */
export class MatchScene extends Phaser.Scene {
  private sim: TowerSim | null = null;
  private sequence = new ParcelSequence(1);
  private input2: InputController | null = null;
  private accumulator = 0;
  private scalePx = 32;
  private cameraY = 0;
  private perfectCount = 0;
  private bodies = new Map<number, BodySprite>();
  private activeGfx!: Phaser.GameObjects.Graphics;
  private platformGfx!: Phaser.GameObjects.Graphics;
  private fpsSamples: number[] = [];
  private physicsMsSamples: number[] = [];
  private hudTimer = 0;

  constructor() {
    super('MatchScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(BACKGROUND);
    this.platformGfx = this.add.graphics();
    this.activeGfx = this.add.graphics().setDepth(10);

    this.input2 = new InputController(this, {
      move: (dir) => this.sim?.move(dir),
      rotate: () => this.sim?.rotate(),
      fastDrop: (on) => this.sim?.setFastDrop(on),
    });

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    const offRestart = hudStore.onRestart(() => void this.restart());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offRestart();
      this.input2?.destroy();
      this.sim?.dispose();
    });

    void this.restart();
  }

  override update(_time: number, delta: number): void {
    const sim = this.sim;
    if (!sim) return;

    this.accumulator += Math.min(delta, STEP_MS * MAX_STEPS_PER_FRAME);
    const t0 = performance.now();
    let steps = 0;
    while (this.accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
      if (!sim.active) this.spawnNext();
      for (const sprite of this.bodies.values()) sprite.prev = { ...sprite.curr };
      sim.step();
      this.handleEvents();
      this.syncBodies(sim.bodyViews());
      this.accumulator -= STEP_MS;
      steps++;
    }
    if (steps > 0) this.physicsMsSamples.push((performance.now() - t0) / steps);

    const alpha = this.accumulator / STEP_MS;
    this.renderBodies(alpha);
    this.renderActive();
    this.followTower(delta);
    this.updateHud(delta);
  }

  private async restart(): Promise<void> {
    this.sim?.dispose();
    this.sim = null;
    for (const sprite of this.bodies.values()) sprite.container.destroy();
    this.bodies.clear();
    this.perfectCount = 0;
    this.accumulator = 0;
    this.cameraY = 0;
    const seedParam = new URLSearchParams(location.search).get('seed');
    this.sequence = new ParcelSequence(seedParam ? Number(seedParam) : Date.now() >>> 0);
    hudStore.set({ ready: false });
    this.sim = await TowerSim.create(POST_OFFICE);
    this.spawnNext();
    hudStore.set({ ready: true, height: 0, perfect: 0, lost: 0 });
  }

  private spawnNext(): void {
    const sim = this.sim;
    if (!sim || sim.active) return;
    if (sim.spawnParcel(this.sequence.peek())) {
      this.sequence.next();
    }
  }

  private handleEvents(): void {
    for (const event of this.sim!.drainEvents()) {
      if (event.type === 'settled' && event.perfect) {
        this.perfectCount++;
        const sprite = this.bodies.get(event.id);
        if (sprite) this.flash(sprite.container);
      }
    }
  }

  /** Mükəmməl yerləşdirmədə qısa “squash” effekti. */
  private flash(container: Phaser.GameObjects.Container): void {
    this.tweens.add({
      targets: container,
      scaleY: 0.92,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private syncBodies(views: BodyView[]): void {
    const seen = new Set<number>();
    for (const view of views) {
      seen.add(view.id);
      const state = { x: view.x, y: view.y, angle: view.angle };
      const existing = this.bodies.get(view.id);
      if (existing) {
        existing.curr = state;
      } else {
        const container = this.add.container(0, 0);
        this.drawCells(container, view.cells, PARCEL_COLORS[view.kind]);
        this.bodies.set(view.id, { container, prev: state, curr: state });
      }
    }
    for (const [id, sprite] of this.bodies) {
      if (!seen.has(id)) {
        sprite.container.destroy();
        this.bodies.delete(id);
      }
    }
  }

  private drawCells(
    container: Phaser.GameObjects.Container,
    cells: readonly Cell[],
    color: number,
  ): void {
    const s = this.scalePx;
    for (const [c, r] of cells) {
      const cx = c * s + s / 2;
      const cy = -(r * s + s / 2);
      container.add(this.add.rectangle(cx, cy, s - 2, s - 2, color).setStrokeStyle(2, OUTLINE));
      container.add(this.add.rectangle(cx, cy, s * 0.22, s - 2, TAPE, 0.9));
    }
  }

  private renderBodies(alpha: number): void {
    const s = this.scalePx;
    for (const sprite of this.bodies.values()) {
      const x = Phaser.Math.Linear(sprite.prev.x, sprite.curr.x, alpha);
      const y = Phaser.Math.Linear(sprite.prev.y, sprite.curr.y, alpha);
      const angle = Phaser.Math.Linear(sprite.prev.angle, sprite.curr.angle, alpha);
      // Fizikada y yuxarı artır, ekranda aşağı: həm mövqe, həm bucaq işarəsi çevrilir.
      sprite.container.setPosition(x * s, -y * s).setRotation(-angle);
    }
  }

  private renderActive(): void {
    const g = this.activeGfx;
    g.clear();
    const sim = this.sim;
    const active = sim?.active;
    if (!sim || !active) return;
    const s = this.scalePx;
    const ox = (active.x / X_STEPS_PER_CELL) * s;

    const ghostY = sim.ghostY();
    if (ghostY !== null) {
      const gy = (ghostY / Y_STEPS_PER_CELL) * s;
      g.fillStyle(0xffffff, 0.22);
      for (const [c, r] of active.cells)
        g.fillRect(ox + c * s + 1, -(gy + (r + 1) * s) + 1, s - 2, s - 2);
    }

    const oy = (active.y / Y_STEPS_PER_CELL) * s;
    g.fillStyle(PARCEL_COLORS[active.kind], 1);
    g.lineStyle(2, OUTLINE, 1);
    for (const [c, r] of active.cells) {
      const x = ox + c * s + 1;
      const y = -(oy + (r + 1) * s) + 1;
      g.fillRect(x, y, s - 2, s - 2);
      g.strokeRect(x, y, s - 2, s - 2);
    }
  }

  /** Kamera qüllənin üstünü yumşaq izləyir: zirvə ekranın yuxarı üçdə birində qalır. */
  private followTower(delta: number): void {
    const { height } = this.scale.gameSize;
    const s = this.scalePx;
    const top = this.sim ? this.sim.getHeight() : 0;
    const target = Math.max(0, top * s - height * 0.35);
    this.cameraY = Phaser.Math.Linear(this.cameraY, target, Math.min(1, delta / 300));
    // Yer səviyyəsi (y = 0) ekranda alt yazıların və platformanın üstündə qalır.
    this.cameras.main.scrollY = -(height - BOTTOM_RESERVE_PX - s) - this.cameraY;
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const cellsAcross = POST_OFFICE.platformWidth + 2;
    const newScale = Math.floor(Math.min(width / cellsAcross, height / 18));
    const rescale = newScale !== this.scalePx;
    this.scalePx = newScale;
    this.cameras.main.scrollX = -width / 2;
    this.input2?.setStepPixels(newScale / X_STEPS_PER_CELL);

    const s = this.scalePx;
    const half = (POST_OFFICE.platformWidth / 2) * s;
    this.platformGfx.clear();
    this.platformGfx.fillStyle(PLATFORM, 1).fillRect(-half, 0, half * 2, s);
    this.platformGfx.fillStyle(OUTLINE, 1).fillRect(-half, 0, half * 2, 3);

    if (rescale) {
      for (const [, sprite] of this.bodies) sprite.container.destroy();
      this.bodies.clear();
      if (this.sim) this.syncBodies(this.sim.bodyViews());
    }
  }

  private updateHud(delta: number): void {
    this.fpsSamples.push(delta > 0 ? 1000 / delta : 0);
    this.hudTimer += delta;
    if (this.hudTimer < 250 || !this.sim) return;
    this.hudTimer = 0;
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    hudStore.set({
      height: this.sim.getHeight(),
      perfect: this.perfectCount,
      lost: this.sim.lostCount,
      next: this.sequence.peek(),
      fps: avg(this.fpsSamples),
      physicsMs: avg(this.physicsMsSamples),
    });
    this.fpsSamples = [];
    this.physicsMsSamples = [];
  }
}
