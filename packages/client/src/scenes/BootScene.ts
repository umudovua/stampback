import Phaser from 'phaser';

const KRAFT = 0xc9a27e;
const BOX = 0xb3865d;
const BOX_EDGE = 0x6f5238;
const TAPE = 0xe3cfa6;

/**
 * M0 placeholder səhnəsi: kraft fonda kiçik karton qutu yığını.
 * Real qüllə simulyasiyası və render M1-də gəlir (MatchScene).
 */
export class BootScene extends Phaser.Scene {
  private stack?: Phaser.GameObjects.Graphics;

  constructor() {
    super('BootScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(KRAFT);
    this.stack = this.add.graphics();
    this.drawStack();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.drawStack, this);
  }

  private drawStack(): void {
    const g = this.stack;
    if (!g) return;
    const { width, height } = this.scale.gameSize;
    const unit = Math.min(width, height) / 9;
    const baseY = height - unit * 1.2;
    const cx = width / 2;
    // Placeholder qüllə: [sütun sürüşməsi, sıra, vahidlə en]
    const boxes: Array<[number, number, number]> = [
      [-1.5, 0, 3],
      [-1, 1, 2],
      [-0.5, 2, 1],
    ];

    g.clear();
    for (const [col, row, w] of boxes) {
      const x = cx + col * unit;
      const y = baseY - (row + 1) * unit;
      g.fillStyle(BOX, 1).fillRect(x, y, w * unit, unit);
      g.fillStyle(TAPE, 1).fillRect(x + (w * unit) / 2 - unit * 0.12, y, unit * 0.24, unit);
      g.lineStyle(3, BOX_EDGE, 1).strokeRect(x, y, w * unit, unit);
    }
  }
}
