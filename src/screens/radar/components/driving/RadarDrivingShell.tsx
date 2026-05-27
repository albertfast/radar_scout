import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { RadarAlert } from '../../../../types';
import { formatDistance } from '../../../../utils/format';
import { TabType } from '../../types';
import { radarScreenStyles as styles } from '../../styles/radarScreenStyles';
import {
  formatRadarSpeedLimitText,
  formatRadarTimingText,
  formatRadarTypeLabel,
  getRadarDisplayLocation,
} from '../../../../utils/radarAlerts';

type RadarDrivingShellProps = {
  insetsTop: number;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  canUsePro: boolean;
  onOpenSubscription: () => void;
  onExitHome: () => void;
  onOpenSettings: () => void;
  isNavigationStarted: boolean;
  isMapNavigationActive: boolean;
  activeAlert: RadarAlert | null;
  unitSystem: 'metric' | 'imperial';
  acknowledgeAlert: (id: string) => void;
  routeCoords: any[];
  routeMetaDestinationLabel?: string;
  navInstruction?: string;
  navDistanceLabel?: string;
  hasArrived: boolean;
  onEndTrip: () => void;
  basicContent: React.ReactNode;
  mapContent: React.ReactNode;
  graphicContent: React.ReactNode;
};

export function RadarDrivingShell({
  insetsTop,
  activeTab,
  setActiveTab,
  canUsePro,
  onOpenSubscription,
  onExitHome,
  onOpenSettings,
  isNavigationStarted,
  isMapNavigationActive,
  activeAlert,
  unitSystem,
  acknowledgeAlert,
  routeCoords,
  routeMetaDestinationLabel,
  navInstruction,
  navDistanceLabel,
  hasArrived,
  onEndTrip,
  basicContent,
  mapContent,
  graphicContent,
}: RadarDrivingShellProps) {
  return (
    <View style={styles.container}>
      <LinearGradient colors={['#000000', '#1A1A1A']} style={StyleSheet.absoluteFill} />

      <View style={[styles.drivingHeader, { paddingTop: insetsTop + 8 }]}>
        <IconButton icon="home-variant" iconColor="#fff" size={28} onPress={onExitHome} />
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.drivingModeTitle}>DRIVING MODE</Text>
          <Text style={styles.drivingModeSub}>MAP</Text>
        </View>
        <IconButton icon="cog" iconColor="#fff" onPress={onOpenSettings} />
      </View>

      {hasArrived && activeTab !== 'Map' ? (
        <Animated.View
          style={styles.navigationProgress}
          entering={FadeInUp.duration(300)}
        >
          <View style={styles.progressIcon}>
            <MaterialCommunityIcons name="flag-checkered" size={18} color="#4ECDC4" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.progressTitle}>You have arrived</Text>
            <Text style={styles.progressSubtitle}>End the trip when parked safely.</Text>
          </View>
          <TouchableOpacity style={styles.arrivedEndTripButton} onPress={onEndTrip}>
            <Text style={styles.arrivedEndTripText}>End Trip</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : activeAlert && routeCoords.length > 0 ? (
        <Animated.View
          style={styles.liveAlertBanner}
          entering={FadeInUp.duration(300)}
        >
          <View style={styles.liveAlertIcon}>
            <MaterialCommunityIcons name="alert" size={18} color="#FF5252" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.liveAlertTitle}>
              {activeAlert.type ? formatRadarTypeLabel(activeAlert.type) : 'Alert'}
            </Text>
            <Text style={styles.liveAlertSubtitle}>
              {formatDistance(activeAlert.distance, unitSystem)}
              {getRadarDisplayLocation(activeAlert.locationLabel, 'full')
                ? ` • ${getRadarDisplayLocation(activeAlert.locationLabel, 'full')}`
                : ''}
              {formatRadarSpeedLimitText(activeAlert, unitSystem)
                ? ` • ${formatRadarSpeedLimitText(activeAlert, unitSystem)}`
                : ''}
              {' • '}
              {formatRadarTimingText(activeAlert)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => acknowledgeAlert(activeAlert.id)}
            style={styles.liveAlertDismiss}
          >
            <MaterialCommunityIcons name="close" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      <View style={styles.tabBar}>
        {(['Basic', 'Map', 'Graphic'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabItem, activeTab === tab && styles.activeTabItem]}
            onPress={() => {
              if (tab === 'Graphic') {
                setActiveTab(tab);
                return;
              }
              setActiveTab(tab);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab && { color: '#FF5252' }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, display: activeTab === 'Basic' ? 'flex' : 'none' }}>
          {basicContent}
        </View>
        <View style={{ flex: 1, display: activeTab === 'Map' ? 'flex' : 'none' }}>
          {mapContent}
        </View>
        <View style={{ flex: 1, display: activeTab === 'Graphic' ? 'flex' : 'none' }}>
          {graphicContent}
        </View>
      </View>

    </View>
  );
}

export type { RadarDrivingShellProps };
