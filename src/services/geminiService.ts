import axios from 'axios';
import type { AnalysisImage } from '../types';

export interface FormationAnalysis {
  teamName: string;
  formation: string;
  players: string[];
  confidence: number;
}

export interface PredictionResult {
  homeTeam: string;
  awayTeam: string;
  homeFormation: string;
  awayFormation: string;
  homePlayers: string[];
  awayPlayers: string[];
  predictedScore: string;
  homeWinProbability: number;
  drawProbability: number;
  awayWinProbability: number;
  tacticalAnalysis: string;
}

const GEMINI_MODELS = [
  process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash',
  'gemini-2.0-flash',
];
const GEMINI_VISION_MODELS = [
  process.env.EXPO_PUBLIC_GEMINI_VISION_MODEL || 'gemini-2.5-pro',
  process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash',
  'gemini-2.0-flash',
];
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_INLINE_IMAGE_BYTES = 18 * 1024 * 1024;
const GEMINI_TIMEOUT_MS = 60000;
const MAX_ANALYSIS_IMAGES = 5;

const FORMATION_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    teamName: { type: 'STRING' },
    formation: { type: 'STRING' },
    players: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    confidence: { type: 'NUMBER' },
  },
  required: ['teamName', 'formation', 'players', 'confidence'],
};

const PLAYER_OCR_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    teamName: { type: 'STRING' },
    players: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    confidence: { type: 'NUMBER' },
  },
  required: ['teamName', 'players', 'confidence'],
};

const RAW_OCR_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    rawTextLines: {
      type: 'ARRAY',
      items: { type: 'STRING' },
    },
    confidence: { type: 'NUMBER' },
  },
  required: ['rawTextLines', 'confidence'],
};

function assertGeminiApiKey() {
  if (!getGeminiApiKey()) {
    throw new Error('AI解析キーがアプリに設定されていません');
  }
}

function getGeminiApiKey() {
  return process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
}

function stripDataUrlPrefix(imageBase64: string) {
  return imageBase64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s/g, '');
}

function estimateBase64Bytes(imageBase64: string) {
  const padding = imageBase64.endsWith('==') ? 2 : imageBase64.endsWith('=') ? 1 : 0;
  return Math.floor((imageBase64.length * 3) / 4) - padding;
}

function prepareInlineImage(imageBase64: string, mimeType: string) {
  const data = stripDataUrlPrefix(imageBase64);
  if (!data) {
    throw new Error('画像データをAI解析用に読み込めませんでした');
  }

  if (estimateBase64Bytes(data) > MAX_INLINE_IMAGE_BYTES) {
    throw new Error('画像サイズが大きすぎます。写真を少しトリミングしてから再度お試しください');
  }

  const normalizedMimeType = mimeType.toLowerCase() === 'image/jpg' ? 'image/jpeg' : mimeType;

  return {
    mimeType: /^image\/(jpeg|png|webp|heic|heif)$/i.test(normalizedMimeType)
      ? normalizedMimeType
      : 'image/jpeg',
    data,
  };
}

function prepareInlineImages(
  imageBase64: string,
  mimeType: string,
  analysisImages?: AnalysisImage[]
) {
  const sourceImages =
    analysisImages && analysisImages.length > 0
      ? analysisImages
      : [{ base64: imageBase64, mimeType, label: 'full-selection' }];

  const seen = new Set<string>();
  return sourceImages
    .slice(0, MAX_ANALYSIS_IMAGES)
    .map((image) => ({
      ...prepareInlineImage(image.base64, image.mimeType || mimeType),
      label: image.label || 'analysis-image',
    }))
    .filter((image) => {
      const key = `${image.label}:${image.data.slice(0, 64)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function buildInlineImageParts(images: ReturnType<typeof prepareInlineImages>) {
  return images.flatMap((image, index) => [
    {
      text: `解析画像${index + 1}: ${image.label}`,
    },
    {
      inline_data: {
        mime_type: image.mimeType,
        data: image.data,
      },
    },
  ]);
}

function extractJsonObject(text: string) {
  const cleaned = text
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Gemini response did not contain JSON: ${text}`);
  }

  return JSON.parse(cleaned.slice(start, end + 1));
}

function extractResponseText(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    return '';
  }

  return parts
    .map((part) => {
      if (typeof part?.text === 'string') {
        return part.text;
      }
      return '';
    })
    .join('')
    .trim();
}

