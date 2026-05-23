import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView from 'react-native-maps';
import * as Haptics from 'expo-haptics';
import { RadarAlert } from '../../../types';
import { useRadarStore } from '../../../store/radarStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { RadarService } from '../../../services/RadarService';
import { LocationService } from '../../../services/LocationService';
import { GoogleMapsService } from '../../../services/GoogleMapsService';
import { NotificationService } from '../../../services/NotificationService';
import { VoiceGuidanceService } from '../../../services/VoiceGuidanceService';
import { formatDistance } from '../../../utils/format';
import { useSpeedSmoothing } from './useSpeedSmoothing';
import { MAP_TRACE_ENABLED, ROUTE_RELEVANCE_V2_ENABLED } from '../constants';
import { TabType } from '../types';
import { extractShortStreetLabel, formatRadarLabel } from '../utils/radarFormatters';
import {
  formatRadarAnnouncementTiming,
  getRadarDisplayLocation,
  formatRadarSpeedLimitAnnouncement,
} from '../../../utils/radarAlerts';

type UseRadarDataSyncParams = {
  locationPermissionGranted: boolean;
  currentLocation: any;
  setCurrentLocation: (location: any) => void;
  currentLocationRef: React.MutableRefObject<any>;
  mapRef: React.RefObject<MapView | null>;
  allowUiLocationUpdates: boolean;
  isDriving: boolean;
  activeTab: TabType;
  followHeading: boolean;
  isTypingRef: React.MutableRefObject<boolean>;
  manualPanModeRef: React.MutableRefObject<boolean>;
  hasCenteredMapRef: React.MutableRefObject<boolean>;
  activeAlerts: RadarAlert[];
  hasHydrated: boolean;
  hapticAlertsEnabled: boolean;
  voicePlaybackEnabled: boolean;
  warningVolume: number;
  unitSystem: 'metric' | 'imperial';
  setRadarLocations: (radars: any[]) => void;
};

const normalizeHeading = (heading: number) => {
  const normalized = heading % 360;
  return normalized >= 0 ? normalized : normalized + 360;
};

const calculateBearing = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
) => {
  const startLat = (fromLat * Math.PI) / 180;
  const endLat = (toLat * Math.PI) / 180;
  const deltaLng = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(deltaLng) * Math.cos(endLat);
  const x =
    Math.cos(startLat) * Math.sin(endLat) -
    Math.sin(startLat) * Math.cos(endLat) * Math.cos(deltaLng);
  const angle = (Math.atan2(y, x) * 180) / Math.PI;
  return normalizeHeading(angle);
};

const calculateHeadingDelta = (
  fromHeading: number | null | undefined,
  toHeading: number | null | undefined
) => {
  if (
    typeof fromHeading !== 'number' ||
    !Number.isFinite(fromHeading) ||
    typeof toHeading !== 'number' ||
    !Number.isFinite(toHeading)
  ) {
    return 0;
  }

  let delta = Math.abs(normalizeHeading(toHeading) - normalizeHeading(fromHeading));
  if (delta > 180) delta = 360 - delta;
  return delta;
};

const stepHeadingToward = (
  fromHeading: number | null | undefined,
  toHeading: number,
  maxStepDeg: number
) => {
  const normalizedTo = normalizeHeading(toHeading);
  if (typeof fromHeading !== 'number' || !Number.isFinite(fromHeading)) {
    return normalizedTo;
  }

  const normalizedFrom = normalizeHeading(fromHeading);
  let delta = normalizedTo - normalizedFrom;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;

  if (Math.abs(delta) <= maxStepDeg) {
    return normalizedTo;
  }

  return normalizeHeading(normalizedFrom + Math.sign(delta) * maxStepDeg);
};

const projectForwardCoordinate = (
  latitude: number,
  longitude: number,
  bearingDeg: number,
  distanceMeters: number
) => {
  const earthRadiusMeters = 6378137;
  const angularDistance = distanceMeters / earthRadiusMeters;
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const latitudeRad = (latitude * Math.PI) / 180;
  const longitudeRad = (longitude * Math.PI) / 180;

  const projectedLatitude = Math.asin(
    Math.sin(latitudeRad) * Math.cos(angularDistance) +
      Math.cos(latitudeRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );
  const projectedLongitude =
    longitudeRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latitudeRad),
      Math.cos(angularDistance) - Math.sin(latitudeRad) * Math.sin(projectedLatitude)
    );

  return {
    latitude: (projectedLatitude * 180) / Math.PI,
    longitude: (projectedLongitude * 180) / Math.PI,
  };
};

