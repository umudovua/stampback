/**
 * Xəritə təsvirləri (GDD, bölmə 5). M1-də yalnız “Poçt şöbəsi” var;
 * “Yük maşını” və “Dam üstü” M4-də əlavə olunur.
 */

export interface MapDef {
  id: string;
  /** Platformanın eni, hüceyrə ilə. Platforma dünya mərkəzində (x = 0) yerləşir. */
  platformWidth: number;
}

export const POST_OFFICE: MapDef = {
  id: 'postOffice',
  platformWidth: 10,
};
