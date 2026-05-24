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
import { Text, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../store/authStore';
import { SubscriptionService } from '../services/SubscriptionService';
import { AnalyticsService } from '../services/AnalyticsService';
import {
  APP_PRIVACY_POLICY_URL,
  APP_STANDARD_EULA_URL,
  APP_TERMS_URL,
} from '../config/appIdentity';

const { height } = Dimensions.get('window');
const isCompactDevice = height < 820;
type MaterialIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type PlanKey = 'weekly' | 'yearly' | 'adfree';
type PlanPrices = Record<PlanKey, string | null>;

const SubscriptionScreen = ({ navigation }: any) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>('yearly');
  const [loading, setLoading] = useState(false);
  const [trialEnabled, setTrialEnabled] = useState(true);
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [planPrices, setPlanPrices] = useState<PlanPrices>({
    adfree: null,
    weekly: null,
    yearly: null,
  });
  const { user } = useAuthStore();
  const successMessage = user?.accountLinkRequiredUntil
    ? 'Your subscription is active. Link your account within 24h to keep access across devices.'
    : 'Your subscription is active.';

  useEffect(() => {
    let cancelled = false;

    const loadLocalizedPrices = async () => {
      try {
        const [
          weeklyResolution,
          yearlyResolution,
          adfreeResolution,
          weeklyDirectResolution,
          yearlyDirectResolution,
        ] = await Promise.all([
          SubscriptionService.getPackageResolution('weekly'),
          SubscriptionService.getPackageResolution('yearly'),
          SubscriptionService.getDirectProductResolution('adfree'),
          SubscriptionService.getDirectProductResolution('weekly'),
          SubscriptionService.getDirectProductResolution('yearly'),
        ]);

        if (cancelled) return;

        setPlanPrices({
          weekly:
            weeklyResolution.targetPackage?.product?.priceString ||
            weeklyDirectResolution.targetProduct?.priceString ||
            null,
          yearly:
            yearlyResolution.targetPackage?.product?.priceString ||
            yearlyDirectResolution.targetProduct?.priceString ||
            null,
          adfree: adfreeResolution.targetProduct?.priceString || null,
        });
      } catch {
        // Store-localized prices are required before purchase, not before display.
      } finally {
        if (!cancelled) setPricesLoaded(true);
      }
    };

    void loadLocalizedPrices();

    return () => {
      cancelled = true;
    };
  }, []);

  const displayPrice = (price: string | null) => price || (pricesLoaded ? '-' : '...');
  const yearlyPrice = displayPrice(planPrices.yearly);
  const weeklyPrice = displayPrice(planPrices.weekly);
  const adfreePrice = displayPrice(planPrices.adfree);
  const selectedPlanPrice = planPrices[selectedPlan];
  const selectedPlanCanPurchase = Boolean(selectedPlanPrice);
  const selectedPlanDisclosure =
    selectedPlan === 'yearly'
      ? planPrices.yearly
        ? `${trialEnabled ? '3-day trial, then ' : ''}${yearlyPrice}/year`
        : 'Store price loading'
      : selectedPlan === 'weekly'
        ? planPrices.weekly
          ? `${weeklyPrice}/week`
          : 'Store price loading'
        : planPrices.adfree
          ? `${adfreePrice} once`
          : 'Store price loading';

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

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      if (!selectedPlanPrice) {
        Alert.alert(
          'Store Price Unavailable',
          'Please wait for the App Store or Google Play price to load before purchasing.'
        );
        return;
      }

      if (!SubscriptionService.isConfigured()) {
        Alert.alert(
          'Payments Not Configured',
          'RevenueCat API key is missing. Configure EXPO_PUBLIC_REVENUECAT_IOS_API_KEY and EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY.'
        );
        return;
      }

      const planToPurchase = selectedPlan;

      await AnalyticsService.trackEvent('subscription_attempt', {
        plan: planToPurchase,
        trial: planToPurchase === 'yearly' && trialEnabled,
      });

      const resolution = await SubscriptionService.getPackageResolution(planToPurchase);
      let purchaseSource = resolution.matchSource || 'unresolved_package';
      let purchased = false;
      let purchasedProductId = resolution.targetPackage?.product?.identifier || null;

      if (resolution.targetPackage) {
        purchased = await SubscriptionService.purchasePackage(resolution.targetPackage);
      } else {
        const directResolution = await SubscriptionService.getDirectProductResolution(planToPurchase);
        if (directResolution.targetProduct) {
          purchaseSource = directResolution.matchSource || 'canonical_product';
          purchasedProductId = directResolution.targetProduct.identifier;
          purchased = await SubscriptionService.purchaseStoreProduct(directResolution.targetProduct);
        } else {
          Alert.alert(
            'Package Mapping Missing',
            `No package mapped for "${planToPurchase}". Please check RevenueCat product mapping.`
          );
          return;
        }
      }

      if (!purchased) {
        Alert.alert('Payment Failed', 'Purchase could not be completed. Please try again.');
        return;
      }

      await AnalyticsService.trackEvent('subscription_success', {
        source: purchaseSource,
        package_id: resolution.targetPackage?.identifier,
        product_id: purchasedProductId,
      });

      Alert.alert('Success', successMessage);
      navigation.goBack();
    } catch (err) {
      console.error('Subscription purchase error:', err);
      Alert.alert('Payment Error', 'An unexpected error occurred during payment.');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      await SubscriptionService.openSubscriptionManagement();
    } catch {
      Alert.alert('Link Unavailable', 'Please open your store subscription settings manually.');
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    const restored = await SubscriptionService.restorePurchases();
    setLoading(false);
    if (restored) {
      Alert.alert('Restored', 'Your purchases have been restored.');
      navigation.goBack();
      return;
    }
    Alert.alert('Restore Failed', 'No purchases were restored.');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0B0E14', '#121821', '#0B0E14']} style={StyleSheet.absoluteFill} />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <IconButton
            icon="close"
            iconColor="#F8FAFC"
            size={28}
            onPress={() => navigation.goBack()}
          />
          <TouchableOpacity onPress={handleRestore} disabled={loading} style={styles.restoreButton}>
            <Text style={styles.restoreText}>Restore</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.proHeroCard}>
            <View style={styles.proTitleRow}>
              <View style={styles.crownCircle}>
                <MaterialCommunityIcons name="crown" size={isCompactDevice ? 21 : 24} color="#0B0E14" />
              </View>
              <View style={styles.proTitleCopy}>
                <Text style={styles.proTitle}>Unlock PRO</Text>
                <Text style={styles.proSubtitle}>Faster radar intelligence, clean experience.</Text>
              </View>
            </View>
            <View style={styles.trustRow}>
              <TrustItem icon="account-group" label="50K+ users" />
              <TrustItem icon="star" label="4.8 rating" />
              <TrustItem icon="shield-check" label="Secure" />
            </View>
          </View>

          <View style={styles.featureGrid}>
            <FeatureTile icon="radar" text="Real-time alerts" tone="#FF5A7A" />
            <FeatureTile icon="map-marker-path" text="Smart routes" tone="#2DD4BF" />
            <FeatureTile icon="car-cog" text="AI diagnosis" tone="#60A5FA" />
            <FeatureTile icon="chart-line" text="Drive analytics" tone="#A78BFA" />
          </View>

          <View style={styles.priceCardsRow}>
            <PriceCard
              label="Weekly"
              price={weeklyPrice}
              period="per week"
              selected={selectedPlan === 'weekly'}
              onSelect={() => setSelectedPlan('weekly')}
            />
            <PriceCard
              label="Yearly"
              price={yearlyPrice}
              period="per year"
              badge="SAVE 80%"
              subtext={planPrices.yearly ? '~$1.66/month' : undefined}
              selected={selectedPlan === 'yearly'}
              onSelect={() => setSelectedPlan('yearly')}
            />
          </View>

          <TouchableOpacity
            style={[styles.adfreeRow, selectedPlan === 'adfree' && styles.rowSelected]}
            onPress={() => setSelectedPlan('adfree')}
            activeOpacity={0.88}
          >
            <View style={styles.rowLeft}>
              <MaterialCommunityIcons name="block-helper" size={21} color="#FFD84D" />
              <Text style={styles.rowText}>Ads Off</Text>
            </View>
            <Text style={styles.rowPrice}>{adfreePrice} once</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.trialToggleRow}
            onPress={() => setTrialEnabled((current) => !current)}
            activeOpacity={0.88}
          >
            <Text style={styles.rowText}>Enable 3-day free trial</Text>
            <View style={[styles.trialSwitch, trialEnabled && styles.trialSwitchActive]}>
              <View style={styles.trialKnob} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subscribeButton, (loading || !selectedPlanCanPurchase) && styles.disabledButton]}
            onPress={handleSubscribe}
            disabled={loading || !selectedPlanCanPurchase}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FF6B6B', '#FF5252']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.subscribeGradient}
            >
              <MaterialCommunityIcons name="lightning-bolt" size={18} color="#FFFFFF" />
              <View style={styles.subscribeCopy}>
                <Text style={styles.subscribeButtonText}>
                  {loading
                    ? 'PROCESSING...'
                    : selectedPlan === 'yearly'
                      ? trialEnabled
                        ? 'START 3-DAY TRIAL'
                        : 'START YEARLY PLAN'
                      : selectedPlan === 'weekly'
                        ? 'START WEEKLY PLAN'
                        : 'BUY AD-FREE BASIC'}
                </Text>
                <Text style={styles.subscribeSubtext}>{selectedPlanDisclosure}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footerLinks}>
            <Text style={styles.footerLink} onPress={handleManageSubscription}>Manage</Text>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerLink} onPress={() => { void openExternalLink(APP_STANDARD_EULA_URL); }}>EULA</Text>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerLink} onPress={() => { void openExternalLink(APP_PRIVACY_POLICY_URL); }}>Privacy</Text>
            <Text style={styles.footerDot}>·</Text>
            <Text style={styles.footerLink} onPress={() => { void openExternalLink(APP_TERMS_URL); }}>Terms</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const FeatureTile = ({ icon, text, tone }: { icon: MaterialIconName; text: string; tone: string }) => (
  <View style={[styles.featureTile, { borderColor: `${tone}40` }]}>
    <View style={[styles.featureIcon, { backgroundColor: `${tone}20` }]}>
      <MaterialCommunityIcons name={icon} size={18} color={tone} />
    </View>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const TrustItem = ({ icon, label }: { icon: MaterialIconName; label: string }) => (
  <View style={styles.trustItem}>
    <MaterialCommunityIcons name={icon} size={15} color="#CBD5E1" />
    <Text style={styles.trustText}>{label}</Text>
  </View>
);

const PriceCard = ({
  label,
  price,
  period,
  badge,
  subtext,
  selected,
  onSelect,
}: {
  label: string;
  price: string;
  period: string;
  badge?: string;
  subtext?: string;
  selected: boolean;
  onSelect: () => void;
}) => (
  <TouchableOpacity
    style={[styles.priceCard, selected && styles.priceCardSelected]}
    onPress={onSelect}
    activeOpacity={0.88}
  >
    <View style={styles.priceHeader}>
      <View>
        {badge ? (
          <View style={styles.priceBadge}>
            <Text style={styles.priceBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <Text style={styles.priceLabel}>{label}</Text>
      </View>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <View style={styles.radioInner} /> : null}
      </View>
    </View>
    <Text style={styles.priceAmount}>{price}</Text>
    <Text style={styles.pricePeriodText}>{period}</Text>
    {subtext ? <Text style={styles.priceSubtext}>{subtext}</Text> : null}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  safeArea: {
    flex: 1,
  },
  glowTop: {
    position: 'absolute',
    top: -122,
    right: -92,
    width: 235,
    height: 235,
    borderRadius: 118,
    backgroundColor: 'rgba(45,212,191,0.17)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -150,
    left: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,82,82,0.18)',
  },
  header: {
    minHeight: isCompactDevice ? 46 : 54,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  restoreButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  restoreText: {
    color: '#A8B2C5',
    fontSize: 14,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingBottom: isCompactDevice ? 10 : 16,
    justifyContent: 'space-between',
    gap: isCompactDevice ? 8 : 10,
  },
  proHeroCard: {
    borderRadius: 22,
    padding: isCompactDevice ? 14 : 17,
    backgroundColor: 'rgba(30, 32, 54, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  proTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  crownCircle: {
    width: isCompactDevice ? 43 : 48,
    height: isCompactDevice ? 43 : 48,
    borderRadius: 24,
    backgroundColor: '#FFD84D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  proTitle: {
    color: '#FFFFFF',
    fontSize: isCompactDevice ? 28 : 32,
    lineHeight: isCompactDevice ? 31 : 35,
    fontWeight: '900',
  },
  proSubtitle: {
    marginTop: 4,
    color: '#CBD5E1',
    fontSize: isCompactDevice ? 13 : 15,
    lineHeight: isCompactDevice ? 17 : 19,
    fontWeight: '600',
  },
  trustRow: {
    marginTop: isCompactDevice ? 10 : 13,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trustText: {
    color: '#CBD5E1',
    fontSize: isCompactDevice ? 12 : 13,
    fontWeight: '700',
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  featureTile: {
    width: '48.5%',
    minHeight: isCompactDevice ? 48 : 54,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    backgroundColor: 'rgba(255,255,255,0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: isCompactDevice ? 12 : 13,
    fontWeight: '800',
  },
  priceCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priceCard: {
    flex: 1,
    minHeight: isCompactDevice ? 126 : 146,
    borderRadius: 20,
    padding: isCompactDevice ? 13 : 15,
    backgroundColor: 'rgba(34, 37, 74, 0.72)',
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.22)',
  },
  priceCardSelected: {
    borderColor: '#FFD84D',
    backgroundColor: 'rgba(39, 39, 84, 0.9)',
  },
  priceHeader: {
    minHeight: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  priceBadge: {
    alignSelf: 'flex-start',
    marginBottom: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: '#FFD84D',
  },
  priceBadgeText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '900',
  },
  priceLabel: {
    color: '#D5DEED',
    fontSize: isCompactDevice ? 13 : 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  priceAmount: {
    marginTop: isCompactDevice ? 10 : 13,
    color: '#FFFFFF',
    fontSize: isCompactDevice ? 30 : 35,
    lineHeight: isCompactDevice ? 33 : 38,
    fontWeight: '900',
  },
  pricePeriodText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '800',
  },
  priceSubtext: {
    marginTop: 5,
    color: '#97A6BC',
    fontSize: 12,
    fontWeight: '600',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#8290A8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#FFD84D',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD84D',
  },
  adfreeRow: {
    minHeight: isCompactDevice ? 44 : 50,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: 'rgba(44, 38, 82, 0.72)',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  trialToggleRow: {
    minHeight: isCompactDevice ? 44 : 50,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    backgroundColor: 'rgba(44, 38, 82, 0.72)',
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowSelected: {
    borderColor: '#FFD84D',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowText: {
    color: '#F8FAFC',
    fontSize: isCompactDevice ? 14 : 16,
    fontWeight: '900',
  },
  rowPrice: {
    color: '#F8FAFC',
    fontSize: isCompactDevice ? 13 : 15,
    fontWeight: '900',
  },
  trialSwitch: {
    width: 54,
    height: 31,
    borderRadius: 18,
    padding: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    alignItems: 'flex-start',
  },
  trialSwitchActive: {
    backgroundColor: '#FFD84D',
    alignItems: 'flex-end',
  },
  trialKnob: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#0F172A',
  },
  subscribeButton: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  disabledButton: {
    opacity: 0.65,
  },
  subscribeGradient: {
    minHeight: isCompactDevice ? 58 : 66,
    paddingVertical: 12,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
  },
  subscribeCopy: {
    flex: 1,
    alignItems: 'center',
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: isCompactDevice ? 15 : 16,
  },
  subscribeSubtext: {
    color: '#FFE5E5',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '800',
    textAlign: 'center',
  },
  footerLinks: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  footerLink: {
    color: '#54D9E2',
    fontSize: 11,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  footerDot: {
    color: '#65758C',
    fontSize: 12,
    fontWeight: '800',
  },
});

export default SubscriptionScreen;