const REVERSE_GEOCODE_CACHE_TTL_MS = 10 * 60 * 1000;
const REVERSE_GEOCODE_MAX_CONCURRENCY = 2;
const RADAR_HINT_NEAREST_LIMIT = 6;
const VIEWPORT_RADAR_DEBOUNCE_MS = 650;
const VIEWPORT_RADAR_MAX_RADIUS_KM = 35;
const VIEWPORT_RADAR_MIN_RADIUS_KM = 2;

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const isSpeedCameraType = (type: string | undefined): boolean =>
  type === 'speed_camera' || type === 'fixed';

const clampViewportRadiusKm = (value: number) =>
  Math.max(VIEWPORT_RADAR_MIN_RADIUS_KM, Math.min(VIEWPORT_RADAR_MAX_RADIUS_KM, value));

const radiusKmForRegion = (region: MapRegion) => {
  const latSpanKm = Math.abs(region.latitudeDelta) * 111;
  const lonSpanKm =
    Math.abs(region.longitudeDelta) *
    111 *
    Math.max(0.2, Math.cos((region.latitude * Math.PI) / 180));
  const diagonalKm = Math.sqrt(latSpanKm * latSpanKm + lonSpanKm * lonSpanKm);
  return clampViewportRadiusKm(diagonalKm * 0.6);
};

