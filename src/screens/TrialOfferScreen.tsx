import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { RadarAnimation } from '../components/RadarAnimation';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { AdService } from '../services/AdService';
import { SubscriptionService } from '../services/SubscriptionService';
import { useAuthStore } from '../store/authStore';
import {
  APP_DISPLAY_NAME,
  APP_PRIVACY_POLICY_URL,
  APP_STANDARD_EULA_URL,
  APP_TERMS_URL,
} from '../config/appIdentity';

const { width, height } = Dimensions.get('window');
const allowLayoutAnimations = Platform.OS !== 'android';
const isCompactDevice = height < 820;
const heroRadarSize = Math.max(122, Math.min(160, Math.round(width * 0.36)));
const introRadarSize = Math.max(220, Math.min(286, Math.round(width * 0.68)));

type ActiveAction = 'free' | 'trial' | 'restore' | null;
type TrialPlanKey = 'yearly' | 'weekly' | 'adfree';

let hasCompletedOpeningIntro = false;

const FEATURES = [
  {
    id: 'live',
    title: 'Live radar',
    subtitle: 'Community stream',
    icon: 'radar' as const,
    color: '#4ECDC4',
  },
  {
    id: 'graphic',
    title: 'Graphic mode',
    subtitle: '3D radar panel',
    icon: 'chart-areaspline' as const,
    color: '#FF8A65',
  },
  {
    id: 'route',
    title: 'Safe route',
    subtitle: 'Route-aware alerts',
    icon: 'map-marker-path' as const,
    color: '#FFE66D',
  },
];

const BENEFITS = [
  { label: 'Graphic & trips', value: 'Free', color: '#4ECDC4' },
  { label: 'Safe route', value: 'Included', color: '#FFE66D' },
  { label: 'Ad-free', value: 'Premium', color: '#FF8A65' },
];

const INTRO_STEPS = [
  {
    eyebrow: 'LIVE 3D RADAR',
    title: 'Radar wakes up around you',
    subtitle: 'The globe scans nearby roads, cameras and risky zones before you start.',
    button: 'NEXT',
  },
  {
    eyebrow: 'DRIVE YOUR WAY',
    title: 'Free with ads, faster with PRO',
    subtitle: 'Continue free, or unlock a cleaner ride with 3D radar and smart alerts.',
    button: 'SEE OPTIONS',
  },
];

