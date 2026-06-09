import React, { useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import HomeScreen from './src/screens/HomeScreen';
import ConfirmationScreen from './src/screens/ConfirmationScreen';
import PredictionScreen from './src/screens/PredictionScreen';
import AdPlaceholder from './src/components/AdPlaceholder';
import { predictMatchOutcome } from './src/services/geminiService';
import type { FormationData, PredictionData, AppScreen } from './src/types';
import { colors } from './src/theme';
import {
  AnalysisUsage,
  createEmptyUsage,
  DAILY_FREE_ANALYSIS_LIMIT,
  getRemainingAnalyses,
  getRemainingRewardedAds,
  loadAnalysisUsage,
  saveAnalysisUsage,
} from './src/utils/analysisUsage';

type TrackingPermissionState = 'checking' | 'needsPrompt' | 'ready';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [homeFormation, setHomeFormation] = useState<FormationData | null>(null);
  const [awayFormation, setAwayFormation] = useState<FormationData | null>(null);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [showRewardedAd, setShowRewardedAd] = useState(false);
  const [rewardPurpose, setRewardPurpose] = useState<'prediction' | 'imageRead'>('prediction');
  const [usage, setUsage] = useState<AnalysisUsage>(createEmptyUsage());
  const [trackingPermissionState, setTrackingPermissionState] =
    useState<TrackingPermissionState>('checking');

  React.useEffect(() => {
    loadAnalysisUsage().then(setUsage);
  }, []);

  React.useEffect(() => {
    let mounted = true;

    const checkTrackingPermission = async () => {
      try {
        if (Platform.OS !== 'ios') {
          setTrackingPermissionState('ready');
          return;
        }

        const permission = await getTrackingPermissionsAsync();

        if (permission.status === 'undetermined' && permission.canAskAgain) {
          setTrackingPermissionState('needsPrompt');
          return;
        }

        setTrackingPermissionState('ready');
      } catch (error) {
        console.warn('Unable to check tracking permission', error);
        if (mounted) {
          setTrackingPermissionState('ready');
        }
      }
    };

    checkTrackingPermission();

    return () => {
      mounted = false;
    };
  }, []);

  const trackingPermissionReady = trackingPermissionState === 'ready';

  const handleTrackingPromptContinue = async () => {
    try {
      await requestTrackingPermissionsAsync();
    } catch (error) {
      console.warn('Unable to request tracking permission', error);
    } finally {
      setTrackingPermissionState('ready');
    }
  };

  const persistUsage = async (nextUsage: AnalysisUsage) => {
    setUsage(nextUsage);
    await saveAnalysisUsage(nextUsage);
  };

  const consumeAnalysisCredit = async () => {
    const freshUsage = await loadAnalysisUsage();
    const remaining = getRemainingAnalyses(freshUsage);
    if (remaining <= 0) {
      setUsage(freshUsage);
      return false;
    }

    const nextUsage = {
      ...freshUsage,
      used: freshUsage.used + 1,
    };
    await persistUsage(nextUsage);
    return true;
  };

  const handleRewardEarned = async () => {
    const freshUsage = await loadAnalysisUsage();
    if (getRemainingRewardedAds(freshUsage) <= 0) {
      setUsage(freshUsage);
      Alert.alert('本日の広告追加は上限です', 'リワード広告による追加は1日3回までです。');
      return;
    }

    const nextUsage = {
      ...freshUsage,
      rewardedCredits:
        rewardPurpose === 'prediction'
          ? freshUsage.rewardedCredits + 1
          : freshUsage.rewardedCredits,
      imageReadCredits:
        rewardPurpose === 'imageRead'
          ? freshUsage.imageReadCredits + 1
          : freshUsage.imageReadCredits,
      rewardedViews: freshUsage.rewardedViews + 1,
    };
    await persistUsage(nextUsage);
    Alert.alert(
      rewardPurpose === 'prediction' ? '試合予想回数を追加しました' : '画像再読取を追加しました',
      rewardPurpose === 'prediction'
        ? 'AI分析を1回追加で利用できます。'
        : '画像のAI再読み取りを1回利用できます。もう一度AI読取を押してください。'
    );
  };

  const requestRewardedAd = async (purpose: 'prediction' | 'imageRead' = 'prediction') => {
    const freshUsage = await loadAnalysisUsage();
    setUsage(freshUsage);

    if (getRemainingRewardedAds(freshUsage) <= 0) {
      Alert.alert('本日の広告追加は上限です', 'リワード広告による追加は1日3回までです。手入力での修正は無料で利用できます。');
      return;
    }

    setRewardPurpose(purpose);
    setShowRewardedAd(true);
  };

  const consumeImageReadCredit = async () => {
    const freshUsage = await loadAnalysisUsage();
    if (freshUsage.imageReadCredits <= 0) {
      setUsage(freshUsage);
      return false;
    }

    const nextUsage = {
      ...freshUsage,
      imageReadCredits: freshUsage.imageReadCredits - 1,
    };
    await persistUsage(nextUsage);
    return true;
  };

  const handleHomeScreenProceed = (home: FormationData, away: FormationData) => {
    setHomeFormation(home);
    setAwayFormation(away);
    setCurrentScreen('confirmation');
  };

  const handleConfirmationConfirm = async (
    home: FormationData,
    away: FormationData
  ) => {
    const freshUsage = await loadAnalysisUsage();
    const remaining = getRemainingAnalyses(freshUsage);
    if (remaining <= 0) {
      setUsage(freshUsage);
      Alert.alert(
        '本日の無料試合予想を使い切りました',
        'リワード広告を見ると試合予想を1回追加できます。',
        [
          { text: 'あとで', style: 'cancel' },
          { text: '広告を見て+1回', onPress: () => requestRewardedAd('prediction') },
        ]
      );
      return;
    }

    setHomeFormation(home);
    setAwayFormation(away);
    setLoading(true);
    setShowAd(true);

    try {
      // Show ad for 3 seconds before proceeding
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Generate prediction
      const result = await predictMatchOutcome(
        home.teamName,
        away.teamName,
        home.formation,
        away.formation,
        home.players,
        away.players
      );

      const consumed = await consumeAnalysisCredit();
      if (!consumed) {
        Alert.alert(
          '本日の無料試合予想を使い切りました',
          'リワード広告を見ると試合予想を1回追加できます。',
          [
            { text: 'あとで', style: 'cancel' },
            { text: '広告を見て+1回', onPress: () => requestRewardedAd('prediction') },
          ]
        );
        setCurrentScreen('confirmation');
        return;
      }

      setPrediction(result);
      setCurrentScreen('prediction');
    } catch (error) {
      Alert.alert('エラー', '試合予想の生成に失敗しました');
      console.error(error);
      setCurrentScreen('confirmation');
    } finally {
      setLoading(false);
      setShowAd(false);
    }
  };

  const handleReset = () => {
    setCurrentScreen('home');
    setHomeFormation(null);
    setAwayFormation(null);
    setPrediction(null);
  };

  const handleBackFromConfirmation = () => {
    setCurrentScreen('home');
    setHomeFormation(null);
    setAwayFormation(null);
  };

  if (trackingPermissionState === 'checking') {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={colors.goldBright} />
      </View>
    );
  }

  if (trackingPermissionState === 'needsPrompt') {
    return (
      <View style={styles.permissionContainer}>
        <StatusBar style="light" />
        <View style={styles.permissionPanel}>
          <Text style={styles.permissionTitle}>広告表示に関する確認</Text>
          <Text style={styles.permissionText}>
            本アプリでは、広告配信、広告効果測定、不正防止のためにデバイス識別子を使用する場合があります。
          </Text>
          <Text style={styles.permissionText}>
            次の画面でトラッキング許可の確認が表示されます。許可しない場合でも、アプリは引き続き利用できます。
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={handleTrackingPromptContinue}
          >
            <Text style={styles.permissionButtonText}>続行</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {currentScreen === 'home' && (
        <HomeScreen
          onProceed={handleHomeScreenProceed}
          remainingAnalyses={getRemainingAnalyses(usage)}
          remainingRewardedAds={getRemainingRewardedAds(usage)}
          dailyFreeLimit={DAILY_FREE_ANALYSIS_LIMIT}
          onRequestRewardedAd={() => requestRewardedAd('prediction')}
          onRequestImageReadReward={() => requestRewardedAd('imageRead')}
          onConsumeImageReadCredit={consumeImageReadCredit}
        />
      )}

      {currentScreen === 'confirmation' && homeFormation && awayFormation && (
        <ConfirmationScreen
          homeFormation={homeFormation}
          awayFormation={awayFormation}
          onConfirm={handleConfirmationConfirm}
          onBack={handleBackFromConfirmation}
          remainingAnalyses={getRemainingAnalyses(usage)}
          remainingRewardedAds={getRemainingRewardedAds(usage)}
          dailyFreeLimit={DAILY_FREE_ANALYSIS_LIMIT}
          onRequestRewardedAd={() => requestRewardedAd('prediction')}
          onRequestImageReadReward={() => requestRewardedAd('imageRead')}
          onConsumeImageReadCredit={consumeImageReadCredit}
        />
      )}

      {currentScreen === 'prediction' && prediction && (
        <PredictionScreen
          prediction={prediction}
          onReset={handleReset}
          adsEnabled={trackingPermissionReady}
        />
      )}

      {/* Loading and Ad Overlay */}
      {showAd && (
        <View style={styles.overlay}>
          {trackingPermissionReady && <AdPlaceholder type="interstitial" />}
          {loading && (
            <ActivityIndicator
              size="large"
              color={colors.goldBright}
              style={styles.loadingIndicator}
            />
          )}
        </View>
      )}

      {showRewardedAd && trackingPermissionReady && (
        <AdPlaceholder
          type="rewarded"
          onRewardEarned={handleRewardEarned}
          onAdClosed={() => setShowRewardedAd(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionPanel: {
    width: '100%',
    maxWidth: 460,
    padding: 22,
    borderRadius: 14,
    backgroundColor: colors.panelElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  permissionTitle: {
    color: colors.goldBright,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  permissionButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.gold,
  },
  permissionButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '900',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    backgroundColor: 'rgba(2, 8, 23, 0.92)',
  },
  loadingIndicator: {
    marginTop: 20,
  },
});
