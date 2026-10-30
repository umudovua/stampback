/**
 * Normal bağlamalar: 7 klassik tetromino (GDD, bölmə 4).
 * Hüceyrələr tam ədədli şəbəkə koordinatlarındadır: [sütun, sıra], sıra yuxarı artır.
 */

export type NormalParcelKind = 'I' | 'O' | 'T' | 'L' | 'J' | 'S' | 'Z';

/** 90°-lik addımlarla dönmə: 0, 1, 2, 3. Bucaq heç vaxt radianla saxlanmır. */
export type Rotation = 0 | 1 | 2 | 3;

export type Cell = readonly [col: number, row: number];

export const NORMAL_PARCEL_KINDS: readonly NormalParcelKind[] = ['I', 'O', 'T', 'L', 'J', 'S', 'Z'];

const BASE_CELLS: Record<NormalParcelKind, readonly Cell[]> = {
  I: [
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ],
  O: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ],
  T: [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  L: [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ],
  J: [
    [0, 0],
    [1, 0],
    [2, 0],
    [0, 1],
  ],
  S: [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  Z: [
    [1, 0],
    [2, 0],
    [0, 1],
    [1, 1],
  ],
};

/**
 * Hüceyrələri 90° saat əqrəbinin əksinə `rot` dəfə döndərir və sol-aşağı küncə (0, 0) gətirir.
 * Yalnız tam ədəd əməliyyatlarıdır, ona görə hər platformada eyni nəticə verir.
 */
export function rotateCells(cells: readonly Cell[], rot: Rotation): Cell[] {
  let out: Cell[] = cells.map(([c, r]) => [c, r] as const);
  for (let i = 0; i < rot; i++) {
    out = out.map(([c, r]) => [-r, c] as const);
  }
  let minC = Infinity;
  let minR = Infinity;
  for (const [c, r] of out) {
    if (c < minC) minC = c;
    if (r < minR) minR = r;
  }
  return out
    .map(([c, r]) => [c - minC, r - minR] as const)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

export function parcelCells(kind: NormalParcelKind, rot: Rotation = 0): Cell[] {
  return rotateCells(BASE_CELLS[kind], rot);
}

/** Hüceyrələrin tutduğu ən və hündürlük (hüceyrə sayı ilə). */
export function cellBounds(cells: readonly Cell[]): { width: number; height: number } {
  let width = 0;
  let height = 0;
  for (const [c, r] of cells) {
    if (c + 1 > width) width = c + 1;
    if (r + 1 > height) height = r + 1;
  }
  return { width, height };
}
