import * as THREE from 'three';
import type { Settings } from '../core/settings.ts';
import { resolveMotion } from '../core/settings.ts';
import { cityCentre, cityRadius, CityLayout } from '../sim/layout.ts';
import { countOf } from '../sim/economy.ts';
import type { GameState } from '../sim/state.ts';
import { Buildings, type BuildingRef } from './buildings.ts';
import { Collapse, COLLAPSE_SECONDS } from './collapse.ts';
import { CameraRig } from './cameraRig.ts';
import { Cars } from './cars.ts';
import { createSkyReading, dayPhase, RESTING_PHASE, sampleSky } from './daylight.ts';
import { Fires } from './fires.ts';
import { Estates } from './estates.ts';
import { Ground } from './ground.ts';
import { Highway, highwayReach } from './highway.ts';
import { Pedestrians } from './pedestrians.ts';
import { Port, portReach } from './port.ts';
import { Ships } from './ships.ts';
import { Water } from './water.ts';
import { SHADOW_STEPS, World } from './world.ts';
import { Courtyards, Parks, Zones, type ZoneMode } from './zones.ts';

/**
 * The view layer, entire.
 *
 * It owns zero game state. Given the simulation's counts it reconciles the
 * scene toward them, and it could be thrown away and rebuilt on any frame
 * without the game noticing. The moment building positions start living in the
 * scene graph instead of being derived from counts, offline progress and
 * save/load quietly stop working — so they never do.
 */
export class View {
  readonly world: World;
  readonly rig: CameraRig;

  private readonly ground: Ground;
  private readonly buildings: Buildings;
  private readonly zones: Zones;
  private readonly courtyards: Courtyards;
  private readonly parks: Parks;
  private readonly cars: Cars;
  /**
   * The other half of the trip count. `Cars` draws what is on the road and this
   * draws what is not — see `walkingTrips`. Same lifecycle in every respect,
   * because it is the same kind of thing: a readout with nothing stored.
   */
  private readonly walkers: Pedestrians;
  private readonly fires: Fires;
  /**
   * Buildings falling down. Its own layer, not the fire's and not the
   * skyline's, because it is the only thing in the renderer that outlives the
   * building it draws — see `Collapse`.
   */
  private readonly collapse: Collapse;
  /**
   * Whether a lost building is animated at all. False under reduced motion.
   *
   * Skipped rather than shortened, matching the construction cages and for the
   * same reason: at GROW_SECONDS_REDUCED the rebuild that follows the collapse
   * is seven frames long, so the whole sequence would be a building blinking
   * out and back. A city that quietly has one fewer building is what the game
   * did before this existed, and it is the right thing to keep doing for
   * someone who asked for less motion.
   */
  private collapsing: boolean;
  private readonly port: Port;
  private readonly ships: Ships;
  private readonly highway: Highway;
  private readonly estates: Estates;
  private elapsed = 0;
  private shownDistricts = 0;
  /** What the camera was last leashed to. See `reachOf`. */
  private shownReach = -1;
  /**
   * The building the player has clicked on, or null.
   *
   * View state, and it stays view state: it names an ordinal, it is never
   * written to the save, and a reload opens with nothing selected. Anything
   * else would be the renderer holding a number the simulation cannot
   * reproduce, which is the failure this whole layer is arranged to avoid.
   */
  private selected: BuildingRef | null = null;
  /**
   * The last state `sync` was handed, so a mode change between two syncs has
   * numbers to read. A reference, never a copy — the view is a read-only
   * subscriber and holding a copy is exactly what would make it wrong.
   */
  private lastState: Readonly<GameState> | null = null;
  /**
   * Told when the overlay changes, so the HUD's picker can follow the Z key.
   *
   * Same shape as `onSelect`: the view owns the state and announces it, and the
   * HUD is a subscriber. Nothing flows the other way except a request.
   */
  onZoneMode: ((mode: ZoneMode) => void) | null = null;
  /**
   * Told when the camera goes to street level or comes back, so the HUD can say
   * so. Same shape as `onZoneMode`: the view owns the state and announces it.
   */
  onStreet: ((street: boolean) => void) | null = null;
  /** Reused across clicks. A raycast must not allocate, per frame or otherwise. */
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  /**
   * One reusable sky, filled in place every sync. The cycle runs forever, so a
   * fresh reading per frame would be a per-frame allocation.
   */
  private readonly sky = createSkyReading();
  /** Reduced motion holds the cycle at midday instead of running it. */
  private cycling: boolean;

