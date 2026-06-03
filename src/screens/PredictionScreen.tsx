import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import type { PredictionData } from '../types';
import AdPlaceholder from '../components/AdPlaceholder';

interface PredictionScreenProps {
  prediction: PredictionData;
  onReset: () => void;
}

const SAMURAI_BLUE = '#003F8F';
const { width } = Dimensions.get('window');

export default function PredictionScreen({
  prediction,
  onReset,
}: PredictionScreenProps) {
  const barWidth = (width - 64) / 2;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>試合展望</Text>
      </View>

      {/* Match Info */}
      <View style={styles.matchInfo}>
        <View style={styles.teamColumn}>
          <Text style={styles.teamName}>{prediction.homeTeam}</Text>
          <Text style={styles.formation}>{prediction.homeFormation}</Text>
        </View>

        <View style={styles.scoreColumn}>
          <Text style={styles.predictedScore}>{prediction.predictedScore}</Text>
          <Text style={styles.scoreLabel}>予想スコア</Text>
        </View>

        <View style={styles.teamColumn}>
          <Text style={styles.teamName}>{prediction.awayTeam}</Text>
          <Text style={styles.formation}>{prediction.awayFormation}</Text>
        </View>
      </View>

      {/* Win Probabilities */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>勝敗予測</Text>

        <View style={styles.probabilityContainer}>
          {/* Home Win */}
          <View style={styles.probabilityColumn}>
            <View style={styles.barContainer}>
              <View
                style={[
                  styles.probabilityBar,
                  {
                    height: `${prediction.homeWinProbability}%`,
                    backgroundColor: SAMURAI_BLUE,
                  },
                ]}
              />
            </View>
            <Text style={styles.teamLabel}>{prediction.homeTeam}</Text>
            <Text style={styles.probability}>
              {prediction.homeWinProbability}%
            </Text>
          </View>

          {/* Draw */}
          <View style={styles.probabilityColumn}>
            <View style={styles.barContainer}>
              <View
                style={[
                  styles.probabilityBar,
                  {
                    height: `${prediction.drawProbability}%`,
                    backgroundColor: '#FFA500',
                  },
                ]}
              />
            </View>
            <Text style={styles.teamLabel}>引き分け</Text>
            <Text style={styles.probability}>
              {prediction.drawProbability}%
            </Text>
          </View>

          {/* Away Win */}
          <View style={styles.probabilityColumn}>
            <View style={styles.barContainer}>
              <View
                style={[
                  styles.probabilityBar,
                  {
                    height: `${prediction.awayWinProbability}%`,
                    backgroundColor: '#DC143C',
                  },
                ]}
              />
            </View>
            <Text style={styles.teamLabel}>{prediction.awayTeam}</Text>
            <Text style={styles.probability}>
              {prediction.awayWinProbability}%
            </Text>
          </View>
        </View>
      </View>

      {/* Tactical Analysis */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>戦術分析</Text>
        <View style={styles.analysisBox}>
          <Text style={styles.analysisText}>{prediction.tacticalAnalysis}</Text>
        </View>
      </View>

      {/* Players Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>選手情報</Text>

        <View style={styles.playersContainer}>
          <View style={styles.playersColumn}>
            <Text style={styles.playersTeamName}>{prediction.homeTeam}</Text>
            {prediction.homePlayers.map((player, index) => (
              <Text key={index} style={styles.playerName}>
                • {player}
              </Text>
            ))}
            {prediction.homePlayers.length === 0 && (
              <Text style={styles.noPlayers}>選手情報なし</Text>
            )}
          </View>

          <View style={styles.playersColumn}>
            <Text style={styles.playersTeamName}>{prediction.awayTeam}</Text>
            {prediction.awayPlayers.map((player, index) => (
              <Text key={index} style={styles.playerName}>
                • {player}
              </Text>
            ))}
            {prediction.awayPlayers.length === 0 && (
              <Text style={styles.noPlayers}>選手情報なし</Text>
            )}
          </View>
        </View>
      </View>

      {/* Ad Placeholder */}
      <View style={styles.adContainer}>
        <AdPlaceholder type="banner" />
      </View>

      {/* Reset Button */}
      <TouchableOpacity style={styles.resetButton} onPress={onReset}>
        <Text style={styles.resetButtonText}>新しい予想を作成</Text>
      </TouchableOpacity>

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
  },
  matchInfo: {
    flexDirection: 'row',
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  formation: {
    fontSize: 12,
    color: '#666',
  },
  scoreColumn: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  predictedScore: {
    fontSize: 32,
    fontWeight: 'bold',
    color: SAMURAI_BLUE,
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: 12,
    color: '#666',
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
  probabilityContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  probabilityColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    width: 40,
    height: 150,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    marginBottom: 12,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  probabilityBar: {
    width: '100%',
  },
  teamLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  probability: {
    fontSize: 16,
    fontWeight: 'bold',
    color: SAMURAI_BLUE,
  },
  analysisBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  analysisText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
  },
  playersContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  playersColumn: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  playersTeamName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: SAMURAI_BLUE,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  playerName: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
  },
  noPlayers: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  adContainer: {
    marginVertical: 16,
  },
  resetButton: {
    backgroundColor: SAMURAI_BLUE,
    marginHorizontal: 16,
    marginVertical: 20,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  spacer: {
    height: 20,
  },
});
