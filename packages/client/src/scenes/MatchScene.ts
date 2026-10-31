import Phaser from 'phaser';
import {
  BELT_SLOTS,
  parcelSize,
  POST_OFFICE,
  TICK_RATE,
  X_STEPS_PER_CELL,
  Y_STEPS_PER_CELL,
  type ParcelKind,
  type ParcelRotation,
} from '@stampback/shared';
import { OfflineMatch, type MatchPlayer } from '../game/OfflineMatch';
import { hudStore } from '../game/hudStore';
import { FINISH_HEIGHT } from '../game/players';
import { t } from '../i18n';
import { CARDBOARD, drawBox } from '../render/parcelArt';
import { TowerRenderer, type TowerStyle } from '../render/TowerRenderer';

const STEP_MS = 1000 / TICK_RATE;
/** Arxa plandan qayıdanda bir kadrda ən çox neçə tick yetişdirilir (arxitektura, 5.1). */
const MAX_STEPS_PER_FRAME = 5;
/** Çeşidləmə lentinin hündürlüyü və altındakı ipucu üçün yer (piksel). */
const BELT_HEIGHT = 104;
const HINT_SPACE = 30;
/** Arxadakı rəqib qülləsinin şəffaflığı (“şüşə arxasında” görünüş). */
const RIVAL_ALPHA = 0.3;
/** Tutulan bağlama yarım hüceyrəlik addımlarla hərəkət edir (2 X addımı). */
const MOVE_STEPS = 2;
/** Tutulan bağlamanın barmağa hamar çatma müddəti (ms, eksponensial). */
const MOVE_SMOOTH_MS = 40;
/** Toxunuşun sürükləməyə çevrildiyi məsafə (piksel). */
const DRAG_THRESHOLD = 10;
/** Klaviatura: ilk təkrara qədər gecikmə və təkrar intervalı (ms). */
const KEY_REPEAT_DELAY = 170;
const KEY_REPEAT_INTERVAL = 60;

const BACKGROUND = 0xe9dcc6;
const COUNTER_TOP = 0x8a6545;
const COUNTER = 0x6b4b30;
const COUNTER_LINE = 0x5a3e27;
const FINISH = 0xb8322a;
const BELT = 0x3d4250;
const BELT_EDGE = 0x2a2e38;
const BELT_ROLLER = 0x585e6e;
const GUIDE = 0x23314f;

interface Held {
  slot: number;
  kind: ParcelKind;
  rot: ParcelRotation;
  /** Məntiqi mövqe (X addımı): buraxılanda istifadə olunur. */
  x: number;
  /** Ekranda çəkilən mövqe (piksel): məntiqi mövqeyə hamar yaxınlaşır. */
  drawX: number;
}

/**
 * Oflayn matç səhnəsi (GDD v1.1): aşağıda çeşidləmə lenti, bağlama lentdən sürüklənib qüllənin
 * üstündə buraxılır və real fizika ilə düşür. Ən yaxın rəqibin qülləsi arxada yarımşəffaf görünür.
 */
export class MatchScene extends Phaser.Scene {
  private match: OfflineMatch | null = null;
  private myTower: TowerRenderer | null = null;
  private rivalTower: TowerRenderer | null = null;
  private rival: MatchPlayer | null = null;
  private accumulator = 0;
  private scalePx = 32;
  private cameraY = 0;
  private perfectCount = 0;
  private held: Held | null = null;
  private pointerSlot = -1;
  private pointerStart = { x: 0, y: 0 };
  private dragging = false;
  private repeatTimer: Phaser.Time.TimerEvent | null = null;
  private background!: Phaser.GameObjects.Graphics;
  private stage!: Phaser.GameObjects.Graphics;
  private heldGfx!: Phaser.GameObjects.Graphics;
  private beltGfx!: Phaser.GameObjects.Graphics;
  private finishLabel!: Phaser.GameObjects.Text;
  private fpsSamples: number[] = [];
  private physicsMsSamples: number[] = [];
  private hudTimer = 0;
  private generation = 0;

  constructor() {
    super('MatchScene');
  }

