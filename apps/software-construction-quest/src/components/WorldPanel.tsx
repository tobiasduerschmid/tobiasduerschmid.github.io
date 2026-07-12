import {
  Component,
  lazy,
  Suspense,
  useMemo,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import type { StudentAvatarProfile } from '../adapters/avatarProfile';
import type { DistrictDefinition } from '../domain/types';

const LazyQuestWorld = lazy(() =>
  import('../game/QuestWorld').then((module) => ({ default: module.QuestWorld })),
);

class SceneErrorBoundary extends Component<
  { readonly children: ReactNode },
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('The decorative quest world could not render.', error, errorInfo);
  }

  override render() {
    if (this.state.failed) {
      return (
        <p className="scq-world-fallback" role="status">
          The animated world is unavailable. All missions remain playable from the
          quest map.
        </p>
      );
    }
    return this.props.children;
  }
}

interface WorldPanelProps {
  readonly avatar: StudentAvatarProfile;
  readonly districts: readonly DistrictDefinition[];
  readonly selectedDistrictId: string;
  readonly completedDistrictIds: ReadonlySet<string>;
  readonly selectedDistrictComplete: number;
  readonly selectedDistrictTotal: number;
  readonly webglSupported: boolean;
  readonly worldVisible: boolean;
  readonly animationPaused: boolean;
  readonly reducedMotion: boolean;
  readonly onToggleWorld: () => void;
  readonly onToggleAnimation: () => void;
}

export function WorldPanel({
  avatar,
  districts,
  selectedDistrictId,
  completedDistrictIds,
  selectedDistrictComplete,
  selectedDistrictTotal,
  webglSupported,
  worldVisible,
  animationPaused,
  reducedMotion,
  onToggleWorld,
  onToggleAnimation,
}: WorldPanelProps) {
  const selectedDistrict = districts.find(
    (district) => district.id === selectedDistrictId,
  );
  const districtIds = useMemo(
    () => districts.map((district) => district.id),
    [districts],
  );

  return (
    <section className="scq-world-panel" aria-labelledby="scq-world-title">
      <div className="scq-world-panel__heading">
        <div>
          <p className="scq-eyebrow">Live system view</p>
          <h2 id="scq-world-title">Campus restoration map</h2>
        </div>
        <div className="scq-inline-actions">
          <button
            type="button"
            className="scq-button scq-button--quiet"
            aria-pressed={!worldVisible || !webglSupported}
            onClick={onToggleWorld}
            disabled={!webglSupported}
          >
            Text-only world
          </button>
          <button
            type="button"
            className="scq-button scq-button--quiet"
            aria-pressed={animationPaused || reducedMotion}
            onClick={onToggleAnimation}
            disabled={!worldVisible || !webglSupported || reducedMotion}
          >
            Pause world motion
          </button>
        </div>
      </div>

      <p className="scq-world-description">
        <strong>{selectedDistrict?.title ?? 'Quest district'}:</strong>{' '}
        {selectedDistrictComplete} of {selectedDistrictTotal} missions restored.
        {reducedMotion ? ' Motion is paused by your reduced-motion preference.' : ''}
      </p>

      {worldVisible && webglSupported ? (
        <div className="scq-canvas" aria-hidden="true">
          <SceneErrorBoundary>
            <Suspense
              fallback={<p className="scq-world-fallback">Loading the animated world...</p>}
            >
              <LazyQuestWorld
                avatar={avatar}
                districtIds={districtIds}
                selectedDistrictId={selectedDistrictId}
                completedDistrictIds={completedDistrictIds}
                animationPaused={animationPaused || reducedMotion}
              />
            </Suspense>
          </SceneErrorBoundary>
        </div>
      ) : (
        <div className="scq-world-fallback" role="status">
          <p>
            {webglSupported
              ? 'Text-only world is active. Use the quest map to navigate every district.'
              : 'WebGL is unavailable. The complete text quest remains active.'}
          </p>
          <ul>
            {districts.map((district) => (
              <li key={district.id}>
                {district.title}:{' '}
                {completedDistrictIds.has(district.id) ? 'restored' : 'repairs remaining'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
