import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
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
  loadAnalysisUsage,
  saveAnalysisUsage,
} from './src/utils/analysisUsage';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [homeFormation, setHomeFormation] = useState<FormationData | null>(null);
  const [awayFormation, setAwayFormation] = useState<FormationData | null>(null);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [showRewardedAd, setShowRewardedAd] = useState(false);
  const [usage, setUsage] = useState<AnalysisUsage>(createEmptyUsage());

  React.useEffect(() => {
    loadAnalysisUsage().then(setUsage);
  }, []);

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

  const restoreAnalysisCredit = async () => {
    const freshUsage = await loadAnalysisUsage();
    if (freshUsage.used <= 0) {
      setUsage(freshUsage);
      return;
    }

    const nextUsage = {
      ...freshUsage,
      used: freshUsage.used - 1,
    };
    await persistUsage(nextUsage);
  };

  const handleRewardEarned = async () => {
    const freshUsage = await loadAnalysisUsage();
    const nextUsage = {
      ...freshUsage,
      rewardedCredits: freshUsage.rewardedCredits + 1,
    };
    await persistUsage(nextUsage);
    Alert.alert('解析回数を追加しました', 'AI解析を1回追加で利用できます。');
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

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor={colors.background} />

      {currentScreen === 'home' && (
        <HomeScreen
          onProceed={handleHomeScreenProceed}
          remainingAnalyses={getRemainingAnalyses(usage)}
          dailyFreeLimit={DAILY_FREE_ANALYSIS_LIMIT}
          onConsumeAnalysisCredit={consumeAnalysisCredit}
          onRestoreAnalysisCredit={restoreAnalysisCredit}
          onRequestRewardedAd={() => setShowRewardedAd(true)}
        />
      )}

      {currentScreen === 'confirmation' && homeFormation && awayFormation && (
        <ConfirmationScreen
          homeFormation={homeFormation}
          awayFormation={awayFormation}
          onConfirm={handleConfirmationConfirm}
          onBack={handleBackFromConfirmation}
          remainingAnalyses={getRemainingAnalyses(usage)}
          dailyFreeLimit={DAILY_FREE_ANALYSIS_LIMIT}
          onConsumeAnalysisCredit={consumeAnalysisCredit}
          onRestoreAnalysisCredit={restoreAnalysisCredit}
          onRequestRewardedAd={() => setShowRewardedAd(true)}
        />
      )}

      {currentScreen === 'prediction' && prediction && (
        <PredictionScreen prediction={prediction} onReset={handleReset} />
      )}

      {/* Loading and Ad Overlay */}
      {showAd && (
        <View style={styles.overlay}>
          <AdPlaceholder type="interstitial" />
          {loading && (
            <ActivityIndicator
              size="large"
              color={colors.goldBright}
              style={styles.loadingIndicator}
            />
          )}
        </View>
      )}

      {showRewardedAd && (
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
