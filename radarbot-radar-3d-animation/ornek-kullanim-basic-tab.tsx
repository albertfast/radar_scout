/**
 * "Basic" sekmesinde arka planda aynı animasyon (daha küçük boyut).
 * Kaynak: src/screens/components/RadarBasicView.tsx
 */
import { Dimensions, View } from 'react-native';
import { RadarAnimation } from './RadarAnimation';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const RADAR_BG_SIZE = Math.min(SCREEN_W * 0.5, SCREEN_H * 0.2);

export function BasicTabRadarOrnegi() {
  return (
    <View style={{ position: 'absolute', alignSelf: 'center', opacity: 0.85 }}>
      <RadarAnimation size={RADAR_BG_SIZE} />
    </View>
  );
}
