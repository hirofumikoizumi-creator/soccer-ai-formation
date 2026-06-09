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
import { colors, shadows } from '../theme';

const TEAM_HINT_OPTIONS = [
  '指定なし',
  '日本代表',
  'オランダ代表',
  'フランス代表',
  'イングランド代表',
  'スペイン代表',
];

interface HomeScreenProps {
  onProceed: (homeFormation: FormationData, awayFormation: FormationData) => void;
  remainingAnalyses: number;
  remainingRewardedAds: number;
  dailyFreeLimit: number;
  onRequestRewardedAd: () => void;
  onRequestImageReadReward: () => void;
  onConsumeImageReadCredit: () => Promise<boolean>;
}

function createPendingFormation(
  teamType: 'home' | 'away',
  imageUri: string,
  imageBase64?: string,
  mimeType?: string,
  teamHint?: string
): FormationData {
  return {
    teamName: teamHint || (teamType === 'home' ? 'ホームチーム' : 'アウェイチーム'),
    formation: '未解析',
    players: [],
    imageUri,
    imageBase64,
    mimeType,
    teamHint,
  };
}

function createManualFormation(teamType: 'home' | 'away', teamHint?: string): FormationData {
  return {
    teamName: teamHint || (teamType === 'home' ? 'ホームチーム' : 'アウェイチーム'),
    formation: '4-2-3-1',
    players: [],
    teamHint,
  };
}

function getAnalysisErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'AI解析に失敗しました。確認画面でチーム名やフォーメーションを手入力してください';
}

function hasUsefulAnalysis(formation: FormationData) {
  return formation.formation !== '未解析' || formation.players.length > 0;
}

