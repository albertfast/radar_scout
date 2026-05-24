import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Platform,
  Linking,
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { SubscriptionService } from '../services/SubscriptionService';
import Animated, {
  FadeInDown,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Trial3DAnimation from '../components/Trial3DAnimation';
import {
  APP_DISPLAY_NAME,
  APP_PRIVACY_POLICY_URL,
  APP_STANDARD_EULA_URL,
  APP_TERMS_URL,
} from '../config/appIdentity';

const { width } = Dimensions.get('window');
const allowLayoutAnimations = Platform.OS !== 'android';
type AccountLinkProvider = 'apple' | 'google';
type TrialPlanKey = 'yearly' | 'weekly' | 'adfree';

const FEATURES = [
  {
    id: '1',
    title: 'Live Radar Alerts',
    subtitle: 'Instant warnings for nearby enforcement and risky zones.',
    icon: 'radar' as const,
    color: '#FF5252',
  },
  {
    id: '2',
    title: 'AI Diagnostics',
    subtitle: "Scan dashboard lights with AI. Know your car's health.",
    icon: 'car-cog' as const,
    color: '#4ECDC4',
  },
  {
    id: '3',
    title: 'Safe Route Match',
    subtitle: 'Find the safest route with our community-driven data.',
    icon: 'map-marker-path' as const,
    color: '#FFE66D',
  },
];

const TrialOfferScreen = ({ navigation }: any) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<TrialPlanKey | 'free' | 'restore' | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<TrialPlanKey>('yearly');
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [storePrices, setStorePrices] = useState<Record<TrialPlanKey, string | null>>({
    yearly: null,
    weekly: null,
    adfree: null,
  });
  const { signInAnonymously } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    const loadLocalizedPrices = async () => {
      try {
        const [yearlyRes, weeklyRes, adfreeRes, yearlyDirect, weeklyDirect, adfreeDirect] =
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
            yearlyRes.targetPackage?.product?.priceString ||
            yearlyDirect.targetProduct?.priceString ||
            null,
          weekly:
            weeklyRes.targetPackage?.product?.priceString ||
            weeklyDirect.targetProduct?.priceString ||
            null,
          adfree:
            adfreeRes.targetPackage?.product?.priceString ||
            adfreeDirect.targetProduct?.priceString ||
            null,
        });
      } catch {
        // Store prices required for compliance
      } finally {
        if (!cancelled) setPricesLoaded(true);
      }
    };

    void loadLocalizedPrices();

    // Preload ads
    (async () => {
      try {
        const { AdService } = await import('../services/AdService');
        AdService.preloadAll?.();
      } catch {}
    })();

    return () => { cancelled = true; };
  }, []);

  // Auto-scroll carousel
  useEffect(() => {
    const interval = setInterval(() => {
      let next = activeIndex + 1;
      if (next >= FEATURES.length) next = 0;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    }, 3000);
    return () => clearInterval(interval);
  }, [activeIndex]);

  // --- Business Logic (unchanged) ---
  const handleLinkAccount = async (provider: AccountLinkProvider) => {
    try {
      setLoading(true);
      const { AccountLinkService } = await import('../services/AccountLinkService');
      const result = await AccountLinkService.linkCurrentUser(provider);
      if (!result.ok) {
        Alert.alert('Link Failed', result.message || 'Could not link your account right now.');
        return;
      }
      Alert.alert('Account Linked', `Your purchase is now attached to your ${provider === 'apple' ? 'Apple' : 'Google'} sign-in.`);
    } finally {
      setLoading(false);
    }
  };

  const promptForAccountLink = async () => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser?.email) return;
    const { AccountLinkService } = await import('../services/AccountLinkService');
    const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'default' | 'destructive' }> = [
      { text: 'Later', style: 'cancel' },
    ];
    if (Platform.OS === 'ios' && AccountLinkService.isProviderSupported('apple')) {
      buttons.push({ text: 'Link Apple ID', onPress: () => { void handleLinkAccount('apple'); } });
    }
    if (AccountLinkService.isProviderSupported('google')) {
      buttons.push({ text: 'Link Google', onPress: () => { void handleLinkAccount('google'); } });
    }
    Alert.alert('Protect Your Purchase', 'Link to Apple or Google so Pro restores across devices.', buttons);
  };

  const handleRestorePurchase = async () => {
    try {
      setLoading(true);
      setActiveAction('restore');
      try { await FirebaseAuthService.signInAnonymously(); } catch {}
      await signInAnonymously();
      const { SubscriptionService } = await import('../services/SubscriptionService');
      const restored = await SubscriptionService.restorePurchases();
      if (!restored) {
        Alert.alert('Restore Failed', 'No previous purchase found for this device.');
        return;
      }
      Alert.alert('Restored', 'Your purchase was restored successfully.');
      await promptForAccountLink();
    } catch (error: any) {
      Alert.alert('Restore Failed', typeof error?.message === 'string' && error.message.trim() ? error.message : 'Could not restore purchases right now.');
    } finally {
      setActiveAction(null);
      setLoading(false);
    }
  };

  const openExternalLink = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) { Alert.alert('Link unavailable'); return; }
      await Linking.openURL(url);
    } catch { Alert.alert('Link unavailable'); }
  };

  const bootstrapAnonymousSession = async () => {
    try { await FirebaseAuthService.signInAnonymously(); } catch {}
    await signInAnonymously();
  };

  const purchasePlan = async (plan: TrialPlanKey): Promise<boolean> => {
    const rcPlan = plan === 'adfree' ? 'adfree' : plan;
    const { SubscriptionService } = await import('../services/SubscriptionService');
    const resolution = await SubscriptionService.getPackageResolution(rcPlan);
    if (resolution.targetPackage) {
      return SubscriptionService.purchasePackage(resolution.targetPackage);
    }
    const directResolution = await SubscriptionService.getDirectProductResolution(rcPlan);
    if (directResolution.targetProduct) {
      return SubscriptionService.purchaseStoreProduct(directResolution.targetProduct);
    }
    return false;
  };

  const handlePurchase = async (plan: TrialPlanKey) => {
    if (!storePrices[plan]) {
      Alert.alert('Store Price Unavailable', 'Please wait for store price to load.');
      return;
    }
    try {
      setLoading(true);
      setActiveAction(plan);
      await bootstrapAnonymousSession();
      let didPurchase = false;
      try { didPurchase = await purchasePlan(plan); } catch (e) { console.log(`${plan} error:`, e); }
      if (didPurchase) await promptForAccountLink();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Please check your internet connection.');
    } finally {
      setActiveAction(null);
      setLoading(false);
    }
  };

  const handleContinueFree = async () => {
    try {
      setLoading(true);
      setActiveAction('free');
      await bootstrapAnonymousSession();
      try {
        const { AdService } = await import('../services/AdService');
        await AdService.showInterstitial('onboarding_entry');
      } catch {}
    } catch (err: any) {
      Alert.alert('Error', 'Please check your internet connection.');
    } finally {
      setActiveAction(null);
      setLoading(false);
    }
  };

  const priceLabel = (key: TrialPlanKey) =>
    storePrices[key] || (pricesLoaded ? '—' : '...');

  const renderFeatureItem = ({ item }: any) => (
    <View style={styles.featureSlide}>
      <View style={[styles.featureIconBg, { shadowColor: item.color }]}>
        <MaterialCommunityIcons name={item.icon} size={32} color={item.color} />
      </View>
      <Text style={styles.featureTitle}>{item.title}</Text>
      <Text style={styles.featureSubtitle}>{item.subtitle}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Background 3D */}
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient colors={['#000000', '#0A1628', '#0F1B2D']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <Trial3DAnimation />
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <Animated.View entering={allowLayoutAnimations ? FadeInDown.delay(100).duration(300) : undefined} style={styles.header}>
          <View style={styles.radarBotBadge}>
            <MaterialCommunityIcons name="radar" size={14} color="#4ECDC4" />
            <Text style={styles.radarBotText}>RADAR BOT</Text>
          </View>
          <TouchableOpacity onPress={handleRestorePurchase} disabled={loading}>
            <Text style={styles.restoreText}>
              {loading && activeAction === 'restore' ? 'Restoring…' : 'Restore'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Hero */}
        <Animated.View entering={allowLayoutAnimations ? FadeInDown.delay(150).duration(400) : undefined} style={styles.hero}>
          <Text style={styles.heroEyebrow}>WELCOME DRIVER</Text>
          <Text style={styles.heroTitle}>Drive calmer,{'\n'}react faster.</Text>
        </Animated.View>

        {/* Continue Free */}
        <TouchableOpacity style={styles.continueFreeBtn} onPress={() => { void handleContinueFree(); }} disabled={loading}>
          {loading && activeAction === 'free' ? (
            <ActivityIndicator color="#CBD5E1" size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="chevron-right" size={16} color="#94A3B8" />
              <Text style={styles.continueFreeText}>Continue with limited access (Ads)</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Feature Carousel */}
        <View style={styles.carouselWrap}>
          <FlatList
            ref={flatListRef}
            data={FEATURES}
            renderItem={renderFeatureItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(ev) => {
              const index = Math.round(ev.nativeEvent.contentOffset.x / (width - 40));
              setActiveIndex(index);
            }}
            snapToInterval={width - 40}
            decelerationRate="fast"
          />
          <View style={styles.dotRow}>
            {FEATURES.map((_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i === activeIndex ? '#38BDF8' : 'rgba(148,163,184,0.3)', width: i === activeIndex ? 18 : 6 }]} />
            ))}
          </View>
        </View>

        {/* Plans — 3 cards side-by-side */}
        <View style={styles.planRow}>
          {/* Weekly */}
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'weekly' && styles.planCardActive]}
            onPress={() => setSelectedPlan('weekly')}
            activeOpacity={0.8}
          >
            <Text style={styles.planPrice}>{priceLabel('weekly')}</Text>
            <Text style={styles.planLabel}>Weekly</Text>
          </TouchableOpacity>

          {/* Yearly */}
          <TouchableOpacity
            style={[styles.planCard, styles.planCardCenter, selectedPlan === 'yearly' && styles.planCardActive]}
            onPress={() => setSelectedPlan('yearly')}
            activeOpacity={0.8}
          >
            <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>BEST</Text></View>
            <Text style={styles.planPrice}>{priceLabel('yearly')}</Text>
            <Text style={styles.planLabel}>Yearly</Text>
            <Text style={styles.planTrial}>3-day trial</Text>
          </TouchableOpacity>

          {/* Remove Ads */}
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'adfree' && styles.planCardActive]}
            onPress={() => setSelectedPlan('adfree')}
            activeOpacity={0.8}
          >
            <Text style={styles.planPrice}>{priceLabel('adfree')}</Text>
            <Text style={styles.planLabel}>No Ads</Text>
          </TouchableOpacity>
        </View>

        {/* Offer Terms — minimal */}
        <Text style={styles.offerTerms}>Cancel anytime.</Text>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaButton, (!storePrices[selectedPlan] || loading) && styles.ctaDisabled]}
          onPress={() => { void handlePurchase(selectedPlan); }}
          disabled={loading || !storePrices[selectedPlan]}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#FF5252', '#D32F2F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGradient}>
            {loading && (activeAction === 'yearly' || activeAction === 'weekly' || activeAction === 'adfree') ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.ctaText}>
                {selectedPlan === 'yearly' ? 'START FREE TRIAL' : selectedPlan === 'weekly' ? 'SUBSCRIBE WEEKLY' : 'REMOVE ADS'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Legal */}
        <Text style={styles.legalText}>
          <Text style={styles.legalLink} onPress={() => { void openExternalLink(APP_STANDARD_EULA_URL); }}>EULA</Text>
          {'  ·  '}
          <Text style={styles.legalLink} onPress={() => { void openExternalLink(APP_PRIVACY_POLICY_URL); }}>Privacy</Text>
          {'  ·  '}
          <Text style={styles.legalLink} onPress={() => { void openExternalLink(APP_TERMS_URL); }}>Terms</Text>
        </Text>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 20 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 },
  radarBotBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: 'rgba(78,205,196,0.3)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(8,14,28,0.7)' },
  radarBotText: { color: '#E2E8F0', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  restoreText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },

  // Hero
  hero: { paddingTop: 2 },
  heroEyebrow: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 4 },
  heroTitle: { color: '#F8FAFC', fontSize: 30, fontWeight: '900', lineHeight: 36 },

  // Continue Free
  continueFreeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148,163,184,0.2)', backgroundColor: 'rgba(15,23,42,0.6)' },
  continueFreeText: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },

  // Carousel
  carouselWrap: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(148,163,184,0.12)', backgroundColor: 'rgba(10,16,30,0.85)', paddingVertical: 12, overflow: 'hidden' },
  featureSlide: { width: width - 40, paddingHorizontal: 14 },
  featureIconBg: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(148,163,184,0.15)', backgroundColor: 'rgba(15,23,42,0.9)', marginBottom: 8 },
  featureTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', marginBottom: 3 },
  featureSubtitle: { color: '#94A3B8', fontSize: 12, lineHeight: 16, fontWeight: '500' },
  dotRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { height: 5, borderRadius: 2.5 },

  // Plans
  planRow: { flexDirection: 'row', gap: 8 },
  planCard: { flex: 1, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(148,163,184,0.2)', backgroundColor: 'rgba(15,23,42,0.6)', paddingVertical: 14, alignItems: 'center', gap: 3 },
  planCardCenter: {},
  planCardActive: { borderColor: '#4ECDC4', backgroundColor: 'rgba(78,205,196,0.08)' },
  planPrice: { color: '#F8FAFC', fontSize: 18, fontWeight: '900' },
  planLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  planTrial: { color: '#4ECDC4', fontSize: 10, fontWeight: '700', marginTop: 1 },
  bestBadge: { position: 'absolute', top: -8, backgroundColor: '#4ECDC4', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 },
  bestBadgeText: { color: '#0F172A', fontSize: 8, fontWeight: '900', letterSpacing: 0.3 },

  // Offer terms
  offerTerms: { color: '#64748B', fontSize: 11, textAlign: 'center', lineHeight: 16, fontWeight: '500' },

  // CTA
  ctaButton: { borderRadius: 14, overflow: 'hidden' },
  ctaDisabled: { opacity: 0.65 },
  ctaGradient: { paddingVertical: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.7 },

  // Legal
  legalText: { color: '#475569', fontSize: 10, textAlign: 'center', paddingBottom: 4 },
  legalLink: { color: '#67E8F9', textDecorationLine: 'underline' },
});

export default TrialOfferScreen;
