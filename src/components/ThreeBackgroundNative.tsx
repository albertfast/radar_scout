import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';

type ThemeName = 'dark' | 'light';

const PALETTES = {
  dark: {
    particles: ['#7C3AED', '#A855F7', '#C084FC', '#06B6D4', '#F472B6'],
    orbColors: ['#7C3AED', '#06B6D4', '#F472B6'],
    particleOpacity: 0.85,
    lineOpacity: 0.12,
    bgOpacity: 0.62,
    orbOpacity: 0.15,
  },
  light: {
    particles: ['#A78BFA', '#818CF8', '#93C5FD', '#67E8F9', '#F9A8D4'],
    orbColors: ['#A78BFA', '#67E8F9', '#F9A8D4'],
    particleOpacity: 0.55,
    lineOpacity: 0.06,
    bgOpacity: 0.42,
    orbOpacity: 0.08,
  },
} as const;

export default function ThreeBackgroundNative({ theme }: { theme: ThemeName }) {
  const rafRef = useRef<number | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const palette = useMemo(() => PALETTES[theme], [theme]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <View pointerEvents="none" style={styles.absoluteFill}>
      <GLView
        key={theme}
        style={{ flex: 1, opacity: palette.bgOpacity }}
        onContextCreate={async (gl) => {
          const renderer = new Renderer({ gl });

          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
          camera.position.set(0, 0, 7);

          const width = gl.drawingBufferWidth || 1;
          const height = gl.drawingBufferHeight || 1;
          renderer.setSize(width, height);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();

          // ---------------------------
          // Particle field
          // ---------------------------
          const PARTICLE_COUNT = 128;
          const BOUNDS = { x: 7, y: 7, z: 5 };
          const EPS = 0.0001;

          const positions = new Float32Array(PARTICLE_COUNT * 3);
          const velocities = new Float32Array(PARTICLE_COUNT * 3);
          const scales = new Float32Array(PARTICLE_COUNT);
          const phases = new Float32Array(PARTICLE_COUNT);
          const colors = new Float32Array(PARTICLE_COUNT * 3);

          for (let i = 0; i < PARTICLE_COUNT; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * BOUNDS.x * 2;
            positions[i3 + 1] = (Math.random() - 0.5) * BOUNDS.y * 2;
            positions[i3 + 2] = (Math.random() - 0.5) * BOUNDS.z * 2;

            velocities[i3] = (Math.random() - 0.5) * 0.006;
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.006;
            velocities[i3 + 2] = (Math.random() - 0.5) * 0.003;

            scales[i] = 0.02 + Math.random() * 0.04;
            phases[i] = Math.random() * Math.PI * 2;

            const col = new THREE.Color(palette.particles[Math.floor(Math.random() * palette.particles.length)]);
            colors[i3] = col.r;
            colors[i3 + 1] = col.g;
            colors[i3 + 2] = col.b;
          }

          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

          const material = new THREE.PointsMaterial({
            size: 0.07,
            vertexColors: true,
            transparent: true,
            opacity: palette.particleOpacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });

          const points = new THREE.Points(geometry, material);
          scene.add(points);

          // ---------------------------
          // Ambient orbs
          // ---------------------------
          const orbOpacity = palette.orbOpacity;
          const orbGeo = new THREE.SphereGeometry(1, 14, 10);
          const orbMatA = new THREE.MeshBasicMaterial({
            color: new THREE.Color(palette.orbColors[0]),
            transparent: true,
            opacity: orbOpacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const orbMatB = new THREE.MeshBasicMaterial({
            color: new THREE.Color(palette.orbColors[1]),
            transparent: true,
            opacity: orbOpacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });
          const orbMatC = new THREE.MeshBasicMaterial({
            color: new THREE.Color(palette.orbColors[2]),
            transparent: true,
            opacity: orbOpacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          });

          const orbA = new THREE.Mesh(orbGeo, orbMatA);
          orbA.position.set(-3.5, 2.5, -3);
          const orbB = new THREE.Mesh(orbGeo, orbMatB);
          orbB.position.set(3, -2, -2);
          const orbC = new THREE.Mesh(orbGeo, orbMatC);
          orbC.position.set(0, 3.5, -4);
          scene.add(orbA, orbB, orbC);

          // Floating math / science motifs (wireframe, cheap)
          const decoGroup = new THREE.Group();
          const wireMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color('#67E8F9'),
            transparent: true,
            opacity: theme === 'dark' ? 0.22 : 0.14,
            wireframe: true,
            depthWrite: false,
          });
          const wireMat2 = new THREE.MeshBasicMaterial({
            color: new THREE.Color('#F472B6'),
            transparent: true,
            opacity: theme === 'dark' ? 0.18 : 0.12,
            wireframe: true,
            depthWrite: false,
          });
          const boxGeo = new THREE.BoxGeometry(0.42, 0.42, 0.42);
          const torusGeo = new THREE.TorusGeometry(0.32, 0.08, 8, 20);
          const meshCube = new THREE.Mesh(boxGeo, wireMat);
          meshCube.position.set(-2.2, -1.1, -1.2);
          const meshTorus = new THREE.Mesh(torusGeo, wireMat2);
          meshTorus.position.set(2.4, 1.2, -1.5);
          const meshCube2 = new THREE.Mesh(boxGeo.clone(), wireMat2);
          meshCube2.position.set(0.6, -2.3, -2);
          meshCube2.scale.setScalar(0.72);
          decoGroup.add(meshCube, meshTorus, meshCube2);
          scene.add(decoGroup);

          const t0 = Date.now();
          const animate = () => {
            const t = (Date.now() - t0) / 1000;

            // drift / pulse
            for (let i = 0; i < PARTICLE_COUNT; i++) {
              const i3 = i * 3;
              positions[i3] += velocities[i3];
              positions[i3 + 1] += velocities[i3 + 1];
              positions[i3 + 2] += velocities[i3 + 2];

              if (Math.abs(positions[i3]) > BOUNDS.x) velocities[i3] *= -1;
              if (Math.abs(positions[i3 + 1]) > BOUNDS.y) velocities[i3 + 1] *= -1;
              if (Math.abs(positions[i3 + 2]) > BOUNDS.z) velocities[i3 + 2] *= -1;

              const pulse = 1 + Math.sin(t * 0.8 + phases[i]) * 0.3;
              const s = Math.max(EPS, scales[i] * pulse);
              // scale isn't applied per-point here; we keep it simple for performance.
              // Points size is fixed, so pulse is visually represented by motion/opacity.
              void s;
            }
            geometry.attributes.position.needsUpdate = true;

            // slow rotation
            points.rotation.y = t * 0.02;

            // orb motion
            orbA.position.x = -3.5 + Math.sin(t * 0.22) * 1.35;
            orbA.position.y = 2.5 + Math.cos(t * 0.16) * 0.95;
            orbA.scale.setScalar(1 + Math.sin(t * 0.22) * 0.16);

            orbB.position.x = 3 + Math.sin(t * 0.28) * 1.25;
            orbB.position.y = -2 + Math.cos(t * 0.18) * 0.9;
            orbB.scale.setScalar(1 + Math.sin(t * 0.28) * 0.15);

            orbC.position.x = 0 + Math.sin(t * 0.2) * 1.3;
            orbC.position.y = 3.5 + Math.cos(t * 0.15) * 0.9;
            orbC.scale.setScalar(1 + Math.sin(t * 0.2) * 0.15);

            decoGroup.rotation.y = t * 0.11;
            decoGroup.rotation.x = Math.sin(t * 0.07) * 0.08;
            meshCube.rotation.x = t * 0.5;
            meshCube.rotation.y = t * 0.35;
            meshTorus.rotation.x = t * 0.4;
            meshTorus.rotation.z = t * 0.22;
            meshCube2.rotation.y = -t * 0.44;

            renderer.render(scene, camera);
            gl.endFrameEXP();
            rafRef.current = requestAnimationFrame(animate);
          };

          animate();

          cleanupRef.current = () => {
            try {
              if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
              geometry.dispose();
              material.dispose();
              orbGeo.dispose();
              orbMatA.dispose();
              orbMatB.dispose();
              orbMatC.dispose();
              boxGeo.dispose();
              torusGeo.dispose();
              wireMat.dispose();
              wireMat2.dispose();
              meshCube2.geometry.dispose();
              renderer.dispose();
              (gl as unknown as { destroy?: () => void }).destroy?.();
            } catch {
              // best-effort cleanup
            }
          };
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteFill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
});