export default function HomeScreen({
  onProceed,
  remainingAnalyses,
  remainingRewardedAds,
  dailyFreeLimit,
  onRequestRewardedAd,
  onRequestImageReadReward,
  onConsumeImageReadCredit,
}: HomeScreenProps) {
  const [homeFormation, setHomeFormation] = useState<FormationData | null>(null);
  const [awayFormation, setAwayFormation] = useState<FormationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState<'home' | 'away' | null>(null);
  const [homeTeamHint, setHomeTeamHint] = useState('指定なし');
  const [awayTeamHint, setAwayTeamHint] = useState('指定なし');

  const getTeamHint = (teamType: 'home' | 'away') => {
    const value = teamType === 'home' ? homeTeamHint : awayTeamHint;
    return value === '指定なし' ? undefined : value;
  };

  const handleSelectImage = async (teamType: 'home' | 'away') => {
    try {
      const teamHint = getTeamHint(teamType);
      const image = await pickImage();
      if (!image) {
        Alert.alert('写真を選択できません', '写真ライブラリへのアクセスを許可してからもう一度お試しください');
        return;
      }

      setAnalyzing(teamType);
      const pendingFormation = createPendingFormation(
        teamType,
        image.uri,
        image.base64,
        image.mimeType,
        teamHint
      );
      pendingFormation.analysisImages = image.analysisImages;
      if (teamType === 'home') {
        setHomeFormation(pendingFormation);
      } else {
        setAwayFormation(pendingFormation);
      }

      const analysis = await analyzeFormationImage(
        image.base64,
        teamType,
        image.mimeType,
        image.analysisImages,
        teamHint
      );

      const formationData: FormationData = {
        teamName: analysis.teamName,
        formation: analysis.formation,
        players: analysis.players,
        imageUri: image.uri,
        imageBase64: image.base64,
        mimeType: image.mimeType,
        analysisImages: image.analysisImages,
        teamHint,
      };

      if (teamType === 'home') {
        setHomeFormation(formationData);
      } else {
        setAwayFormation(formationData);
      }
    } catch (error) {
      Alert.alert(
        '画像を登録しました',
        `${getAnalysisErrorMessage(error)}\n\n確認画面でチーム名やフォーメーションを手入力できます。`
      );
      console.error(error);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleTakePhoto = async (teamType: 'home' | 'away') => {
    try {
      const teamHint = getTeamHint(teamType);
      const image = await takePhoto();
      if (!image) {
        Alert.alert('カメラを起動できません', 'カメラへのアクセスを許可してからもう一度お試しください');
        return;
      }

      setAnalyzing(teamType);
      const pendingFormation = createPendingFormation(
        teamType,
        image.uri,
        image.base64,
        image.mimeType,
        teamHint
      );
      pendingFormation.analysisImages = image.analysisImages;
      if (teamType === 'home') {
        setHomeFormation(pendingFormation);
      } else {
        setAwayFormation(pendingFormation);
      }

      const analysis = await analyzeFormationImage(
        image.base64,
        teamType,
        image.mimeType,
        image.analysisImages,
        teamHint
      );

      const formationData: FormationData = {
        teamName: analysis.teamName,
        formation: analysis.formation,
        players: analysis.players,
        imageUri: image.uri,
        imageBase64: image.base64,
        mimeType: image.mimeType,
        analysisImages: image.analysisImages,
        teamHint,
      };

      if (teamType === 'home') {
        setHomeFormation(formationData);
      } else {
        setAwayFormation(formationData);
      }
    } catch (error) {
      Alert.alert(
        '画像を登録しました',
        `${getAnalysisErrorMessage(error)}\n\n確認画面でチーム名やフォーメーションを手入力できます。`
      );
      console.error(error);
    } finally {
      setAnalyzing(null);
    }
  };

  const handleProceed = () => {
    if (!homeFormation || !awayFormation) {
      Alert.alert('エラー', 'ホーム・アウェイ両方のチーム情報を入力してください');
      return;
    }
    onProceed(homeFormation, awayFormation);
  };

  const handleManualInput = (teamType: 'home' | 'away') => {
    const manualFormation = createManualFormation(teamType, getTeamHint(teamType));
    if (teamType === 'home') {
      setHomeFormation(manualFormation);
    } else {
      setAwayFormation(manualFormation);
    }
  };

  const handleAnalyzeExistingImage = async (
    teamType: 'home' | 'away',
    formation: FormationData
  ) => {
    try {
      const canRetry = await onConsumeImageReadCredit();
      if (!canRetry) {
        Alert.alert(
          '画像の再読み取り',
          '画像のAI再読み取りにはリワード広告が必要です。手入力での修正は無料で利用できます。',
          [
            { text: '手入力で修正', style: 'cancel' },
            { text: '広告を見て再読取+1', onPress: onRequestImageReadReward },
          ]
        );
        return;
      }

      setAnalyzing(teamType);
      if (!formation.imageBase64) {
        throw new Error('画像データを再分析できませんでした。写真をもう一度選択してください');
      }

      const activeTeamHint = getTeamHint(teamType) || formation.teamHint;
      const analysis = await analyzeFormationImage(
        formation.imageBase64,
        teamType,
        formation.mimeType || 'image/jpeg',
        formation.analysisImages,
        activeTeamHint
      );
      const formationData: FormationData = {
        teamName: analysis.teamName,
        formation: analysis.formation,
        players: analysis.players,
        imageUri: formation.imageUri,
        imageBase64: formation.imageBase64,
        mimeType: formation.mimeType || 'image/jpeg',
        analysisImages: formation.analysisImages,
        teamHint: activeTeamHint,
      };

      if (teamType === 'home') {
        setHomeFormation(formationData);
      } else {
        setAwayFormation(formationData);
      }
    } catch (error) {
      Alert.alert(
        'AI解析に失敗しました',
        `${getAnalysisErrorMessage(error)}\n\n確認画面でチーム名やフォーメーションを手入力できます。`
      );
      console.error(error);
    } finally {
      setAnalyzing(null);
    }
  };

  const renderTeamCard = (teamType: 'home' | 'away', formation: FormationData) => {
    const isAnalyzing = analyzing === teamType;
    const analyzed = hasUsefulAnalysis(formation);
    const statusLabel = formation.imageUri
      ? analyzed
        ? 'AI画像読み取り済み'
        : '画像登録済み（未解析）'
      : '手入力';

    return (
      <View style={styles.formationCard}>
        <View style={styles.pitchGlow}>
          <View style={[styles.pitchLine, styles.pitchLineTop]} />
          <View style={[styles.pitchLine, styles.pitchLineBottom]} />
          <View style={[styles.diagonalLine, styles.diagonalLeft]} />
          <View style={[styles.diagonalLine, styles.diagonalRight]} />
          {formation.imageUri ? (
            <Image
              source={{ uri: formation.imageUri }}
              style={styles.formationImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.manualCard}>
              <Text style={styles.manualCardTitle}>手入力モード</Text>
              <Text style={styles.manualCardText}>次の画面でフォーメーションと11名を入力できます。</Text>
            </View>
          )}
        </View>
        <Text style={styles.teamName}>
          {teamType === 'home' ? 'ホームチーム' : 'アウェイチーム'}: {statusLabel}
        </Text>
        <Text style={styles.formation}>フォーメーション: {formation.formation}</Text>
        {formation.imageUri && !analyzed && (
          <Text style={styles.analysisWarning}>
            フォーメーションや選手名を読み取れていません。範囲指定して再読み取りするか、次の画面で手入力してください。
          </Text>
        )}
        {formation.imageUri && (
          <TouchableOpacity
            style={styles.changeButton}
            onPress={() => handleAnalyzeExistingImage(teamType, formation)}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <ActivityIndicator size="small" color={colors.goldBright} />
            ) : (
              <Text style={styles.buttonText}>範囲指定して再読取</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderUploadButtons = (teamType: 'home' | 'away') => {
    const isAnalyzing = analyzing === teamType;

    return (
      <View style={styles.uploadPlaceholder}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => handleSelectImage(teamType)}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <ActivityIndicator size="small" color={colors.goldBright} />
          ) : (
            <>
              <Text style={styles.uploadIcon}>▣</Text>
              <View style={styles.uploadTextBlock}>
                <Text style={styles.uploadText}>ギャラリーから選択</Text>
                <Text style={styles.uploadSubText}>範囲指定してスクリーンショットを使う</Text>
              </View>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => handleTakePhoto(teamType)}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <ActivityIndicator size="small" color={colors.goldBright} />
          ) : (
            <>
              <Text style={styles.uploadIcon}>◉</Text>
              <View style={styles.uploadTextBlock}>
                <Text style={styles.uploadText}>カメラで撮影</Text>
                <Text style={styles.uploadSubText}>撮影後に読み取り範囲を指定</Text>
              </View>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => handleManualInput(teamType)}
          disabled={isAnalyzing}
        >
          <Text style={styles.uploadIcon}>✎</Text>
          <View style={styles.uploadTextBlock}>
            <Text style={styles.uploadText}>自分で入力する</Text>
            <Text style={styles.uploadSubText}>APIを使わず手入力で作成</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderTeamHintSelector = (teamType: 'home' | 'away') => {
    const selected = teamType === 'home' ? homeTeamHint : awayTeamHint;
    const setSelected = teamType === 'home' ? setHomeTeamHint : setAwayTeamHint;

    return (
      <View style={styles.teamHintPanel}>
        <Text style={styles.teamHintLabel}>読み取り補正</Text>
        <View style={styles.teamHintOptions}>
          {TEAM_HINT_OPTIONS.map((option) => {
            const active = selected === option;
            return (
              <TouchableOpacity
                key={`${teamType}-${option}`}
                style={[styles.teamHintChip, active && styles.teamHintChipActive]}
                onPress={() => setSelected(option)}
              >
                <Text style={[styles.teamHintChipText, active && styles.teamHintChipTextActive]}>
                  {option}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.backgroundAccent} />
      <View style={styles.patternBlock}>
        <View style={[styles.patternLine, styles.patternLineOne]} />
        <View style={[styles.patternLine, styles.patternLineTwo]} />
        <View style={[styles.patternLine, styles.patternLineThree]} />
      </View>

      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>⚽</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>サッカーAI予想シミュレーション</Text>
          <Text style={styles.subtitle}>Formation Analysis</Text>
        </View>
      </View>

      <View style={styles.usagePanel}>
        <Text style={styles.usageTitle}>本日の無料試合予想</Text>
        <Text style={styles.usageCount}>残り {remainingAnalyses} 回</Text>
        <Text style={styles.usageNote}>
          無料は1日{dailyFreeLimit}試合まで。写真読み取りや手入力では消費せず、試合予想の生成成功時に1回消費します。
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ホームチーム</Text>
        {renderTeamHintSelector('home')}
        {homeFormation ? renderTeamCard('home', homeFormation) : renderUploadButtons('home')}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アウェイチーム</Text>
        {renderTeamHintSelector('away')}
        {awayFormation ? renderTeamCard('away', awayFormation) : renderUploadButtons('away')}
      </View>

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
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 22,
    gap: 14,
  },
  backgroundAccent: {
    position: 'absolute',
    top: -90,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(77, 183, 255, 0.12)',
  },
  patternBlock: {
    position: 'absolute',
    top: 116,
    right: -40,
    width: 230,
    height: 210,
    opacity: 0.42,
  },
  patternLine: {
    position: 'absolute',
    width: 260,
    height: 1,
    backgroundColor: colors.borderSoft,
  },
  patternLineOne: {
    top: 20,
    transform: [{ rotate: '32deg' }],
  },
  patternLineTwo: {
    top: 86,
    transform: [{ rotate: '-26deg' }],
  },
  patternLineThree: {
    top: 146,
    transform: [{ rotate: '32deg' }],
  },
  logo: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panelElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoText: {
    fontSize: 39,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.goldBright,
    lineHeight: 27,
  },
  subtitle: {
    fontSize: 17,
    color: colors.text,
    marginTop: 3,
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
  teamHintPanel: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 17, 39, 0.64)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  teamHintLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  teamHintOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  teamHintChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'rgba(9, 24, 52, 0.86)',
  },
  teamHintChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.goldBright,
  },
  teamHintChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  teamHintChipTextActive: {
    color: colors.background,
  },
  formationCard: {
    backgroundColor: colors.panelSoft,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.panel,
  },
  pitchGlow: {
    height: 420,
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#06152c',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  formationImage: {
    width: '86%',
    height: '92%',
    borderRadius: 4,
  },
  manualCard: {
    width: '86%',
    minHeight: 180,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: 'rgba(5, 17, 39, 0.74)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  manualCardTitle: {
    color: colors.goldBright,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 10,
  },
  manualCardText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  pitchLine: {
    position: 'absolute',
    width: 270,
    height: 1,
    backgroundColor: 'rgba(244, 221, 160, 0.34)',
  },
  pitchLineTop: {
    top: 84,
    transform: [{ rotate: '-31deg' }],
  },
  pitchLineBottom: {
    bottom: 92,
    transform: [{ rotate: '31deg' }],
  },
  diagonalLine: {
    position: 'absolute',
    width: 330,
    height: 1,
    backgroundColor: 'rgba(77, 183, 255, 0.24)',
  },
  diagonalLeft: {
    transform: [{ rotate: '52deg' }],
  },
  diagonalRight: {
    transform: [{ rotate: '-52deg' }],
  },
  teamName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.goldBright,
    marginBottom: 4,
  },
  formation: {
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
  },
  analysisWarning: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  changeButton: {
    backgroundColor: 'rgba(3, 13, 32, 0.72)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  buttonText: {
    color: colors.goldBright,
    fontWeight: '800',
    fontSize: 20,
  },
  uploadPlaceholder: {
    backgroundColor: colors.panelSoft,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.panel,
  },
  uploadButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(9, 24, 52, 0.92)',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 9,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 16,
  },
  uploadIcon: {
    width: 46,
    color: colors.goldBright,
    fontSize: 30,
    textAlign: 'center',
  },
  uploadText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 18,
  },
  uploadTextBlock: {
    flex: 1,
  },
  uploadSubText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
  },
  usagePanel: {
    marginHorizontal: 20,
    marginBottom: 10,
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
    fontSize: 22,
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
  proceedButton: {
    backgroundColor: colors.gold,
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  proceedButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: 16,
  },
  spacer: {
    height: 20,
  },
});
