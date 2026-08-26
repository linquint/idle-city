import * as THREE from 'three';
import { cityCentre, cityRadius, CityLayout } from '../sim/layout';
import { countOf } from '../sim/economy';
import type { GameState } from '../sim/state';
import { Buildings, type BuildingRef } from './buildings';
import { CameraRig } from './cameraRig';
import { Cars } from './cars';
import { createSkyReading, dayPhase, RESTING_PHASE, sampleSky } from './daylight';
import { Fires } from './fires';
import { Ground } from './ground';
import { Port } from './port';
import { Ships } from './ships';
import { Water } from './water';
import { World } from './world';
import { Courtyards, Parks, Zones, type ZoneMode } from './zones';

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
  private readonly fires: Fires;
  private readonly port: Port;
  private readonly ships: Ships;
  private elapsed = 0;
  private shownDistricts = 0;
  /**
   * The building the player has clicked on, or null.
   *
   * View state, and it stays view state: it names an ordinal, it is never
   * written to the save, and a reload opens with nothing selected. Anything
   * else would be the renderer holding a number the simulation cannot
   * reproduce, which is the failure this whole layer is arranged to avoid.
   */
  private selected: BuildingRef | null = null;
  /** Reused across clicks. A raycast must not allocate, per frame or otherwise. */
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  /**
   * One reusable sky, filled in place every sync. The cycle runs forever, so a
   * fresh reading per frame would be a per-frame allocation.
   */
  private readonly sky = createSkyReading();
  /** Reduced motion holds the cycle at dusk instead of running it. */
  private readonly cycling: boolean;

  constructor(canvas: HTMLCanvasElement, layout: CityLayout) {
    const reducedMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.world = new World(canvas);
    this.ground = new Ground(this.world.scene, layout);
    // Before the buildings, and with nothing kept: the water is built once from
    // the seed and never reconciled against anything, so the view holds no
    // reference to it. It was there before the city was.
    new Water(this.world.scene);
    this.buildings = new Buildings(this.world.scene, layout);
    this.zones = new Zones(this.world.scene, layout);
    this.courtyards = new Courtyards(this.world.scene, layout);
    this.parks = new Parks(this.world.scene, layout);
    this.cars = new Cars(this.world.scene, layout, !reducedMotion);
    this.fires = new Fires(this.world.scene, layout, !reducedMotion);
    this.port = new Port(this.world.scene);
    this.ships = new Ships(this.world.scene, !reducedMotion);

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
    if (event.key !== 'z' && event.key !== 'Z') return;
    this.toggleZones();
  };

  /**
   * The zone overlay, stepped off -> plan -> demand. Building colours are
   * rebuilt once here rather than every frame; the pads themselves are rebuilt
   * by the next `sync`, which keeps the view from having to hold on to a copy
   * of the simulation's counts.
   */
  toggleZones(): ZoneMode {
    const mode = this.zones.cycle();
    // Buildings only ever say which zone they stand in; demand is a property of
    // the *unbuilt* land, so both overlay modes tint them the same way.
    this.buildings.setZoneOverlay(mode !== 'off');
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

    if (state.districts !== this.shownDistricts) {
      // The first sync is the city the player arrived with, however large it is.
      // Anything after that is land they just bought, and gets the ceremony.
      const annexed = this.shownDistricts > 0 && state.districts > this.shownDistricts;
      this.shownDistricts = state.districts;
      const radius = cityRadius(state.districts);
      this.world.fit(radius);
      this.rig.fit(radius, cityCentre(state.districts), annexed);
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
    this.zones.sync(state);
    this.courtyards.sync(state);
    this.parks.sync(state);
    this.cars.sync(state);
    this.fires.sync(state);
    this.port.sync(state);
    this.ships.sync(state);
  }

  /** Advances animations and draws one frame. */
  render(dt: number): void {
    this.elapsed += dt;
    this.rig.update(dt);
    this.world.focusShadows(this.rig.target);
    this.world.updateFog(this.rig.distance);

    // Both of these are O(instances currently in flight), so calling them every
    // frame costs nothing once the city has settled.
    this.ground.update(this.elapsed);
    this.buildings.update(this.elapsed);
    // After `focusShadows`, so traffic is culled against the focus the rest of
    // the frame was drawn from rather than against last frame's.
    this.cars.update(dt, this.rig.target, this.sky.night);
    this.ships.update(dt, this.rig.target);
    this.fires.update(dt, this.elapsed, this.sky.night);

    this.world.render();
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    this.rig.dispose();
    this.world.dispose();
  }
}
