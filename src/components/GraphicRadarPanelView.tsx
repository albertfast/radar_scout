import React, { useEffect, useMemo } from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  UIManager,
  useWindowDimensions,
  View,
  ViewProps,
  ViewStyle,
  requireNativeComponent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { EASING_FUNCTIONS } from '../utils/animationConstants';

export interface GraphicRadarPanelViewProps extends ViewProps {
  signalLevel?: number;
  dangerLevel?: number;
  paused?: boolean;
  style?: StyleProp<ViewStyle>;
}

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  opacity: number;
};

const NATIVE_VIEW_NAME = 'RTGraphicRadarPanelView';
const clamp01 = (value: number) => Math.max(0, Math.min(value, 1));

let nativeComponent: React.ComponentType<GraphicRadarPanelViewProps> | null | undefined;

const getNativeComponent = () => {
  if (nativeComponent !== undefined) return nativeComponent;
  if (Platform.OS !== 'android') {
    nativeComponent = null;
    return nativeComponent;
  }

  const config = UIManager.getViewManagerConfig?.(NATIVE_VIEW_NAME);
  if (!config) {
    nativeComponent = null;
    return nativeComponent;
  }

  nativeComponent = requireNativeComponent<GraphicRadarPanelViewProps>(NATIVE_VIEW_NAME);
  return nativeComponent;
};

const seededRandom = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

const buildParticles = (
  panelWidth: number,
  panelHeight: number,
  signalLevel: number,
  dangerLevel: number
): Particle[] => {
  const signal = clamp01(signalLevel);
  const danger = clamp01(dangerLevel);
  const count = 58 + Math.round(signal * 42);
  const cx = panelWidth * 0.56;
  const cy = panelHeight * 0.55;
  const rx = panelWidth * 0.27;
  const ry = panelHeight * 0.24;

  return Array.from({ length: count }, (_, index) => {
    const angle = seededRandom(index + 4) * Math.PI * 2;
    const distance = Math.pow(0.16 + seededRandom(index + 11) * 0.84, 0.72);
    const depth = seededRandom(index + 23);
    const isDanger = seededRandom(index + 41) < 0.12 + danger * 0.45;
    const size = 2.2 + seededRandom(index + 77) * 4 + depth * 2.4;

    return {
      id: index,
      x: cx + Math.cos(angle) * rx * distance,
      y: cy + Math.sin(angle) * ry * distance + (depth - 0.5) * panelHeight * 0.12,
      size,
      color: isDanger ? '#FF6BCE' : '#23E8C6',
      opacity: 0.38 + depth * 0.58,
    };
  });
};

