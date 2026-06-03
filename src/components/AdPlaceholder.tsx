import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  TestIds,
} from 'react-native-google-mobile-ads';

interface AdPlaceholderProps {
  type?: 'banner' | 'interstitial';
  onAdClosed?: () => void;
}

const SAMURAI_BLUE = '#003F8F';
const BANNER_AD_ID = process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || TestIds.BANNER;
const INTERSTITIAL_AD_ID =
  process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || 'ca-app-pub-5840457424714744/2994711458';

export default function AdPlaceholder({ type = 'banner', onAdClosed }: AdPlaceholderProps) {
  const [interstitialLoaded, setInterstitialLoaded] = useState(false);
  const interstitial = useMemo(
    () =>
      InterstitialAd.createForAdRequest(INTERSTITIAL_AD_ID, {
        requestNonPersonalizedAdsOnly: true,
      }),
    []
  );

  useEffect(() => {
    if (type === 'interstitial') {
      const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        setInterstitialLoaded(true);
        interstitial.show();
      });
      const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        setInterstitialLoaded(false);
        onAdClosed?.();
      });
      const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, () => {
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
  }, [interstitial, type, onAdClosed]);

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

  return (
    <View style={styles.bannerContainer}>
      <BannerAd
        unitId={BANNER_AD_ID}
        size={BannerAdSize.BANNER}
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