export function useRadarDataSync({
  locationPermissionGranted,
  currentLocation,
  setCurrentLocation,
  currentLocationRef,
  mapRef,
  allowUiLocationUpdates,
  isDriving,
  activeTab,
  followHeading,
  isTypingRef,
  manualPanModeRef,
  hasCenteredMapRef,
  activeAlerts,
  hasHydrated,
  hapticAlertsEnabled,
  voicePlaybackEnabled,
  warningVolume,
  unitSystem,
  setRadarLocations,
}: UseRadarDataSyncParams) {
  const routeCoords = useRadarStore((state) => state.routeGuidancePath);
  const isRouteGuidanceActive = useRadarStore((state) => state.isRouteGuidanceActive);
  const [nearbyRadars, setNearbyRadars] = useState<any[]>([]);
  const [viewportRadars, setViewportRadars] = useState<any[]>([]);
  const [closestRadarHint, setClosestRadarHint] = useState('');
  const [radarLocationHints, setRadarLocationHints] = useState<Record<string, string>>({});

  const { uiSpeedKph: currentSpeed, pushLocationSample, resetSpeed } = useSpeedSmoothing({
    calculateDistanceSync: LocationService.calculateDistanceSync,
  });

  const currentSpeedRef = useRef(currentSpeed);
  useEffect(() => {
    currentSpeedRef.current = currentSpeed;
  }, [currentSpeed]);

  const nearbyRadarsRef = useRef<any[]>([]);
  const viewportRadarsRef = useRef<any[]>([]);
  const syncedStoreRadarsRef = useRef<any[]>([]);
  const viewportFetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportFetchRequestIdRef = useRef(0);
  const lastViewportFetchRef = useRef<{
    latitude: number;
    longitude: number;
    radiusKm: number;
    fetchedAt: number;
  } | null>(null);
  const lastCameraUpdateRef = useRef(0);
  const lastCameraCenterRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const cameraAnimationInFlightRef = useRef(false);
  const lastUiLocationRef = useRef<any>(null);
  const lastUiLocationUpdateAtRef = useRef(0);
  const lastAnnouncedAlertIdRef = useRef<string | null>(null);
  const closestRadarLabelCacheRef = useRef<Record<string, string>>({});
  const reverseGeocodeCacheRef = useRef<Record<string, { label: string; updatedAt: number }>>({});
  const reverseGeocodeInFlightRef = useRef<Record<string, Promise<string>>>({});
  const reverseGeocodeQueueRef = useRef<Array<() => void>>([]);
  const reverseGeocodeActiveCountRef = useRef(0);
  const previousHeadingLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastValidHeadingRef = useRef<number | null>(null);
  const lastCameraHeadingRef = useRef<number | null>(null);

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation, currentLocationRef]);

  useEffect(() => {
    return () => {
      if (viewportFetchTimerRef.current) {
        clearTimeout(viewportFetchTimerRef.current);
        viewportFetchTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const seededHeading =
      typeof currentLocation?.heading === 'number' && Number.isFinite(currentLocation.heading)
        ? normalizeHeading(currentLocation.heading)
        : null;
    if (seededHeading !== null) {
      lastValidHeadingRef.current = seededHeading;
    }
  }, [currentLocation]);

  const activeAlert = useMemo<RadarAlert | null>(() => {
    const unacknowledged = (activeAlerts as RadarAlert[]).filter((alert) => !alert.acknowledged);
    return unacknowledged.sort((a, b) => a.distance - b.distance)[0] || null;
  }, [activeAlerts]);

  const closestRadar = useMemo(() => {
    if (!nearbyRadars || nearbyRadars.length === 0) return null;
    return [...nearbyRadars].sort((a, b) => a.distance - b.distance)[0];
  }, [nearbyRadars]);

  const hasSameRadarSnapshot = useCallback((a: any[], b: any[]) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
      const left = a[index];
      const right = b[index];
      if (!left || !right) return false;
      if (left.id !== right.id) return false;
      if (left.type !== right.type) return false;
      const leftDistance = Math.round((left.distance || 0) * 100);
      const rightDistance = Math.round((right.distance || 0) * 100);
      if (leftDistance !== rightDistance) return false;
    }
    return true;
  }, []);

  const applyRouteRelevanceFilter = useCallback(
    (incoming: any[], loc: { latitude: number; longitude: number; heading?: number | null }) => {
      if (!ROUTE_RELEVANCE_V2_ENABLED) return incoming;
      const routeState = useRadarStore.getState();
      if (!routeState.isRouteGuidanceActive || routeState.routeGuidancePath.length < 2) {
        return incoming;
      }

      const relevant = RadarService.filterRouteRelevantRadars(incoming, {
        currentLocation: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          heading: typeof loc.heading === 'number' ? loc.heading : null,
        },
        routeCoords: routeState.routeGuidancePath,
        speedKph: Math.max(currentSpeedRef.current || 0, 10),
        maxCorridorMeters: 90,
        maxHeadingDeltaDeg: 65,
        etaSecondsWindow: [0, 3600],
        requireEtaWindow: false,
      });

      return relevant;
    },
    []
  );

  const updateNearbyRadarsState = useCallback(
    (incoming: any[]) => {
      if (hasSameRadarSnapshot(nearbyRadarsRef.current, incoming)) return;
      nearbyRadarsRef.current = incoming;
      setNearbyRadars(incoming);
    },
    [hasSameRadarSnapshot]
  );

  useEffect(() => {
    if (locationPermissionGranted) {
      return;
    }

    currentLocationRef.current = null;
    lastUiLocationRef.current = null;
    previousHeadingLocationRef.current = null;
    lastValidHeadingRef.current = null;
    lastCameraCenterRef.current = null;
    lastCameraHeadingRef.current = null;
    viewportRadarsRef.current = [];
    setViewportRadars([]);
    lastViewportFetchRef.current = null;
    updateNearbyRadarsState([]);
    setRadarLocationHints({});
    setClosestRadarHint('');
    if (currentLocation) {
      setCurrentLocation(null);
    }
  }, [
    currentLocation,
    currentLocationRef,
    locationPermissionGranted,
    setCurrentLocation,
    updateNearbyRadarsState,
  ]);

  useEffect(() => {
    nearbyRadarsRef.current = nearbyRadars;
  }, [nearbyRadars]);

  useEffect(() => {
    viewportRadarsRef.current = viewportRadars;
  }, [viewportRadars]);

  useEffect(() => {
    if (hasSameRadarSnapshot(syncedStoreRadarsRef.current, nearbyRadars)) return;
    syncedStoreRadarsRef.current = nearbyRadars;
    setRadarLocations(nearbyRadars);
  }, [hasSameRadarSnapshot, nearbyRadars, setRadarLocations]);

  const getRadarLabelCacheKey = useCallback(
    (radarId: string | undefined, latitude: number, longitude: number) =>
      radarId || `${latitude.toFixed(5)},${longitude.toFixed(5)}`,
    []
  );

  const runReverseGeocodeTask = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    if (reverseGeocodeActiveCountRef.current >= REVERSE_GEOCODE_MAX_CONCURRENCY) {
      await new Promise<void>((resolve) => {
        reverseGeocodeQueueRef.current.push(resolve);
      });
    }

    reverseGeocodeActiveCountRef.current += 1;
    try {
      return await task();
    } finally {
      reverseGeocodeActiveCountRef.current = Math.max(
        0,
        reverseGeocodeActiveCountRef.current - 1
      );
      const next = reverseGeocodeQueueRef.current.shift();
      if (next) next();
    }
  }, []);

  const resolveRadarShortLabel = useCallback(
    async (radarId: string | undefined, latitude: number, longitude: number): Promise<string> => {
      const cacheKey = getRadarLabelCacheKey(radarId, latitude, longitude);
      const cached = reverseGeocodeCacheRef.current[cacheKey];
      if (cached && Date.now() - cached.updatedAt <= REVERSE_GEOCODE_CACHE_TTL_MS) {
        return cached.label;
      }

      const inflight = reverseGeocodeInFlightRef.current[cacheKey];
      if (inflight) {
        return inflight;
      }

      const request = runReverseGeocodeTask(async () => {
        try {
          const fullLabel = await GoogleMapsService.getReverseGeocoding(latitude, longitude);
          const shortLabel = extractShortStreetLabel(fullLabel);
          const resolved = shortLabel || '';
          reverseGeocodeCacheRef.current[cacheKey] = {
            label: resolved,
            updatedAt: Date.now(),
          };
          if (radarId && resolved) {
            closestRadarLabelCacheRef.current[radarId] = resolved;
          }
          return resolved;
        } catch {
          reverseGeocodeCacheRef.current[cacheKey] = {
            label: '',
            updatedAt: Date.now(),
          };
          return '';
        }
      });

      reverseGeocodeInFlightRef.current[cacheKey] = request;
      request.finally(() => {
        if (reverseGeocodeInFlightRef.current[cacheKey] === request) {
          delete reverseGeocodeInFlightRef.current[cacheKey];
        }
      });

      return request;
    },
    [getRadarLabelCacheKey, runReverseGeocodeTask]
  );

  useEffect(() => {
    if (!hasHydrated) return;
    if (!activeAlert) {
      lastAnnouncedAlertIdRef.current = null;
      return;
    }
    if (!isDriving) return;
    if (lastAnnouncedAlertIdRef.current === activeAlert.id) return;
    lastAnnouncedAlertIdRef.current = activeAlert.id;

    if (hapticAlertsEnabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }

    if (voicePlaybackEnabled) {
      const liveSettings = useSettingsStore.getState();
      const liveVoiceEnabled =
        liveSettings.hasHydrated && liveSettings.voiceWarningsEnabled && liveSettings.warningVolume > 0;
      if (!liveVoiceEnabled) {
        return;
      }
      const distanceText = formatDistance(activeAlert.distance, unitSystem);
      const displayLocation = getRadarDisplayLocation(activeAlert.locationLabel, 'full');
      const locationSuffix = displayLocation ? ` near ${displayLocation}` : '';
      const timingText = formatRadarAnnouncementTiming(activeAlert);
      const speedLimitText = formatRadarSpeedLimitAnnouncement(activeAlert, unitSystem);
      const speedLimitSuffix = speedLimitText ? ` ${speedLimitText}.` : '';
      const message = `${formatRadarLabel(activeAlert.type)} ahead${locationSuffix}.${speedLimitSuffix} ${distanceText}. ${timingText}.`;
      VoiceGuidanceService.speak(message, {
        cooldownKey: `active_alert:${activeAlert.id}`,
        cooldownMs: 6000,
      });
    }
  }, [
    activeAlert,
    hasHydrated,
    hapticAlertsEnabled,
    isDriving,
    unitSystem,
    voicePlaybackEnabled,
    warningVolume,
  ]);

  useEffect(() => {
    if (!voicePlaybackEnabled) {
      VoiceGuidanceService.syncMuteState().catch(() => {});
      NotificationService.silenceAllAudioNow().catch(() => {
        VoiceGuidanceService.stop().catch(() => {});
      });
    }
  }, [voicePlaybackEnabled]);

  useEffect(() => {
    if (!closestRadar?.id) {
      setClosestRadarHint('');
      return;
    }
    const cached = closestRadarLabelCacheRef.current[closestRadar.id];
    if (cached) {
      setClosestRadarHint(cached);
      return;
    }

    const latitude = Number(closestRadar.latitude);
    const longitude = Number(closestRadar.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setClosestRadarHint('');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const shortLabel = await resolveRadarShortLabel(
          closestRadar.id,
          latitude,
          longitude
        );
        if (cancelled) return;
        if (shortLabel) {
          closestRadarLabelCacheRef.current[closestRadar.id] = shortLabel;
          setClosestRadarHint(shortLabel);
        } else {
          setClosestRadarHint('');
        }
      } catch {
        if (!cancelled) {
          setClosestRadarHint('');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [closestRadar, resolveRadarShortLabel]);

  useEffect(() => {
    const candidates = [...nearbyRadars]
      .sort((a, b) => Number(a?.distance || Number.MAX_SAFE_INTEGER) - Number(b?.distance || Number.MAX_SAFE_INTEGER))
      .slice(0, RADAR_HINT_NEAREST_LIMIT);

    for (const radar of candidates) {
      if (!radar?.id) continue;
      if (radarLocationHints[radar.id]) continue;
      const latitude = Number(radar.latitude);
      const longitude = Number(radar.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

      (async () => {
        try {
          const shortLabel = await resolveRadarShortLabel(radar.id, latitude, longitude);
          if (!shortLabel) return;
          setRadarLocationHints((prev) => {
            if (prev[radar.id] === shortLabel) return prev;
            return { ...prev, [radar.id]: shortLabel };
          });
        } catch {
          // Ignore reverse geocode failures for non-critical hints.
        }
      })();
    }
  }, [nearbyRadars, radarLocationHints, resolveRadarShortLabel]);

  const nearbyRadarsWithHints = useMemo(
    () =>
      nearbyRadars.map((radar) => ({
        ...radar,
        locationHint: radarLocationHints[radar.id] || radar.locationLabel || '',
      })),
    [nearbyRadars, radarLocationHints]
  );

  const mapRadars = useMemo(() => {
    if (isRouteGuidanceActive && routeCoords.length > 1) {
      return nearbyRadarsWithHints;
    }

    const merged = new Map<string, any>();
    for (const radar of viewportRadars) {
      if (!radar?.id) continue;
      merged.set(radar.id, radar);
    }
    for (const radar of nearbyRadarsWithHints) {
      if (!radar?.id) continue;
      merged.set(radar.id, {
        ...merged.get(radar.id),
        ...radar,
      });
    }

    return Array.from(merged.values()).sort((left, right) => {
      const leftDistance = Number(left?.distance);
      const rightDistance = Number(right?.distance);
      return (
        (Number.isFinite(leftDistance) ? leftDistance : Number.MAX_SAFE_INTEGER) -
        (Number.isFinite(rightDistance) ? rightDistance : Number.MAX_SAFE_INTEGER)
      );
    });
  }, [isRouteGuidanceActive, nearbyRadarsWithHints, routeCoords.length, viewportRadars]);

  const requestViewportRadars = useCallback(
    (region: MapRegion) => {
      if (!locationPermissionGranted) return;
      if (
        !region ||
        !Number.isFinite(region.latitude) ||
        !Number.isFinite(region.longitude) ||
        !Number.isFinite(region.latitudeDelta) ||
        !Number.isFinite(region.longitudeDelta) ||
        region.latitudeDelta <= 0 ||
        region.longitudeDelta <= 0
      ) {
        return;
      }

      const routeState = useRadarStore.getState();
      if (routeState.isRouteGuidanceActive && routeState.routeGuidancePath.length > 1) {
        viewportRadarsRef.current = [];
        setViewportRadars([]);
        return;
      }

      if (viewportFetchTimerRef.current) {
        clearTimeout(viewportFetchTimerRef.current);
      }

      const requestId = viewportFetchRequestIdRef.current + 1;
      viewportFetchRequestIdRef.current = requestId;

      viewportFetchTimerRef.current = setTimeout(async () => {
        const liveRouteState = useRadarStore.getState();
        if (liveRouteState.isRouteGuidanceActive && liveRouteState.routeGuidancePath.length > 1) {
          viewportRadarsRef.current = [];
          setViewportRadars([]);
          return;
        }

        const radiusKm = radiusKmForRegion(region);
        const lastFetch = lastViewportFetchRef.current;
        if (lastFetch) {
          const movedKm = LocationService.calculateDistanceSync(
            region.latitude,
            region.longitude,
            lastFetch.latitude,
            lastFetch.longitude
          );
          const radiusDeltaRatio =
            Math.abs(radiusKm - lastFetch.radiusKm) / Math.max(1, lastFetch.radiusKm);
          const isFresh = Date.now() - lastFetch.fetchedAt < 10000;
          const isSameCoverage =
            movedKm < Math.max(0.75, radiusKm * 0.18) && radiusDeltaRatio < 0.35;
          if (isFresh && isSameCoverage) {
            return;
          }
        }

        lastViewportFetchRef.current = {
          latitude: region.latitude,
          longitude: region.longitude,
          radiusKm,
          fetchedAt: Date.now(),
        };

        const radars = await RadarService.getNearbyRadars(region.latitude, region.longitude, radiusKm);
        if (viewportFetchRequestIdRef.current !== requestId) return;

        const liveLocation = currentLocationRef.current;
        const speedCameraRadars = radars
          .filter((radar) => isSpeedCameraType(radar?.type))
          .map((radar) => {
            if (!liveLocation) return radar;
            return {
              ...radar,
              distance: LocationService.calculateDistanceSync(
                liveLocation.latitude,
                liveLocation.longitude,
                radar.latitude,
                radar.longitude
              ),
            };
          });

        viewportRadarsRef.current = speedCameraRadars;
        setViewportRadars(speedCameraRadars);
      }, VIEWPORT_RADAR_DEBOUNCE_MS);
    },
    [currentLocationRef, locationPermissionGranted]
  );

  useEffect(() => {
    if (!isRouteGuidanceActive || routeCoords.length < 2) return;
    viewportRadarsRef.current = [];
    setViewportRadars([]);
  }, [isRouteGuidanceActive, routeCoords.length]);

  useEffect(() => {
    if (!locationPermissionGranted) {
      return () => {};
    }

    const unsubscribe = useRadarStore.subscribe((state) => {
      const location = state.currentLocation;
      if (
        location &&
        (!currentLocationRef.current ||
          location.latitude !== currentLocationRef.current.latitude ||
          location.longitude !== currentLocationRef.current.longitude)
      ) {
        const previousHeadingLocation = previousHeadingLocationRef.current;
        const sampleSpeedKph =
          typeof location.speed === 'number' && Number.isFinite(location.speed) && location.speed >= 0
            ? location.speed * 3.6
            : Math.max(0, currentSpeedRef.current || 0);
        const headingFromSensor =
          typeof location.heading === 'number' &&
          Number.isFinite(location.heading) &&
          location.heading >= 0
            ? normalizeHeading(location.heading)
            : null;
        const movementMeters = previousHeadingLocation
          ? LocationService.calculateDistanceSync(
              previousHeadingLocation.latitude,
              previousHeadingLocation.longitude,
              location.latitude,
              location.longitude
            ) * 1000
          : 0;
        const hasReliableMotion = movementMeters >= 4 || sampleSpeedKph >= 8;
        const bearingHeading =
          previousHeadingLocation && movementMeters >= 4
            ? calculateBearing(
                previousHeadingLocation.latitude,
                previousHeadingLocation.longitude,
                location.latitude,
                location.longitude
              )
            : null;
        const motionHeading =
          bearingHeading ?? (hasReliableMotion ? headingFromSensor : null);
        const maxHeadingStepDeg =
          sampleSpeedKph >= 90 ? 24 : sampleSpeedKph >= 55 ? 18 : sampleSpeedKph >= 25 ? 14 : 10;
        const resolvedHeading =
          motionHeading !== null
            ? stepHeadingToward(lastValidHeadingRef.current, motionHeading, maxHeadingStepDeg)
            : lastValidHeadingRef.current;
        lastValidHeadingRef.current =
          typeof resolvedHeading === 'number' && Number.isFinite(resolvedHeading)
            ? normalizeHeading(resolvedHeading)
            : lastValidHeadingRef.current;
        previousHeadingLocationRef.current = {
          latitude: location.latitude,
          longitude: location.longitude,
        };

        const locationWithHeading = {
          ...location,
          latitude: location.latitude,
          longitude: location.longitude,
          heading: lastValidHeadingRef.current,
        };

        currentLocationRef.current = locationWithHeading;
        pushLocationSample(locationWithHeading);

        const previousUiLocation = lastUiLocationRef.current;
        const now = Date.now();
        const movedMeters = previousUiLocation
          ? LocationService.calculateDistanceSync(
              previousUiLocation.latitude,
              previousUiLocation.longitude,
              locationWithHeading.latitude,
              locationWithHeading.longitude
            ) * 1000
          : Number.POSITIVE_INFINITY;
        const previousHeading =
          typeof previousUiLocation?.heading === 'number' ? previousUiLocation.heading : null;
        const nextHeading =
          typeof locationWithHeading.heading === 'number' ? locationWithHeading.heading : null;
        let headingDelta = 0;
        if (previousHeading !== null && nextHeading !== null) {
          headingDelta = Math.abs(nextHeading - previousHeading);
          if (headingDelta > 180) headingDelta = 360 - headingDelta;
        }
        const uiUpdateIntervalMs =
          sampleSpeedKph >= 90 ? 200 : sampleSpeedKph >= 60 ? 250 : sampleSpeedKph >= 30 ? 320 : 420;
        const uiMoveThresholdMeters =
          sampleSpeedKph >= 90 ? 1.6 : sampleSpeedKph >= 60 ? 1.2 : sampleSpeedKph >= 30 ? 0.9 : 0.45;
        const shouldUpdateUiLocation =
          !previousUiLocation ||
          movedMeters >= uiMoveThresholdMeters ||
          headingDelta >= 3 ||
          now - lastUiLocationUpdateAtRef.current >= uiUpdateIntervalMs;

        if (shouldUpdateUiLocation && allowUiLocationUpdates) {
          lastUiLocationRef.current = locationWithHeading;
          lastUiLocationUpdateAtRef.current = now;
          setCurrentLocation(locationWithHeading);
        }

        if (isDriving && activeTab === 'Map' && !manualPanModeRef.current && !isTypingRef.current) {
          const currentHeading =
            typeof locationWithHeading.heading === 'number' && Number.isFinite(locationWithHeading.heading)
              ? normalizeHeading(locationWithHeading.heading)
              : lastValidHeadingRef.current ?? 0;
          const centerBearing = followHeading ? currentHeading : 0;
          const cameraUpdateIntervalMs =
            sampleSpeedKph >= 90 ? 240 : sampleSpeedKph >= 60 ? 300 : sampleSpeedKph >= 30 ? 360 : 430;
          const cameraMoveThresholdMeters =
            sampleSpeedKph >= 90 ? 5 : sampleSpeedKph >= 60 ? 4 : sampleSpeedKph >= 30 ? 3 : 2;
          const cameraHeadingThresholdDeg =
            sampleSpeedKph >= 90 ? 5 : sampleSpeedKph >= 60 ? 6 : sampleSpeedKph >= 30 ? 8 : 12;
          const lookAheadMeters = Math.max(
            18,
            Math.min(36, 22 + Math.round((currentSpeedRef.current || 0) * 0.2))
          );
          const followCenter = followHeading
            ? projectForwardCoordinate(
                locationWithHeading.latitude,
                locationWithHeading.longitude,
                centerBearing,
                lookAheadMeters
              )
            : { latitude: locationWithHeading.latitude, longitude: locationWithHeading.longitude };
          const lastCameraCenter = lastCameraCenterRef.current;
          const movedFromCameraMeters = lastCameraCenter
            ? LocationService.calculateDistanceSync(
                lastCameraCenter.latitude,
                lastCameraCenter.longitude,
                followCenter.latitude,
                followCenter.longitude
              ) * 1000
            : Number.POSITIVE_INFINITY;
          const nextCameraHeading = followHeading ? currentHeading : 0;
          const headingDeltaForCamera = calculateHeadingDelta(
            lastCameraHeadingRef.current,
            nextCameraHeading
          );
          const allowHeadingDrivenCameraUpdate =
            followHeading && (sampleSpeedKph >= 10 || movementMeters >= 4);

          const shouldAnimateCamera =
            !lastCameraCenter ||
            movedFromCameraMeters >= cameraMoveThresholdMeters ||
            (allowHeadingDrivenCameraUpdate && headingDeltaForCamera >= cameraHeadingThresholdDeg);

          if (shouldAnimateCamera && now - lastCameraUpdateRef.current >= cameraUpdateIntervalMs && !cameraAnimationInFlightRef.current) {
            cameraAnimationInFlightRef.current = true;
            const animationDuration = 300;
            mapRef.current?.animateCamera(
              {
                center: {
                  latitude: followCenter.latitude,
                  longitude: followCenter.longitude,
                },
                pitch: 0,
                heading: followHeading ? currentHeading : 0,
                zoom: 18.85,
              },
              { duration: animationDuration }
            );
            lastCameraCenterRef.current = {
              latitude: followCenter.latitude,
              longitude: followCenter.longitude,
            };
            lastCameraHeadingRef.current = nextCameraHeading;
            lastCameraUpdateRef.current = now;
            setTimeout(() => { cameraAnimationInFlightRef.current = false; }, animationDuration + 40);

            if (MAP_TRACE_ENABLED) {
              console.log('[MapTrace] cameraFollow', {
                movedFromCameraMeters: Math.round(movedFromCameraMeters),
                centerBearing: Math.round(centerBearing),
                lookAheadMeters,
              });
            }
          }
        }
      }
    });

    return unsubscribe;
  }, [
    activeTab,
    allowUiLocationUpdates,
    followHeading,
    isDriving,
    locationPermissionGranted,
    manualPanModeRef,
    isTypingRef,
    mapRef,
    pushLocationSample,
    routeCoords,
  ]);

  useEffect(() => {
    if (currentLocation && mapRef.current && !hasCenteredMapRef.current) {
      const routeHeading =
        followHeading && routeCoords.length > 1
          ? LocationService.calculateRouteBearing(
              currentLocation.latitude,
              currentLocation.longitude,
              routeCoords
            )
          : null;
      const initialBearing =
        followHeading && typeof routeHeading === 'number'
          ? routeHeading
          : followHeading &&
              typeof currentLocation.heading === 'number' &&
              Number.isFinite(currentLocation.heading)
          ? currentLocation.heading
          : 0;
      const initialCenter = followHeading
        ? projectForwardCoordinate(currentLocation.latitude, currentLocation.longitude, initialBearing, 28)
        : { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
      mapRef.current.animateCamera(
        {
          center: initialCenter,
          zoom: 18.7,
          pitch: 0,
          heading: followHeading ? normalizeHeading(initialBearing) : 0,
        },
        { duration: 340 }
      );
      if (followHeading) {
        lastValidHeadingRef.current = normalizeHeading(initialBearing);
      }
      lastCameraCenterRef.current = {
        latitude: initialCenter.latitude,
        longitude: initialCenter.longitude,
      };
      lastCameraHeadingRef.current = followHeading ? normalizeHeading(initialBearing) : 0;
      lastCameraUpdateRef.current = Date.now();
      hasCenteredMapRef.current = true;
    }
  }, [currentLocation, followHeading, hasCenteredMapRef, mapRef, routeCoords]);

  useEffect(() => {
    if (!locationPermissionGranted) {
      updateNearbyRadarsState([]);
      return () => {};
    }

    const fetchNearby = async () => {
      const loc = currentLocationRef.current || (await LocationService.getCurrentLocation());
      if (!loc) return;

      const radars = await RadarService.getNearbyRadars(loc.latitude, loc.longitude, 10);
      const filtered = applyRouteRelevanceFilter(radars, {
        latitude: loc.latitude,
        longitude: loc.longitude,
        heading: typeof loc.heading === 'number' ? loc.heading : null,
      });
      updateNearbyRadarsState(filtered);
    };

    fetchNearby();
    const intervalMs = isRouteGuidanceActive && routeCoords.length > 1 ? 7000 : 15000;
    const interval = setInterval(fetchNearby, intervalMs);
    return () => clearInterval(interval);
  }, [
    applyRouteRelevanceFilter,
    currentLocationRef,
    isRouteGuidanceActive,
    locationPermissionGranted,
    routeCoords.length,
    updateNearbyRadarsState,
  ]);

  return {
    currentLocation,
    setCurrentLocation,
    currentLocationRef,
    nearbyRadars: nearbyRadarsWithHints,
    mapRadars,
    nearbyRadarsRef,
    setNearbyRadars,
    updateNearbyRadarsState,
    requestViewportRadars,
    currentSpeed,
    resetSpeed,
    activeAlert,
    closestRadar,
    closestRadarHint,
    resolvedHeading:
      typeof currentLocation?.heading === 'number' && Number.isFinite(currentLocation.heading)
        ? normalizeHeading(currentLocation.heading)
        : lastValidHeadingRef.current ?? 0,
  };
}
