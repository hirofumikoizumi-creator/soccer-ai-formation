import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

interface AdPlaceholderProps {
  type?: 'banner' | 'interstitial' | 'rewarded';
  onAdClosed?: () => void;
  onRewardEarned?: () => void;
}

const BANNER_AD_ID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || 'ca-app-pub-5840457424714744/2191315578';
const INTERSTITIAL_AD_ID =
  process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || 'ca-app-pub-5840457424714744/2994711458';
const REWARDED_AD_ID =
  process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || 'ca-app-pub-5840457424714744/2803510894';

export default function AdPlaceholder({
  type = 'banner',
  onAdClosed,
  onRewardEarned,
}: AdPlaceholderProps) {
  const [adsModule, setAdsModule] = useState<any>(null);
  const [interstitialLoaded, setInterstitialLoaded] = useState(false);
  const [rewardedLoaded, setRewardedLoaded] = useState(false);

  useEffect(() => {
    try {
      setAdsModule(require('react-native-google-mobile-ads'));
    } catch (error) {
      console.warn('Google Mobile Ads SDK is unavailable', error);
      if (type === 'interstitial' || type === 'rewarded') {
        onAdClosed?.();
      }
    }
  }, [type, onAdClosed]);

  const interstitial = useMemo(() => {
    if (!adsModule) {
      return null;
    }

    return adsModule.InterstitialAd.createForAdRequest(INTERSTITIAL_AD_ID, {
      requestNonPersonalizedAdsOnly: true,
    });
  }, [adsModule]);

  const rewarded = useMemo(() => {
    if (!adsModule) {
      return null;
    }

    return adsModule.RewardedAd.createForAdRequest(REWARDED_AD_ID, {
      requestNonPersonalizedAdsOnly: true,
    });
  }, [adsModule]);

  useEffect(() => {
    if (type === 'interstitial' && interstitial && adsModule) {
      const unsubscribeLoaded = interstitial.addAdEventListener(adsModule.AdEventType.LOADED, () => {
        setInterstitialLoaded(true);
        interstitial.show();
      });
      const unsubscribeClosed = interstitial.addAdEventListener(adsModule.AdEventType.CLOSED, () => {
        setInterstitialLoaded(false);
        onAdClosed?.();
      });
      const unsubscribeError = interstitial.addAdEventListener(adsModule.AdEventType.ERROR, () => {
        setInterstitialLoaded(false);
        onAdClosed?.();
      });

      interstitial.load();

      return () => {
        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();
      };
    }
  }, [adsModule, interstitial, type, onAdClosed]);

  useEffect(() => {
    if (type === 'rewarded' && rewarded && adsModule) {
      let rewardEarned = false;
      const unsubscribeLoaded = rewarded.addAdEventListener(adsModule.RewardedAdEventType.LOADED, () => {
        setRewardedLoaded(true);
        rewarded.show();
      });
      const unsubscribeEarned = rewarded.addAdEventListener(
        adsModule.RewardedAdEventType.EARNED_REWARD,
        () => {
          rewardEarned = true;
          onRewardEarned?.();
        }
      );
      const unsubscribeClosed = rewarded.addAdEventListener(adsModule.AdEventType.CLOSED, () => {
        setRewardedLoaded(false);
        if (!rewardEarned) {
          onAdClosed?.();
          return;
        }
        onAdClosed?.();
      });
      const unsubscribeError = rewarded.addAdEventListener(adsModule.AdEventType.ERROR, () => {
        setRewardedLoaded(false);
        onAdClosed?.();
      });

      rewarded.load();

      return () => {
        unsubscribeLoaded();
        unsubscribeEarned();
        unsubscribeClosed();
        unsubscribeError();
      };
    }
  }, [adsModule, rewarded, type, onAdClosed, onRewardEarned]);

  if (type === 'interstitial' || type === 'rewarded') {
    const isRewarded = type === 'rewarded';
    const loaded = isRewarded ? rewardedLoaded : interstitialLoaded;

    return (
      <View style={styles.interstitialContainer}>
        <View style={styles.interstitialContent}>
          <Text style={styles.adText}>
            {isRewarded ? 'リワード広告を読み込み中...' : '広告を読み込み中...'}
          </Text>
          <Text style={styles.adSubText}>
            {loaded ? '広告を表示しています' : 'しばらくお待ちください'}
          </Text>
        </View>
      </View>
    );
  }

  if (!adsModule) {
    return (
      <View style={styles.bannerContainer}>
        <Text style={styles.adSubText}>広告を準備中...</Text>
      </View>
    );
  }

  const BannerAd = adsModule.BannerAd;

  return (
    <View style={styles.bannerContainer}>
      <BannerAd
        unitId={BANNER_AD_ID}
        size={adsModule.BannerAdSize.BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    width: '100%',
    height: 50,
    backgroundColor: colors.panel,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  interstitialContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2, 8, 23, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  interstitialContent: {
    backgroundColor: colors.panelElevated,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  adText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.goldBright,
    marginBottom: 8,
  },
  adSubText: {
    fontSize: 12,
    color: colors.muted,
  },
});
