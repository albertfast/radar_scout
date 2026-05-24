import React from 'react';
import { UIManager, ViewProps, requireNativeComponent, View } from 'react-native';
import { logWarn } from '../utils/logger';

export type RadarLifeThemeVariant = 'contour_orbit';

export interface RadarLife3DViewProps extends ViewProps {
  rotationSpeed?: number;
  pulseEnabled?: boolean;
  signalLevel?: number;
  dangerLevel?: number;
  themeVariant?: RadarLifeThemeVariant;
  paused?: boolean;
}

const NATIVE_VIEW_NAME = 'RTRadarLife3DView';
const NATIVE_COMPONENT_CACHE_KEY = '__RT_NATIVE_COMPONENT_RTRadarLife3DView__';
let nativeComponent: React.ComponentType<RadarLife3DViewProps> | undefined;

const getNativeComponent = () => {
  if (nativeComponent) return nativeComponent;
  const globalCache = globalThis as unknown as Record<string, unknown>;
  const cachedGlobal = globalCache[NATIVE_COMPONENT_CACHE_KEY] as
    | React.ComponentType<RadarLife3DViewProps>
    | undefined;
  if (cachedGlobal) {
    nativeComponent = cachedGlobal;
    return nativeComponent;
  }

  const config = UIManager.getViewManagerConfig?.(NATIVE_VIEW_NAME);
  if (!config) {
    return null;
  }

  nativeComponent = requireNativeComponent<RadarLife3DViewProps>(NATIVE_VIEW_NAME);
  globalCache[NATIVE_COMPONENT_CACHE_KEY] = nativeComponent;
  return nativeComponent;
};

import RadarLife3DFallback from './RadarLife3DFallback';

const RadarLife3DView = (props: RadarLife3DViewProps) => {
  const NativeRadarLife3DView = getNativeComponent();

  if (NativeRadarLife3DView) {
    return <NativeRadarLife3DView {...props} />;
  }

  // Fallback: visible RN/Reanimated radar when native 3D view is unavailable.
  return <RadarLife3DFallback {...props} />;
};

export default RadarLife3DView;
