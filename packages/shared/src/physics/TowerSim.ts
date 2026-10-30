import type { MapDef } from '../maps';
import {
  cellBounds,
  parcelCells,
  type Cell,
  type NormalParcelKind,
  type Rotation,
} from '../parcels/normal';
import {
  CALM_SPEED_SQ,
  CELL_HALF,
  FAST_DESCENT,
  GRAVITY_Y,
  LOST_Y,
  QUERY_HALF,
  SETTLE_TICKS,
  SLOW_DESCENT,
  SPAWN_GAP_CELLS,
  TICK_RATE,
  X_STEPS_PER_CELL,
  Y_STEPS_PER_CELL,
} from './constants';
import { fnv1a32 } from './hash';
import { loadRapier, type Rapier } from './rapier';

type World = InstanceType<Rapier['World']>;
type RigidBody = ReturnType<World['createRigidBody']>;
type Collider = ReturnType<World['createCollider']>;

/**
 * Giriş jurnalının qeydi. Fizika dünyası YALNIZ bu hadisələrdən asılıdır:
 * idarə olunan bağlama buraxılana qədər fizikaya daxil deyil.
 */
export interface ReleaseEvent {
  tick: number;
  type: 'release';
  parcel: NormalParcelKind;
  /** Sol-aşağı künc, X addımı ilə (1 hüceyrə = X_STEPS_PER_CELL). */
  x: number;
  /** Sol-aşağı künc, Y addımı ilə (1 hüceyrə = Y_STEPS_PER_CELL). */
  y: number;
  rot: Rotation;
}

/** Oyunçunun hələ idarə etdiyi, fizikaya daxil olmayan bağlama. */
export interface ActiveParcel {
  kind: NormalParcelKind;
  x: number;
  y: number;
  rot: Rotation;
  cells: readonly Cell[];
}

/** Render üçün cisim görünüşü. `angle` yalnız çəkmək üçündür, simulyasiyaya qayıtmır. */
export interface BodyView {
  id: number;
  kind: NormalParcelKind;
  x: number;
  y: number;
  angle: number;
  cells: readonly Cell[];
  settled: boolean;
}

interface TrackedBody {
  id: number;
  body: RigidBody;
  kind: NormalParcelKind;
  cells: readonly Cell[];
  calmTicks: number;
}

