import type Phaser from 'phaser';

const WALL = 0xe8d4b2;
const WAINSCOT = 0xcfae85;
const WAINSCOT_LINE = 0xbf9b70;
const SHELF = 0xa98258;
const SHELF_BOX = [0xd9b88d, 0xc9a477, 0xdcc199] as const;

/**
 * Sadə poçt şöbəsi arxa planı: divar, panel və arxada rəfli bağlamalar.
 * Kameraya bağlıdır (scroll etmir); real AI qrafikası M6-da bunu əvəz edəcək.
 */
export function drawBackground(
  g: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
): void {
  g.clear();
  g.fillStyle(WALL, 1).fillRect(0, 0, width, height);

  // Arxada iki rəf, üstündə kiçik bağlamalar.
  const shelfYs = [height * 0.3, height * 0.52];
  shelfYs.forEach((y, row) => {
    let x = 12 + row * 18;
    let i = row;
    while (x < width - 30) {
      const w = 22 + ((i * 17) % 26);
      const h = 16 + ((i * 11) % 22);
      g.fillStyle(SHELF_BOX[i % SHELF_BOX.length]!, 1).fillRect(x, y - h, w, h);
      x += w + 6 + ((i * 7) % 14);
      i++;
    }
    g.fillStyle(SHELF, 1).fillRect(0, y, width, 6);
  });

  // Aşağı panel (lambri).
  const panelTop = height * 0.72;
  g.fillStyle(WAINSCOT, 1).fillRect(0, panelTop, width, height - panelTop);
  g.fillStyle(WAINSCOT_LINE, 1).fillRect(0, panelTop, width, 4);
  for (let x = 40; x < width; x += 80) g.fillRect(x, panelTop + 4, 3, height - panelTop);
}
