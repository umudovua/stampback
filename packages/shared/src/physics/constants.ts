/** Fizika addımlarının tezliyi (Hz). Vaxt yalnız tam ədədli tick ilə ölçülür. */
export const TICK_RATE = 60;

/** Üfüqi mövqe dəqiqliyi: bir hüceyrədə neçə addım (x = addım / X_STEPS). */
export const X_STEPS_PER_CELL = 4;

/** Şaquli mövqe dəqiqliyi: bir hüceyrədə neçə addım (y = addım / Y_STEPS). */
export const Y_STEPS_PER_CELL = 64;

/** Bağlama qüllənin ən yüksək nöqtəsindən neçə hüceyrə yuxarıdan buraxılır. */
export const DROP_GAP_CELLS = 1;

/** Cazibə (hüceyrə / s²). */
export const GRAVITY_Y = -20;

/** Bu qədər ardıcıl sakit tick-dən sonra cisim “sabitləşmiş” sayılır (0,5 s). */
export const SETTLE_TICKS = 30;

/** Sürət kvadratı bu həddən kiçik olanda cisim sakit sayılır (0,05 hüceyrə/s). */
export const CALM_SPEED_SQ = 0.0025;

/**
 * Sabitləşmiş cisim yalnız sürət kvadratı bu həddi keçəndə sabitliyini itirir (0,2 hüceyrə/s).
 * Histerezis: kiçik titrəmələr hündürlüyün atlamasına səbəb olmur.
 */
export const UNSETTLE_SPEED_SQ = 0.04;

/** Karton bağlamaların fizika parametrləri. */
export const PARCEL_FRICTION = 1.0;
export const PARCEL_LINEAR_DAMPING = 0.05;
export const PARCEL_ANGULAR_DAMPING = 0.3;

/** Rapier solver iterasiyaları: hündür yığınlarda sabitlik üçün standart 4 əvəzinə 8. */
export const SOLVER_ITERATIONS = 8;

/** Bu hündürlükdən aşağı düşən bağlama itirilmiş sayılır (hüceyrə). */
export const LOST_Y = -10;

/** Toqquşma sorğularında qutunu hər tərəfdən bu qədər kiçildirik ki, toxunan qonşular “kəsişmə” sayılmasın. */
export const QUERY_MARGIN = 0.02;
