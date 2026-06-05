import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import type { PredictionData } from '../types';
import AdPlaceholder from '../components/AdPlaceholder';
import { colors, shadows } from '../theme';

interface PredictionScreenProps {
  prediction: PredictionData;
  onReset: () => void;
}

export default function PredictionScreen({
  prediction,
  onReset,
}: PredictionScreenProps) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.backgroundAccent} />
      <View style={styles.header}>
        <Text style={styles.title}>試合展望</Text>
        <Text style={styles.subtitle}>Match Prediction</Text>
      </View>

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
                    backgroundColor: colors.blue,
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
                    backgroundColor: colors.orange,
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
                    backgroundColor: colors.red,
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
        <Text style={styles.sectionTitle}>試合分析</Text>
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

      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>ご利用上の注意</Text>
        <Text style={styles.noticeText}>
          この予測はAIによる参考情報です。実際の試合結果を保証するものではなく、賭けや金銭的判断を推奨するものではありません。
        </Text>
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
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 18,
  },
  backgroundAccent: {
    position: 'absolute',
    top: -120,
    left: -90,
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: 'rgba(217, 191, 120, 0.1)',
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
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 6,
  },
  matchInfo: {
    flexDirection: 'row',
    backgroundColor: colors.panelSoft,
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 16,
    borderRadius: 18,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.panel,
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  formation: {
    fontSize: 12,
    color: colors.goldBright,
  },
  scoreColumn: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  predictedScore: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.goldBright,
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: 12,
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
  probabilityContainer: {
    flexDirection: 'row',
    backgroundColor: colors.panelSoft,
    borderRadius: 18,
    padding: 16,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.panel,
  },
  probabilityColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    width: 40,
    height: 150,
    backgroundColor: 'rgba(5, 17, 39, 0.86)',
    borderRadius: 6,
    marginBottom: 12,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  probabilityBar: {
    width: '100%',
  },
  teamLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  probability: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.goldBright,
  },
  analysisBox: {
    backgroundColor: colors.panelSoft,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.panel,
  },
  analysisText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  playersContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  playersColumn: {
    flex: 1,
    backgroundColor: colors.panelSoft,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.panel,
  },
  playersTeamName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.goldBright,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  playerName: {
    fontSize: 12,
    color: colors.text,
    marginBottom: 4,
  },
  noPlayers: {
    fontSize: 12,
    color: colors.dim,
    fontStyle: 'italic',
  },
  adContainer: {
    marginVertical: 16,
  },
  noticeBox: {
    marginHorizontal: 20,
    marginTop: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(9, 24, 52, 0.86)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  noticeTitle: {
    color: colors.goldBright,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 6,
  },
  noticeText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  resetButton: {
    backgroundColor: colors.gold,
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: 16,
  },
  spacer: {
    height: 20,
  },
});
