import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { BannerAd, BannerAdSize, InterstitialAd, AdEventType } from 'expo-ads-admob';

interface AdPlaceholderProps {
  type?: 'banner' | 'interstitial';
  onAdClosed?: () => void;
}

const SAMURAI_BLUE = '#003F8F';
const INTERSTITIAL_AD_ID = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID || 'ca-app-pub-5840457424714744/2994711458';

export default function AdPlaceholder({ type = 'banner', onAdClosed }: AdPlaceholderProps) {
  const [interstitialLoaded, setInterstitialLoaded] = useState(false);

  useEffect(() => {
    if (type === 'interstitial') {
      const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_ID);

      const unsubscribe = interstitial.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          setInterstitialLoaded(false);
          onAdClosed?.();
        }
      );

      interstitial.load();
      setInterstitialLoaded(true);

      return () => {
        unsubscribe();
      };
    }
  }, [type, onAdClosed]);

  if (type === 'interstitial') {
    return (
      <View style={styles.interstitialContainer}>
        <View style={styles.interstitialContent}>
          {interstitialLoaded ? (
            <>
              <Text style={styles.adText}>広告を読み込み中...</Text>
              <ActivityIndicator size="large" color={SAMURAI_BLUE} style={{ marginTop: 16 }} />
            </>
          ) : (
            <>
              <Text style={styles.adText}>広告</Text>
              <Text style={styles.adSubText}>AdMob インタースティシャル広告</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.bannerContainer}>
      <BannerAd
        size={BannerAdSize.BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
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