/**
 * Bir oyunçunun qülləsinin deterministik simulyasiyası (docs/architecture.md, bölmə 4–5).
 *
 * - 60 Hz sabit addım; vaxt = tam ədədli tick.
 * - Bağlama buraxılana qədər kinematik deyil, sırf məlumatdır; buraxılanda dinamik cismə çevrilir.
 * - Dönmə tam ədədli hüceyrə çevrilməsi ilə edilir, ona görə trigonometriya lazım deyil.
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
  private activeParcel: ActiveParcel | null = null;
  private fastDrop = false;
  private heightCache: { tick: number; value: number } | null = null;

  private constructor(R: Rapier, map: MapDef) {
    this.R = R;
    this.map = map;
    this.world = new R.World({ x: 0, y: GRAVITY_Y });
    this.world.timestep = 1 / TICK_RATE;

    const platform = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.5));
    this.world.createCollider(
      R.ColliderDesc.cuboid(map.platformWidth / 2, 0.5).setFriction(0.9),
      platform,
    );
  }

  /** Rapier-i yükləyir və boş qüllə yaradır. */
  static async create(map: MapDef): Promise<TowerSim> {
    const R = await loadRapier();
    return new TowerSim(R, map);
  }

  /** Giriş jurnalını `untilTick`-ə qədər təkrar oynadır (determinizm testi və gələcək server yoxlaması üçün). */
  static async replay(
    map: MapDef,
    log: readonly ReleaseEvent[],
    untilTick: number,
  ): Promise<TowerSim> {
    const sim = await TowerSim.create(map);
    let i = 0;
    while (sim.currentTick < untilTick) {
      while (i < log.length && log[i]!.tick === sim.currentTick) {
        sim.addDynamicParcel(log[i]!);
        i++;
      }
      sim.stepWorld();
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

  get active(): ActiveParcel | null {
    return this.activeParcel;
  }

  /** Yeni idarə olunan bağlama yaradır. Artıq aktiv bağlama varsa və ya yer tutulubsa `false`. */
  spawnParcel(kind: NormalParcelKind, rot: Rotation = 0): boolean {
    if (this.activeParcel) return false;
    const cells = parcelCells(kind, rot);
    const { width } = cellBounds(cells);
    const x = -width * (X_STEPS_PER_CELL / 2);
    const top = Math.ceil(this.getHeight());
    const y = (top + SPAWN_GAP_CELLS) * Y_STEPS_PER_CELL;
    if (this.collides(cells, x, y)) return false;
    this.activeParcel = { kind, x, y, rot, cells };
    this.fastDrop = false;
    return true;
  }

  /** Aktiv bağlamanı bir X addımı sola (-1) və ya sağa (+1) aparır. */
  move(direction: -1 | 1): boolean {
    const p = this.activeParcel;
    if (!p) return false;
    const x = p.x + direction;
    if (this.collides(p.cells, x, p.y)) return false;
    p.x = x;
    return true;
  }

  /** Aktiv bağlamanı 90° döndərir; yer tutulubsa döndərmir. */
  rotate(): boolean {
    const p = this.activeParcel;
    if (!p) return false;
    const rot = ((p.rot + 1) % 4) as Rotation;
    const cells = parcelCells(p.kind, rot);
    if (this.collides(cells, p.x, p.y)) return false;
    p.rot = rot;
    p.cells = cells;
    return true;
  }

  setFastDrop(on: boolean): void {
    this.fastDrop = on;
  }

  /** Aktiv bağlamanı olduğu yerdə buraxır: dinamik cismə çevrilir və jurnala yazılır. */
  release(): ReleaseEvent | null {
    const p = this.activeParcel;
    if (!p) return null;
    const event: ReleaseEvent = {
      tick: this.currentTick,
      type: 'release',
      parcel: p.kind,
      x: p.x,
      y: p.y,
      rot: p.rot,
    };
    this.addDynamicParcel(event);
    this.releaseLog.push(event);
    this.activeParcel = null;
    return event;
  }

  /**
   * Bir tick irəli: aktiv bağlama enir (maneəyə çatanda avtomatik buraxılır), sonra fizika addımı.
   * Qaytarır: bu tick-də buraxılma baş veribsə, onun hadisəsi.
   */
  step(): ReleaseEvent | null {
    let released: ReleaseEvent | null = null;
    const p = this.activeParcel;
    if (p) {
      const speed = this.fastDrop ? FAST_DESCENT : SLOW_DESCENT;
      let moved = 0;
      while (moved < speed && !this.collides(p.cells, p.x, p.y - 1)) {
        p.y -= 1;
        moved++;
      }
      if (moved < speed) released = this.release();
    }
    this.stepWorld();
    return released;
  }

  /** Qüllənin hündürlüyü (hüceyrə): yalnız sabitləşmiş bağlamalar sayılır. */
  getHeight(): number {
    if (this.heightCache?.tick === this.currentTick) return this.heightCache.value;
    const half = this.map.platformWidth / 2;
    const top = 1000;
    let height = 0;
    const ray = new this.R.Ray({ x: 0, y: top }, { x: 0, y: -1 });
    const isSettled = (c: Collider) => this.settledColliders.has(c.handle);
    for (let x = -half + 0.125; x < half; x += 0.25) {
      ray.origin = { x, y: top };
      const hit = this.world.castRay(
        ray,
        top + 1,
        true,
        undefined,
        undefined,
        undefined,
        undefined,
        isSettled,
      );
      if (hit) {
        const y = top - hit.timeOfImpact;
        if (y > height) height = y;
      }
    }
    this.heightCache = { tick: this.currentTick, value: height };
    return height;
  }

  /** Bütün buraxılmış bağlamalar sabitləşibmi? */
  isSettled(): boolean {
    return this.bodies.every((b) => b.calmTicks >= SETTLE_TICKS);
  }

  /** Render üçün cisimlərin vəziyyəti. */
  bodyViews(): BodyView[] {
    return this.bodies.map((b) => {
      const t = b.body.translation();
      return {
        id: b.id,
        kind: b.kind,
        x: t.x,
        y: t.y,
        angle: b.body.rotation(),
        cells: b.cells,
        settled: b.calmTicks >= SETTLE_TICKS,
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

  private stepWorld(): void {
    this.world.step();
    this.currentTick++;

    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const tracked = this.bodies[i]!;
      const body = tracked.body;
      if (body.translation().y < LOST_Y) {
        for (let c = 0; c < body.numColliders(); c++) {
          this.settledColliders.delete(body.collider(c).handle);
        }
        this.world.removeRigidBody(body);
        this.bodies.splice(i, 1);
        this.lost++;
        continue;
      }
      const v = body.linvel();
      const w = body.angvel();
      const calm = v.x * v.x + v.y * v.y < CALM_SPEED_SQ && w * w < CALM_SPEED_SQ;
      tracked.calmTicks = calm ? tracked.calmTicks + 1 : 0;
      const settled = tracked.calmTicks >= SETTLE_TICKS;
      for (let c = 0; c < body.numColliders(); c++) {
        const handle = body.collider(c).handle;
        if (settled) this.settledColliders.add(handle);
        else this.settledColliders.delete(handle);
      }
    }
  }

  private addDynamicParcel(event: ReleaseEvent): void {
    const R = this.R;
    const cells = parcelCells(event.parcel, event.rot);
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic().setTranslation(
        event.x / X_STEPS_PER_CELL,
        event.y / Y_STEPS_PER_CELL,
      ),
    );
    for (const [c, r] of cells) {
      this.world.createCollider(
        R.ColliderDesc.cuboid(CELL_HALF, CELL_HALF)
          .setTranslation(c + CELL_HALF, r + CELL_HALF)
          .setDensity(1)
          .setFriction(0.7)
          .setRestitution(0),
        body,
      );
    }
    this.bodies.push({ id: this.nextBodyId++, body, kind: event.parcel, cells, calmTicks: 0 });
  }

  /** Hüceyrələr (x, y) mövqeyində hər hansı kolliderlə kəsişirmi? */
  private collides(cells: readonly Cell[], x: number, y: number): boolean {
    const shape = new this.R.Cuboid(QUERY_HALF, QUERY_HALF);
    const ox = x / X_STEPS_PER_CELL;
    const oy = y / Y_STEPS_PER_CELL;
    let hit = false;
    for (const [c, r] of cells) {
      this.world.intersectionsWithShape(
        { x: ox + c + CELL_HALF, y: oy + r + CELL_HALF },
        0,
        shape,
        () => {
          hit = true;
          return false;
        },
      );
      if (hit) return true;
    }
    return false;
  }
}
