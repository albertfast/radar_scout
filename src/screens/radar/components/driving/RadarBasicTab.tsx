import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop, Path } from 'react-native-svg';
import { formatSpeed } from '../../../../utils/format';
import { GoogleMapsService } from '../../../../services/GoogleMapsService';
import { LocationService } from '../../../../services/LocationService';
import {
  describeRadarApproach,
  formatRadarFullAddress,
  formatRadarDistanceAdaptive,
  formatRadarLabel,
} from '../../utils/radarFormatters';

type RadarBasicTabProps = {
  currentSpeed: number;
  unitSystem: 'metric' | 'imperial';
  nearbyRadars: any[];
  tabBarInset: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
  } | null;
};

const SPEED_DIAL_SIZE = 240;
const SPEED_DIAL_STROKE = 10;
const SPEED_DIAL_RADIUS = (SPEED_DIAL_SIZE - SPEED_DIAL_STROKE) / 2;
const SPEED_DIAL_CIRCUMFERENCE = 2 * Math.PI * SPEED_DIAL_RADIUS;
const ARC_START_ANGLE = 135;
const ARC_SWEEP_ANGLE = 270;

export function RadarBasicTab({
  currentSpeed,
  unitSystem,
  nearbyRadars,
  tabBarInset,
  currentLocation,
}: RadarBasicTabProps) {
  const [speedLimit, setSpeedLimit] = useState<{ value: number; units: 'KPH' | 'MPH' } | null>(null);
  const [speedLimitSource, setSpeedLimitSource] = useState<
    'roads_api' | 'osm' | 'unknown' | 'roads_unavailable' | null
  >(null);
  const [resolvedRadarAddresses, setResolvedRadarAddresses] = useState<Record<string, string>>({});
  const lastSpeedLimitFetchAtRef = useRef(0);
  const lastSpeedLimitLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const addressRequestInFlightRef = useRef<Record<string, boolean>>({});

  // Animations
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);
  const scanSweep = useSharedValue(0);
  const glowIntensity = useSharedValue(0.5);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      true
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.12, { duration: 1800 }),
        withTiming(0.35, { duration: 1800 })
      ),
      -1,
      true
    );
    scanSweep.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
    glowIntensity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 2500 }),
        withTiming(0.4, { duration: 2500 })
      ),
      -1,
      true
    );
  }, []);

  const pulseAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const scanAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${scanSweep.value}deg` }],
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: glowIntensity.value,
  }));

  useEffect(() => {
    if (!currentLocation) return;
    const now = Date.now();
    const previous = lastSpeedLimitLocationRef.current;
    const movedMeters = previous
      ? LocationService.calculateDistanceSync(
          currentLocation.latitude,
          currentLocation.longitude,
          previous.latitude,
          previous.longitude
        ) * 1000
      : Number.POSITIVE_INFINITY;

    if (now - lastSpeedLimitFetchAtRef.current < 12000 && movedMeters < 55) {
      return;
    }

    let cancelled = false;
    lastSpeedLimitFetchAtRef.current = now;
    lastSpeedLimitLocationRef.current = {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    };

    (async () => {
      const result = await GoogleMapsService.getSpeedLimitForCoordinate(
        currentLocation.latitude,
        currentLocation.longitude
      );
      if (cancelled) return;
      if (!result || result.speedLimit <= 0) {
        setSpeedLimit(null);
        setSpeedLimitSource(result?.source || 'unknown');
        return;
      }
      setSpeedLimit({ value: result.speedLimit, units: result.units });
      setSpeedLimitSource(result.source);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentLocation]);

  const sortedRadars = useMemo(
    () =>
      [...(Array.isArray(nearbyRadars) ? nearbyRadars : [])].sort(
        (a, b) => Number(a?.distance || 9999) - Number(b?.distance || 9999)
      ),
    [nearbyRadars]
  );
  const closestRadar = sortedRadars[0] || null;
  const radarCount = sortedRadars.length;
  const radarCountLabel = radarCount === 1 ? '1 radar' : `${radarCount} radars`;
  const displayRadars = sortedRadars.slice(0, 14);

  useEffect(() => {
    displayRadars.forEach((radar) => {
      const radarId = radar?.id ? String(radar.id) : '';
      if (!radarId || resolvedRadarAddresses[radarId] || addressRequestInFlightRef.current[radarId]) {
        return;
      }

      const sourceAddress = formatRadarFullAddress(
        radar?.locationLabel || radar?.locationHint || ''
      );
      if (sourceAddress) {
        setResolvedRadarAddresses((prev) =>
          prev[radarId] === sourceAddress ? prev : { ...prev, [radarId]: sourceAddress }
        );
        return;
      }

      const latitude = Number(radar?.latitude);
      const longitude = Number(radar?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      addressRequestInFlightRef.current[radarId] = true;
      GoogleMapsService.getReverseGeocoding(latitude, longitude)
        .then((label) => {
          const normalized = formatRadarFullAddress(label);
          if (!normalized) return;
          setResolvedRadarAddresses((prev) =>
            prev[radarId] === normalized ? prev : { ...prev, [radarId]: normalized }
          );
        })
        .catch(() => {})
        .finally(() => {
          delete addressRequestInFlightRef.current[radarId];
        });
    });
  }, [displayRadars, resolvedRadarAddresses]);

  const speedParts = formatSpeed(currentSpeed, unitSystem).split(' ');
  const currentSpeedValue = Number(speedParts[0]) || 0;
  const currentSpeedUnit = speedParts[1] || (unitSystem === 'imperial' ? 'MPH' : 'KM/H');

  const limitDisplay = useMemo(() => {
    if (!speedLimit) return null;
    if (unitSystem === 'imperial') {
      return Math.round(speedLimit.units === 'MPH' ? speedLimit.value : speedLimit.value * 0.621371);
    }
    return Math.round(speedLimit.units === 'KPH' ? speedLimit.value : speedLimit.value * 1.60934);
  }, [speedLimit, unitSystem]);

  const speedDelta = limitDisplay ? currentSpeedValue - limitDisplay : null;
  const isOverspeed = typeof speedDelta === 'number' && speedDelta > 0;
  const speedTone = isOverspeed ? '#FF5252' : '#4ECDC4';

  const riskLabel = useMemo(() => {
    const distanceKm = Number(closestRadar?.distance);
    if (!Number.isFinite(distanceKm)) return 'Scanning';
    if (distanceKm <= 0.08) return 'Critical';
    if (distanceKm <= 0.35) return 'High';
    if (distanceKm <= 0.9) return 'Guarded';
    return 'Calm';
  }, [closestRadar?.distance]);

  const riskColor = useMemo(() => {
    switch (riskLabel) {
      case 'Critical':
        return '#FF5252';
      case 'High':
        return '#F97316';
      case 'Guarded':
        return '#FACC15';
      case 'Calm':
        return '#4ECDC4';
      default:
        return '#94A3B8';
    }
  }, [riskLabel]);

  const getCardAccent = (distanceKm: number) => {
    if (!Number.isFinite(distanceKm)) return '#334155';
    if (distanceKm <= 0.08) return '#FF5252';
    if (distanceKm <= 0.35) return '#F97316';
    if (distanceKm <= 0.9) return '#22D3EE';
    return '#4ECDC4';
  };

  // SVG arc progress (0 to 1)
  const speedProgress = useMemo(() => {
    if (!limitDisplay || limitDisplay <= 0) {
      return Math.min(1, Math.max(0.05, currentSpeedValue / 160));
    }
    return Math.min(1, Math.max(0.05, currentSpeedValue / limitDisplay));
  }, [currentSpeedValue, limitDisplay]);

  const arcDashoffset = SPEED_DIAL_CIRCUMFERENCE * (ARC_SWEEP_ANGLE / 360);
  const filledArc = arcDashoffset * speedProgress;

  const closestLocationDescriptor = useMemo(() => {
    const radarId = closestRadar?.id ? String(closestRadar.id) : '';
    return (
      formatRadarFullAddress(closestRadar?.locationLabel || closestRadar?.locationHint || '') ||
      (radarId ? resolvedRadarAddresses[radarId] || '' : '') ||
      ''
    );
  }, [closestRadar?.id, closestRadar?.locationHint, closestRadar?.locationLabel, resolvedRadarAddresses]);

  const speedLimitSubtitle = useMemo(() => {
    if (!limitDisplay) return 'No speed-limit feed yet';
    if (isOverspeed) {
      return `${Math.abs(speedDelta || 0)} ${currentSpeedUnit} over limit`;
    }
    if (typeof speedDelta === 'number') {
      return `${Math.abs(speedDelta)} ${currentSpeedUnit} buffer`;
    }
    return 'Within legal speed';
  }, [currentSpeedUnit, isOverspeed, limitDisplay, speedDelta]);

  const sourceLabel = useMemo(() => {
    switch (speedLimitSource) {
      case 'roads_api':
        return 'Roads API';
      case 'osm':
        return 'OSM';
      case 'unknown':
        return 'Unknown';
      case 'roads_unavailable':
        return 'Roads Off';
      default:
        return 'Live';
    }
  }, [speedLimitSource]);

  const statusLabel = closestRadar
    ? `${formatRadarDistanceAdaptive(Number(closestRadar.distance || 0), unitSystem)} to nearest`
    : 'No immediate cameras';

  const getRadarAddress = (radar: any) =>
    formatRadarFullAddress(radar?.locationLabel || radar?.locationHint || '') ||
    (radar?.id ? resolvedRadarAddresses[String(radar.id)] || '' : '') ||
    'Address pending';

  const getRadarSubtitle = (radar: any) => {
    const approach = describeRadarApproach(Number(radar?.distance), unitSystem);
    return `${formatRadarLabel(radar?.type)} • ${approach}`;
  };

  return (
    <ScrollView
      style={localStyles.screen}
      contentContainerStyle={[localStyles.content, { paddingBottom: tabBarInset + 28 }]}
      showsVerticalScrollIndicator={false}
      scrollEnabled
    >
      {/* Speedometer Dashboard */}
      <LinearGradient
        colors={['rgba(6,12,25,0.98)', 'rgba(4,9,19,0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={localStyles.dashboardCard}
      >
        {/* Speed Dial */}
        <View style={localStyles.speedDialWrap}>
          {/* Animated pulse ring */}
          <Animated.View style={[localStyles.pulseRingAnim, pulseAnimStyle]} />

          {/* Animated scan sweep */}
          <Animated.View style={[localStyles.scanSweepContainer, scanAnimStyle]}>
            <View style={localStyles.scanSweepLine} />
          </Animated.View>

          {/* SVG Arc gauge */}
          <Svg width={SPEED_DIAL_SIZE} height={SPEED_DIAL_SIZE} viewBox={`0 0 ${SPEED_DIAL_SIZE} ${SPEED_DIAL_SIZE}`}>
            <Defs>
              <SvgGradient id="arcGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={isOverspeed ? '#FF5252' : '#4ECDC4'} stopOpacity="0.3" />
                <Stop offset="1" stopColor={isOverspeed ? '#FF5252' : '#4ECDC4'} stopOpacity="0.9" />
              </SvgGradient>
              <SvgGradient id="bgArc" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#1E293B" stopOpacity="0.4" />
                <Stop offset="1" stopColor="#1E293B" stopOpacity="0.1" />
              </SvgGradient>
            </Defs>
            {/* Background arc */}
            <Circle
              cx={SPEED_DIAL_SIZE / 2}
              cy={SPEED_DIAL_SIZE / 2}
              r={SPEED_DIAL_RADIUS}
              fill="none"
              stroke="url(#bgArc)"
              strokeWidth={SPEED_DIAL_STROKE}
              strokeLinecap="round"
              strokeDasharray={`${arcDashoffset} ${SPEED_DIAL_CIRCUMFERENCE}`}
              transform={`rotate(${ARC_START_ANGLE} ${SPEED_DIAL_SIZE / 2} ${SPEED_DIAL_SIZE / 2})`}
            />
            {/* Filled arc */}
            <Circle
              cx={SPEED_DIAL_SIZE / 2}
              cy={SPEED_DIAL_SIZE / 2}
              r={SPEED_DIAL_RADIUS}
              fill="none"
              stroke="url(#arcGrad)"
              strokeWidth={SPEED_DIAL_STROKE + 2}
              strokeLinecap="round"
              strokeDasharray={`${filledArc} ${SPEED_DIAL_CIRCUMFERENCE}`}
              transform={`rotate(${ARC_START_ANGLE} ${SPEED_DIAL_SIZE / 2} ${SPEED_DIAL_SIZE / 2})`}
            />
          </Svg>

          {/* Center speed display */}
          <View style={localStyles.speedCenter}>
            <Text style={[localStyles.speedValue, { color: speedTone }]}>
              {currentSpeedValue}
            </Text>
            <Text style={localStyles.speedUnit}>{currentSpeedUnit}</Text>
          </View>

          {/* Animated glow */}
          <Animated.View style={[localStyles.centerGlow, { backgroundColor: `${speedTone}15` }, glowAnimStyle]} />
        </View>

        {/* Status Pills */}
        <View style={localStyles.pillRow}>
          <View style={localStyles.metaPill}>
            <View style={[localStyles.liveDot, { backgroundColor: '#4ECDC4' }]} />
            <Text style={localStyles.metaPillText}>{radarCountLabel}</Text>
          </View>
          <View style={[localStyles.metaPill, { borderColor: `${riskColor}33` }]}>
            <View style={[localStyles.liveDot, { backgroundColor: riskColor }]} />
            <Text style={[localStyles.metaPillText, { color: riskColor }]}>{riskLabel}</Text>
          </View>
          <View style={localStyles.metaPill}>
            <Text style={localStyles.metaPillText}>{statusLabel}</Text>
          </View>
        </View>

        {/* KPI Cards */}
        <View style={localStyles.kpiRow}>
          <LinearGradient
            colors={['rgba(26,32,52,0.95)', 'rgba(11,16,30,0.95)']}
            style={localStyles.kpiCard}
          >
            <Text style={localStyles.kpiLabel}>Closest camera</Text>
            <Text style={localStyles.kpiValue}>
              {closestRadar
                ? formatRadarDistanceAdaptive(Number(closestRadar.distance || 0), unitSystem)
                : '—'}
            </Text>
            <Text style={localStyles.kpiHint} numberOfLines={2}>
              {closestLocationDescriptor || 'Waiting for location intelligence'}
            </Text>
          </LinearGradient>

          <LinearGradient
            colors={['rgba(36,22,32,0.95)', 'rgba(18,12,22,0.95)']}
            style={localStyles.kpiCard}
          >
            <Text style={localStyles.kpiLabel}>Threat level</Text>
            <Text style={[localStyles.kpiValue, { color: riskColor }]}>{riskLabel}</Text>
            <Text style={localStyles.kpiHint}>
              {closestRadar
                ? describeRadarApproach(Number(closestRadar.distance || 0), unitSystem)
                : 'No active threats in your lane'}
            </Text>
          </LinearGradient>
        </View>

        {/* Speed Limit Panel */}
        <LinearGradient
          colors={['rgba(9,22,32,0.95)', 'rgba(6,14,22,0.95)']}
          style={localStyles.limitPanel}
        >
          <View style={localStyles.limitHeaderRow}>
            <Text style={localStyles.limitTitle}>SPEED LIMIT</Text>
            <View style={localStyles.limitSourceChip}>
              <Text style={localStyles.limitSourceText}>{sourceLabel}</Text>
            </View>
          </View>
          <View style={localStyles.limitBody}>
            <View style={[localStyles.limitSign, { borderColor: speedTone }]}>
              <Text style={localStyles.limitSignTop}>LIMIT</Text>
              <Text style={[localStyles.limitSignValue, { color: speedTone }]}>
                {limitDisplay ?? '--'}
              </Text>
              <Text style={localStyles.limitSignUnit}>{currentSpeedUnit}</Text>
            </View>
            <View style={localStyles.limitCopy}>
              <Text style={[localStyles.limitStatus, { color: speedTone }]}>
                {isOverspeed ? 'Reduce speed now' : 'Stable driving pace'}
              </Text>
              <Text style={localStyles.limitSub}>{speedLimitSubtitle}</Text>
            </View>
          </View>
        </LinearGradient>
      </LinearGradient>

      {/* Nearby Cameras List */}
      <View style={localStyles.listSection}>
        <View style={localStyles.listHeader}>
          <Text style={localStyles.listTitle}>NEARBY CAMERAS</Text>
          <View style={localStyles.listCount}>
            <Text style={localStyles.listCountText}>{displayRadars.length}</Text>
          </View>
        </View>

        {displayRadars.length > 0 ? (
          displayRadars.map((radar, index) => {
            const distanceKm = Number(radar?.distance || 0);
            const accent = getCardAccent(distanceKm);
            return (
              <LinearGradient
                key={radar?.id || `radar-${index}`}
                colors={['rgba(12,18,30,0.94)', 'rgba(9,14,26,0.94)']}
                style={[localStyles.radarCard, { borderColor: `${accent}33` }]}
              >
                {/* Radar type icon */}
                <View style={[localStyles.radarIconWrap, { backgroundColor: `${accent}18` }]}>
                  <View style={[localStyles.radarIconDot, { backgroundColor: accent }]} />
                </View>
                <View style={localStyles.radarCopy}>
                  <Text style={localStyles.radarTitle} numberOfLines={2}>
                    {getRadarAddress(radar)}
                  </Text>
                  <Text style={localStyles.radarSubtitle} numberOfLines={2}>
                    {getRadarSubtitle(radar)}
                  </Text>
                </View>
                <View style={[localStyles.radarDistanceBadge, { backgroundColor: `${accent}18` }]}>
                  <Text style={[localStyles.radarDistanceText, { color: accent }]}>
                    {formatRadarDistanceAdaptive(distanceKm, unitSystem)}
                  </Text>
                </View>
              </LinearGradient>
            );
          })
        ) : (
          <LinearGradient
            colors={['rgba(12,18,30,0.9)', 'rgba(8,14,26,0.9)']}
            style={localStyles.emptyState}
          >
            <View style={localStyles.emptyStateIcon}>
              <View style={localStyles.emptyStateDot} />
            </View>
            <Text style={localStyles.emptyStateText}>Scanning nearby roads for cameras...</Text>
          </LinearGradient>
        )}
      </View>
    </ScrollView>
  );
}

export type { RadarBasicTabProps };

const localStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 12,
  },
  dashboardCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(78,205,196,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 16,
    overflow: 'hidden',
    gap: 14,
  },

  // Speed Dial
  speedDialWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: SPEED_DIAL_SIZE + 20,
  },
  pulseRingAnim: {
    position: 'absolute',
    width: SPEED_DIAL_SIZE + 30,
    height: SPEED_DIAL_SIZE + 30,
    borderRadius: (SPEED_DIAL_SIZE + 30) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(78,205,196,0.2)',
  },
  scanSweepContainer: {
    position: 'absolute',
    width: SPEED_DIAL_SIZE,
    height: SPEED_DIAL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanSweepLine: {
    position: 'absolute',
    width: SPEED_DIAL_SIZE / 2 - 20,
    height: 2,
    backgroundColor: 'rgba(78,205,196,0.35)',
    borderRadius: 1,
    right: SPEED_DIAL_SIZE / 2,
    top: SPEED_DIAL_SIZE / 2 - 1,
  },
  speedCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedValue: {
    fontSize: 64,
    fontWeight: '900',
    lineHeight: 68,
  },
  speedUnit: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  centerGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
  },

  // Pills
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(10,18,35,0.7)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaPillText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  // KPI Cards
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 100,
    gap: 3,
  },
  kpiLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  kpiValue: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  kpiHint: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },

  // Speed Limit
  limitPanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  limitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  limitTitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  limitSourceChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: 'rgba(15,23,42,0.7)',
  },
  limitSourceText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  limitBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  limitSign: {
    width: 88,
    borderRadius: 14,
    borderWidth: 2.5,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  limitSignTop: {
    color: '#0F172A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  limitSignValue: {
    color: '#0F172A',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
    marginTop: 1,
  },
  limitSignUnit: {
    color: '#334155',
    fontSize: 10,
    fontWeight: '800',
    marginTop: -1,
  },
  limitCopy: {
    flex: 1,
  },
  limitStatus: {
    fontSize: 17,
    fontWeight: '800',
  },
  limitSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
    fontWeight: '600',
  },

  // Camera List
  listSection: {
    gap: 9,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 4,
  },
  listTitle: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  listCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,41,59,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    paddingHorizontal: 8,
  },
  listCountText: {
    color: '#E2E8F0',
    fontWeight: '800',
    fontSize: 12,
  },
  radarCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radarIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarIconDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radarCopy: {
    flex: 1,
  },
  radarTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  radarSubtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  radarDistanceBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    minWidth: 68,
    alignItems: 'center',
  },
  radarDistanceText: {
    fontSize: 15,
    fontWeight: '900',
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(78,205,196,0.15)',
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyStateIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(78,205,196,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ECDC4',
  },
  emptyStateText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
