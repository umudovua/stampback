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
/** Klaviaturada bir basış neçə X addımı aparır (1 hüceyrə = 4 addım). */
const KEY_MOVE_STEPS = 4;

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

  /** Bir X addımının (¼ hüceyrə) ekranda neçə piksel olduğu; ekran ölçüsü dəyişəndə yenilənir. */
  setStepPixels(px: number): void {
    this.stepPx = Math.max(4, px);
  }

  destroy(): void {
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
        for (let i = 0; i < KEY_MOVE_STEPS; i++) this.commands.move(-1);
        break;
      case 'ArrowRight':
      case 'KeyD':
        for (let i = 0; i < KEY_MOVE_STEPS; i++) this.commands.move(1);
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
  }
}
