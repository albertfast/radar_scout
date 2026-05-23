import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedProps, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Circle, Path } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Premium 3D radar animation for the Trial screen.
 * Three.js is loaded lazily via require() to prevent startup crashes.
 * If three.js fails to load, renders an empty transparent view.
 */

let CanvasComponent: any = null;
let useFrameHook: any = null;
let THREE: any = null;
let threeLoaded = false;
let loadFailed = false;

const tryLoadThree = () => {
  if (threeLoaded || loadFailed) return threeLoaded;
  try {
    const fiber = require('@react-three/fiber/native');
    const three = require('three');
    CanvasComponent = fiber.Canvas;
    useFrameHook = fiber.useFrame;
    THREE = three;
    threeLoaded = true;
  } catch (e) {
    loadFailed = true;
    console.warn('Trial3DAnimation: three.js failed to load:', e);
  }
  return threeLoaded;
};

const RadarGlobe = () => {
  const globeRef = React.useRef<any>(null);
  const sweepRef = React.useRef<any>(null);
  const pulseRef1 = React.useRef<any>(null);
  const pulseRef2 = React.useRef<any>(null);
  const particlesRef = React.useRef<any>(null);

  const particleData = React.useMemo(() => {
    const particles: Array<{ pos: [number, number, number]; color: string; size: number }> = [];
    // Distribute particles like POIs on a radar
    for (let i = 0; i < 45; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 1.8;
      const isDanger = Math.random() < 0.15;
      const isWarning = Math.random() < 0.25;
      
      let color = '#00F7E6'; // default cyan
      if (isDanger) color = '#FF3B30'; // Red
      else if (isWarning) color = '#FFCC00'; // Yellow
      
      particles.push({
        pos: [
          r * Math.cos(theta),
          (Math.random() - 0.5) * 0.4, // slight height variation
          r * Math.sin(theta),
        ],
        color,
        size: 0.05 + Math.random() * 0.06,
      });
    }
    return particles;
  }, []);

  if (!useFrameHook) return null;
  const useFrame = useFrameHook;

  useFrame((state: any, delta: number) => {
    const t = state.clock.getElapsedTime();
    if (globeRef.current) globeRef.current.rotation.y = t * 0.1;
    if (sweepRef.current) sweepRef.current.rotation.y = -t * 2.5; // Fast sweep
    
    // Pulsing concentric rings
    if (pulseRef1.current) {
      const scale = 1 + (t % 2);
      pulseRef1.current.scale.set(scale, scale, scale);
      pulseRef1.current.material.opacity = Math.max(0, 0.4 - (t % 2) * 0.2);
    }
    if (pulseRef2.current) {
      const scale = 1 + ((t + 1) % 2);
      pulseRef2.current.scale.set(scale, scale, scale);
      pulseRef2.current.material.opacity = Math.max(0, 0.4 - ((t + 1) % 2) * 0.2);
    }
  });

  return (
    <>
      {/* Dynamic Lighting */}
      <ambientLight intensity={0.6} color="#0B1A2C" />
      <directionalLight position={[0, 10, 0]} intensity={1.5} color="#00F7E6" />
      <pointLight position={[0, 1, 0]} intensity={2.5} color="#00F7E6" distance={5} />
      <pointLight position={[0, -1, 0]} intensity={1.5} color="#005A70" distance={8} />

      {/* Main Radar Angle Setup */}
      <group rotation={[0.4, 0, 0]}>
        {/* Base Grid / Radar Plate */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <cylinderGeometry args={[2.5, 2.5, 0.05, 64]} />
          <meshStandardMaterial color="#04121F" metalness={0.8} roughness={0.2} transparent opacity={0.8} />
        </mesh>
        
        {/* Outer Ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <ringGeometry args={[2.4, 2.5, 64]} />
          <meshBasicMaterial color="#00F7E6" transparent opacity={0.4} />
        </mesh>

        {/* Inner Rings */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <ringGeometry args={[1.5, 1.52, 64]} />
          <meshBasicMaterial color="#00F7E6" transparent opacity={0.2} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <ringGeometry args={[0.75, 0.77, 64]} />
          <meshBasicMaterial color="#00F7E6" transparent opacity={0.2} />
        </mesh>

        {/* Pulse Rings */}
        <mesh ref={pulseRef1} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.95, 1.0, 64]} />
          <meshBasicMaterial color="#00F7E6" transparent opacity={0.4} />
        </mesh>
        <mesh ref={pulseRef2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.95, 1.0, 64]} />
          <meshBasicMaterial color="#00F7E6" transparent opacity={0.4} />
        </mesh>

        {/* Radar Sweep Effect (Cone intersecting the plate) */}
        <group ref={sweepRef}>
          <mesh position={[1.25, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
             <circleGeometry args={[2.5, 32, 0, Math.PI / 4]} />
             <meshBasicMaterial color="#00F7E6" transparent opacity={0.15} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
          {/* Sweep scanner line */}
          <mesh position={[1.25, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
             <planeGeometry args={[2.5, 0.05]} />
             <meshBasicMaterial color="#00F7E6" transparent opacity={0.8} />
          </mesh>
        </group>

        {/* Center Glowing Core */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.15, 32, 32]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#00F7E6" emissiveIntensity={2.5} />
        </mesh>

        {/* 3D POI Particles (Threats/Cameras) */}
        <group ref={particlesRef}>
          {particleData.map((p, i) => (
            <group key={`p-${i}`} position={p.pos}>
              {/* Particle Core */}
              <mesh>
                <sphereGeometry args={[p.size, 12, 12]} />
                <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={1.5} />
              </mesh>
              {/* Particle Glow (Torus) */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[p.size * 2, p.size * 0.2, 8, 24]} />
                <meshBasicMaterial color={p.color} transparent opacity={0.4} />
              </mesh>
              {/* Vertical pin line */}
              <mesh position={[0, -0.2, 0]}>
                 <cylinderGeometry args={[0.01, 0.01, 0.4, 8]} />
                 <meshBasicMaterial color={p.color} transparent opacity={0.6} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </>
  );
};

const Trial3DAnimation = () => {
  const [threeReady, setThreeReady] = React.useState(false);

  useEffect(() => {
    if (tryLoadThree()) {
      setThreeReady(true);
    }
  }, []);

  if (!threeReady || !CanvasComponent) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <CanvasComponent style={{ flex: 1, width: '100%', height: '100%' }}>
        <RadarGlobe />
      </CanvasComponent>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
});

export default Trial3DAnimation;
