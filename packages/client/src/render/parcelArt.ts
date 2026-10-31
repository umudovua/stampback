import type Phaser from 'phaser';
import { cellBounds, type Cell, type NormalParcelKind } from '@stampback/shared';

/** Hər forma üçün bir az fərqli karton çaları: qüllədə bağlamalar bir-birindən seçilsin. */
export const CARDBOARD: Record<NormalParcelKind, number> = {
  I: 0xc8955f,
  O: 0xb98652,
  T: 0xd3a26e,
  L: 0xbd8a57,
  J: 0xc99a66,
  S: 0xb7834f,
  Z: 0xd0a06a,
};

const OUTLINE = 0x5a3d26;
const LABEL = 0xf6eedf;
const LABEL_LINES = 0xb9a58a;

export interface ParcelStyle {
  fill: number;
  tape: number;
  outline?: number;
  label?: boolean;
  lineWidth?: number;
}

/**
 * Bağlamanı bir bütöv karton qutu kimi çəkir: hüceyrələr arasında daxili xətt yoxdur,
 * yalnız xarici kontur, uzun ox boyunca skotç və bir ünvan etiketi.
 * Koordinatlar: (0, 0) bağlamanın sol-aşağı küncüdür, y yuxarı mənfidir (ekran oxu).
 */
export function drawParcel(
  g: Phaser.GameObjects.Graphics,
  cells: readonly Cell[],
  s: number,
  style: ParcelStyle,
): void {
  const occupied = new Set(cells.map(([c, r]) => `${c},${r}`));
  const has = (c: number, r: number) => occupied.has(`${c},${r}`);
  const { width, height } = cellBounds(cells);
  const horizontal = width >= height;
  const tape = s * 0.2;

  g.fillStyle(style.fill, 1);
  for (const [c, r] of cells) g.fillRect(c * s, -(r + 1) * s, s, s);

  g.fillStyle(style.tape, 1);
  for (const [c, r] of cells) {
    if (horizontal) g.fillRect(c * s, -(r + 0.5) * s - tape / 2, s, tape);
    else g.fillRect(c * s + s / 2 - tape / 2, -(r + 1) * s, tape, s);
  }

  if (style.label !== false) {
    const [lc, lr] = cells[cells.length - 1]!;
    const lw = s * 0.42;
    const lh = s * 0.28;
    const lx = lc * s + s * 0.12;
    const ly = -(lr + 1) * s + s * 0.1;
    g.fillStyle(LABEL, 1).fillRect(lx, ly, lw, lh);
    g.fillStyle(LABEL_LINES, 1);
    g.fillRect(lx + lw * 0.12, ly + lh * 0.3, lw * 0.7, Math.max(1, s * 0.03));
    g.fillRect(lx + lw * 0.12, ly + lh * 0.62, lw * 0.5, Math.max(1, s * 0.03));
  }

  const lw = style.lineWidth ?? Math.max(2, s * 0.07);
  g.lineStyle(lw, style.outline ?? OUTLINE, 1);
  g.beginPath();
  for (const [c, r] of cells) {
    const x0 = c * s;
    const x1 = (c + 1) * s;
    const yTop = -(r + 1) * s;
    const yBottom = -r * s;
    if (!has(c, r + 1)) {
      g.moveTo(x0, yTop);
      g.lineTo(x1, yTop);
    }
    if (!has(c, r - 1)) {
      g.moveTo(x0, yBottom);
      g.lineTo(x1, yBottom);
    }
    if (!has(c - 1, r)) {
      g.moveTo(x0, yTop);
      g.lineTo(x0, yBottom);
    }
    if (!has(c + 1, r)) {
      g.moveTo(x1, yTop);
      g.lineTo(x1, yBottom);
    }
  }
  g.strokePath();
}
