import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import type { StudentAvatarProfile } from '../adapters/avatarProfile';

interface QuestWorldProps {
  readonly avatar: StudentAvatarProfile;
  readonly districtIds: readonly string[];
  readonly selectedDistrictId: string;
  readonly completedDistrictIds: ReadonlySet<string>;
  readonly animationPaused: boolean;
}

interface QuestPalette {
  readonly background: string;
  readonly surface: string;
  readonly surfaceMuted: string;
  readonly primary: string;
  readonly accent: string;
  readonly success: string;
  readonly lighting: string;
}

type WorldPosition = readonly [number, number, number];

function createDistrictPositions(districtIds: readonly string[]): readonly WorldPosition[] {
  const outerDistrictCount = Math.max(districtIds.length - 1, 0);
  return districtIds.map((_, index) => {
    if (outerDistrictCount === 0 || index === districtIds.length - 1) {
      return [0, 0, -0.2] as const;
    }
    const angle = Math.PI + (index / outerDistrictCount) * Math.PI * 2;
    return [Math.cos(angle) * 4.25, 0, Math.sin(angle) * 2.35] as const;
  });
}

function readQuestPalette(): QuestPalette {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    background: token('--color-bg', '#fdfdfd'),
    surface: token('--color-surface', '#ffffff'),
    surfaceMuted: token('--color-surface-2', '#f8f9fa'),
    primary: token('--color-primary', '#2774ae'),
    accent: token('--color-accent', '#ffd100'),
    success: token('--color-success', '#1f7a3d'),
    lighting: '#ffffff',
  };
}

function useQuestPalette() {
  const [palette, setPalette] = useState(readQuestPalette);

  useEffect(() => {
    const observer = new MutationObserver(() => setPalette(readQuestPalette()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return palette;
}

function hairScale(hairStyle: string): [number, number, number] {
  if (hairStyle.includes('long') || hairStyle.includes('afro')) return [0.66, 0.34, 0.63];
  if (hairStyle.includes('mohawk') || hairStyle.includes('spike')) return [0.45, 0.48, 0.46];
  if (hairStyle.includes('bald') || hairStyle.includes('none')) return [0.01, 0.01, 0.01];
  return [0.55, 0.25, 0.53];
}

function bodyScale(bodyType: string): [number, number, number] {
  if (bodyType.includes('strong') || bodyType.includes('power')) return [1.18, 1, 1.08];
  if (bodyType.includes('slim') || bodyType.includes('agile')) return [0.84, 1.04, 0.9];
  return [1, 1, 1];
}

function StudentAvatar({ avatar }: { readonly avatar: StudentAvatarProfile }) {
  const scale = bodyScale(avatar.bodyType);
  const isBruin = avatar.kind === 'bruin';
  const hasCape = !avatar.outfitStyle.includes('casual');

  return (
    <group scale={scale}>
      <mesh position={[-0.19, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.42, 8, 12]} />
        <meshStandardMaterial color={avatar.suitColor} roughness={0.72} />
      </mesh>
      <mesh position={[0.19, 0.42, 0]} castShadow>
        <capsuleGeometry args={[0.11, 0.42, 8, 12]} />
        <meshStandardMaterial color={avatar.suitColor} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.12, 0]} castShadow>
        <capsuleGeometry args={[0.37, 0.62, 10, 16]} />
        <meshStandardMaterial color={avatar.suitColor} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.19, 0.35]} castShadow>
        <circleGeometry args={[0.15, 24]} />
        <meshStandardMaterial color={avatar.accentColor} roughness={0.55} />
      </mesh>
      {hasCape ? (
        <mesh position={[0, 1.12, -0.31]} rotation={[-0.16, 0, 0]} castShadow>
          <boxGeometry args={[0.64, 0.92, 0.05]} />
          <meshStandardMaterial color={avatar.capeColor} roughness={0.78} />
        </mesh>
      ) : null}
      <mesh position={[-0.48, 1.18, 0]} rotation={[0, 0, -0.22]} castShadow>
        <capsuleGeometry args={[0.09, 0.52, 8, 12]} />
        <meshStandardMaterial color={avatar.skinColor} roughness={0.72} />
      </mesh>
      <mesh position={[0.48, 1.18, 0]} rotation={[0, 0, 0.22]} castShadow>
        <capsuleGeometry args={[0.09, 0.52, 8, 12]} />
        <meshStandardMaterial color={avatar.skinColor} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.93, 0]} castShadow>
        <sphereGeometry args={[0.4, 24, 18]} />
        <meshStandardMaterial color={avatar.skinColor} roughness={0.8} />
      </mesh>
      {isBruin ? (
        <>
          <mesh position={[-0.34, 2.22, 0]} castShadow>
            <sphereGeometry args={[0.17, 16, 12]} />
            <meshStandardMaterial color={avatar.hairColor} roughness={0.85} />
          </mesh>
          <mesh position={[0.34, 2.22, 0]} castShadow>
            <sphereGeometry args={[0.17, 16, 12]} />
            <meshStandardMaterial color={avatar.hairColor} roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.82, 0.34]} castShadow>
            <sphereGeometry args={[0.2, 18, 12]} />
            <meshStandardMaterial color={avatar.skinColor} roughness={0.85} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, 2.2, -0.02]} scale={hairScale(avatar.hairStyle)} castShadow>
          <sphereGeometry args={[0.72, 22, 14]} />
          <meshStandardMaterial color={avatar.hairColor} roughness={0.86} />
        </mesh>
      )}
      <mesh position={[-0.14, 1.99, 0.36]}>
        <sphereGeometry args={[0.045, 12, 8]} />
        <meshStandardMaterial color={avatar.eyeColor} roughness={0.5} />
      </mesh>
      <mesh position={[0.14, 1.99, 0.36]}>
        <sphereGeometry args={[0.045, 12, 8]} />
        <meshStandardMaterial color={avatar.eyeColor} roughness={0.5} />
      </mesh>
    </group>
  );
}

