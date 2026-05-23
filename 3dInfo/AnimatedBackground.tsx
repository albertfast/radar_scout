'use client';

import { useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function FloatingParticles({ count = 80 }: { count?: number }) {
  const mesh = useRef<THREE.Points>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const velocitiesRef = useRef<Float32Array | null>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return pos;
  }, [count]);

  useEffect(() => {
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      vel[i * 3] = (Math.random() - 0.5) * 0.008;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.008;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.004;
    }
    velocitiesRef.current = vel;
  }, [count]);

  const colors = useMemo(() => {
    const cols = new Float32Array(count * 3);
    const palette = [
      [0.44, 0.26, 0.95], // violet
      [0.95, 0.35, 0.45], // rose
      [0.45, 0.90, 0.55], // emerald
      [0.98, 0.60, 0.25], // amber
    ];
    for (let i = 0; i < count; i++) {
      const c = palette[Math.floor(Math.random() * palette.length)];
      cols[i * 3] = c[0];
      cols[i * 3 + 1] = c[1];
      cols[i * 3 + 2] = c[2];
    }
    return cols;
  }, [count]);

  useFrame((state) => {
    if (!mesh.current) return;
    const vel = velocitiesRef.current;
    if (!vel) return;
    const posArray = mesh.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      posArray[i * 3] += vel[i * 3];
      posArray[i * 3 + 1] += vel[i * 3 + 1];
      posArray[i * 3 + 2] += vel[i * 3 + 2];

      if (Math.abs(posArray[i * 3]) > 6) vel[i * 3] *= -1;
      if (Math.abs(posArray[i * 3 + 1]) > 6) vel[i * 3 + 1] *= -1;
      if (Math.abs(posArray[i * 3 + 2]) > 4) vel[i * 3 + 2] *= -1;
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
    mesh.current.rotation.y = state.clock.elapsedTime * 0.02;

    if (light.current) {
      light.current.position.x = Math.sin(state.clock.elapsedTime * 0.3) * 3;
      light.current.position.y = Math.cos(state.clock.elapsedTime * 0.2) * 2;
    }
  });

  return (
    <>
      <pointLight ref={light} distance={10} intensity={2} color="#8b5cf6" />
      <points ref={mesh}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            count={count}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
            count={count}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.08}
          vertexColors
          transparent
          opacity={0.7}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </>
  );
}

function GlowingOrb({ position, color, speed }: { position: [number, number, number]; color: string; speed: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.x = position[0] + Math.sin(state.clock.elapsedTime * speed) * 1.5;
    ref.current.position.y = position[1] + Math.cos(state.clock.elapsedTime * speed * 0.7) * 1;
    ref.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * speed * 2) * 0.2);
  });

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.15} />
    </mesh>
  );
}

function ConnectionLines({ count = 40 }: { count?: number }) {
  const ref = useRef<THREE.LineSegments>(null!);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 6);
    for (let i = 0; i < count; i++) {
      pos[i * 6] = (Math.random() - 0.5) * 10;
      pos[i * 6 + 1] = (Math.random() - 0.5) * 10;
      pos[i * 6 + 2] = (Math.random() - 0.5) * 6;
      pos[i * 6 + 3] = pos[i * 6] + (Math.random() - 0.5) * 3;
      pos[i * 6 + 4] = pos[i * 6 + 1] + (Math.random() - 0.5) * 3;
      pos[i * 6 + 5] = pos[i * 6 + 2] + (Math.random() - 0.5) * 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, [count]);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.015;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1;
  });

  return (
    <lineSegments ref={ref} geometry={geometry}>
      <lineBasicMaterial color="#8b5cf6" transparent opacity={0.06} />
    </lineSegments>
  );
}

export default function AnimatedBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" style={{ opacity: 0.6 }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 60 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        dpr={[1, 1.5]}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.3} />
        <FloatingParticles count={60} />
        <ConnectionLines count={25} />
        <GlowingOrb position={[-3, 2, -2]} color="#8b5cf6" speed={0.3} />
        <GlowingOrb position={[3, -1, -1]} color="#f43f5e" speed={0.25} />
        <GlowingOrb position={[0, -3, -3]} color="#10b981" speed={0.2} />
      </Canvas>
    </div>
  );
}