  constructor(canvas: HTMLCanvasElement, layout: CityLayout, settings?: Readonly<Settings>) {
    // The preference, resolved once, and `system` is what it resolves to when
    // nobody handed one in — which is exactly the `matchMedia` read this used
    // to make inline. A `View` built without settings behaves as it always did.
    const reducedMotion = resolveMotion(settings?.motion ?? 'system');

    this.world = new World(canvas);
    this.ground = new Ground(this.world.scene, layout);
    // Before the buildings, and with nothing kept: the water is built once from
    // the seed and never reconciled against anything, so the view holds no
    // reference to it. It was there before the city was.
    new Water(this.world.scene);
    this.buildings = new Buildings(this.world.scene, layout, reducedMotion);
    this.zones = new Zones(this.world.scene, layout);
    this.courtyards = new Courtyards(this.world.scene, layout);
    this.parks = new Parks(this.world.scene, layout);
    this.cars = new Cars(this.world.scene, layout, !reducedMotion);
    this.walkers = new Pedestrians(this.world.scene, layout, !reducedMotion);
    this.fires = new Fires(this.world.scene, layout, !reducedMotion);
    this.collapse = new Collapse(this.world.scene);
    this.collapsing = !reducedMotion;
    this.port = new Port(this.world.scene);
    this.ships = new Ships(this.world.scene, !reducedMotion);
    this.highway = new Highway(this.world.scene);
    this.estates = new Estates(this.world.scene);

    this.rig = new CameraRig(this.world.camera, canvas, !reducedMotion);
    // A sun crossing the sky is motion, and a slow full-screen colour ramp is
    // the kind of motion the preference exists for. Holding at RESTING_PHASE is
    // not a fallback — it is midday, which is the frame the world is designed
    // to be looked at in.
    this.cycling = !reducedMotion;

    this.rig.onClick = (x, y) => this.pick(x, y);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
  }

  /**
   * Told when the selection changes, so the HUD can open or close its card.
   *
   * A hook rather than the view reaching into the HUD: the view knows what was
   * clicked and nothing about what a panel is.
   */
  onSelect: ((ref: BuildingRef | null) => void) | null = null;

  get selection(): BuildingRef | null {
    return this.selected;
  }

  /**
   * How far from the city's centre the player may pan.
   *
   * The districts used to be the whole answer, and they are not any more: a
   * quay stands off the coast and an estate band sits behind the town, both
   * beyond the furthest the districts can ever go. Before this, they were
   * things you could see from a wide shot and could not go and stand over.
   *
   * Cheap enough to ask every sync — a handful of hypots over the berths — and
   * `sync` re-frames only when the answer moves, so buying a terminal or the
   * road lengthens the leash without the ceremony an annexation gets.
   */
  private reachOf(state: Readonly<GameState>, centre: { x: number; z: number }): number {
    return Math.max(
      cityRadius(state.districts),
      portReach(state, centre.x, centre.z),
      highwayReach(state, centre.x, centre.z),
    );
  }

  /** Casts through a screen point and selects whatever building is under it. */
  private pick(x: number, y: number): void {
    const rect = this.world.canvas.getBoundingClientRect();
    // Normalised device coordinates, which is what `setFromCamera` wants.
    this.pointer.set(
      ((x - rect.left) / rect.width) * 2 - 1,
      -((y - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.world.camera);
    // Ground and sky both come back as nothing, which is the same answer: a
    // click on land the player owns but has not built on clears the card.
    this.select(this.buildings.pick(this.raycaster));
  }

  select(ref: BuildingRef | null): void {
    const same =
      ref === this.selected ||
      (ref !== null &&
        this.selected !== null &&
        ref.kind === this.selected.kind &&
        ref.slot === this.selected.slot);
    if (same) return;
    this.selected = ref;
    this.onSelect?.(ref);
  }

  private readonly onResize = (): void => this.world.resize();

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.isContentEditable || target instanceof HTMLInputElement) return;
    // Escape clears the selection, which is the one thing every panel in every
    // application agrees it should do.
    if (event.key === 'Escape') {
      this.select(null);
      return;
    }
    // Street level, and back. Its own key rather than a zoom past MIN_RADIUS:
    // the orbit camera is the play camera and has to behave exactly as it did.
    if (event.key === 'v' || event.key === 'V') {
      this.toggleStreet();
      return;
    }
    if (event.key !== 'z' && event.key !== 'Z') return;
    // Shift walks the list backwards. With seven modes on one key, a player who
    // has gone one too far should not have to go round again — and the HUD
    // picker is the other half of the same answer.
    this.toggleZones(event.shiftKey);
  };

