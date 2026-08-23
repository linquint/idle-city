import { cityCentre, cityRadius, CityLayout } from '../sim/layout';
import type { GameState } from '../sim/state';
import { Buildings } from './buildings';
import { CameraRig } from './cameraRig';
import { Ground } from './ground';
import { World } from './world';

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
  private elapsed = 0;
  private shownDistricts = 0;

  constructor(canvas: HTMLCanvasElement, layout: CityLayout) {
    this.world = new World(canvas);
    this.ground = new Ground(this.world.scene, layout);
    this.buildings = new Buildings(this.world.scene, layout);

    const reducedMotion =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.rig = new CameraRig(this.world.camera, canvas, !reducedMotion);

    window.addEventListener('resize', this.onResize);
  }

  private readonly onResize = (): void => this.world.resize();

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
    this.rig.dispose();
    this.world.dispose();
  }
}
