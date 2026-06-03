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

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('home');
  const [homeFormation, setHomeFormation] = useState<FormationData | null>(null);
  const [awayFormation, setAwayFormation] = useState<FormationData | null>(null);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAd, setShowAd] = useState(false);

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
        <HomeScreen onProceed={handleHomeScreenProceed} />
      )}

      {currentScreen === 'confirmation' && homeFormation && awayFormation && (
        <ConfirmationScreen
          homeFormation={homeFormation}
          awayFormation={awayFormation}
          onConfirm={handleConfirmationConfirm}
          onBack={handleBackFromConfirmation}
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