  create(): void {
    this.background = this.add.graphics().setScrollFactor(0).setDepth(-20);
    this.stage = this.add.graphics().setDepth(2);
    this.heldGfx = this.add.graphics().setDepth(10);
    this.beltGfx = this.add.graphics().setScrollFactor(0).setDepth(20);
    this.finishLabel = this.add
      .text(0, 0, t('hud.finish'), {
        fontFamily: 'Trebuchet MS, Segoe UI, system-ui, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#b8322a',
      })
      .setOrigin(0, 1)
      .setDepth(3);

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    this.input.keyboard?.on('keydown', this.onKeyDown, this);
    this.input.keyboard?.on('keyup', this.onKeyUp, this);

    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    const offRestart = hudStore.onRestart(() => void this.restart());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offRestart();
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
    this.renderHeld(delta);
    this.renderBelt();
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
    this.held = null;
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

  // ---------- Lent və idarəetmə ----------

  /** Lentin ekrandakı yuxarı kənarı (piksel). */
  private beltTop(): number {
    return this.scale.gameSize.height - HINT_SPACE - BELT_HEIGHT;
  }

  /** Ekran nöqtəsi hansı lent yuvasının üstündədir; heç birinin deyilsə -1. */
  private slotAt(x: number, y: number): number {
    const top = this.beltTop();
    if (y < top || y > top + BELT_HEIGHT) return -1;
    const slotWidth = this.scale.gameSize.width / BELT_SLOTS;
    return Math.max(0, Math.min(BELT_SLOTS - 1, Math.floor(x / slotWidth)));
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.pointerSlot = this.slotAt(pointer.x, pointer.y);
    this.pointerStart = { x: pointer.x, y: pointer.y };
    this.dragging = false;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.pointerSlot < 0 || !pointer.isDown) return;
    if (!this.dragging) {
      const dist = Math.hypot(pointer.x - this.pointerStart.x, pointer.y - this.pointerStart.y);
      if (dist < DRAG_THRESHOLD) return;
      this.dragging = true;
      this.hold(this.pointerSlot, pointer.x);
    }
    this.moveHeldToScreenX(pointer.x);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    const slot = this.pointerSlot;
    this.pointerSlot = -1;
    if (slot < 0) return;
    if (!this.dragging) {
      // Qısa toxunuş: lentdəki bağlamanı döndər.
      this.match?.me.belt.rotate(slot);
      return;
    }
    this.dragging = false;
    // Lentə geri buraxılıbsa, ləğv edilir; yuxarıda buraxılıbsa, qülləyə düşür.
    if (pointer.y < this.beltTop() - DRAG_THRESHOLD) this.dropHeld();
    else this.held = null;
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.repeat) return;
    const digit = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code);
    if (digit >= 0) {
      this.hold(digit);
      return;
    }
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.startRepeat(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.startRepeat(1);
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.rotateHeld();
        break;
      case 'ArrowDown':
      case 'KeyS':
      case 'Space':
      case 'Enter':
        this.dropHeld();
        break;
      case 'Escape':
        this.held = null;
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(event.code)) {
      this.repeatTimer?.remove(false);
      this.repeatTimer = null;
    }
  }

  /** Klaviatura: basış bir addım, saxlayanda qısa gecikmədən sonra bərabər sürətlə təkrar. */
  private startRepeat(dir: -1 | 1): void {
    if (!this.held) this.hold(0);
    this.repeatTimer?.remove(false);
    this.nudge(dir);
    this.repeatTimer = this.time.addEvent({
      delay: KEY_REPEAT_DELAY,
      callback: () => {
        this.repeatTimer = this.time.addEvent({
          delay: KEY_REPEAT_INTERVAL,
          loop: true,
          callback: () => this.nudge(dir),
        });
      },
    });
  }

  /** Lent yuvasındakı bağlamanı tutur; mövqe verilməyibsə, qüllənin ortasından başlayır. */
  private hold(slot: number, screenX?: number): void {
    const match = this.match;
    const item = match?.me.belt.slots[slot];
    if (!match || !item || match.winner) return;
    const { w } = parcelSize(item.kind, item.rot);
    const x = match.me.sim.clampX(item.kind, item.rot, -w * (X_STEPS_PER_CELL / 2));
    this.held = { slot, kind: item.kind, rot: item.rot, x, drawX: this.stepsToPx(x) };
    if (screenX !== undefined) {
      this.moveHeldToScreenX(screenX);
      this.held.drawX = this.stepsToPx(this.held.x);
    }
  }

  private moveHeldToScreenX(screenX: number): void {
    const held = this.held;
    const sim = this.match?.me.sim;
    if (!held || !sim) return;
    const s = this.scalePx;
    const { w } = parcelSize(held.kind, held.rot);
    const worldCells = (screenX + this.cameras.main.scrollX) / s;
    const raw = (worldCells - w / 2) * X_STEPS_PER_CELL;
    const snapped = Math.round(raw / MOVE_STEPS) * MOVE_STEPS;
    held.x = sim.clampX(held.kind, held.rot, snapped);
  }

  private nudge(dir: -1 | 1): void {
    const held = this.held;
    const sim = this.match?.me.sim;
    if (!held || !sim) return;
    held.x = sim.clampX(held.kind, held.rot, held.x + dir * MOVE_STEPS);
  }

  private rotateHeld(): void {
    const held = this.held;
    const match = this.match;
    if (!held || !match) return;
    match.me.belt.rotate(held.slot);
    held.rot = held.rot === 0 ? 1 : 0;
    held.x = match.me.sim.clampX(held.kind, held.rot, held.x);
  }

  private dropHeld(): void {
    const held = this.held;
    if (!held || !this.match) return;
    this.match.dropFromBelt(held.slot, held.x);
    this.held = null;
  }

  private stepsToPx(x: number): number {
    return (x / X_STEPS_PER_CELL) * this.scalePx;
  }

  // ---------- Render ----------

  private myStyle(): TowerStyle {
    return { tape: this.match!.me.color, alpha: 1, depth: 5 };
  }

  private rivalStyle(player: MatchPlayer): TowerStyle {
    return { tape: player.color, alpha: RIVAL_ALPHA, depth: 1, tint: player.color };
  }

  /** Hədəf rəqib dəyişibsə, arxadakı qülləni ona keçirir. */
  private updateRival(): void {
    const target = this.match?.target() ?? null;
    if (!target || target === this.rival) return;
    this.rival = target;
    if (this.rivalTower) this.rivalTower.setSource(target.sim, this.rivalStyle(target));
    else
      this.rivalTower = new TowerRenderer(this, target.sim, this.rivalStyle(target), this.scalePx);
  }

  /** Tutulan bağlama buraxma xəttində; altında düşəcəyi yerə qədər bələdçi xətlər. */
  private renderHeld(delta: number): void {
    const g = this.heldGfx;
    g.clear();
    const held = this.held;
    const me = this.match?.me;
    if (!held || !me) return;
    const s = this.scalePx;
    const target = this.stepsToPx(held.x);
    held.drawX += (target - held.drawX) * Math.min(1, delta / MOVE_SMOOTH_MS);
    if (Math.abs(target - held.drawX) < 0.5) held.drawX = target;

    const { w, h } = parcelSize(held.kind, held.rot);
    const dropY = (me.sim.dropLineY() / Y_STEPS_PER_CELL) * s;
    const landing = me.sim.landingY(held.kind, held.rot, held.x);
    if (landing !== null) {
      const landY = (landing / Y_STEPS_PER_CELL) * s;
      g.lineStyle(2, GUIDE, 0.35);
      for (const gx of [target, target + w * s]) {
        for (let y = -dropY; y < -landY; y += 10) g.lineBetween(gx, y, gx, Math.min(y + 5, -landY));
      }
      g.lineStyle(3, GUIDE, 0.5).lineBetween(target, -landY, target + w * s, -landY);
    }

    g.save();
    g.translateCanvas(held.drawX, -dropY);
    drawBox(g, w, h, s, { fill: CARDBOARD[held.kind], tape: me.color });
    g.restore();
  }

  /** Çeşidləmə lenti: ekranın altında 3 yuva, tutulan bağlamanın yeri solğun göstərilir. */
  private renderBelt(): void {
    const g = this.beltGfx;
    g.clear();
    const me = this.match?.me;
    const { width } = this.scale.gameSize;
    const top = this.beltTop();
    // Lentin altındakı ipucu zolağı: piştaxta görünməsin, mətn oxunsun.
    g.fillStyle(BACKGROUND, 1).fillRect(0, top + BELT_HEIGHT, width, HINT_SPACE + 40);
    g.fillStyle(BELT, 1).fillRect(0, top, width, BELT_HEIGHT);
    g.fillStyle(BELT_EDGE, 1)
      .fillRect(0, top, width, 5)
      .fillRect(0, top + BELT_HEIGHT - 5, width, 5);
    g.fillStyle(BELT_ROLLER, 1);
    for (let x = 14; x < width; x += 28) g.fillCircle(x, top + BELT_HEIGHT - 12, 4);
    if (!me) return;

    const slotWidth = width / BELT_SLOTS;
    me.belt.slots.forEach((item, slot) => {
      const { w, h } = parcelSize(item.kind, item.rot);
      const scale = Math.min(this.scalePx, (slotWidth * 0.78) / w, (BELT_HEIGHT * 0.66) / h);
      const cx = slotWidth * (slot + 0.5);
      const bottom = top + BELT_HEIGHT * 0.78;
      g.save();
      g.translateCanvas(cx - (w * scale) / 2, bottom);
      drawBox(g, w, h, scale, { fill: CARDBOARD[item.kind], tape: me.color });
      g.restore();
      if (this.held?.slot === slot) {
        g.fillStyle(BELT, 0.65).fillRect(
          slot * slotWidth + 4,
          top + 6,
          slotWidth - 8,
          BELT_HEIGHT - 12,
        );
      }
    });
  }

  /** Kamera buraxma xəttini və rəqibin zirvəsini görünən saxlayır. */
  private followTower(delta: number): void {
    const s = this.scalePx;
    const me = this.match?.me.sim;
    const dropLine = me ? me.dropLineY() / Y_STEPS_PER_CELL + 2.5 : 0;
    const rival = this.rival?.sim.getHeight() ?? 0;
    const top = Math.max(dropLine, rival);
    const visible = this.beltTop() - s;
    const target = Math.max(0, top * s - visible * 0.8);
    this.cameraY = Phaser.Math.Linear(this.cameraY, target, Math.min(1, delta / 300));
    this.cameras.main.scrollY = -(this.beltTop() - s * 0.6) - this.cameraY;
  }

  private layout(): void {
    const { width, height } = this.scale.gameSize;
    const cellsAcross = POST_OFFICE.platformWidth + 2;
    const available = height - BELT_HEIGHT - HINT_SPACE;
    this.scalePx = Math.floor(Math.min(width / cellsAcross, available / 16));
    const s = this.scalePx;
    this.cameras.main.scrollX = -width / 2;
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
