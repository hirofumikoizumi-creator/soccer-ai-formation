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
  KeyboardAvoidingView,
  Platform,
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
  remainingAnalyses: number;
  remainingRewardedAds: number;
  dailyFreeLimit: number;
  onRequestRewardedAd: () => void;
  onRequestImageReadReward: () => void;
  onConsumeImageReadCredit: () => Promise<boolean>;
}

const FORMATION_OPTIONS = [
  '4-4-2',
  '4-3-3',
  '4-2-3-1',
  '4-1-4-1',
  '3-4-3',
  '3-5-2',
  '3-4-2-1',
  '5-3-2',
  '5-4-1',
];

const POSITION_LABELS_BY_FORMATION: Record<string, string[]> = {
  '4-4-2': ['GK', 'RB', 'CB', 'CB', 'LB', 'RMF', 'CMF', 'CMF', 'LMF', 'CF', 'CF'],
  '4-3-3': ['GK', 'RB', 'CB', 'CB', 'LB', 'DMF', 'CMF', 'CMF', 'RWG', 'CF', 'LWG'],
  '4-2-3-1': ['GK', 'RB', 'CB', 'CB', 'LB', 'DMF', 'DMF', 'RMF', 'OMF', 'LMF', 'CF'],
  '4-1-4-1': ['GK', 'RB', 'CB', 'CB', 'LB', 'DMF', 'RMF', 'CMF', 'CMF', 'LMF', 'CF'],
  '3-4-3': ['GK', 'CB', 'CB', 'CB', 'RWB', 'CMF', 'CMF', 'LWB', 'RWG', 'CF', 'LWG'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'RWB', 'CMF', 'DMF', 'CMF', 'LWB', 'CF', 'CF'],
  '3-4-2-1': ['GK', 'CB', 'CB', 'CB', 'RWB', 'CMF', 'CMF', 'LWB', 'ST', 'ST', 'CF'],
  '5-3-2': ['GK', 'RWB', 'CB', 'CB', 'CB', 'LWB', 'CMF', 'DMF', 'CMF', 'CF', 'CF'],
  '5-4-1': ['GK', 'RWB', 'CB', 'CB', 'CB', 'LWB', 'RMF', 'CMF', 'CMF', 'LMF', 'CF'],
};

const DEFAULT_POSITION_LABELS = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW'];

function getPositionLabels(formation: string) {
  return POSITION_LABELS_BY_FORMATION[formation.trim()] || DEFAULT_POSITION_LABELS;
}

function stripPositionPrefix(player: string) {
  return player.replace(/^[A-Z]{1,4}\s*[:：]\s*/i, '').trim();
}

function createPositionedPlayers(players: string[], formation: string) {
  const positionLabels = getPositionLabels(formation);
  return players
    .map((player, index) => {
      const name = stripPositionPrefix(player);
      return name ? `${positionLabels[index] || `P${index + 1}`}: ${name}` : '';
    })
    .filter(Boolean);
}

function createPlayerFields(players: string[]) {
  const fields = Array.from({ length: 11 }, (_, index) => stripPositionPrefix(players[index] || ''));
  return fields;
}

function getAnalysisErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'AI解析に失敗しました';
}

