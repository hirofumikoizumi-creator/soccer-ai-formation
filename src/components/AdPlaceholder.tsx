import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AdPlaceholderProps {
  type?: 'banner' | 'interstitial';
  onAdClosed?: () => void;
}

const SAMURAI_BLUE = '#003F8F';
const BANNER_AD_ID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || 'ca-app-pub-5840457424714744/2191315578';
const INTERSTITIAL_AD_ID =
  process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || 'ca-app-pub-5840457424714744/2994711458';

export default function AdPlaceholder({ type = 'banner', onAdClosed }: AdPlaceholderProps) {
  const [adsModule, setAdsModule] = useState<any>(null);
  const [interstitialLoaded, setInterstitialLoaded] = useState(false);

  useEffect(() => {
    try {
      setAdsModule(require('react-native-google-mobile-ads'));
    } catch (error) {
      console.warn('Google Mobile Ads SDK is unavailable', error);
      if (type === 'interstitial') {
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

  if (type === 'interstitial') {
    return (
      <View style={styles.interstitialContainer}>
        <View style={styles.interstitialContent}>
          <Text style={styles.adText}>広告を読み込み中...</Text>
          <Text style={styles.adSubText}>
            {interstitialLoaded ? '広告を表示しています' : 'しばらくお待ちください'}
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
    backgroundColor: '#f0f0f0',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  interstitialContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  interstitialContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  adText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: SAMURAI_BLUE,
    marginBottom: 8,
  },
  adSubText: {
    fontSize: 12,
    color: '#666',
  },
});
