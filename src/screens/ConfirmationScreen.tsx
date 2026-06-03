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
} from 'react-native';
import type { FormationData } from '../types';

interface ConfirmationScreenProps {
  homeFormation: FormationData;
  awayFormation: FormationData;
  onConfirm: (home: FormationData, away: FormationData) => void;
  onBack: () => void;
}

const SAMURAI_BLUE = '#003F8F';

export default function ConfirmationScreen({
  homeFormation,
  awayFormation,
  onConfirm,
  onBack,
}: ConfirmationScreenProps) {
  const [homeTeam, setHomeTeam] = useState(homeFormation.teamName);
  const [homeFormationStr, setHomeFormationStr] = useState(homeFormation.formation);
  const [homePlayers, setHomePlayers] = useState(homeFormation.players.join('\n'));

  const [awayTeam, setAwayTeam] = useState(awayFormation.teamName);
  const [awayFormationStr, setAwayFormationStr] = useState(awayFormation.formation);
  const [awayPlayers, setAwayPlayers] = useState(awayFormation.players.join('\n'));

  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const updatedHome: FormationData = {
        ...homeFormation,
        teamName: homeTeam,
        formation: homeFormationStr,
        players: homePlayers
          .split('\n')
          .map((p) => p.trim())
          .filter((p) => p.length > 0),
      };

      const updatedAway: FormationData = {
        ...awayFormation,
        teamName: awayTeam,
        formation: awayFormationStr,
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
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>情報確認</Text>
        <Text style={styles.subtitle}>チーム情報を確認・修正してください</Text>
      </View>

      {/* Home Team Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ホームチーム</Text>

        <Image
          source={{ uri: homeFormation.imageUri }}
          style={styles.formationImage}
        />

        <View style={styles.formGroup}>
          <Text style={styles.label}>チーム名</Text>
          <TextInput
            style={styles.input}
            value={homeTeam}
            onChangeText={setHomeTeam}
            placeholder="チーム名を入力"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>フォーメーション</Text>
          <TextInput
            style={styles.input}
            value={homeFormationStr}
            onChangeText={setHomeFormationStr}
            placeholder="例: 4-3-3"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>選手名（1行1人）</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={homePlayers}
            onChangeText={setHomePlayers}
            placeholder="選手1&#10;選手2&#10;選手3..."
            multiline
            numberOfLines={6}
          />
        </View>
      </View>

      {/* Away Team Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アウェイチーム</Text>

        <Image
          source={{ uri: awayFormation.imageUri }}
          style={styles.formationImage}
        />

        <View style={styles.formGroup}>
          <Text style={styles.label}>チーム名</Text>
          <TextInput
            style={styles.input}
            value={awayTeam}
            onChangeText={setAwayTeam}
            placeholder="チーム名を入力"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>フォーメーション</Text>
          <TextInput
            style={styles.input}
            value={awayFormationStr}
            onChangeText={setAwayFormationStr}
            placeholder="例: 4-2-3-1"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>選手名（1行1人）</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={awayPlayers}
            onChangeText={setAwayPlayers}
            placeholder="選手1&#10;選手2&#10;選手3..."
            multiline
            numberOfLines={6}
          />
        </View>
      </View>

      {/* Action Buttons */}
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
  formationImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#e0e0e0',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  textArea: {
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#999',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: SAMURAI_BLUE,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  spacer: {
    height: 20,
  },
});
