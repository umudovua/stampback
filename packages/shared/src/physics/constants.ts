/** Fizika addımlarının tezliyi (Hz). Vaxt yalnız tam ədədli tick ilə ölçülür. */
export const TICK_RATE = 60;

/** Üfüqi mövqe dəqiqliyi: bir hüceyrədə neçə addım (x = addım / X_STEPS). */
export const X_STEPS_PER_CELL = 4;

/** Şaquli mövqe dəqiqliyi: bir hüceyrədə neçə addım (y = addım / Y_STEPS). */
export const Y_STEPS_PER_CELL = 64;

/** İdarə olunan bağlamanın enmə sürəti (Y addımı / tick). */
export const SLOW_DESCENT = 1;
export const FAST_DESCENT = 16;

/** Yeni bağlama qüllənin üstündən neçə hüceyrə yuxarıda yaranır. */
export const SPAWN_GAP_CELLS = 6;

/** Cazibə (hüceyrə / s²). */
export const GRAVITY_Y = -20;

/** Bu qədər ardıcıl sakit tick-dən sonra cisim “sabitləşmiş” sayılır (0,5 s). */
export const SETTLE_TICKS = 30;

/** Sürət kvadratı bu həddən kiçik olanda cisim sakit sayılır. */
export const CALM_SPEED_SQ = 0.0004;

/** Bu hündürlükdən aşağı düşən bağlama itirilmiş sayılır (hüceyrə). */
export const LOST_Y = -10;

/** Hüceyrə kolliderinin yarı-ölçüsü və toqquşma sorğusu üçün bir az kiçildilmiş variantı. */
export const CELL_HALF = 0.5;
export const QUERY_HALF = 0.48;
