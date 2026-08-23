import { cityCentre, cityRadius, CityLayout } from '../sim/layout';
import type { GameState } from '../sim/state';
import { Buildings } from './buildings';
import { CameraRig } from './cameraRig';
import { Ground } from './ground';
import { World } from './world';
import { Courtyards, Zones, type ZoneMode } from './zones';

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
  private elapsed = 0;
  private shownDistricts = 0;

  constructor(canvas: HTMLCanvasElement, layout: CityLayout) {
    this.world = new World(canvas);
    this.ground = new Ground(this.world.scene, layout);
    this.buildings = new Buildings(this.world.scene, layout);
    this.zones = new Zones(this.world.scene, layout);
    this.courtyards = new Courtyards(this.world.scene, layout);

    const reducedMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.rig = new CameraRig(this.world.camera, canvas, !reducedMotion);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
  }

  private readonly onResize = (): void => this.world.resize();

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key !== 'z' && event.key !== 'Z') return;
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.isContentEditable || target instanceof HTMLInputElement) return;
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
    this.zones.sync(state);
    this.courtyards.sync(state);
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

    this.world.render();
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    this.rig.dispose();
    this.world.dispose();
  }
}
