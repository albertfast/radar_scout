'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Theme color palettes                                               */
/* ------------------------------------------------------------------ */
const PALETTES = {
  dark: {
    particles: [
      new THREE.Color('#7C3AED'),
      new THREE.Color('#A855F7'),
      new THREE.Color('#C084FC'),
      new THREE.Color('#06B6D4'),
    ],
    lineColor: new THREE.Color('#7C3AED'),
    lineOpacity: 0.12,
    particleOpacity: 0.85,
    orbOpacity: 0.12,
    bgAlpha: 0.7,
  },
  light: {
    particles: [
      new THREE.Color('#A78BFA'),
      new THREE.Color('#818CF8'),
      new THREE.Color('#93C5FD'),
      new THREE.Color('#67E8F9'),
    ],
    lineColor: new THREE.Color('#A78BFA'),
    lineOpacity: 0.06,
    particleOpacity: 0.5,
    orbOpacity: 0.06,
    bgAlpha: 0.4,
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const PARTICLE_COUNT = 100;
const CONNECTION_DISTANCE = 2.2;
const MAX_CONNECTIONS = 180;
const BOUNDS = { x: 7, y: 7, z: 5 };
const EPS = 0.0001;

/* ------------------------------------------------------------------ */
/*  Helper – build a single rounded‑sphere geometry (re‑used)         */
/* ------------------------------------------------------------------ */
const _sphereGeo = new THREE.SphereGeometry(1, 8, 6);
const _dummy = new THREE.Object3D();

function createParticleState() {
  const pos = new Float32Array(PARTICLE_COUNT * 3);
  const vel = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const i3 = i * 3;
    pos[i3] = (Math.random() - 0.5) * BOUNDS.x * 2;
    pos[i3 + 1] = (Math.random() - 0.5) * BOUNDS.y * 2;
    pos[i3 + 2] = (Math.random() - 0.5) * BOUNDS.z * 2;
    vel[i3] = (Math.random() - 0.5) * 0.005;
    vel[i3 + 1] = (Math.random() - 0.5) * 0.005;
    vel[i3 + 2] = (Math.random() - 0.5) * 0.003;
  }
  return { positions: pos, velocities: vel };
}

/* ------------------------------------------------------------------ */
/*  Particle Field (scene contents)                                    */
/* ------------------------------------------------------------------ */
function ParticleField({
  theme,
}: {
  theme: 'dark' | 'light';
}) {
  const instancedRef = useRef<THREE.InstancedMesh>(null!);
  const linesRef = useRef<THREE.LineSegments>(null!);
  const palette = PALETTES[theme];

  /* ---- mutable particle state ---- */
  const particleStateRef = useRef<ReturnType<typeof createParticleState> | null>(null);
  useEffect(() => {
    particleStateRef.current = createParticleState();
  }, []);

  /* ---- immutable per‑particle properties ---- */
  const { colors, scales, phases } = useMemo(() => {
    const c = new Float32Array(PARTICLE_COUNT * 3);
    const s = new Float32Array(PARTICLE_COUNT);
    const p = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const col = palette.particles[Math.floor(Math.random() * palette.particles.length)];
      c[i * 3] = col.r;
      c[i * 3 + 1] = col.g;
      c[i * 3 + 2] = col.b;
      s[i] = 0.02 + Math.random() * 0.04;
      p[i] = Math.random() * Math.PI * 2;
    }
    return { colors: c, scales: s, phases: p };
  }, [palette]);

  /* ---- line geometry (pre‑allocated) ---- */
  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_CONNECTIONS * 6); // 2 vertices per line
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  /* ---- material (recreated on theme change) ---- */
  const particleMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: palette.particleOpacity,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [palette.particleOpacity],
  );

  const lineMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: palette.lineColor,
        transparent: true,
        opacity: palette.lineOpacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [palette.lineColor, palette.lineOpacity],
  );

  /* ---- animation loop ---- */
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const particleState = particleStateRef.current;
    const mesh = instancedRef.current;
    const lines = linesRef.current;
    if (!mesh || !lines || !particleState) return;
    const { positions, velocities } = particleState;

    /* update positions + set matrices */
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // gentle drift
      positions[i3] += velocities[i3];
      positions[i3 + 1] += velocities[i3 + 1];
      positions[i3 + 2] += velocities[i3 + 2];

      // soft boundary bounce
      if (Math.abs(positions[i3]) > BOUNDS.x) velocities[i3] *= -1;
      if (Math.abs(positions[i3 + 1]) > BOUNDS.y) velocities[i3 + 1] *= -1;
      if (Math.abs(positions[i3 + 2]) > BOUNDS.z) velocities[i3 + 2] *= -1;

      // pulse scale
      const pulse = 1 + Math.sin(t * 0.8 + phases[i]) * 0.3;
      const s = scales[i] * pulse;

      _dummy.position.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
      _dummy.scale.setScalar(Math.max(EPS, s));
      _dummy.updateMatrix();
      mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    /* overall slow rotation */
    mesh.rotation.y = t * 0.015;

    /* ---- compute connections ---- */
    const linePos = lines.geometry.attributes.position.array as Float32Array;
    let lineIdx = 0;

    for (let i = 0; i < PARTICLE_COUNT && lineIdx < MAX_CONNECTIONS; i++) {
      const ix = positions[i * 3];
      const iy = positions[i * 3 + 1];
      const iz = positions[i * 3 + 2];

      for (let j = i + 1; j < PARTICLE_COUNT && lineIdx < MAX_CONNECTIONS; j++) {
        const jx = positions[j * 3];
        const jy = positions[j * 3 + 1];
        const jz = positions[j * 3 + 2];

        const dx = ix - jx;
        const dy = iy - jy;
        const dz = iz - jz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < CONNECTION_DISTANCE) {
          const base = lineIdx * 6;
          linePos[base] = ix;
          linePos[base + 1] = iy;
          linePos[base + 2] = iz;
          linePos[base + 3] = jx;
          linePos[base + 4] = jy;
          linePos[base + 5] = jz;
          lineIdx++;
        }
      }
    }

    lines.geometry.setDrawRange(0, lineIdx * 2);
    (lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    /* sync line rotation with particles */
    lines.rotation.y = t * 0.015;
  });

  /* set instance colors whenever mesh or colors are ready */
  useEffect(() => {
    const mesh = instancedRef.current;
    if (!mesh) return;
    const colorObj = new THREE.Color();
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      colorObj.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]);
      mesh.setColorAt(i, colorObj);
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [colors]);

  return (
    <>
      <instancedMesh
        ref={instancedRef}
        args={[_sphereGeo, particleMaterial, PARTICLE_COUNT]}
        frustumCulled={false}
      />
      <lineSegments
        ref={linesRef}
        geometry={lineGeometry}
        material={lineMaterial}
        frustumCulled={false}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Ambient Glow Orbs (background atmosphere)                          */
/* ------------------------------------------------------------------ */
function AmbientOrb({
  position,
  color,
  speed,
  opacity,
}: {
  position: [number, number, number];
  color: string;
  speed: number;
  opacity: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.x = position[0] + Math.sin(t * speed) * 1.2;
    ref.current.position.y = position[1] + Math.cos(t * speed * 0.7) * 0.8;
    ref.current.scale.setScalar(1 + Math.sin(t * speed * 1.5) * 0.15);
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[1, 12, 10]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Main exported component                                            */
/* ------------------------------------------------------------------ */
interface ThreeBackgroundProps {
  theme?: 'dark' | 'light';
}

function ThreeBackgroundInner({ theme = 'dark' }: ThreeBackgroundProps) {
  const p = PALETTES[theme];

  const orbs = useMemo(
    () => [
      { position: [-3.5, 2.5, -3] as [number, number, number], color: '#7C3AED', speed: 0.2 },
      { position: [3, -2, -2] as [number, number, number], color: '#06B6D4', speed: 0.25 },
      { position: [0, 3.5, -4] as [number, number, number], color: '#A855F7', speed: 0.18 },
    ],
    [],
  );

  return (
    <div
      className="fixed inset-0 z-0"
      style={{ pointerEvents: 'none', opacity: p.bgAlpha }}
    >
      <Canvas
        camera={{ position: [0, 0, 7], fov: 55 }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: 'low-power',
        }}
        dpr={[1, 1.5]}
        style={{ background: 'transparent' }}
        frameloop="always"
      >
        <ParticleField theme={theme} />
        {orbs.map((orb) => (
          <AmbientOrb
            key={orb.color + orb.position[0]}
            position={orb.position}
            color={orb.color}
            speed={orb.speed}
            opacity={p.orbOpacity}
          />
        ))}
      </Canvas>
    </div>
  );
}

const ThreeBackground = React.memo(ThreeBackgroundInner);
export default ThreeBackground;