  /**
   * Goes to street level, or comes back up. Returns where it ended up.
   *
   * The rig owns the move; this owns telling the HUD, exactly as `toggleZones`
   * does. Nothing about the mode reaches the simulation — it is a camera, and a
   * camera is the most view-only thing in the project.
   */
  toggleStreet(): boolean {
    this.rig.setStreet(!this.rig.street);
    this.onStreet?.(this.rig.street);
    return this.rig.street;
  }

  /** Whether the camera is at street level. */
  get street(): boolean {
    return this.rig.street;
  }

  /**
   * Applies the display preferences to everything that answers to them.
   *
   * Every one of these was a constructor argument read once from `matchMedia`,
   * and every one of them is now a setter — because a preference the player can
   * change has to take effect on the click rather than on the next reload. The
   * whole method is idempotent: the store announces the entire object whenever
   * any field of it moves, and each call below early-outs on a value it already
   * holds.
   *
   * What it deliberately does *not* touch is `GameState`. A city looks
   * different and is not different: the traffic that stops moving is a readout
   * over `trips`, the sun that stops crossing the sky is a read over `elapsed`,
   * and both of those numbers carry on exactly as they were.
   */
  apply(settings: Readonly<Settings>): void {
    const reduced = resolveMotion(settings.motion);
    this.world.setShadows(settings.shadows);
    // The other half of a shadow step, and it is here rather than in `World`
    // because `World` owns the light and the building layer owns the meshes
    // that cast into it. See SHADOW_STEPS for why the step needs both halves:
    // the pass is geometry-bound at 49 districts and the map size alone buys
    // almost nothing.
    this.buildings.setDressingShadows(SHADOW_STEPS[settings.shadows].dressing);
    this.world.setFog(settings.fog);
    this.cycling = !reduced;
    this.buildings.setMotion(reduced);
    this.rig.setDrift(!reduced);
    this.cars.setMoving(!reduced);
    this.walkers.setMoving(!reduced);
    this.fires.setMoving(!reduced);
    this.ships.setMoving(!reduced);
    this.collapsing = !reduced;
    // Anything already falling stops falling, rather than finishing under a
    // preference that has just said not to.
    if (reduced) this.collapse.clear();
  }

  /**
   * The overlay, stepped through ZONE_MODES. Building colours are rebuilt once
   * here rather than every frame; the pads themselves are rebuilt by the next
   * `sync`, which keeps the view from having to hold on to a copy of the
   * simulation's counts.
   */
  toggleZones(back = false): ZoneMode {
    return this.applyZones(this.zones.cycle(back));
  }

  /** Jumps to one mode. What the HUD's picker calls. */
  setZoneMode(mode: ZoneMode): ZoneMode {
    return this.applyZones(this.zones.set(mode));
  }

  /** The overlay the view is showing, so the picker can mark it. */
  get zoneMode(): ZoneMode {
    return this.zones.current;
  }

  /** Pads drawn by the last overlay rebuild, for the dev report. */
  get zoneInstances(): number {
    return this.zones.instances;
  }

  /**
   * Re-colours the buildings for a mode.
   *
   * Four of the six modes vary per building, so the overlay is a *source*
   * rather than a colour — see `Zones.overlay`. The state has to be to hand for
   * that, which is why the mode change is applied here and not inside `Zones`.
   */
  private applyZones(mode: ZoneMode): ZoneMode {
    this.buildings.setZoneOverlay(this.lastState ? this.zones.overlay(this.lastState) : null);
    this.onZoneMode?.(mode);
    return mode;
  }