const GraphicRadarPanelFallback = ({
  signalLevel = 0.55,
  dangerLevel = 0.15,
  paused = false,
  style,
}: GraphicRadarPanelViewProps) => {
  const { width } = useWindowDimensions();
  const panelWidth = Math.max(280, Math.min(width - 64, 520));
  const panelHeight = 230;
  const particles = useMemo(
    () => buildParticles(panelWidth, panelHeight, signalLevel, dangerLevel),
    [dangerLevel, panelHeight, panelWidth, signalLevel]
  );
  const sweep = useSharedValue(0);
  const pulse = useSharedValue(0);
  const orbit = useSharedValue(0);

  useEffect(() => {
    if (paused) {
      cancelAnimation(sweep);
      cancelAnimation(pulse);
      cancelAnimation(orbit);
      return;
    }

    sweep.value = withRepeat(
      withTiming(360, { duration: 3600, easing: EASING_FUNCTIONS.LINEAR }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 1900, easing: EASING_FUNCTIONS.QUAD_IN_OUT }),
      -1,
      true
    );
    orbit.value = withRepeat(
      withTiming(360, { duration: 6800, easing: EASING_FUNCTIONS.LINEAR }),
      -1,
      false
    );
  }, [orbit, paused, pulse, sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sweep.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.22 + pulse.value * 0.18,
    transform: [{ scale: 0.9 + pulse.value * 0.08 }],
  }));

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value}deg` }],
  }));

  return (
    <View style={[fallbackStyles.container, { minHeight: panelHeight }, style]}>
      <LinearGradient
        colors={['#05091A', '#071223', '#030817']}
        style={StyleSheet.absoluteFill}
      />
      <View style={fallbackStyles.tealGlow} />
      <View style={fallbackStyles.redGlow} />
      <View style={fallbackStyles.gridPlane}>
        {Array.from({ length: 11 }, (_, index) => (
          <View
            key={`vertical-${index}`}
            style={[
              fallbackStyles.gridLine,
              {
                left: `${index * 10}%`,
                transform: [
                  { rotate: `${(index - 5) * 4}deg` },
                  { scaleY: 1.7 },
                ],
              },
            ]}
          />
        ))}
        {Array.from({ length: 7 }, (_, index) => (
          <View
            key={`horizontal-${index}`}
            style={[
              fallbackStyles.gridBand,
              {
                top: `${index * 15}%`,
                opacity: 0.16 - index * 0.012,
              },
            ]}
          />
        ))}
      </View>

      <Animated.View
        style={[
          fallbackStyles.radarDisk,
          {
            width: panelWidth * 0.64,
            height: panelWidth * 0.64,
            borderRadius: (panelWidth * 0.64) / 2,
            left: panelWidth * 0.24,
            top: panelHeight * 0.02,
          },
          pulseStyle,
        ]}
      >
        <View style={fallbackStyles.sphereLineWide} />
        <View style={fallbackStyles.sphereLineMid} />
        <View style={fallbackStyles.sphereLineTight} />
      </Animated.View>

      <View
        style={[
          fallbackStyles.orbitPlane,
          {
            width: panelWidth * 0.72,
            height: panelHeight * 0.56,
            left: panelWidth * 0.18,
            top: panelHeight * 0.26,
          },
        ]}
      >
        <View style={fallbackStyles.orbitRingLarge} />
        <View style={fallbackStyles.orbitRingMedium} />
        <View style={fallbackStyles.orbitRingSmall} />
        <Animated.View style={[fallbackStyles.rotatingLayer, orbitStyle]}>
          {particles.map((particle) => (
            <View
              key={particle.id}
              style={[
                fallbackStyles.particle,
                {
                  width: particle.size,
                  height: particle.size,
                  borderRadius: particle.size / 2,
                  left: particle.x - panelWidth * 0.18,
                  top: particle.y - panelHeight * 0.26,
                  backgroundColor: particle.color,
                  opacity: particle.opacity,
                  shadowColor: particle.color,
                },
              ]}
            />
          ))}
        </Animated.View>
        <Animated.View style={[fallbackStyles.sweep, sweepStyle]}>
          <LinearGradient
            colors={['rgba(35,232,198,0)', 'rgba(35,232,198,0.18)', 'rgba(35,232,198,0.75)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={fallbackStyles.sweepBeam}
          />
        </Animated.View>
        <View style={fallbackStyles.centerGlow} />
        <View style={fallbackStyles.centerDot} />
      </View>
    </View>
  );
};

const GraphicRadarPanelView = (props: GraphicRadarPanelViewProps) => {
  const NativeGraphicRadarPanelView = getNativeComponent();
  if (NativeGraphicRadarPanelView) {
    return <NativeGraphicRadarPanelView {...props} />;
  }

  return <GraphicRadarPanelFallback {...props} />;
};

const fallbackStyles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#05091A',
  },
  tealGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    left: -90,
    top: 20,
    backgroundColor: 'rgba(35,232,198,0.16)',
  },
  redGlow: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    right: -90,
    bottom: -80,
    backgroundColor: 'rgba(255,82,82,0.14)',
  },
  gridPlane: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -12,
    height: 110,
    opacity: 0.62,
    transform: [{ scaleY: 0.58 }],
  },
  gridLine: {
    position: 'absolute',
    bottom: -20,
    width: 1,
    height: 155,
    backgroundColor: 'rgba(56,189,248,0.2)',
  },
  gridBand: {
    position: 'absolute',
    left: -20,
    right: -20,
    height: 1,
    backgroundColor: 'rgba(56,189,248,0.34)',
  },
  radarDisk: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(35,232,198,0.22)',
    backgroundColor: 'rgba(3,8,20,0.72)',
  },
  sphereLineWide: {
    position: 'absolute',
    left: '13%',
    right: '13%',
    top: '47%',
    height: '22%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(35,232,198,0.28)',
  },
  sphereLineMid: {
    position: 'absolute',
    left: '25%',
    right: '25%',
    top: '20%',
    bottom: '20%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.18)',
    transform: [{ rotate: '18deg' }],
  },
  sphereLineTight: {
    position: 'absolute',
    left: '38%',
    right: '38%',
    top: '12%',
    bottom: '12%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(35,232,198,0.18)',
    transform: [{ rotate: '-22deg' }],
  },
  orbitPlane: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitRingLarge: {
    position: 'absolute',
    width: '94%',
    height: '58%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(35,232,198,0.28)',
  },
  orbitRingMedium: {
    position: 'absolute',
    width: '66%',
    height: '36%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,179,71,0.24)',
  },
  orbitRingSmall: {
    position: 'absolute',
    width: '38%',
    height: '20%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(35,232,198,0.42)',
  },
  rotatingLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.88,
    shadowRadius: 8,
    elevation: 5,
  },
  sweep: {
    position: 'absolute',
    width: '78%',
    height: '78%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sweepBeam: {
    width: '58%',
    height: 9,
    borderRadius: 5,
    marginLeft: '32%',
  },
  centerGlow: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(35,232,198,0.18)',
  },
  centerDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#23E8C6',
    shadowColor: '#23E8C6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
});

export default GraphicRadarPanelView;
