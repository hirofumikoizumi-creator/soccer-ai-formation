import axios from 'axios';

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

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_MODELS = [
  process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash',
  'gemini-2.0-flash',
];
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

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

function assertGeminiApiKey() {
  if (!GEMINI_API_KEY) {
    throw new Error('AI解析キーがアプリに設定されていません');
  }
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

function normalizePlayers(players: unknown): string[] {
  if (!Array.isArray(players)) {
    return [];
  }

  return players
    .map((player) => String(player).trim())
    .filter(Boolean);
}

function normalizeFormationAnalysis(
  analysis: any,
  teamType: 'home' | 'away'
): FormationAnalysis {
  return {
    teamName: ensureJapaneseText(
      analysis.teamName,
      teamType === 'home' ? 'ホームチーム' : 'アウェイチーム'
    ),
    formation: ensureJapaneseText(analysis.formation, '未解析'),
    players: normalizePlayers(analysis.players),
    confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.5,
  };
}

function hasUsefulFormationAnalysis(analysis: FormationAnalysis) {
  return analysis.formation !== '未解析' || analysis.players.length > 0;
}

async function postGeminiGenerateContent(payload: unknown) {
  let lastError: unknown = null;
  const models = Array.from(new Set(GEMINI_MODELS.filter(Boolean)));

  for (const model of models) {
    try {
      return await axios.post(
        `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${GEMINI_API_KEY}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 90000,
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
    return `${teamLabel}は選手名が不足しているため、個別の役割は断定せず配置面を中心に見ます。`;
  }

  const names = positionedPlayers
    .map((player) => (player.position ? `${player.position}の${player.name}` : player.name))
    .join('、');

  return `${teamLabel}の読み取れたメンバーには${names}などが含まれます。ポジション表記がある選手はその配置として扱い、表記がない選手は個別の役割を断定せず、フォーメーション全体の噛み合わせを優先して評価します。`;
}

function buildTacticalAnalysisFallback(
  homeTeam: string,
  awayTeam: string,
  homeFormation: string,
  awayFormation: string,
  homePlayers: string[],
  awayPlayers: string[]
) {
  return `${summarizeFormation(homeFormation, homeTeam)}一方、${summarizeFormation(awayFormation, awayTeam)}${formatPlayerMention(homeTeam, homePlayers)}${formatPlayerMention(awayTeam, awayPlayers)}総合的には、個人名からプレー内容を決め打ちせず、両チームの配置とライン間の噛み合わせから見ると、中盤の支配とサイドの背後管理が勝敗を分ける展開になりそうです。`;
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
  mimeType = 'image/jpeg'
): Promise<FormationAnalysis> {
  try {
    assertGeminiApiKey();

    const prompt = `あなたはサッカーのフォーメーション画像、テレビ中継のスタメン表示、スマホのスクリーンショットを読む専門家です。
アップロードされた${teamType === 'home' ? 'ホーム' : 'アウェイ'}チームの画像を解析してください。
画像はスマートフォンのカメラ写真、テレビ画面の撮影、WebページやSNSのスクリーンショット、縦長・横長、斜め撮影、影、反射、ぼけ、低解像度を含む可能性があります。

必ず以下を抽出してください:
1. チーム名。見えない場合は "${teamType === 'home' ? 'ホームチーム' : 'アウェイチーム'}"。
2. フォーメーション。文字が読めない場合でも、GKを除く10人の配置から "4-3-3", "4-2-3-1", "3-4-2-1" などを推定してください。
3. 選手名。日本語、英語、ローマ字、カタカナ、漢字、ひらがな表記を読み取ってください。背番号だけの場合は選手名に含めないでください。

読み取り手順:
- まず画像全体の向き、ピッチ、選手名ラベル、ベンチや広告などの余計な文字を分離してください。
- OCRとして、ピッチ上の小さな白文字、テレビ中継のスタメン表、SNS画像のテキストラベルを優先的に読み取ってください。
- 画像が斜め、暗い、反射、粗い場合でも、拡大して読む前提で判断してください。
- GK、DF、MF、FWのラインごとに人数を数え、フォーメーションを推定してください。
- 選手名はピッチ上またはスタメン欄にある11名を優先してください。
- players配列は、可能な限り "GK: 選手名", "CB: 選手名", "SB: 選手名", "DMF: 選手名", "OMF: 選手名", "CF: 選手名" のようにポジション付きで返してください。
- ポジションが不明な選手は名前だけ返してよいですが、配置から推定できる場合は必ずポジションを付けてください。
- players配列の順番は、GK、DF、MF、FWの順にしてください。
- テレビ画面の撮影では、傾きやモアレがあっても、読める名前を最大11名まで返してください。
- スクリーンショットでは、フォーメーション図の名前とリスト表示の名前を照合してください。
- 確信度が低い名前は無理に補完せず、読める部分だけ返してください。

カメラ写真の場合は、画像全体の向きとピッチ上の上下左右を推定し、各ラインの人数からフォーメーションを判断してください。
選手名が一部しか読めない場合も、読める名前だけ返してください。
できるだけ短時間で判断し、推測できる場合は "未解析" ではなく最も可能性が高いフォーメーションを返してください。
confidenceは0から1で、読み取り確信度を返してください。

Markdown、説明文、コードブロックは絶対に含めないでください。`;

    const response = await postGeminiGenerateContent({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: FORMATION_RESPONSE_SCHEMA,
        candidateCount: 1,
        maxOutputTokens: 768,
        temperature: 0.1,
      },
    });

    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('No response from Gemini API');
    }

    const analysis = extractJsonObject(content);
    const normalizedAnalysis = normalizeFormationAnalysis(analysis, teamType);
    if (hasUsefulFormationAnalysis(normalizedAnalysis)) {
      return normalizedAnalysis;
    }

    const retryPrompt = `同じ画像をもう一度、OCRと配置推定を優先して解析してください。
前回はフォーメーションや選手名が十分に読み取れませんでした。

重要:
- 画像の中のフォーメーション図、スタメン表、ピッチ上の選手名ラベルだけに集中してください。
- ブラウザUI、広告、記事本文、スコア表示、SNSの余計な文字は無視してください。
- フォーメーション名が明記されていなくても、GKを除く10人のライン人数から必ず最も近い形を推定してください。
- 選手名は読める範囲だけでよいので、最大11名まで返してください。
- players配列は可能なら "GK: 名前", "CB: 名前", "DMF: 名前", "CF: 名前" のようにポジション付きで返してください。
- それでも読めない場合のみ、formationを"未解析"、playersを空配列にしてください。

JSONのみで返してください。`;

    const retryResponse = await postGeminiGenerateContent({
      contents: [
        {
          parts: [
            { text: retryPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: FORMATION_RESPONSE_SCHEMA,
        candidateCount: 1,
        maxOutputTokens: 768,
        temperature: 0,
      },
    });

    const retryContent = retryResponse.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!retryContent) {
      return normalizedAnalysis;
    }

    return normalizeFormationAnalysis(extractJsonObject(retryContent), teamType);
  } catch (error) {
    console.error('Error analyzing formation image:', error);
    throw error;
  }
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

    const prompt = `あなたはプロのサッカー戦術アナリストです。以下の試合情報をもとに、日本語で試合展開と勝敗予測を作成してください。

ホームチーム: ${homeTeam}
ホームのフォーメーション: ${homeFormation}
ホームの選手とポジション:
${formatLineupForPrompt(homePlayers)}

アウェイチーム: ${awayTeam}
アウェイのフォーメーション: ${awayFormation}
アウェイの選手とポジション:
${formatLineupForPrompt(awayPlayers)}

必ず日本語で、具体的な試合展開、攻撃・守備の噛み合わせ、勝敗予測の理由を説明してください。
戦術分析は300〜500文字にしてください。
戦術分析では、必ず両チームのフォーメーションに言及してください。
フォーメーションから分かるライン構成、サイドの使い方、中央の人数、守備時の形を優先して分析してください。
選手に "CF: 山田" のようなポジション表記がある場合は、そのポジションとして扱ってください。
選手名が入力されている場合は、各チームから1〜3名ずつ自然に含めてください。
実在のサッカー選手として高い確度で識別できる場合は、その選手から一般的に想定されるプレースタイル、力量、ポジション適性を試合予想に反映してください。
ただし同姓同名や読み取り違いの可能性がある場合、個人能力を断定せず「読み取れたメンバー」として扱ってください。
ポジション表記や入力情報から分からない特徴を作らないでください。
例えばCBの選手をサイド突破の中心、GKを前線の起点、CFを守備統率役のように書かないでください。
選手名は、ポジションとフォーメーション上の役割に沿って扱い、個人能力の特徴は推測で断定しないでください。
選手名が不足している場合は無理に架空の名前を作らず、「中盤」「前線」「サイド」「最終ライン」など役割で説明してください。
ホームを常に優勢にしないでください。フォーメーションの噛み合わせから中立に判断してください。
ホームチームには移動負担の少なさ、会場適応、サポーターの後押しを小さな補正として考慮してください。ただし戦力やフォーメーション差を上回るほど過大評価しないでください。
文調は、テレビ中継の優秀な解説者・戦術アナリストのように、落ち着いて具体的で説得力のある日本語にしてください。
返答は有効なJSONのみで、この形式にしてください:
{
  "predictedScore": "X-Y",
  "homeWinProbability": 0-100,
  "drawProbability": 0-100,
  "awayWinProbability": 0-100,
  "tacticalAnalysis": "300〜500文字の日本語の戦術分析"
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
      tacticalAnalysis: tacticalAnalysis.length >= 80 ? tacticalAnalysis : fallbackAnalysis,
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