export default function ConfirmationScreen({
  homeFormation,
  awayFormation,
  onConfirm,
  onBack,
  remainingAnalyses,
  remainingRewardedAds,
  dailyFreeLimit,
  onRequestRewardedAd,
  onRequestImageReadReward,
  onConsumeImageReadCredit,
}: ConfirmationScreenProps) {
  const [activeTeam, setActiveTeam] = useState<'home' | 'away'>('home');

  const [homeTeam, setHomeTeam] = useState(homeFormation.teamName);
  const [homeFormationStr, setHomeFormationStr] = useState(homeFormation.formation);
  const [homePlayers, setHomePlayers] = useState(createPlayerFields(homeFormation.players));
  const [homeImageUri, setHomeImageUri] = useState(homeFormation.imageUri);
  const [homeImageBase64, setHomeImageBase64] = useState(homeFormation.imageBase64);
  const [homeMimeType, setHomeMimeType] = useState(homeFormation.mimeType || 'image/jpeg');
  const [homeAnalysisImages, setHomeAnalysisImages] = useState(homeFormation.analysisImages);

  const [awayTeam, setAwayTeam] = useState(awayFormation.teamName);
  const [awayFormationStr, setAwayFormationStr] = useState(awayFormation.formation);
  const [awayPlayers, setAwayPlayers] = useState(createPlayerFields(awayFormation.players));
  const [awayImageUri, setAwayImageUri] = useState(awayFormation.imageUri);
  const [awayImageBase64, setAwayImageBase64] = useState(awayFormation.imageBase64);
  const [awayMimeType, setAwayMimeType] = useState(awayFormation.mimeType || 'image/jpeg');
  const [awayAnalysisImages, setAwayAnalysisImages] = useState(awayFormation.analysisImages);

  const [loading, setLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState<'home' | 'away' | null>(null);

  const handleReplaceImage = async (
    teamType: 'home' | 'away',
    source: 'library' | 'camera'
  ) => {
    try {
      const previousImageUri = teamType === 'home' ? homeImageUri : awayImageUri;
      setReanalyzing(teamType);
      const image = source === 'library' ? await pickImage() : await takePhoto();
      if (!image) {
        return;
      }

      if (previousImageUri) {
        const canRetry = await onConsumeImageReadCredit();
        if (!canRetry) {
          Alert.alert(
            '画像の再読み取り',
            '画像を変更してAIで再読み取りするにはリワード広告が必要です。手入力での修正は無料です。',
            [
              { text: '手入力で修正', style: 'cancel' },
              { text: '広告を見て再読取+1', onPress: onRequestImageReadReward },
            ]
          );
          return;
        }
      }

      if (teamType === 'home') {
        setHomeImageUri(image.uri);
        setHomeImageBase64(image.base64);
        setHomeMimeType(image.mimeType);
        setHomeAnalysisImages(image.analysisImages);
      } else {
        setAwayImageUri(image.uri);
        setAwayImageBase64(image.base64);
        setAwayMimeType(image.mimeType);
        setAwayAnalysisImages(image.analysisImages);
      }

      const analysis = await analyzeFormationImage(
        image.base64,
        teamType,
        image.mimeType,
        image.analysisImages
      );
      if (teamType === 'home') {
        setHomeTeam(analysis.teamName);
        setHomeFormationStr(analysis.formation);
        setHomePlayers(createPlayerFields(analysis.players));
      } else {
        setAwayTeam(analysis.teamName);
        setAwayFormationStr(analysis.formation);
        setAwayPlayers(createPlayerFields(analysis.players));
      }
    } catch (error) {
      Alert.alert(
        '画像を変更しました',
        `${getAnalysisErrorMessage(error)}\n\n必要に応じてチーム名、フォーメーション、選手名を手入力してください。`
      );
      console.error(error);
    } finally {
      setReanalyzing(null);
    }
  };

  const updatePlayer = (teamType: 'home' | 'away', index: number, value: string) => {
    const setter = teamType === 'home' ? setHomePlayers : setAwayPlayers;
    const players = teamType === 'home' ? homePlayers : awayPlayers;
    const nextPlayers = [...players];
    nextPlayers[index] = value;
    setter(nextPlayers);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const updatedHome: FormationData = {
        ...homeFormation,
        teamName: homeTeam,
        formation: homeFormationStr,
        imageUri: homeImageUri,
        imageBase64: homeImageBase64,
        mimeType: homeMimeType,
        analysisImages: homeAnalysisImages,
        players: createPositionedPlayers(homePlayers, homeFormationStr),
      };

      const updatedAway: FormationData = {
        ...awayFormation,
        teamName: awayTeam,
        formation: awayFormationStr,
        imageUri: awayImageUri,
        imageBase64: awayImageBase64,
        mimeType: awayMimeType,
        analysisImages: awayAnalysisImages,
        players: createPositionedPlayers(awayPlayers, awayFormationStr),
      };

      onConfirm(updatedHome, updatedAway);
    } finally {
      setLoading(false);
    }
  };

  const renderFormationOptions = (
    selectedFormation: string,
    onSelectFormation: (value: string) => void
  ) => (
    <View style={styles.optionWrap}>
      {FORMATION_OPTIONS.map((formation) => {
        const selected = selectedFormation === formation;
        return (
          <TouchableOpacity
            key={formation}
            style={[styles.formationOption, selected && styles.formationOptionSelected]}
            onPress={() => onSelectFormation(formation)}
          >
            <Text style={[styles.formationOptionText, selected && styles.formationOptionTextSelected]}>
              {formation}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderTeamPage = (teamType: 'home' | 'away') => {
    const isHome = teamType === 'home';
    const teamName = isHome ? homeTeam : awayTeam;
    const setTeamName = isHome ? setHomeTeam : setAwayTeam;
    const formation = isHome ? homeFormationStr : awayFormationStr;
    const setFormation = isHome ? setHomeFormationStr : setAwayFormationStr;
    const players = isHome ? homePlayers : awayPlayers;
    const imageUri = isHome ? homeImageUri : awayImageUri;
    const isAnalyzing = reanalyzing === teamType;
    const positionLabels = getPositionLabels(formation);

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{isHome ? 'ホームチーム' : 'アウェイチーム'}</Text>

        <View style={styles.teamPanel}>
          {imageUri ? (
            <View style={styles.imageFrame}>
              <Image source={{ uri: imageUri }} style={styles.formationImage} resizeMode="contain" />
            </View>
          ) : (
            <View style={styles.manualFrame}>
              <Text style={styles.manualFrameTitle}>手入力で作成中</Text>
              <Text style={styles.manualFrameText}>写真なしで、フォーメーションと選手名から試合予想を作成します。</Text>
            </View>
          )}

          <View style={styles.imageActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleReplaceImage(teamType, 'library')}
              disabled={isAnalyzing}
            >
              <Text style={styles.secondaryButtonText}>写真を範囲指定してAI読取</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleReplaceImage(teamType, 'camera')}
              disabled={isAnalyzing}
            >
              <Text style={styles.secondaryButtonText}>撮影後に範囲指定してAI読取</Text>
            </TouchableOpacity>
          </View>
          {isAnalyzing && (
            <ActivityIndicator size="small" color={colors.goldBright} style={styles.inlineLoader} />
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>チーム名</Text>
            <TextInput
              style={styles.input}
              value={teamName}
              onChangeText={setTeamName}
              placeholder="チーム名を入力"
              placeholderTextColor={colors.dim}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>フォーメーション</Text>
            {renderFormationOptions(formation, setFormation)}
            <TextInput
              style={styles.input}
              value={formation}
              onChangeText={setFormation}
              placeholder="候補にない場合は直接入力"
              placeholderTextColor={colors.dim}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>選手名（11名・ポジション順）</Text>
            <Text style={styles.helpText}>
              選択中の{formation}に合わせて、各欄に想定ポジションを表示しています。
            </Text>
            <View style={styles.playersGrid}>
              {players.map((player, index) => (
                <View key={index} style={styles.playerInputRow}>
                  <Text style={styles.playerNumber}>{index + 1}</Text>
                  <Text style={styles.positionBadge}>{positionLabels[index] || `P${index + 1}`}</Text>
                  <TextInput
                    style={styles.playerInput}
                    value={player}
                    onChangeText={(value) => updatePlayer(teamType, index, value)}
                    placeholder={`${positionLabels[index] || `P${index + 1}`}の選手名`}
                    placeholderTextColor={colors.dim}
                  />
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={12}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <View style={styles.backgroundAccent} />
        <View style={styles.header}>
          <Text style={styles.title}>情報確認</Text>
          <Text style={styles.subtitle}>チームごとに情報を確認・修正してください</Text>
        </View>

        <View style={styles.usagePanel}>
          <Text style={styles.usageTitle}>本日の無料試合予想</Text>
          <Text style={styles.usageCount}>残り {remainingAnalyses} 回</Text>
          <Text style={styles.usageNote}>
            写真の読み取りや手入力では消費せず、試合予想の生成成功時に1回消費します。無料は1日{dailyFreeLimit}試合までです。
          </Text>
          <Text style={styles.reviewNote}>
            広告を最後まで見ると試合予想または画像再読取を追加できます。本日の広告追加は残り{remainingRewardedAds}回です。
          </Text>
          <Text style={styles.reviewNote}>
            写真はAI解析のため外部AIサービスへ送信される場合があります。画像の再読み取りは広告視聴、手入力での修正は無料です。
          </Text>
          {remainingAnalyses <= 0 && (
            <TouchableOpacity style={styles.rewardButton} onPress={onRequestRewardedAd}>
              <Text style={styles.rewardButtonText}>広告を見て試合予想を1回追加</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTeam === 'home' && styles.tabActive]}
            onPress={() => setActiveTeam('home')}
          >
            <Text style={[styles.tabText, activeTeam === 'home' && styles.tabTextActive]}>
              ホーム
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTeam === 'away' && styles.tabActive]}
            onPress={() => setActiveTeam('away')}
          >
            <Text style={[styles.tabText, activeTeam === 'away' && styles.tabTextActive]}>
              アウェイ
            </Text>
          </TouchableOpacity>
        </View>

        {renderTeamPage(activeTeam)}

        <View style={styles.buttonContainer}>
          {activeTeam === 'home' ? (
            <>
              <TouchableOpacity style={styles.backButton} onPress={onBack} disabled={loading}>
                <Text style={styles.backButtonText}>戻る</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => setActiveTeam('away')}
                disabled={loading}
              >
                <Text style={styles.confirmButtonText}>アウェイへ</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setActiveTeam('home')}
                disabled={loading}
              >
                <Text style={styles.backButtonText}>ホームへ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color={colors.background} />
                ) : (
                  <Text style={styles.confirmButtonText}>AI分析</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.spacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 180,
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
  usagePanel: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(9, 24, 52, 0.86)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  usageTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  usageCount: {
    color: colors.goldBright,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
  },
  usageNote: {
    color: colors.text,
    fontSize: 12,
    marginTop: 5,
    lineHeight: 18,
  },
  reviewNote: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 8,
    lineHeight: 17,
  },
  rewardButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.gold,
  },
  rewardButtonText: {
    color: colors.background,
    fontWeight: '900',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 17, 39, 0.84)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.gold,
  },
  tabText: {
    color: colors.muted,
    fontWeight: '800',
  },
  tabTextActive: {
    color: colors.background,
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
    height: 280,
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
  manualFrame: {
    minHeight: 170,
    borderRadius: 12,
    marginBottom: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#06152c',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  manualFrameTitle: {
    color: colors.goldBright,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
  },
  manualFrameText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
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
  helpText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
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
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  formationOption: {
    minWidth: 82,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(5, 17, 39, 0.72)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  formationOptionSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.goldBright,
  },
  formationOptionText: {
    color: colors.text,
    fontWeight: '800',
  },
  formationOptionTextSelected: {
    color: colors.background,
  },
  playersGrid: {
    gap: 8,
  },
  playerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: colors.background,
    backgroundColor: colors.gold,
    fontWeight: '900',
  },
  positionBadge: {
    width: 48,
    minHeight: 28,
    borderRadius: 7,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: colors.goldBright,
    backgroundColor: 'rgba(5, 17, 39, 0.92)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    fontSize: 11,
    fontWeight: '900',
    paddingVertical: 5,
  },
  playerInput: {
    flex: 1,
    backgroundColor: 'rgba(5, 17, 39, 0.72)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.text,
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
