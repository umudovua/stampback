import type { MapDef } from '../maps';
import { parcelSize, type ParcelKind, type ParcelRotation } from '../parcels/catalog';
import { isPerfectPlacement } from '../rules/perfect';
import {
  CALM_SPEED_SQ,
  DROP_GAP_CELLS,
  GRAVITY_Y,
  LOST_Y,
  PARCEL_ANGULAR_DAMPING,
  PARCEL_FRICTION,
  PARCEL_LINEAR_DAMPING,
  QUERY_MARGIN,
  SETTLE_TICKS,
  SOLVER_ITERATIONS,
  TICK_RATE,
  UNSETTLE_SPEED_SQ,
  X_STEPS_PER_CELL,
  Y_STEPS_PER_CELL,
} from './constants';
import { fnv1a32 } from './hash';
import { loadRapier, type Rapier } from './rapier';

/** Bu bucaqdan (radian) çox əyilmiş bağlama “düz” sayılmır. */
const MAX_FLAT_ANGLE = 0.05;
/** Alt səth boyunca dəstək yoxlaması: hər hüceyrəyə düşən nöqtə sayı. */
const SUPPORT_SAMPLES_PER_CELL = 4;
/** Hündürlük şüalarının arası (hüceyrə). */
const RAY_SPACING = 0.25;

type World = InstanceType<Rapier['World']>;
type RigidBody = ReturnType<World['createRigidBody']>;
type Collider = ReturnType<World['createCollider']>;

/**
 * Giriş jurnalının qeydi. Fizika dünyası YALNIZ bu hadisələrdən asılıdır:
 * bağlama sol-aşağı küncü (x, y) olmaqla, hərəkətsiz halda dünyaya əlavə olunur.
 */
export interface ReleaseEvent {
  tick: number;
  type: 'release';
  parcel: ParcelKind;
  rot: ParcelRotation;
  /** Sol-aşağı künc, X addımı ilə (1 hüceyrə = X_STEPS_PER_CELL). */
  x: number;
  /** Sol-aşağı künc, Y addımı ilə (1 hüceyrə = Y_STEPS_PER_CELL). */
  y: number;
}

/** Simulyasiyanın xəbər verdiyi hadisələr (HUD, xal və marka üçün). */
export type SimEvent =
  | {
      type: 'settled';
      id: number;
      tick: number;
      perfect: boolean;
      support: number;
      ticksToCalm: number;
    }
  | { type: 'lost'; id: number; tick: number };

/** Render üçün cisim görünüşü. `angle` yalnız çəkmək üçündür, simulyasiyaya qayıtmır. */
export interface BodyView {
  id: number;
  kind: ParcelKind;
  rot: ParcelRotation;
  /** Bağlamanın sol-aşağı küncü (dünya koordinatı, hüceyrə). */
  x: number;
  y: number;
  angle: number;
  w: number;
  h: number;
  settled: boolean;
}

interface TrackedBody {
  id: number;
  body: RigidBody;
  kind: ParcelKind;
  rot: ParcelRotation;
  w: number;
  h: number;
  calmTicks: number;
  settled: boolean;
  releaseTick: number;
  reported: boolean;
}

/**
 * Bir oyunçunun qülləsinin deterministik simulyasiyası (docs/architecture.md, bölmə 4–5).
 *
 * - 60 Hz sabit addım; vaxt = tam ədədli tick.
 * - Oyunçu bağlamanı lentdən götürüb qüllənin üstünə aparır və buraxır (`dropAt`);
 *   bağlama buraxılma xəttindən real fizika ilə düşür.
 * - Bucaqlar radianla saxlanmır: düzbucaqlı qutu üçün 90° döndərmə sadəcə en və hündürlüyün yerini dəyişir.
 */
export class TowerSim {
  readonly map: MapDef;
  private readonly R: Rapier;
  private readonly world: World;
  private readonly bodies: TrackedBody[] = [];
  private readonly releaseLog: ReleaseEvent[] = [];
  private readonly settledColliders = new Set<number>();
  private currentTick = 0;
  private nextBodyId = 1;
  private lost = 0;
  private cache: { tick: number; settled: number; any: number } | null = null;
  private pendingEvents: SimEvent[] = [];

