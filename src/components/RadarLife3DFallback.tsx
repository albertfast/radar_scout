import React from 'react';
import { View } from 'react-native';
import type { RadarLife3DViewProps } from './RadarLife3DView';

const RadarLife3DFallback = (props: RadarLife3DViewProps) => {
  return <View style={props.style} />;
};

export default RadarLife3DFallback;
