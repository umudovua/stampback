import Phaser from 'phaser';
import type { BodyView, TowerSim } from '@stampback/shared';
import { CARDBOARD, drawParcel } from './parcelArt';

export interface TowerStyle {
  /** Skotçun rəngi: oyunçunun rəngi. */
  tape: number;
  /** Ön plan (öz qüllən) üçün 1, arxadakı rəqib üçün yarımşəffaf. */
  alpha: number;
  depth: number;
  /** Verilərsə, karton əvəzinə bu rəngdə çəkilir (rəqibin “şüşə” görünüşü). */
  tint?: number;
}

interface Sprite {
  graphics: Phaser.GameObjects.Graphics;
  prev: { x: number; y: number; angle: number };
  curr: { x: number; y: number; angle: number };
}

/** Bir TowerSim-in bağlamalarını çəkir; fizika addımları arasında mövqeləri interpolasiya edir. */
export class TowerRenderer {
  private sprites = new Map<number, Sprite>();

  constructor(
    private readonly scene: Phaser.Scene,
    private sim: TowerSim,
    private style: TowerStyle,
    private scalePx: number,
  ) {}

  get source(): TowerSim {
    return this.sim;
  }

  /** Başqa qülləyə keçir (məs. hədəf rəqib dəyişəndə). */
  setSource(sim: TowerSim, style: TowerStyle): void {
    if (sim === this.sim && style.tape === this.style.tape) return;
    this.clear();
    this.sim = sim;
    this.style = style;
    this.sync();
    for (const sprite of this.sprites.values()) sprite.prev = { ...sprite.curr };
  }

  setScale(scalePx: number): void {
    if (scalePx === this.scalePx) return;
    this.scalePx = scalePx;
    this.clear();
    this.sync();
  }

  /** Fizika addımından əvvəl: cari vəziyyəti “əvvəlki” kimi saxlayır. */
  beginStep(): void {
    for (const sprite of this.sprites.values()) sprite.prev = { ...sprite.curr };
  }

  /** Fizika addımından sonra: yeni, silinmiş və hərəkət edən bağlamaları yeniləyir. */
  sync(): void {
    const seen = new Set<number>();
    for (const view of this.sim.bodyViews()) {
      seen.add(view.id);
      const state = { x: view.x, y: view.y, angle: view.angle };
      const sprite = this.sprites.get(view.id);
      if (sprite) sprite.curr = state;
      else this.sprites.set(view.id, this.create(view, state));
    }
    for (const [id, sprite] of this.sprites) {
      if (!seen.has(id)) {
        sprite.graphics.destroy();
        this.sprites.delete(id);
      }
    }
  }

  render(alpha: number): void {
    const s = this.scalePx;
    for (const sprite of this.sprites.values()) {
      const x = Phaser.Math.Linear(sprite.prev.x, sprite.curr.x, alpha);
      const y = Phaser.Math.Linear(sprite.prev.y, sprite.curr.y, alpha);
      const angle = Phaser.Math.Linear(sprite.prev.angle, sprite.curr.angle, alpha);
      // Fizikada y yuxarı artır, ekranda aşağı: mövqe və bucaq işarəsi çevrilir.
      sprite.graphics.setPosition(x * s, -y * s).setRotation(-angle);
    }
  }

  /** Mükəmməl yerləşdirmədə qısa “squash” effekti. */
  pulse(id: number): void {
    const sprite = this.sprites.get(id);
    if (!sprite) return;
    this.scene.tweens.add({
      targets: sprite.graphics,
      scaleY: 0.9,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  clear(): void {
    for (const sprite of this.sprites.values()) sprite.graphics.destroy();
    this.sprites.clear();
  }

  private create(view: BodyView, state: Sprite['curr']): Sprite {
    const g = this.scene.add.graphics().setDepth(this.style.depth).setAlpha(this.style.alpha);
    const tint = this.style.tint;
    drawParcel(g, view.cells, this.scalePx, {
      fill: tint ?? CARDBOARD[view.kind],
      tape: this.style.tape,
      outline: tint,
      label: tint === undefined,
    });
    return { graphics: g, prev: state, curr: state };
  }
}
