import type Phaser from 'phaser';
import type { ParcelKind } from '@stampback/shared';

/** Hər qutu növü üçün bir az fərqli karton çaları. */
export const CARDBOARD: Record<ParcelKind, number> = {
  cube: 0xc8955f,
  brick: 0xbd8a57,
  long: 0xd3a26e,
  tube: 0xb98652,
  big: 0xc99a66,
  wide: 0xb7834f,
  crate: 0xd0a06a,
};

const OUTLINE = 0x5a3d26;
const SHADE = 0x000000;
const LABEL = 0xf6eedf;
const LABEL_LINES = 0xb9a58a;

export interface BoxStyle {
  fill: number;
  tape: number;
  outline?: number;
  label?: boolean;
}

/**
 * Qutunu çəkir: (0, 0) sol-aşağı künc, eni w, hündürlüyü h hüceyrə, y ekranda yuxarı mənfidir.
 * Uzun ox boyunca oyunçu rəngində skotç, kifayət qədər böyükdürsə ünvan etiketi.
 */
export function drawBox(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
  s: number,
  style: BoxStyle,
): void {
  const pw = w * s;
  const ph = h * s;
  const radius = Math.min(pw, ph) * 0.12;
  const top = -ph;

  g.fillStyle(style.fill, 1).fillRoundedRect(0, top, pw, ph, radius);
  // Alt kənarda yüngül kölgə: qutuya həcm verir.
  g.fillStyle(SHADE, 0.12).fillRect(radius * 0.5, -ph * 0.16, pw - radius, ph * 0.16 - 1);

  const tape = Math.min(pw, ph) * 0.2;
  g.fillStyle(style.tape, 1);
  if (pw >= ph) g.fillRect(0, top + ph / 2 - tape / 2, pw, tape);
  else g.fillRect(pw / 2 - tape / 2, top, tape, ph);

  if (style.label !== false && pw >= s * 0.9 && ph >= s * 0.9) {
    const lw = Math.min(pw * 0.36, s * 0.6);
    const lh = lw * 0.62;
    const lx = pw - lw - s * 0.12;
    const ly = top + s * 0.1;
    g.fillStyle(LABEL, 1).fillRoundedRect(lx, ly, lw, lh, 3);
    g.fillStyle(LABEL_LINES, 1);
    g.fillRect(lx + lw * 0.14, ly + lh * 0.32, lw * 0.66, Math.max(1, s * 0.03));
    g.fillRect(lx + lw * 0.14, ly + lh * 0.62, lw * 0.44, Math.max(1, s * 0.03));
  }

  g.lineStyle(Math.max(2, s * 0.07), style.outline ?? OUTLINE, 1);
  g.strokeRoundedRect(0, top, pw, ph, radius);
}
