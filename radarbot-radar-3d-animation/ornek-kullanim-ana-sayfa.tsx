/**
 * Radarbot ana sayfasında animasyonun nasıl çağrıldığı (özet).
 * Kaynak: src/screens/RadarScreen.tsx
 */
import { Dimensions, View, StyleSheet } from 'react-native';
import { RadarAnimation } from './RadarAnimation';

const { width, height: screenHeight } = Dimensions.get('window');
const HOME_RADAR_SIZE = Math.min(width * 0.4, screenHeight * 0.19);

export function AnaSayfaRadarOrnegi() {
  return (
    <View style={[styles.sphereZone, { width: HOME_RADAR_SIZE, height: HOME_RADAR_SIZE }]}>
      <View
        style={[
          styles.radarOuterGlow,
          {
            width: HOME_RADAR_SIZE,
            height: HOME_RADAR_SIZE,
            borderRadius: HOME_RADAR_SIZE / 2,
          },
        ]}
      />
      <RadarAnimation size={HOME_RADAR_SIZE} />
    </View>
  );
}

const styles = StyleSheet.create({
  sphereZone: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  radarOuterGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(255, 82, 82, 0.05)',
    shadowColor: '#FF5252',
    shadowRadius: 50,
    shadowOpacity: 0.2,
  },
});