function DistrictPlatform({
  position,
  stateColor,
  selected,
}: {
  readonly position: readonly [number, number, number];
  readonly stateColor: string;
  readonly selected: boolean;
}) {
  return (
    <group position={position}>
      <mesh receiveShadow position={[0, -0.25, 0]}>
        <cylinderGeometry args={[selected ? 1.08 : 0.82, selected ? 1.18 : 0.92, 0.45, 28]} />
        <meshStandardMaterial color={stateColor} roughness={0.76} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.15, 0]} castShadow>
        <octahedronGeometry args={[selected ? 0.27 : 0.19, 0]} />
        <meshStandardMaterial
          color={stateColor}
          emissive={stateColor}
          emissiveIntensity={selected ? 0.3 : 0}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

function WorldScene({
  avatar,
  districtIds,
  selectedDistrictId,
  completedDistrictIds,
  animationPaused,
  palette,
}: QuestWorldProps & { readonly palette: QuestPalette }) {
  const scene = useRef<Group>(null);
  const avatarGroup = useRef<Group>(null);
  const districtPositions = useMemo(
    () => createDistrictPositions(districtIds),
    [districtIds],
  );
  const selectedIndex = districtIds.indexOf(selectedDistrictId);
  const selectedPosition = districtPositions[selectedIndex] ?? ([0, 0, -0.2] as const);

  useFrame(({ clock }) => {
    if (animationPaused) return;
    const elapsed = clock.getElapsedTime();
    if (scene.current) scene.current.rotation.y = Math.sin(elapsed * 0.12) * 0.035;
    if (avatarGroup.current) avatarGroup.current.position.y = Math.sin(elapsed * 1.2) * 0.045;
  });

  return (
    <>
      <ambientLight intensity={1.1} color={palette.lighting} />
      <directionalLight
        castShadow
        color={palette.lighting}
        intensity={2.4}
        position={[4, 8, 6]}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight color={palette.accent} intensity={9} distance={9} position={[0, 3.8, 0]} />
      <group ref={scene}>
        {districtIds.map((districtId, index) => {
          const selected = districtId === selectedDistrictId;
          const completed = completedDistrictIds.has(districtId);
          return (
            <DistrictPlatform
              key={districtId}
              position={districtPositions[index] ?? ([0, 0, -0.2] as const)}
              selected={selected}
              stateColor={completed ? palette.success : selected ? palette.accent : palette.primary}
            />
          );
        })}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 0]} receiveShadow>
          <circleGeometry args={[7.1, 64]} />
          <meshStandardMaterial color={palette.surfaceMuted} roughness={0.98} />
        </mesh>
        <group
          ref={avatarGroup}
          position={[selectedPosition[0], 0.12, selectedPosition[2]]}
          rotation={[0, selectedIndex % 2 === 0 ? 0.18 : -0.18, 0]}
        >
          <StudentAvatar avatar={avatar} />
        </group>
      </group>
    </>
  );
}

export function QuestWorld(props: QuestWorldProps) {
  const palette = useQuestPalette();
  const camera = useMemo(() => ({ position: [0, 6.7, 10.8] as const, fov: 42 }), []);

  return (
    <Canvas
      camera={camera}
      dpr={[1, 1.5]}
      frameloop={props.animationPaused ? 'demand' : 'always'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      shadows
    >
      <fog attach="fog" args={[palette.background, 10, 19]} />
      <WorldScene {...props} palette={palette} />
    </Canvas>
  );
}