function normalizePlayers(players: unknown): string[] {
  if (!Array.isArray(players)) {
    return [];
  }

  const seen = new Set<string>();
  return players
    .map((player) => String(player).trim())
    .map(cleanPlayerLabel)
    .filter((player) => {
      if (!player) {
        return false;
      }
      const key = player.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function cleanPlayerLabel(player: string) {
  const match = player.match(/^([A-Z]{1,4})\s*[:：]\s*(.+)$/i);
  const position = match?.[1]?.toUpperCase();
  const name = (match?.[2] || player)
    .replace(/[（(][^（）()]{1,24}[）)]/g, '')
    .replace(/[「」『』"'“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name || /^[0-9０-９]+$/.test(name)) {
    return '';
  }

  return position ? `${position}: ${name}` : name;
}

function extractPlayerCandidatesFromTextLines(lines: unknown) {
  if (!Array.isArray(lines)) {
    return [];
  }

  const ignored = /google|検索|http|www|archive|カテゴリー|カテゴリ|screenshot|lineup11|sports|基本|フォーメーション|監督|組織|月|年|代表|チーム|広告|スポンサー|copyright|©|tm|browser|chrome|タブ|記事|本文|順位|試合|予定/i;
  const positionPrefix = /^(GK|CB|DF|RB|LB|RWB|LWB|SB|DMF|CMF|OMF|MF|RMF|LMF|AMF|CF|ST|FW|LWG|RWG|LW|RW)\s*[:：\-]?\s*/i;

  return normalizePlayers(
    lines
      .flatMap((line) =>
        String(line || '')
          .split(/[,\n、]/)
          .map((part) => part.trim())
      )
      .map((line) => line.replace(/[（(][^（）()]{1,30}[）)]/g, '').trim())
      .filter((line) => {
        if (!line || ignored.test(line)) {
          return false;
        }
        const withoutPosition = line.replace(positionPrefix, '').trim();
        if (!withoutPosition || /^[0-9０-９\s\-ー]+$/.test(withoutPosition)) {
          return false;
        }
        if (withoutPosition.length > 24) {
          return false;
        }
        return /[ァ-ヶー一-龠A-Za-z]/.test(withoutPosition);
      })
  );
}

function normalizeFormationLabel(formation: unknown) {
  const text = String(formation || '').trim();
  const match = text.match(/([3-5])\s*[-ー－]\s*([1-5])\s*[-ー－]\s*([1-5])(?:\s*[-ー－]\s*([1-5]))?/);
  if (!match) {
    return text || '未解析';
  }

  return [match[1], match[2], match[3], match[4]].filter(Boolean).join('-');
}

function inferFormationFromPlayers(players: string[]) {
  const lines = {
    defenders: 0,
    midfielders: 0,
    forwards: 0,
  };

  parsePositionedPlayers(players).forEach((player) => {
    if (/^(CB|DF|RB|LB|RWB|LWB|SB)$/i.test(player.position)) {
      lines.defenders += 1;
      return;
    }
    if (/^(DMF|CMF|OMF|MF|RMF|LMF|AMF)$/i.test(player.position)) {
      lines.midfielders += 1;
      return;
    }
    if (/^(CF|ST|FW|LWG|RWG|LW|RW)$/i.test(player.position)) {
      lines.forwards += 1;
    }
  });

  if (lines.defenders > 0 && lines.midfielders > 0 && lines.forwards > 0) {
    return `${lines.defenders}-${lines.midfielders}-${lines.forwards}`;
  }

  return '';
}

function normalizeFormationAnalysis(
  analysis: any,
  teamType: 'home' | 'away'
): FormationAnalysis {
  const players = normalizePlayers(analysis.players);
  const formation = normalizeFormationLabel(analysis.formation);
  const inferredFormation = formation === '未解析' ? inferFormationFromPlayers(players) : '';

  return {
    teamName: ensureJapaneseText(
      analysis.teamName,
      teamType === 'home' ? 'ホームチーム' : 'アウェイチーム'
    ),
    formation: inferredFormation || formation,
    players,
    confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.5,
  };
}

function hasUsefulFormationAnalysis(analysis: FormationAnalysis) {
  return analysis.formation !== '未解析' || analysis.players.length > 0;
}

function mergePlayerLists(primaryPlayers: string[], secondaryPlayers: string[]) {
  return normalizePlayers([...primaryPlayers, ...secondaryPlayers]).slice(0, 11);
}

async function readPlayersFromIndividualImages(
  imageBase64: string,
  teamType: 'home' | 'away',
  mimeType: string,
  knownFormation: string,
  analysisImages?: AnalysisImage[]
) {
  const sourceImages =
    analysisImages && analysisImages.length > 0
      ? analysisImages.filter((image) => image.label !== 'full-selection')
      : [];

  let mergedPlayers: string[] = [];
  let bestTeamName = teamType === 'home' ? 'ホームチーム' : 'アウェイチーム';
  let bestConfidence = 0;

  for (const image of sourceImages.slice(0, 4)) {
    try {
      const result = await readPlayersFromImage(
        imageBase64,
        teamType,
        mimeType,
        knownFormation,
        [image]
      );
      mergedPlayers = mergePlayerLists(mergedPlayers, result.players);
      if (result.confidence > bestConfidence) {
        bestTeamName = result.teamName;
        bestConfidence = result.confidence;
      }
      if (mergedPlayers.length >= 10) {
        break;
      }
    } catch (error) {
      console.warn(`Individual OCR failed for ${image.label}`, error);
    }
  }

  return {
    teamName: bestTeamName,
    players: mergedPlayers,
    confidence: bestConfidence,
  };
}

async function readRawTextCandidatesFromImages(
  imageBase64: string,
  mimeType: string,
  analysisImages?: AnalysisImage[]
) {
  const inlineImages = prepareInlineImages(imageBase64, mimeType, analysisImages);
  const prompt = `画像内の文字をOCRしてください。
目的はサッカーのフォーメーション画像から、少しでも読める選手名を拾うことです。

ルール:
- ピッチ上の白文字、選手名ラベル、スタメン表、LINEUP11画像内の名前を最優先でrawTextLinesに入れてください。
- ブラウザUI、検索バー、URL、右サイドバー、記事本文、広告、アーカイブ、カテゴリ、ロゴは可能な限り除外してください。
- 文字が一部しか読めなくても、その短い文字列をrawTextLinesに入れてください。
- 括弧内のクラブ名は除外してください。
- JSONのみで返してください。`;

  const response = await postGeminiGenerateContent({
    contents: [
      {
        parts: [
          { text: prompt },
          ...buildInlineImageParts(inlineImages),
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RAW_OCR_RESPONSE_SCHEMA,
      candidateCount: 1,
      maxOutputTokens: 900,
      temperature: 0,
    },
  }, GEMINI_VISION_MODELS);

  const content = extractResponseText(response.data);
  if (!content) {
    return {
      players: [],
      confidence: 0,
    };
  }

  const result = extractJsonObject(content);
  return {
    players: extractPlayerCandidatesFromTextLines(result.rawTextLines),
    confidence: typeof result.confidence === 'number' ? result.confidence : 0.4,
  };
}

async function enrichFormationWithAllOcr(
  analysis: FormationAnalysis,
  imageBase64: string,
  teamType: 'home' | 'away',
  mimeType: string,
  analysisImages?: AnalysisImage[]
) {
  let players = analysis.players;
  let confidence = analysis.confidence;
  let teamName = analysis.teamName;

  try {
    const playerOcr = await readPlayersFromImage(
      imageBase64,
      teamType,
      mimeType,
      analysis.formation,
      analysisImages
    );
    players = mergePlayerLists(players, playerOcr.players);
    confidence = Math.max(confidence, playerOcr.confidence);
    if (teamName === (teamType === 'home' ? 'ホームチーム' : 'アウェイチーム')) {
      teamName = playerOcr.teamName;
    }
  } catch (error) {
    console.warn('Player OCR pass failed', error);
  }

  if (players.length < 11) {
    try {
      const individualOcr = await readPlayersFromIndividualImages(
        imageBase64,
        teamType,
        mimeType,
        analysis.formation,
        analysisImages
      );
      players = mergePlayerLists(players, individualOcr.players);
      confidence = Math.max(confidence, individualOcr.confidence);
      if (teamName === (teamType === 'home' ? 'ホームチーム' : 'アウェイチーム')) {
        teamName = individualOcr.teamName;
      }
    } catch (error) {
      console.warn('Individual OCR pass failed', error);
    }
  }

  if (players.length < 11) {
    try {
      const rawOcr = await readRawTextCandidatesFromImages(imageBase64, mimeType, analysisImages);
      players = mergePlayerLists(players, rawOcr.players);
      confidence = Math.max(confidence, rawOcr.confidence);
    } catch (error) {
      console.warn('Raw OCR pass failed', error);
    }
  }

  const inferredFormation =
    analysis.formation === '未解析' ? inferFormationFromPlayers(players) : '';

  return {
    ...analysis,
    teamName,
    formation: inferredFormation || analysis.formation,
    players,
    confidence,
  };
}

function removeResponseSchema(payload: any) {
  if (!payload?.generationConfig?.responseSchema) {
    return null;
  }

  const generationConfig = { ...payload.generationConfig };
  delete generationConfig.responseSchema;

  return {
    ...payload,
    generationConfig,
  };
}

async function postGeminiGenerateContent(payload: any, modelList = GEMINI_MODELS) {
  let lastError: unknown = null;
  const models = Array.from(new Set(modelList.filter(Boolean)));
  const apiKey = getGeminiApiKey();

  for (const model of models) {
    try {
      return await axios.post(
        `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${apiKey}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: GEMINI_TIMEOUT_MS,
        }
      );
    } catch (error) {
      lastError = error;
      if (axios.isAxiosError(error)) {
        console.error(`Gemini request failed with model ${model}:`, {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });

        const fallbackPayload = error.response?.status === 400 ? removeResponseSchema(payload) : null;
        if (fallbackPayload) {
          try {
            return await axios.post(
              `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${apiKey}`,
              fallbackPayload,
              {
                headers: {
                  'Content-Type': 'application/json',
                },
                timeout: GEMINI_TIMEOUT_MS,
              }
            );
          } catch (fallbackError) {
            lastError = fallbackError;
            console.error(`Gemini schema-free retry failed with model ${model}:`, fallbackError);
          }
        }
      } else {
        console.error(`Gemini request failed with model ${model}:`, error);
      }
    }
  }

  if (axios.isAxiosError(lastError)) {
    const status = lastError.response?.status;
    if (status === 400) {
      throw new Error('AI解析リクエストの画像形式を処理できませんでした');
    }
    if (status === 401 || status === 403) {
      throw new Error('Gemini APIキーまたはAPI権限を確認してください');
    }
    if (status === 429) {
      throw new Error('Gemini APIの利用上限に達しています。しばらく待ってから再試行してください');
    }
  }

  throw lastError;
}

function ensureJapaneseText(value: unknown, fallback: string) {
  const text = String(value || '').trim();
  return text || fallback;
}

function parsePositionedPlayers(players: string[]) {
  return players
    .map((player) => {
      const text = player.trim();
      const match = text.match(/^([A-Z]{1,4})\s*[:：]\s*(.+)$/i);
      if (!match) {
        return {
          position: '',
          name: text,
          label: text,
        };
      }

      const position = match[1].toUpperCase();
      const name = match[2].trim();
      return {
        position,
        name,
        label: `${position}: ${name}`,
      };
    })
    .filter((player) => player.name);
}

function formatLineupForPrompt(players: string[]) {
  const positionedPlayers = parsePositionedPlayers(players);
  if (positionedPlayers.length === 0) {
    return '不明';
  }

  return positionedPlayers.map((player, index) => `${index + 1}. ${player.label}`).join('\n');
}

function summarizeFormation(formation: string, teamLabel: string) {
  const normalized = formation.trim();
  const notes: Record<string, string> = {
    '4-4-2': `${teamLabel}の4-4-2は2トップを前線に置き、サイドと中央のバランスを取りやすい形です。守備時は中盤4枚で横幅を埋め、攻撃時は前線2枚への早い展開が鍵になります。`,
    '4-3-3': `${teamLabel}の4-3-3は前線3枚で幅を作りやすく、中盤3枚の距離感が攻守の安定に直結します。サイドで優位を作れるかが大きなポイントです。`,
    '4-2-3-1': `${teamLabel}の4-2-3-1はダブルボランチで守備の土台を作り、2列目の3枚が相手の間で受けられるかが攻撃の焦点になります。`,
    '4-1-4-1': `${teamLabel}の4-1-4-1はアンカーを置いて中央を締めやすく、前後の距離を保ちながらサイドへ展開できるかが重要です。`,
    '3-4-3': `${teamLabel}の3-4-3はウイングバックの上下動で幅を作り、前線3枚で相手の最終ラインへ圧力をかけやすい形です。`,
    '3-5-2': `${teamLabel}の3-5-2は中央に人数をかけやすく、2トップと中盤の関係で前進できるかが鍵になります。サイドの背後管理も重要です。`,
    '3-4-2-1': `${teamLabel}の3-4-2-1は2シャドーが相手中盤と最終ラインの間で受けられるかが焦点です。守備時は5バック気味に整えやすい形です。`,
    '5-3-2': `${teamLabel}の5-3-2は守備の人数を確保しやすく、奪った後に2トップへ素早く届けられるかが攻撃の鍵になります。`,
    '5-4-1': `${teamLabel}の5-4-1は低い位置で守備を固めやすく、カウンター時に前線を孤立させないサポートが重要です。`,
  };

  return notes[normalized] || `${teamLabel}は${normalized || '不明なフォーメーション'}をベースに、各ラインの距離感とサイドの使い方が試合展開を左右します。`;
}

function formatPlayerMention(teamLabel: string, players: string[]) {
  const positionedPlayers = parsePositionedPlayers(players).slice(0, 5);
  if (positionedPlayers.length === 0) {
    return `${teamLabel}は配置全体のバランスを中心に、ライン間の距離とサイドの使い方が焦点になります。`;
  }

  const names = positionedPlayers
    .map((player) => (player.position ? `${player.position}の${player.name}` : player.name))
    .join('、');

  return `${teamLabel}は${names}を軸に、ポジション上の役割と個々の特徴をどう試合展開に結びつけるかがポイントになります。`;
}

function buildTacticalAnalysisFallback(
  homeTeam: string,
  awayTeam: string,
  homeFormation: string,
  awayFormation: string,
  homePlayers: string[],
  awayPlayers: string[]
) {
  return `${summarizeFormation(homeFormation, homeTeam)}一方、${summarizeFormation(awayFormation, awayTeam)}${formatPlayerMention(homeTeam, homePlayers)}${formatPlayerMention(awayTeam, awayPlayers)}総合的には、選手の個性を生かす局面をどちらが多く作れるか、そして両チームの配置がぶつかる中盤とサイドで主導権を握れるかが勝敗を分ける展開になりそうです。`;
}

function hasMetaAnalysisLanguage(text: string) {
  return /読み取|読め|解析|OCR|画像|入力情報|表記|データ|不明|不足/.test(text);
}

function normalizeProbability(value: unknown, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(numberValue)));
}

function estimateFallbackProbabilities(homeFormation: string, awayFormation: string) {
  const attackScore: Record<string, number> = {
    '4-3-3': 4,
    '3-4-3': 4,
    '4-2-3-1': 3,
    '3-4-2-1': 3,
    '4-4-2': 2,
    '3-5-2': 2,
    '4-1-4-1': 1,
    '5-3-2': 0,
    '5-4-1': 0,
  };
  const homeScore = attackScore[homeFormation.trim()] ?? 2;
  const awayScore = attackScore[awayFormation.trim()] ?? 2;
  const diff = Math.max(-2, Math.min(2, homeScore - awayScore));
  const homeWinProbability = 36 + diff * 4;
  const awayWinProbability = 34 - diff * 4;

  return {
    homeWinProbability,
    drawProbability: 30,
    awayWinProbability,
  };
}

export async function analyzeFormationImage(
  imageBase64: string,
  teamType: 'home' | 'away',
  mimeType = 'image/jpeg',
  analysisImages?: AnalysisImage[]
): Promise<FormationAnalysis> {
  try {
    assertGeminiApiKey();
    const inlineImages = prepareInlineImages(imageBase64, mimeType, analysisImages);

    const prompt = `あなたはサッカーのフォーメーション画像、テレビ中継のスタメン表示、スマホのスクリーンショットを読む専門家です。
アップロードされた${teamType === 'home' ? 'ホーム' : 'アウェイ'}チームの画像を解析してください。
画像はスマートフォンのカメラ写真、テレビ画面の撮影、WebページやSNSのスクリーンショット、縦長・横長、斜め撮影、影、反射、ぼけ、低解像度を含む可能性があります。

最重要タスク:
- この画像から、対象チームのフォーメーションと先発11名の選手名を読み込んでください。
- フォーメーションは、文字で書かれていなくても選手配置から必ず推定してください。
- 選手名は、完全に読めない場合でも、姓・短縮名・ローマ字・カタカナなど画像上で読める文字列を最大11名まで返してください。

必ず以下を抽出してください:
1. チーム名。見えない場合は "${teamType === 'home' ? 'ホームチーム' : 'アウェイチーム'}"。
2. フォーメーション。文字が読めない場合でも、GKを除く10人の配置から "4-3-3", "4-2-3-1", "3-4-2-1" などを必ず推定してください。
3. 選手名。日本語、英語、ローマ字、カタカナ、漢字、ひらがな表記を読み取ってください。背番号だけの場合は選手名に含めないでください。

読み取り手順:
- まず画像全体の向き、ピッチ、選手名ラベル、ベンチや広告などの余計な文字を分離してください。
- OCRとして、ピッチ上の小さな白文字、テレビ中継のスタメン表、SNS画像のテキストラベルを優先的に読み取ってください。
- 画像が斜め、暗い、反射、粗い場合でも、拡大して読む前提で判断してください。
- GK、DF、MF、FWのラインごとに人数を数え、フォーメーションを推定してください。
- フォーメーション名が見えない場合でも、選手アイコンや名前ラベルの縦横位置からライン人数を数えてください。
- 文字が小さい場合は、ピッチ上のラベルとスタメン表を照合してください。
- 選手名はピッチ上またはスタメン欄にある11名を優先してください。
- players配列は、可能な限り "GK: 選手名", "CB: 選手名", "SB: 選手名", "DMF: 選手名", "OMF: 選手名", "CF: 選手名" のようにポジション付きで返してください。
- ポジションが不明な選手は名前だけ返してよいですが、配置から推定できる場合は必ずポジションを付けてください。
- players配列の順番は、GK、DF、MF、FWの順にしてください。
- テレビ画面の撮影では、傾きやモアレがあっても、読める名前を最大11名まで返してください。
- スクリーンショットでは、フォーメーション図の名前とリスト表示の名前を照合してください。
- 確信度が低い名前は無理に補完せず、読める部分だけ返してください。

カメラ写真の場合は、画像全体の向きとピッチ上の上下左右を推定し、各ラインの人数からフォーメーションを判断してください。
選手名が一部しか読めない場合も、読める名前だけ返してください。
画像内にピッチ図・スタメン表・選手配置のいずれかが見える場合は "未解析" ではなく最も可能性が高いフォーメーションを返してください。
画像がサッカーのフォーメーション図ではないと明確に判断できる場合のみ、formationを"未解析"、playersを空配列にしてください。
confidenceは0から1で、読み取り確信度を返してください。

複数の解析画像がある場合:
- 解析画像1はユーザーが選択した全体画像です。配置、チーム名、ピッチの向きを判断してください。
- 解析画像2以降はOCR用の拡大クロップです。小さな白文字、選手名ラベル、LINEUP11形式の名前読み取りに使ってください。
- ブラウザのタブ、検索バー、右サイドバー、記事本文、アーカイブ、広告、ロゴは無視してください。
- 括弧内のクラブ名はplayersに含めないでください。例: "ガクポ (リヴァプール)" は "LWG: ガクポ" としてください。
- LINEUP11のようなピッチ画像では、ユニフォームの位置からGK/DF/MF/FWのラインを数え、GKを除いた10人でフォーメーションを決めてください。

Markdown、説明文、コードブロックは絶対に含めないでください。`;

    const response = await postGeminiGenerateContent({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
            ...buildInlineImageParts(inlineImages),
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: FORMATION_RESPONSE_SCHEMA,
        candidateCount: 1,
        maxOutputTokens: 900,
        temperature: 0.1,
      },
    }, GEMINI_VISION_MODELS);

    const content = extractResponseText(response.data);
    if (!content) {
      throw new Error('No response from Gemini API');
    }

    const analysis = extractJsonObject(content);
    const normalizedAnalysis = normalizeFormationAnalysis(analysis, teamType);
    if (hasUsefulFormationAnalysis(normalizedAnalysis)) {
      return await enrichFormationWithAllOcr(
        normalizedAnalysis,
        imageBase64,
        teamType,
        mimeType,
        analysisImages
      );
    }

    const retryPrompt = `同じ画像をもう一度、OCRと配置推定を優先して解析してください。
前回はフォーメーションや選手名が十分に読み取れませんでした。

重要:
- 画像の中のフォーメーション図、スタメン表、ピッチ上の選手名ラベルだけに集中してください。
- ブラウザUI、広告、記事本文、スコア表示、SNSの余計な文字は無視してください。
- フォーメーション名が明記されていなくても、GKを除く10人のライン人数から必ず最も近い形を推定してください。
- 選手名は読める範囲だけでよいので、姓・短縮名・ローマ字・カタカナなど最大11名まで返してください。
- players配列は可能なら "GK: 名前", "CB: 名前", "DMF: 名前", "CF: 名前" のようにポジション付きで返してください。
- 複数の解析画像がある場合は、全体画像で配置を確認し、拡大クロップで選手名を読み取ってください。
- Webページのスクリーンショットでは、ピッチ画像以外の本文やサイドバーを無視してください。
- それでも読めない場合のみ、formationを"未解析"、playersを空配列にしてください。

JSONのみで返してください。`;

    const retryResponse = await postGeminiGenerateContent({
      contents: [
        {
          parts: [
            { text: retryPrompt },
            ...buildInlineImageParts(inlineImages),
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: FORMATION_RESPONSE_SCHEMA,
        candidateCount: 1,
        maxOutputTokens: 900,
        temperature: 0,
      },
    }, GEMINI_VISION_MODELS);

    const retryContent = extractResponseText(retryResponse.data);
    if (!retryContent) {
      return await enrichFormationWithAllOcr(
        normalizedAnalysis,
        imageBase64,
        teamType,
        mimeType,
        analysisImages
      );
    }

    const retryAnalysis = normalizeFormationAnalysis(extractJsonObject(retryContent), teamType);
    return await enrichFormationWithAllOcr(
      retryAnalysis,
      imageBase64,
      teamType,
      mimeType,
      analysisImages
    );
  } catch (error) {
    console.error('Error analyzing formation image:', error);
    throw error;
  }
}

async function readPlayersFromImage(
  imageBase64: string,
  teamType: 'home' | 'away',
  mimeType = 'image/jpeg',
  knownFormation = '未解析',
  analysisImages?: AnalysisImage[]
) {
  const inlineImages = prepareInlineImages(imageBase64, mimeType, analysisImages);
  const prompt = `あなたはサッカー画像の選手名OCR専門家です。
この画像から、${teamType === 'home' ? 'ホーム' : 'アウェイ'}チームの選手名だけをできる限り読み取ってください。
フォーメーション推定よりも、選手名ラベル・スタメン表・ピッチ上の小さな文字の読み取りを最優先してください。
この画像から対象チームの先発11名の選手名を読み込んでください。

前提:
- 既知のフォーメーション候補: ${knownFormation}
- 画像はスクリーンショット、テレビ画面の撮影、Web記事、SNS画像、フォーメーション図の可能性があります。
- 画像の中にはブラウザUI、広告、記事本文、検索バー、スコア、SNSボタンなど余計な文字が含まれることがあります。

読み取りルール:
- ピッチ上の選手名ラベル、スタメン一覧、フォーメーション図内の名前を優先してください。
- サッカー選手名らしい文字列のみをplayersに入れてください。
- 背番号だけ、国名だけ、ポジション名だけ、クラブ名だけ、広告文、UI文字は除外してください。
- 日本語、カタカナ、漢字、英字、ローマ字を読んでください。
- 読める名前が一部だけでも返してください。姓だけ、短縮名、ローマ字、カタカナでも選手名らしければ返してください。最大11名です。
- 配置が分かる場合は "GK: 名前", "CB: 名前", "SB: 名前", "DMF: 名前", "OMF: 名前", "CF: 名前" のようにポジション付きで返してください。
- 配置が分からない場合は名前だけでも構いません。
- 選手名を推測で捏造しないでください。読めた名前だけ返してください。
- 複数の解析画像がある場合は、拡大クロップをOCRの主材料にし、全体画像で配置と上下左右を確認してください。
- LINEUP11やWeb記事のスクリーンショットでは、ピッチ内の白文字ラベルを優先し、括弧内のクラブ名、記事本文、右サイドバー、ブラウザUIは除外してください。

JSONのみで返してください。`;

  const response = await postGeminiGenerateContent({
    contents: [
      {
        parts: [
          { text: prompt },
          ...buildInlineImageParts(inlineImages),
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: PLAYER_OCR_RESPONSE_SCHEMA,
      candidateCount: 1,
      maxOutputTokens: 700,
      temperature: 0,
    },
  }, GEMINI_VISION_MODELS);

  const content = extractResponseText(response.data);
  if (!content) {
    return {
      teamName: teamType === 'home' ? 'ホームチーム' : 'アウェイチーム',
      players: [],
      confidence: 0,
    };
  }

  const result = extractJsonObject(content);
  return {
    teamName: ensureJapaneseText(
      result.teamName,
      teamType === 'home' ? 'ホームチーム' : 'アウェイチーム'
    ),
    players: normalizePlayers(result.players),
    confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
  };
}

export async function predictMatchOutcome(
  homeTeam: string,
  awayTeam: string,
  homeFormation: string,
  awayFormation: string,
  homePlayers: string[],
  awayPlayers: string[]
): Promise<PredictionResult> {
  const fallbackAnalysis = buildTacticalAnalysisFallback(
    homeTeam,
    awayTeam,
    homeFormation,
    awayFormation,
    homePlayers,
    awayPlayers
  );
  const fallbackProbabilities = estimateFallbackProbabilities(homeFormation, awayFormation);

  try {
    assertGeminiApiKey();

    const prompt = `あなたはテレビ中継で解説するプロのサッカーアナリストです。以下の試合情報をもとに、日本語で試合分析と勝敗予測を作成してください。

ホームチーム: ${homeTeam}
ホームのフォーメーション: ${homeFormation}
ホームの選手とポジション:
${formatLineupForPrompt(homePlayers)}

アウェイチーム: ${awayTeam}
アウェイのフォーメーション: ${awayFormation}
アウェイの選手とポジション:
${formatLineupForPrompt(awayPlayers)}

必ず日本語で、具体的な試合展開、攻撃・守備の噛み合わせ、勝敗予測の理由を説明してください。
試合分析は300〜500文字にしてください。
試合分析では、次の2点を必ず踏まえてください。
1. 選手名から高い確度で想定できるプレースタイル、力量、ポジション適性、得意な局面。
2. 両チームのフォーメーションによるライン構成、中央の人数、サイドの優位、守備時の形、噛み合わせ。
選手に "CF: 山田" のようなポジション表記がある場合は、そのポジションとして扱ってください。
選手名がある場合は、各チームから1〜3名ずつ自然に含め、選手の特徴とフォーメーション上の役割を結びつけてください。
実在のサッカー選手として高い確度で識別できる場合は、その選手から一般的に想定されるプレースタイル、力量、ポジション適性を試合予想に反映してください。
同姓同名や識別の確度が低い場合は、断定的な個人能力評価を避け、ポジションと配置から自然に言える範囲で分析してください。
ポジションと矛盾する特徴を作らないでください。例えばCBをサイド突破の中心、GKを前線の起点、CFを守備統率役のようには書かないでください。
選手名が少ない場合は架空の名前を作らず、「中盤」「前線」「サイド」「最終ライン」など役割で説明してください。
ホームを常に優勢にしないでください。フォーメーションの噛み合わせから中立に判断してください。
ホームチームには移動負担の少なさ、会場適応、サポーターの後押しを小さな補正として考慮してください。ただし戦力やフォーメーション差を上回るほど過大評価しないでください。
文調は、テレビ中継の優秀な解説者・アナリストのように、落ち着いて具体的で説得力のある日本語にしてください。
「読み取れた」「画像」「解析」「入力情報」「不明」「不足」など、アプリ内部の処理やデータ状態を説明する言葉は使わないでください。
返答は有効なJSONのみで、この形式にしてください:
{
  "predictedScore": "X-Y",
  "homeWinProbability": 0-100,
  "drawProbability": 0-100,
  "awayWinProbability": 0-100,
  "tacticalAnalysis": "300〜500文字の日本語の試合分析"
}

重要: 3つの確率は必ず合計100にしてください。英語、Markdown、説明文、コードブロックは含めないでください。`;

    const response = await postGeminiGenerateContent({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        candidateCount: 1,
        maxOutputTokens: 1024,
        temperature: 0.2,
      },
    });

    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('No response from Gemini API');
    }

    const prediction = extractJsonObject(content);

    // Validate probabilities sum to 100
    const total =
      Number(prediction.homeWinProbability || 0) +
      Number(prediction.drawProbability || 0) +
      Number(prediction.awayWinProbability || 0);

    if (Number.isFinite(total) && total > 0 && Math.abs(total - 100) > 1) {
      // Normalize if slightly off
      const factor = 100 / total;
      prediction.homeWinProbability = Math.round(prediction.homeWinProbability * factor);
      prediction.drawProbability = Math.round(prediction.drawProbability * factor);
      prediction.awayWinProbability = 100 - prediction.homeWinProbability - prediction.drawProbability;
    }

    const tacticalAnalysis = ensureJapaneseText(prediction.tacticalAnalysis, fallbackAnalysis);
    const polishedAnalysis =
      tacticalAnalysis.length >= 80 && !hasMetaAnalysisLanguage(tacticalAnalysis)
        ? tacticalAnalysis
        : fallbackAnalysis;

    return {
      homeTeam,
      awayTeam,
      homeFormation,
      awayFormation,
      homePlayers,
      awayPlayers,
      predictedScore: prediction.predictedScore || '1-1',
      homeWinProbability: normalizeProbability(prediction.homeWinProbability, 33),
      drawProbability: normalizeProbability(prediction.drawProbability, 34),
      awayWinProbability: normalizeProbability(prediction.awayWinProbability, 33),
      tacticalAnalysis: polishedAnalysis,
    };
  } catch (error) {
    console.error('Error predicting match outcome:', error);
    return {
      homeTeam,
      awayTeam,
      homeFormation,
      awayFormation,
      homePlayers,
      awayPlayers,
      predictedScore: '1-1',
      homeWinProbability: fallbackProbabilities.homeWinProbability,
      drawProbability: fallbackProbabilities.drawProbability,
      awayWinProbability: fallbackProbabilities.awayWinProbability,
      tacticalAnalysis: fallbackAnalysis,
    };
  }
}