  /** Reconciles the scene toward `state`. Cheap when nothing has changed. */
  sync(state: Readonly<GameState>): void {
    // Time of day is a read over `state.elapsed`, exactly like a building's
    // position is a read over `state.homes`: it belongs here rather than on a
    // clock of the view's own, or it would reset on reload and stand still
    // while the player was away.
    const sky = sampleSky(this.cycling ? dayPhase(state.elapsed) : RESTING_PHASE, this.sky);
    this.world.setSky(sky);
    this.buildings.setNight(sky.night);
    this.port.setNight(sky.night);

    const centre = cityCentre(state.districts);
    const reach = this.reachOf(state, centre);
    if (state.districts !== this.shownDistricts || reach !== this.shownReach) {
      // The first sync is the city the player arrived with, however large it is.
      // Anything after that is land they just bought, and gets the ceremony.
      const annexed = this.shownDistricts > 0 && state.districts > this.shownDistricts;
      this.shownDistricts = state.districts;
      this.shownReach = reach;
      const radius = cityRadius(state.districts);
      this.world.fit(radius);
      this.rig.fit(radius, centre, annexed, reach);
      this.ground.sync(state.districts, this.elapsed, annexed);
    }
    this.buildings.sync(state, this.elapsed);
    // After the skyline, and every sync rather than only on a click: a selected
    // building can climb a level, merge with its neighbour or be boarded up
    // while the card is open, and the outline has to follow it.
    if (this.selected && this.selected.slot >= countOf(state, this.selected.kind)) {
      this.select(null);
    }
    this.buildings.highlight(this.selected, state);
    // The state the overlay was last applied against, so a mode change made
    // between two syncs has something to read. The view is a subscriber and
    // holds no copy of the simulation's numbers — this is a reference to the
    // one object it is handed, not a snapshot.
    this.lastState = state;
    // A rebuild of the pads is a rebuild of the buildings: the two halves of a
    // mode read the same numbers and one stamp decides both.
    if (this.zones.sync(state) && this.zones.enabled) {
      this.buildings.setZoneOverlay(this.zones.overlay(state));
    }
    this.courtyards.sync(state);
    this.parks.sync(state);
    // Before the traffic: the lorries route along the highway, so the road has
    // to be the road as of this sync rather than as of the last one.
    this.highway.sync(state);
    this.estates.sync(state);
    this.cars.sync(state);
    this.walkers.sync(state);
    this.fires.sync(state);
    // Whatever the fire has just destroyed, drawn where it was standing.
    //
    // Drained every sync whether or not it is animated, so a preference change
    // cannot leave a backlog of buildings waiting to fall over. The plot the
    // flames were on is not the plot the simulation empties — see `Collapse`
    // and `Game.demolish` — and this is deliberately the flames' plot: a
    // building falling down where the fire was is the reading the player can
    // check, and the count is the part the simulation is actually honest about.
    for (const loss of this.fires.drainLosses()) {
      if (!this.collapsing) continue;
      this.collapse.start(loss.x, loss.z, loss.width, loss.depth, loss.top, this.elapsed);
      // And the plot fills again once the dust has settled. The city really is
      // one building smaller — at the far end of the build list — so this is
      // the plot being rebuilt rather than the loss being undone.
      this.buildings.rebuild(loss.kind, loss.slot, this.elapsed + COLLAPSE_SECONDS);
    }
    this.port.sync(state);
    this.ships.sync(state);
  }

  /** Advances animations and draws one frame. */
  render(dt: number): void {
    this.elapsed += dt;
    this.rig.update(dt);
    this.world.focusShadows(this.rig.target);
    this.world.updateFog(this.rig.distance);

    // What the buildings are dressed for. It answers "no" on nearly every
    // frame — the mask only moves when the camera has walked half a district or
    // crossed the engage distance — and a repack is 2.5 ms on the largest city,
    // so it must not be asked for more often than that. See `DetailMask`.
    if (
      this.buildings.setDetail(
        this.rig.target.x,
        this.rig.target.z,
        this.rig.distance,
        this.shownDistricts,
      )
    ) {
      this.buildings.repack(this.elapsed);
    }

    // Both of these are O(instances currently in flight), so calling them every
    // frame costs nothing once the city has settled.
    this.ground.update(this.elapsed);
    this.buildings.update(this.elapsed);
    // After `focusShadows`, so traffic is culled against the focus the rest of
    // the frame was drawn from rather than against last frame's.
    this.cars.update(dt, this.rig.target, this.sky.night);
    // No `night`: a walker carries no lamp, so the cycle has nothing to say to
    // it beyond the lighting every other lit surface in the scene already gets.
    this.walkers.update(dt, this.rig.target);
    this.ships.update(dt, this.rig.target);
    this.fires.update(dt, this.elapsed, this.sky.night);
    // O(what is falling), which is at most six and is nearly always none.
    this.collapse.update(this.elapsed);

    this.world.render();
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    this.rig.dispose();
    this.world.dispose();
  }
}
