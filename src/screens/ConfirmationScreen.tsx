import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { FormationData } from '../types';
import { analyzeFormationImage } from '../services/geminiService';
import { pickImage, takePhoto } from '../utils/imagePicker';
import { colors, shadows } from '../theme';

interface ConfirmationScreenProps {
  homeFormation: FormationData;
  awayFormation: FormationData;
  onConfirm: (home: FormationData, away: FormationData) => void;
  onBack: () => void;
}

export default function ConfirmationScreen({
  homeFormation,
  awayFormation,
  onConfirm,
  onBack,
}: ConfirmationScreenProps) {
  const [homeTeam, setHomeTeam] = useState(homeFormation.teamName);
  const [homeFormationStr, setHomeFormationStr] = useState(homeFormation.formation);
  const [homePlayers, setHomePlayers] = useState(homeFormation.players.join('\n'));
  const [homeImageUri, setHomeImageUri] = useState(homeFormation.imageUri);

  const [awayTeam, setAwayTeam] = useState(awayFormation.teamName);
  const [awayFormationStr, setAwayFormationStr] = useState(awayFormation.formation);
  const [awayPlayers, setAwayPlayers] = useState(awayFormation.players.join('\n'));
  const [awayImageUri, setAwayImageUri] = useState(awayFormation.imageUri);

  const [loading, setLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState<'home' | 'away' | null>(null);

  const handleReplaceImage = async (
    teamType: 'home' | 'away',
    source: 'library' | 'camera'
  ) => {
    try {
      setReanalyzing(teamType);
      const image = source === 'library' ? await pickImage() : await takePhoto();
      if (!image) {
        return;
      }

      if (teamType === 'home') {
        setHomeImageUri(image.uri);
      } else {
        setAwayImageUri(image.uri);
      }

      const analysis = await analyzeFormationImage(image.base64, teamType, image.mimeType);
      if (teamType === 'home') {
        setHomeTeam(analysis.teamName);
        setHomeFormationStr(analysis.formation);
        setHomePlayers(analysis.players.join('\n'));
      } else {
        setAwayTeam(analysis.teamName);
        setAwayFormationStr(analysis.formation);
        setAwayPlayers(analysis.players.join('\n'));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI解析に失敗しました';
      Alert.alert(
        '画像を変更しました',
        `${message}\n\n必要に応じてチーム名、フォーメーション、選手名を手入力してください。`
      );
      console.error(error);
    } finally {
      setReanalyzing(null);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const updatedHome: FormationData = {
        ...homeFormation,
        teamName: homeTeam,
        formation: homeFormationStr,
        imageUri: homeImageUri,
        players: homePlayers
          .split('\n')
          .map((p) => p.trim())
          .filter((p) => p.length > 0),
      };

      const updatedAway: FormationData = {
        ...awayFormation,
        teamName: awayTeam,
        formation: awayFormationStr,
        imageUri: awayImageUri,
        players: awayPlayers
          .split('\n')
          .map((p) => p.trim())
          .filter((p) => p.length > 0),
      };

      onConfirm(updatedHome, updatedAway);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.backgroundAccent} />
      <View style={styles.header}>
        <Text style={styles.title}>情報確認</Text>
        <Text style={styles.subtitle}>チーム情報を確認・修正してください</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ホームチーム</Text>

        <View style={styles.teamPanel}>
          <View style={styles.imageFrame}>
            <Image
              source={{ uri: homeImageUri }}
              style={styles.formationImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.imageActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleReplaceImage('home', 'library')}
              disabled={reanalyzing === 'home'}
            >
              <Text style={styles.secondaryButtonText}>写真を変更</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleReplaceImage('home', 'camera')}
              disabled={reanalyzing === 'home'}
            >
              <Text style={styles.secondaryButtonText}>撮影</Text>
            </TouchableOpacity>
          </View>
          {reanalyzing === 'home' && (
            <ActivityIndicator size="small" color={colors.goldBright} style={styles.inlineLoader} />
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>チーム名</Text>
            <TextInput
              style={styles.input}
              value={homeTeam}
              onChangeText={setHomeTeam}
              placeholder="チーム名を入力"
              placeholderTextColor={colors.dim}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>フォーメーション</Text>
            <TextInput
              style={styles.input}
              value={homeFormationStr}
              onChangeText={setHomeFormationStr}
              placeholder="例: 4-3-3"
              placeholderTextColor={colors.dim}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>選手名（1行1人）</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={homePlayers}
              onChangeText={setHomePlayers}
              placeholder="選手1&#10;選手2&#10;選手3..."
              placeholderTextColor={colors.dim}
              multiline
              numberOfLines={6}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アウェイチーム</Text>

        <View style={styles.teamPanel}>
          <View style={styles.imageFrame}>
            <Image
              source={{ uri: awayImageUri }}
              style={styles.formationImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.imageActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleReplaceImage('away', 'library')}
              disabled={reanalyzing === 'away'}
            >
              <Text style={styles.secondaryButtonText}>写真を変更</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleReplaceImage('away', 'camera')}
              disabled={reanalyzing === 'away'}
            >
              <Text style={styles.secondaryButtonText}>撮影</Text>
            </TouchableOpacity>
          </View>
          {reanalyzing === 'away' && (
            <ActivityIndicator size="small" color={colors.goldBright} style={styles.inlineLoader} />
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>チーム名</Text>
            <TextInput
              style={styles.input}
              value={awayTeam}
              onChangeText={setAwayTeam}
              placeholder="チーム名を入力"
              placeholderTextColor={colors.dim}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>フォーメーション</Text>
            <TextInput
              style={styles.input}
              value={awayFormationStr}
              onChangeText={setAwayFormationStr}
              placeholder="例: 4-2-3-1"
              placeholderTextColor={colors.dim}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>選手名（1行1人）</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={awayPlayers}
              onChangeText={setAwayPlayers}
              placeholder="選手1&#10;選手2&#10;選手3..."
              placeholderTextColor={colors.dim}
              multiline
              numberOfLines={6}
            />
          </View>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          disabled={loading}
        >
          <Text style={styles.backButtonText}>戻る</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.confirmButtonText}>決定</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 18,
  },
  backgroundAccent: {
    position: 'absolute',
    top: -110,
    right: -86,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(77, 183, 255, 0.1)',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 18,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.goldBright,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.muted,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.goldBright,
    marginBottom: 12,
  },
  teamPanel: {
    backgroundColor: colors.panelSoft,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.panel,
  },
  imageFrame: {
    height: 300,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: '#06152c',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  formationImage: {
    width: '100%',
    height: '100%',
  },
  imageActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(5, 17, 39, 0.72)',
  },
  secondaryButtonText: {
    color: colors.goldBright,
    fontWeight: '800',
    fontSize: 13,
  },
  inlineLoader: {
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.goldBright,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(5, 17, 39, 0.72)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  textArea: {
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: 'rgba(5, 17, 39, 0.72)',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  backButtonText: {
    color: colors.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.gold,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: 16,
  },
  spacer: {
    height: 20,
  },
});
