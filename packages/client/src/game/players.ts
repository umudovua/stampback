/** Oyunçu rəngləri (GDD, bölmə 6: rəng + ad + ikon ilə fərqləndirmə). */
export const PLAYER_COLORS = [0xd8542f, 0x1f9e8a, 0x6e5bc8, 0x2f7fd0, 0xc23d78, 0x6d8f1e] as const;

export function colorCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Botlar üçün kuryer adları; dildən asılı deyil. */
export const BOT_NAMES = ['Aysel', 'Murad', 'Leyla', 'Tural', 'Nigar'] as const;

/** Prototipdə finiş xəttinin hündürlüyü (hüceyrə). */
export const FINISH_HEIGHT = 15;
