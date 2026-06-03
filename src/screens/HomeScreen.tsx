import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { pickImage, takePhoto } from '../utils/imagePicker';
import { analyzeFormationImage } from '../services/geminiService';
import type { FormationData } from '../types';

interface HomeScreenProps {
  onProceed: (homeFormation: FormationData, awayFormation: FormationData) => void;
}

const SAMURAI_BLUE = '#003F8F';

export default function HomeScreen({ onProceed }: HomeScreenProps) {
  const [homeFormation, setHomeFormation] = useState<FormationData | null>(null);
  const [awayFormation, setAwayFormation] = useState<FormationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState<'home' | 'away' | null>(null);

  const handleSelectImage = async (teamType: 'home' | 'away') => {
    try {
      const base64 = await pickImage();
      if (!base64) return;

      setAnalyzing(teamType);
      const analysis = await analyzeFormationImage(base64, teamType);

      const formationData: FormationData = {
        teamName: analysis.teamName,
        formation: analysis.formation,
        players: analysis.players,
        imageUri: `data:image/jpeg;base64,${base64}`,
      };

      if (teamType === 'home') {
        setHomeFormation(formationData);
      } else {
        setAwayFormation(formationData);
      }
    } catch (error) {
      Alert.alert('エラー', 'フォーメーション画像の解析に失敗しました');
      console.error(error);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleTakePhoto = async (teamType: 'home' | 'away') => {
    try {
      const base64 = await takePhoto();
      if (!base64) return;

      setAnalyzing(teamType);
      const analysis = await analyzeFormationImage(base64, teamType);

      const formationData: FormationData = {
        teamName: analysis.teamName,
        formation: analysis.formation,
        players: analysis.players,
        imageUri: `data:image/jpeg;base64,${base64}`,
      };

      if (teamType === 'home') {
        setHomeFormation(formationData);
      } else {
        setAwayFormation(formationData);
      }
    } catch (error) {
      Alert.alert('エラー', 'フォーメーション画像の解析に失敗しました');
      console.error(error);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleProceed = () => {
    if (!homeFormation || !awayFormation) {
      Alert.alert('エラー', 'ホーム・アウェイ両方のフォーメーション画像を選択してください');
      return;
    }
    onProceed(homeFormation, awayFormation);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>サッカーAI試合予想</Text>
        <Text style={styles.subtitle}>フォーメーション画像をアップロード</Text>
      </View>

      {/* Home Team Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ホームチーム</Text>
        {homeFormation ? (
          <View style={styles.formationCard}>
            <Image
              source={{ uri: homeFormation.imageUri }}
              style={styles.formationImage}
            />
            <Text style={styles.teamName}>{homeFormation.teamName}</Text>
            <Text style={styles.formation}>フォーメーション: {homeFormation.formation}</Text>
            <TouchableOpacity
              style={styles.changeButton}
              onPress={() => handleSelectImage('home')}
              disabled={analyzing === 'home'}
            >
              <Text style={styles.buttonText}>変更</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.uploadPlaceholder}>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => handleSelectImage('home')}
              disabled={analyzing === 'home'}
            >
              {analyzing === 'home' ? (
                <ActivityIndicator size="large" color={SAMURAI_BLUE} />
              ) : (
                <>
                  <Text style={styles.uploadIcon}>📷</Text>
                  <Text style={styles.uploadText}>ギャラリーから選択</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => handleTakePhoto('home')}
              disabled={analyzing === 'home'}
            >
              {analyzing === 'home' ? (
                <ActivityIndicator size="large" color={SAMURAI_BLUE} />
              ) : (
                <>
                  <Text style={styles.uploadIcon}>📸</Text>
                  <Text style={styles.uploadText}>カメラで撮影</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Away Team Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アウェイチーム</Text>
        {awayFormation ? (
          <View style={styles.formationCard}>
            <Image
              source={{ uri: awayFormation.imageUri }}
              style={styles.formationImage}
            />
            <Text style={styles.teamName}>{awayFormation.teamName}</Text>
            <Text style={styles.formation}>フォーメーション: {awayFormation.formation}</Text>
            <TouchableOpacity
              style={styles.changeButton}
              onPress={() => handleSelectImage('away')}
              disabled={analyzing === 'away'}
            >
              <Text style={styles.buttonText}>変更</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.uploadPlaceholder}>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => handleSelectImage('away')}
              disabled={analyzing === 'away'}
            >
              {analyzing === 'away' ? (
                <ActivityIndicator size="large" color={SAMURAI_BLUE} />
              ) : (
                <>
                  <Text style={styles.uploadIcon}>📷</Text>
                  <Text style={styles.uploadText}>ギャラリーから選択</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => handleTakePhoto('away')}
              disabled={analyzing === 'away'}
            >
              {analyzing === 'away' ? (
                <ActivityIndicator size="large" color={SAMURAI_BLUE} />
              ) : (
                <>
                  <Text style={styles.uploadIcon}>📸</Text>
                  <Text style={styles.uploadText}>カメラで撮影</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Proceed Button */}
      {homeFormation && awayFormation && (
        <TouchableOpacity
          style={styles.proceedButton}
          onPress={handleProceed}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.proceedButtonText}>次へ進む</Text>
          )}
        </TouchableOpacity>
      )}

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: SAMURAI_BLUE,
    padding: 20,
    paddingTop: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SAMURAI_BLUE,
    marginBottom: 12,
  },
  formationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formationImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#e0e0e0',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  formation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  changeButton: {
    backgroundColor: SAMURAI_BLUE,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  uploadPlaceholder: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  uploadButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: SAMURAI_BLUE,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  uploadText: {
    color: SAMURAI_BLUE,
    fontWeight: '600',
    fontSize: 14,
  },
  proceedButton: {
    backgroundColor: SAMURAI_BLUE,
    marginHorizontal: 16,
    marginVertical: 20,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  proceedButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  spacer: {
    height: 20,
  },
});