  private constructor(R: Rapier, map: MapDef) {
    this.R = R;
    this.map = map;
    this.world = new R.World({ x: 0, y: GRAVITY_Y });
    this.world.timestep = 1 / TICK_RATE;
    this.world.numSolverIterations = SOLVER_ITERATIONS;

    const platform = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.5));
    this.world.createCollider(
      R.ColliderDesc.cuboid(map.platformWidth / 2, 0.5).setFriction(0.9),
      platform,
    );
    // Rapier sorğu strukturlarını (broad phase) ilk addımda qurur. Boş dünyada bir hazırlıq
    // addımı edirik ki, ilk sorğular platformanı görsün. Dinamik cisim olmadığı üçün nəticəyə
    // təsir etmir; tick sayına daxil edilmir.
    this.world.step();
  }

  /** Rapier-i yükləyir və boş qüllə yaradır. */
  static async create(map: MapDef): Promise<TowerSim> {
    const R = await loadRapier();
    return new TowerSim(R, map);
  }

  /**
   * Giriş jurnalını `untilTick`-ə qədər təkrar oynadır (determinizm testi və gələcək server yoxlaması üçün).
   * `onTick` hər fizika addımından sonra çağırılır, məsələn, aralıq hash-ləri toplamaq üçün.
   */
  static async replay(
    map: MapDef,
    log: readonly ReleaseEvent[],
    untilTick: number,
    onTick?: (sim: TowerSim) => void,
  ): Promise<TowerSim> {
    const sim = await TowerSim.create(map);
    let i = 0;
    while (sim.currentTick < untilTick) {
      while (i < log.length && log[i]!.tick === sim.currentTick) {
        sim.addBody(log[i]!);
        i++;
      }
      sim.stepWorld();
      onTick?.(sim);
    }
    return sim;
  }

  get tick(): number {
    return this.currentTick;
  }

  get lostCount(): number {
    return this.lost;
  }

  get log(): readonly ReleaseEvent[] {
    return this.releaseLog;
  }

  /** Bağlamanın buraxılacağı hündürlük (Y addımı): qüllənin ən yüksək nöqtəsinin bir az üstü. */
  dropLineY(): number {
    return Math.ceil((this.getTopAny() + DROP_GAP_CELLS) * Y_STEPS_PER_CELL);
  }

  /** Bağlamanın mərkəzi platformanın üstündə qalacaq X diapazonu (X addımı ilə). */
  xRange(kind: ParcelKind, rot: ParcelRotation): { min: number; max: number } {
    const { w } = parcelSize(kind, rot);
    const half = (this.map.platformWidth / 2) * X_STEPS_PER_CELL;
    const halfW = (w / 2) * X_STEPS_PER_CELL;
    return { min: Math.ceil(-half - halfW), max: Math.floor(half - halfW) };
  }

  /** X-i platforma diapazonuna sıxışdırır. */
  clampX(kind: ParcelKind, rot: ParcelRotation, x: number): number {
    const { min, max } = this.xRange(kind, rot);
    return Math.max(min, Math.min(max, x));
  }

  /**
   * Bağlamanı buraxma xəttindən (x mövqeyində) buraxır: dinamik cismə çevrilir və jurnala yazılır.
   * Buraxma xəttində yer tutulubsa, boş yer tapılana qədər yuxarı qaldırılır.
   */
  dropAt(kind: ParcelKind, rot: ParcelRotation, x: number): ReleaseEvent {
    const cx = this.clampX(kind, rot, x);
    let y = this.dropLineY();
    while (this.collides(kind, rot, cx, y)) y += Y_STEPS_PER_CELL / 4;
    const event: ReleaseEvent = {
      tick: this.currentTick,
      type: 'release',
      parcel: kind,
      rot,
      x: cx,
      y,
    };
    this.addBody(event);
    this.releaseLog.push(event);
    return event;
  }

  /**
   * Bağlama x mövqeyindən buraxılsa, harada dayanacağını təxmin edir (sol-aşağı künc Y-si, Y addımı ilə).
   * Fizikanı işə salmır: yalnız düz aşağı endirib ilk toxunuşu tapır. Botlar və bələdçi xətlər üçündür.
   */
  landingY(kind: ParcelKind, rot: ParcelRotation, x: number): number | null {
    const floor = LOST_Y * Y_STEPS_PER_CELL;
    let y = this.dropLineY();
    if (this.collides(kind, rot, x, y)) return null;
    const coarse = Y_STEPS_PER_CELL / 4;
    while (y - coarse > floor && !this.collides(kind, rot, x, y - coarse)) y -= coarse;
    while (y - 1 > floor && !this.collides(kind, rot, x, y - 1)) y -= 1;
    return y - 1 > floor ? y : null;
  }

  /** Bir tick irəli. */
  step(): void {
    this.stepWorld();
  }

  /** Qüllənin hündürlüyü (hüceyrə): yalnız sabitləşmiş bağlamalar sayılır. */
  getHeight(): number {
    return this.measure().settled;
  }

  /** Bütün bağlamaların (hərəkətdə olanlar daxil) ən yüksək nöqtəsi (hüceyrə). */
  getTopAny(): number {
    return this.measure().any;
  }

  /** Bütün buraxılmış bağlamalar sabitləşibmi? */
  isSettled(): boolean {
    return this.bodies.every((b) => b.settled);
  }

  /** Son çağırışdan bəri baş vermiş hadisələri qaytarır və siyahını təmizləyir. */
  drainEvents(): SimEvent[] {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  /** Render üçün cisimlərin vəziyyəti. */
  bodyViews(): BodyView[] {
    return this.bodies.map((b) => {
      const t = b.body.translation();
      return {
        id: b.id,
        kind: b.kind,
        rot: b.rot,
        x: t.x,
        y: t.y,
        angle: b.body.rotation(),
        w: b.w,
        h: b.h,
        settled: b.settled,
      };
    });
  }

  /** Dünya vəziyyətinin hash-i: eyni jurnal hər platformada eyni hash verməlidir. */
  snapshotHash(): string {
    return fnv1a32(this.world.takeSnapshot());
  }

  dispose(): void {
    this.world.free();
  }

  /** Platformanın üstündə şüalarla ən yüksək nöqtələri ölçür (tick başına bir dəfə). */
  private measure(): { settled: number; any: number } {
    if (this.cache?.tick === this.currentTick) return this.cache;
    const half = this.map.platformWidth / 2;
    const top = 1000;
    let settled = 0;
    let any = 0;
    const ray = new this.R.Ray({ x: 0, y: top }, { x: 0, y: -1 });
    const isSettled = (c: Collider) => this.settledColliders.has(c.handle);
    for (let x = -half + RAY_SPACING / 2; x < half; x += RAY_SPACING) {
      ray.origin = { x, y: top };
      const hitAny = this.world.castRay(ray, top + 1, true);
      if (hitAny) any = Math.max(any, top - hitAny.timeOfImpact);
      const hitSettled = this.world.castRay(
        ray,
        top + 1,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        isSettled,
      );
      if (hitSettled) settled = Math.max(settled, top - hitSettled.timeOfImpact);
    }
    this.cache = { tick: this.currentTick, settled, any };
    return this.cache;
  }

  private stepWorld(): void {
    this.world.step();
    this.currentTick++;

    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const tracked = this.bodies[i]!;
      const body = tracked.body;
      const handle = body.collider(0).handle;
      if (body.translation().y < LOST_Y) {
        this.settledColliders.delete(handle);
        this.world.removeRigidBody(body);
        this.bodies.splice(i, 1);
        this.lost++;
        this.pendingEvents.push({ type: 'lost', id: tracked.id, tick: this.currentTick });
        continue;
      }
      const v = body.linvel();
      const w = body.angvel();
      const speedSq = v.x * v.x + v.y * v.y;
      const spinSq = w * w;
      if (tracked.settled) {
        if (speedSq > UNSETTLE_SPEED_SQ || spinSq > UNSETTLE_SPEED_SQ) {
          tracked.settled = false;
          tracked.calmTicks = 0;
        }
      } else {
        const calm = speedSq < CALM_SPEED_SQ && spinSq < CALM_SPEED_SQ;
        tracked.calmTicks = calm ? tracked.calmTicks + 1 : 0;
        if (tracked.calmTicks >= SETTLE_TICKS) tracked.settled = true;
      }
      if (tracked.settled && !tracked.reported) {
        tracked.reported = true;
        const ticksToCalm = this.currentTick - SETTLE_TICKS - tracked.releaseTick;
        const support = this.measureSupport(tracked);
        this.pendingEvents.push({
          type: 'settled',
          id: tracked.id,
          tick: this.currentTick,
          perfect: isPerfectPlacement({ ticksToCalm, support }),
          support,
          ticksToCalm,
        });
      }
      if (tracked.settled) this.settledColliders.add(handle);
      else this.settledColliders.delete(handle);
    }
  }

  private addBody(event: ReleaseEvent): void {
    const R = this.R;
    const { w, h } = parcelSize(event.parcel, event.rot);
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(event.x / X_STEPS_PER_CELL, event.y / Y_STEPS_PER_CELL)
        .setLinearDamping(PARCEL_LINEAR_DAMPING)
        .setAngularDamping(PARCEL_ANGULAR_DAMPING),
    );
    this.world.createCollider(
      R.ColliderDesc.cuboid(w / 2, h / 2)
        .setTranslation(w / 2, h / 2)
        .setDensity(1)
        .setFriction(PARCEL_FRICTION)
        .setRestitution(0),
      body,
    );
    this.bodies.push({
      id: this.nextBodyId++,
      body,
      kind: event.parcel,
      rot: event.rot,
      w,
      h,
      calmTicks: 0,
      settled: false,
      releaseTick: event.tick,
      reported: false,
    });
  }

  /**
   * Bağlamanın alt səthinin neçə faizinin dəstəkləndiyini ölçür (0–1).
   * Alt kənar boyunca qısa şüalar atılır. Əyilmiş bağlama dəstəklənmiş sayılmır, çünki
   * trigonometriyasız ölçmə yalnız düz vəziyyətdə dəqiqdir.
   */
  private measureSupport(tracked: TrackedBody): number {
    const angle = tracked.body.rotation();
    if (angle > MAX_FLAT_ANGLE || angle < -MAX_FLAT_ANGLE) return 0;
    const center = tracked.body.collider(0).translation();
    const left = center.x - tracked.w / 2;
    const bottom = center.y - tracked.h / 2;
    const samples = Math.max(2, Math.round(tracked.w * SUPPORT_SAMPLES_PER_CELL));
    const ray = new this.R.Ray({ x: 0, y: 0 }, { x: 0, y: -1 });
    let supported = 0;
    for (let i = 0; i < samples; i++) {
      ray.origin = { x: left + ((i + 0.5) * tracked.w) / samples, y: bottom + 0.05 };
      const hit = this.world.castRay(
        ray,
        0.15,
        true,
        undefined,
        undefined,
        undefined,
        tracked.body,
      );
      if (hit) supported++;
    }
    return supported / samples;
  }

  /** Bağlama (x, y) mövqeyində hər hansı kolliderlə kəsişirmi? */
  private collides(kind: ParcelKind, rot: ParcelRotation, x: number, y: number): boolean {
    const { w, h } = parcelSize(kind, rot);
    const shape = new this.R.Cuboid(w / 2 - QUERY_MARGIN, h / 2 - QUERY_MARGIN);
    let hit = false;
    this.world.intersectionsWithShape(
      { x: x / X_STEPS_PER_CELL + w / 2, y: y / Y_STEPS_PER_CELL + h / 2 },
      0,
      shape,
      () => {
        hit = true;
        return false;
      },
    );
    return hit;
  }
}
