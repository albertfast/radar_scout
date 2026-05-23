import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AdService } from '../services/AdService';

const DriveShortcutScreen = ({ navigation }: any) => {
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const run = async () => {
        await AdService.showInterstitial('start_driving_basic').catch(() => 'failed');
        if (!active) return;
        navigation.navigate('Home', {
          screen: 'RadarDriveNavigation',
          params: { initialTab: 'Map' },
        });
      };
      run();

      return () => {
        active = false;
      };
    }, [navigation])
  );

  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color="#4ECDC4" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DriveShortcutScreen;
