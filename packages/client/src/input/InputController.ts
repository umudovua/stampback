import type Phaser from 'phaser';

/** Oyun səhnəsinin tanıdığı abstrakt əmrlər (docs/architecture.md, bölmə 8). */
export interface InputCommands {
  move(direction: -1 | 1): void;
  rotate(): void;
  fastDrop(on: boolean): void;
}

/** Bu qədər pikseldən az hərəkət və bu qədər millisaniyədən qısa toxunuş “döndərmə” sayılır. */
const TAP_MAX_DISTANCE = 12;
const TAP_MAX_MS = 250;
/** Aşağı sürüşdürmənin sürətli endirməyə çevrildiyi məsafə (piksel). */
const SWIPE_DOWN_PX = 40;
/** Klaviaturada düyməni basıb saxlayanda: ilk təkrara qədər gecikmə və təkrar intervalı (ms). */
const KEY_REPEAT_DELAY = 170;
const KEY_REPEAT_INTERVAL = 60;

/**
 * Toxunma və klaviaturanı eyni əmrlərə çevirir (GDD, bölmə 6).
 * Toxunma nisbidir: barmaq ekranın istənilən yerində sürüşdürülür, bağlamanı örtmür.
 */
export class InputController {
  private stepPx = 10;
  private down = false;
  private startX = 0;
  private startY = 0;
  private lastStepX = 0;
  private startTime = 0;
  private moved = false;
  private dropping = false;
  private heldDir: -1 | 1 | 0 = 0;
  private repeatTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly commands: InputCommands,
  ) {
    scene.input.on('pointerdown', this.onPointerDown, this);
    scene.input.on('pointermove', this.onPointerMove, this);
    scene.input.on('pointerup', this.onPointerUp, this);
    scene.input.on('pointerupoutside', this.onPointerUp, this);
    scene.input.keyboard?.on('keydown', this.onKeyDown, this);
    scene.input.keyboard?.on('keyup', this.onKeyUp, this);
  }

  /** Bir hərəkət addımının (½ hüceyrə) ekranda neçə piksel olduğu; ekran ölçüsü dəyişəndə yenilənir. */
  setStepPixels(px: number): void {
    this.stepPx = Math.max(4, px);
  }

  destroy(): void {
    this.stopRepeat();
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    this.scene.input.keyboard?.off('keydown', this.onKeyDown, this);
    this.scene.input.keyboard?.off('keyup', this.onKeyUp, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.down = true;
    this.startX = this.lastStepX = pointer.x;
    this.startY = pointer.y;
    this.startTime = pointer.downTime;
    this.moved = false;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.down) return;
    let dx = pointer.x - this.lastStepX;
    while (Math.abs(dx) >= this.stepPx) {
      const dir = dx > 0 ? 1 : -1;
      this.commands.move(dir);
      this.lastStepX += dir * this.stepPx;
      dx = pointer.x - this.lastStepX;
      this.moved = true;
    }
    const dy = pointer.y - this.startY;
    if (!this.dropping && dy > SWIPE_DOWN_PX && dy > Math.abs(pointer.x - this.startX)) {
      this.dropping = true;
      this.moved = true;
      this.commands.fastDrop(true);
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.down) return;
    this.down = false;
    const distance = Math.hypot(pointer.x - this.startX, pointer.y - this.startY);
    const duration = pointer.upTime - this.startTime;
    if (!this.moved && distance < TAP_MAX_DISTANCE && duration < TAP_MAX_MS) {
      this.commands.rotate();
    }
    if (this.dropping) {
      this.dropping = false;
      this.commands.fastDrop(false);
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    switch (event.code) {
      case 'ArrowLeft':
      case 'KeyA':
        if (!event.repeat) this.startRepeat(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        if (!event.repeat) this.startRepeat(1);
        break;
      case 'ArrowUp':
      case 'KeyW':
        if (!event.repeat) this.commands.rotate();
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.commands.fastDrop(true);
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    if (event.code === 'ArrowDown' || event.code === 'KeyS') this.commands.fastDrop(false);
    const dir =
      event.code === 'ArrowLeft' || event.code === 'KeyA'
        ? -1
        : event.code === 'ArrowRight' || event.code === 'KeyD'
          ? 1
          : 0;
    if (dir !== 0 && dir === this.heldDir) this.stopRepeat();
  }

  /**
   * Düymə basılanda bir addım, saxlanılanda qısa gecikmədən sonra bərabər sürətlə təkrar.
   * Əməliyyat sisteminin öz təkrar sürətindən asılı deyil.
   */
  private startRepeat(dir: -1 | 1): void {
    this.stopRepeat();
    this.heldDir = dir;
    this.commands.move(dir);
    this.repeatTimer = this.scene.time.addEvent({
      delay: KEY_REPEAT_DELAY,
      callback: () => {
        this.repeatTimer = this.scene.time.addEvent({
          delay: KEY_REPEAT_INTERVAL,
          loop: true,
          callback: () => this.commands.move(dir),
        });
      },
    });
  }

  private stopRepeat(): void {
    this.repeatTimer?.remove(false);
    this.repeatTimer = null;
    this.heldDir = 0;
  }
}