const TrialOfferScreen = () => {
  const { signInAnonymously } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [introStep, setIntroStep] = useState(() => (hasCompletedOpeningIntro ? 2 : 0));
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [storePrices, setStorePrices] = useState<Record<TrialPlanKey, string | null>>({
    yearly: null,
    weekly: null,
    adfree: null,
  });

  useEffect(() => {
    let cancelled = false;

    const loadStorePrices = async () => {
      try {
        const [yearly, weekly, adfree, yearlyDirect, weeklyDirect, adfreeDirect] =
          await Promise.all([
            SubscriptionService.getPackageResolution('yearly'),
            SubscriptionService.getPackageResolution('weekly'),
            SubscriptionService.getPackageResolution('adfree'),
            SubscriptionService.getDirectProductResolution('yearly'),
            SubscriptionService.getDirectProductResolution('weekly'),
            SubscriptionService.getDirectProductResolution('adfree'),
          ]);

        if (cancelled) return;

        setStorePrices({
          yearly:
            yearly.targetPackage?.product?.priceString ||
            yearlyDirect.targetProduct?.priceString ||
            null,
          weekly:
            weekly.targetPackage?.product?.priceString ||
            weeklyDirect.targetProduct?.priceString ||
            null,
          adfree:
            adfree.targetPackage?.product?.priceString ||
            adfreeDirect.targetProduct?.priceString ||
            null,
        });
      } catch {
        // Store-localized prices are optional for display and required before purchase.
      } finally {
        if (!cancelled) setPricesLoaded(true);
      }
    };

    void loadStorePrices();
    AdService.preloadAll().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const yearlyPrice = storePrices.yearly || (pricesLoaded ? '-' : '...');
  const weeklyPrice = storePrices.weekly || null;
  const priceHint = storePrices.yearly
    ? `Then ${yearlyPrice}/year${weeklyPrice ? ` · Or ${weeklyPrice}/week` : ''}`
    : 'Store price loading';
  const purchaseDisabled = loading || !storePrices.yearly;

  const ensureSession = async () => {
    try {
      await FirebaseAuthService.signInAnonymously();
    } catch {}

    const { error } = await signInAnonymously();
    if (!error) return;

    throw error instanceof Error
      ? error
      : new Error('Could not start the app. Try again or check your connection.');
  };

  const openExternalLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Link Unavailable', 'Please try again in your browser.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Link Unavailable', 'Please try again in your browser.');
    }
  };

  const purchaseYearlyPlan = async (): Promise<boolean> => {
    const resolution = await SubscriptionService.getPackageResolution('yearly');
    if (resolution.targetPackage) {
      return SubscriptionService.purchasePackage(resolution.targetPackage);
    }

    const directResolution = await SubscriptionService.getDirectProductResolution('yearly');
    if (directResolution.targetProduct) {
      return SubscriptionService.purchaseStoreProduct(directResolution.targetProduct);
    }

    return false;
  };

  const handleIntroNext = () => {
    setIntroStep((current) => {
      const next = Math.min(current + 1, 2);
      if (next === 2) {
        hasCompletedOpeningIntro = true;
      }
      return next;
    });
  };

  const handleContinueWithAds = async () => {
    try {
      setLoading(true);
      setActiveAction('free');
      await AdService.showInterstitial('onboarding_entry').catch(() => 'failed');
      await ensureSession();
    } catch (err: any) {
      Alert.alert(
        'Continue Failed',
        typeof err?.message === 'string' && err.message.trim()
          ? err.message
          : 'Please check your internet connection and try again.'
      );
    } finally {
      setActiveAction(null);
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!storePrices.yearly) {
      Alert.alert('Store Price Unavailable', 'Please wait for the App Store price to load.');
      return;
    }

    try {
      setLoading(true);
      setActiveAction('trial');
      await ensureSession();
      const purchased = await purchaseYearlyPlan();
      if (!purchased) {
        Alert.alert('Payment Failed', 'Purchase could not be completed. Please try again.');
      }
    } catch (err: any) {
      Alert.alert(
        'Payment Error',
        typeof err?.message === 'string' && err.message.trim()
          ? err.message
          : 'Subscription could not be started.'
      );
    } finally {
      setActiveAction(null);
      setLoading(false);
    }
  };

  const handleRestorePurchase = async () => {
    try {
      setLoading(true);
      setActiveAction('restore');
      await ensureSession();
      const restored = await SubscriptionService.restorePurchases();
      Alert.alert(
        restored ? 'Restored' : 'Restore Failed',
        restored ? 'Your purchase was restored successfully.' : 'No previous purchase was found.'
      );
    } catch (err: any) {
      Alert.alert('Restore Failed', err?.message || 'Could not restore purchases.');
    } finally {
      setActiveAction(null);
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#020713', '#06172A', '#101124']} style={StyleSheet.absoluteFill} />
      <View style={styles.tealWash} />
      <View style={styles.coralWash} />

      <SafeAreaView style={styles.safeArea}>
        {introStep < 2 ? (
          <OpeningIntro step={introStep} onNext={handleIntroNext} />
        ) : (
          <>
            <View style={styles.header}>
              <View style={styles.brandRow}>
                <MaterialCommunityIcons name="radar" size={21} color="#4ECDC4" />
                <Text style={styles.brandText}>{APP_DISPLAY_NAME.toUpperCase()}</Text>
              </View>
              <TouchableOpacity onPress={handleRestorePurchase} disabled={loading} style={styles.restoreButton}>
                <Text style={styles.restoreText}>{activeAction === 'restore' ? 'Restoring...' : 'Restore purchases'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.body}>
              <Animated.View
                entering={allowLayoutAnimations ? FadeInDown.delay(40).duration(300) : undefined}
                style={styles.heroCard}
              >
                <View style={styles.heroTopRow}>
                  <View style={styles.heroCopy}>
                    <Text style={styles.eyebrow}>WELCOME DRIVER</Text>
                    <Text style={styles.heroTitle}>Drive{'\n'}calmer,{'\n'}react faster</Text>
                    <Text style={styles.heroSubtitle}>
                      Real-time radar alerts and navigation. Start free with ads - no payment required.
                    </Text>
                  </View>

                  <View style={styles.radarBubble}>
                    <RadarAnimation
                      size={heroRadarSize}
                      rendererMode="life3d"
                      artPreset="contour_orbit"
                      signalLevel={0.86}
                      dangerLevel={0.24}
                      rotationSpeed={1.08}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleContinueWithAds}
                  disabled={loading}
                  activeOpacity={0.9}
                  style={styles.freeButtonWrap}
                >
                  <LinearGradient
                    colors={['#3AE2CF', '#22C7B8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.freeButton}
                  >
                    {activeAction === 'free' ? (
                      <ActivityIndicator color="#06111F" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="chevron-right" size={22} color="#06212B" />
                        <Text style={styles.freeButtonText}>Continue with limited access (Ads)</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.freeCaption}>Free forever with ads. Premium is optional.</Text>

                <View style={styles.featureRow}>
                  {FEATURES.map((feature) => (
                    <View key={feature.id} style={styles.featureCard}>
                      <View style={[styles.featureIcon, { borderColor: `${feature.color}42`, backgroundColor: `${feature.color}15` }]}>
                        <MaterialCommunityIcons name={feature.icon} size={17} color={feature.color} />
                      </View>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
                    </View>
                  ))}
                </View>
              </Animated.View>

              <Animated.View
                entering={allowLayoutAnimations ? FadeInDown.delay(100).duration(300) : undefined}
                style={styles.offerCard}
              >
                <View style={styles.offerTopRow}>
                  <View style={styles.offerCopy}>
                    <Text style={styles.offerEyebrow}>3-DAY FREE TRIAL</Text>
                    <Text style={styles.offerTitle}>Go ad-free on the road</Text>
                  </View>
                  <View style={styles.pricePill}>
                    <Text style={styles.priceValue}>{yearlyPrice}</Text>
                    <Text style={styles.pricePeriod}>per year</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setTrialEnabled((current) => !current)}
                  activeOpacity={0.85}
                  style={styles.toggleRow}
                >
                  <MaterialCommunityIcons
                    name={trialEnabled ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={trialEnabled ? '#FFD84D' : '#8190A8'}
                  />
                  <Text style={styles.toggleText}>Enable 3-day free trial</Text>
                </TouchableOpacity>

                <View style={styles.benefitRow}>
                  {BENEFITS.map((benefit) => (
                    <View key={benefit.label} style={styles.benefitCard}>
                      <Text style={styles.benefitLabel}>{benefit.label}</Text>
                      <Text style={[styles.benefitValue, { color: benefit.color }]}>{benefit.value}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.priceHint}>{priceHint}</Text>

                <TouchableOpacity
                  onPress={handlePurchase}
                  disabled={purchaseDisabled}
                  activeOpacity={0.9}
                  style={[styles.purchaseButtonWrap, purchaseDisabled && styles.disabledButton]}
                >
                  <LinearGradient
                    colors={['#21D6C4', '#1FAEA5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.purchaseButton}
                  >
                    {activeAction === 'trial' ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="shield-check-outline" size={20} color="#FFFFFF" />
                        <Text style={styles.purchaseButtonText}>
                          {trialEnabled ? 'Start 3-day free trial' : 'Start yearly plan'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              <Text style={styles.legalText}>
                <Text style={styles.legalLink} onPress={() => { void openExternalLink(APP_STANDARD_EULA_URL); }}>EULA</Text>
                {'  ·  '}
                <Text style={styles.legalLink} onPress={() => { void openExternalLink(APP_PRIVACY_POLICY_URL); }}>Privacy</Text>
                {'  ·  '}
                <Text style={styles.legalLink} onPress={() => { void openExternalLink(APP_TERMS_URL); }}>Terms</Text>
              </Text>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
};

const OpeningIntro = ({ step, onNext }: { step: number; onNext: () => void }) => {
  const copy = INTRO_STEPS[step];

  return (
    <Animated.View
      key={step}
      entering={allowLayoutAnimations ? FadeInDown.duration(320) : undefined}
      style={styles.intro}
    >
      <View style={styles.introBrand}>
        <MaterialCommunityIcons name="radar" size={23} color="#4ECDC4" />
        <Text style={styles.introBrandText}>{APP_DISPLAY_NAME.toUpperCase()}</Text>
      </View>

      <View style={styles.introRadarFrame}>
        <RadarAnimation
          size={introRadarSize}
          rendererMode="life3d"
          artPreset="contour_orbit"
          signalLevel={step === 0 ? 0.92 : 0.78}
          dangerLevel={step === 0 ? 0.3 : 0.16}
          rotationSpeed={1.18}
        />
      </View>

      <View style={styles.introCopy}>
        <Text style={styles.introEyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.introTitle}>{copy.title}</Text>
        <Text style={styles.introSubtitle}>{copy.subtitle}</Text>
      </View>

      <View style={styles.introPager}>
        {INTRO_STEPS.map((item, index) => (
          <View
            key={item.eyebrow}
            style={[styles.introDot, index === step && styles.introDotActive]}
          />
        ))}
      </View>

      <TouchableOpacity onPress={onNext} activeOpacity={0.9} style={styles.introButtonWrap}>
        <LinearGradient
          colors={['#3AE2CF', '#22C7B8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.introButton}
        >
          <Text style={styles.introButtonText}>{copy.button}</Text>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#06212B" />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020713',
  },
  tealWash: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 999,
    top: 88,
    left: -190,
    backgroundColor: 'rgba(45, 212, 191, 0.2)',
  },
  coralWash: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 999,
    right: -214,
    bottom: 42,
    backgroundColor: 'rgba(255, 82, 82, 0.14)',
  },
  safeArea: {
    flex: 1,
  },
  intro: {
    flex: 1,
    paddingHorizontal: 22,
    paddingBottom: isCompactDevice ? 18 : 26,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  introBrand: {
    minHeight: isCompactDevice ? 54 : 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  introBrandText: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  introRadarFrame: {
    width: introRadarSize + 34,
    height: introRadarSize + 34,
    borderRadius: (introRadarSize + 34) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(48, 211, 196, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.2)',
  },
  introCopy: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  introEyebrow: {
    color: '#38E7D1',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
  },
  introTitle: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: isCompactDevice ? 27 : 31,
    lineHeight: isCompactDevice ? 31 : 35,
    fontWeight: '900',
    textAlign: 'center',
  },
  introSubtitle: {
    marginTop: 8,
    color: '#A7B3C6',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  introPager: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  introDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
  },
  introDotActive: {
    width: 24,
    backgroundColor: '#4ECDC4',
  },
  introButtonWrap: {
    alignSelf: 'stretch',
    borderRadius: 18,
    overflow: 'hidden',
  },
  introButton: {
    minHeight: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  introButtonText: {
    color: '#06212B',
    fontSize: 16,
    fontWeight: '900',
  },
  header: {
    minHeight: isCompactDevice ? 46 : 54,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandText: {
    color: '#F8FAFC',
    fontSize: isCompactDevice ? 18 : 20,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  restoreButton: {
    paddingLeft: 10,
    paddingVertical: 8,
  },
  restoreText: {
    color: '#A8B2C5',
    fontSize: 13,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    paddingHorizontal: 17,
    paddingBottom: isCompactDevice ? 8 : 14,
    justifyContent: 'space-between',
    gap: isCompactDevice ? 8 : 10,
  },
  heroCard: {
    borderRadius: 26,
    padding: isCompactDevice ? 14 : 16,
    backgroundColor: 'rgba(5, 12, 25, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: '#37DEC9',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  heroTitle: {
    marginTop: 6,
    color: '#FFFFFF',
    fontSize: isCompactDevice ? 27 : 31,
    lineHeight: isCompactDevice ? 29 : 33,
    fontWeight: '900',
  },
  heroSubtitle: {
    marginTop: 8,
    color: '#A4AEC1',
    fontSize: isCompactDevice ? 12 : 14,
    lineHeight: isCompactDevice ? 17 : 19,
    fontWeight: '600',
  },
  radarBubble: {
    width: heroRadarSize,
    height: heroRadarSize,
    borderRadius: heroRadarSize / 2,
    backgroundColor: 'rgba(48, 211, 196, 0.13)',
    overflow: 'hidden',
  },
  freeButtonWrap: {
    marginTop: isCompactDevice ? 13 : 16,
    borderRadius: 17,
    overflow: 'hidden',
  },
  freeButton: {
    minHeight: isCompactDevice ? 48 : 52,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  freeButtonText: {
    color: '#06212B',
    fontSize: isCompactDevice ? 14 : 16,
    fontWeight: '900',
  },
  freeCaption: {
    marginTop: 8,
    color: '#9AA7BB',
    textAlign: 'center',
    fontSize: isCompactDevice ? 12 : 13,
    fontWeight: '600',
  },
  featureRow: {
    marginTop: 11,
    flexDirection: 'row',
    gap: 8,
  },
  featureCard: {
    flex: 1,
    minHeight: isCompactDevice ? 86 : 98,
    borderRadius: 16,
    padding: isCompactDevice ? 9 : 11,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
  },
  featureIcon: {
    width: 33,
    height: 33,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    marginTop: 8,
    color: '#F8FAFC',
    fontSize: isCompactDevice ? 12 : 14,
    lineHeight: isCompactDevice ? 14 : 16,
    fontWeight: '900',
  },
  featureSubtitle: {
    marginTop: 4,
    color: '#93A1B7',
    fontSize: isCompactDevice ? 10 : 12,
    lineHeight: isCompactDevice ? 13 : 15,
    fontWeight: '600',
  },
  offerCard: {
    borderRadius: 24,
    padding: isCompactDevice ? 14 : 16,
    backgroundColor: 'rgba(14, 17, 31, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
    overflow: 'hidden',
  },
  offerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  offerCopy: {
    flex: 1,
    minWidth: 0,
  },
  offerEyebrow: {
    color: '#35E2CF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  offerTitle: {
    marginTop: 5,
    color: '#FFFFFF',
    fontSize: isCompactDevice ? 21 : 25,
    lineHeight: isCompactDevice ? 24 : 28,
    fontWeight: '900',
  },
  pricePill: {
    minWidth: 86,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  priceValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  pricePeriod: {
    marginTop: 2,
    color: '#A5B0C2',
    fontSize: 10,
    fontWeight: '800',
  },
  toggleRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  toggleText: {
    color: '#D7DEE9',
    fontSize: isCompactDevice ? 13 : 14,
    fontWeight: '700',
  },
  benefitRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  benefitCard: {
    flex: 1,
    minHeight: isCompactDevice ? 50 : 58,
    borderRadius: 15,
    padding: isCompactDevice ? 9 : 10,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.13)',
  },
  benefitLabel: {
    color: '#909DB2',
    fontSize: isCompactDevice ? 10 : 11,
    fontWeight: '800',
  },
  benefitValue: {
    marginTop: 3,
    fontSize: isCompactDevice ? 13 : 15,
    fontWeight: '900',
  },
  priceHint: {
    marginTop: 10,
    color: '#9BA6B8',
    textAlign: 'center',
    fontSize: isCompactDevice ? 11 : 13,
    fontWeight: '600',
  },
  purchaseButtonWrap: {
    marginTop: 12,
    borderRadius: 18,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.65,
  },
  purchaseButton: {
    minHeight: isCompactDevice ? 50 : 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  purchaseButtonText: {
    color: '#FFFFFF',
    fontSize: isCompactDevice ? 14 : 16,
    fontWeight: '900',
  },
  legalText: {
    color: '#68758A',
    fontSize: 11,
    textAlign: 'center',
  },
  legalLink: {
    color: '#54D9E2',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
});

export default TrialOfferScreen;
