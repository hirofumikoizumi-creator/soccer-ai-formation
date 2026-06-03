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
          timeout: 60000,
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

function buildTacticalAnalysisFallback(
  homeTeam: string,
  awayTeam: string,
  homeFormation: string,
  awayFormation: string,
  homePlayers: string[],
  awayPlayers: string[]
) {
  const homeKeyPlayers = homePlayers.slice(0, 3).join('、') || '中盤と前線の選手';
  const awayKeyPlayers = awayPlayers.slice(0, 3).join('、') || 'サイドと前線の選手';

  return `${homeTeam}は${homeFormation}をベースに、${homeKeyPlayers}を中心として中盤から攻撃の形を作れるかが鍵になります。ボール保持で相手の守備ラインを動かし、サイドやトップ下のスペースを使えれば主導権を握りやすい展開です。一方、${awayTeam}は${awayFormation}から守備の人数を確保しつつ、${awayKeyPlayers}を起点に素早い攻撃へ移る形が狙いになります。ホームが押し込む時間は長くなりそうですが、アウェイのカウンターにも注意が必要です。総合的には、配置の安定感と攻撃の再現性でホームがやや優勢と見ます。`;
}

function normalizeProbability(value: unknown, fallback: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(numberValue)));
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
- GK、DF、MF、FWのラインごとに人数を数え、フォーメーションを推定してください。
- 選手名はピッチ上またはスタメン欄にある11名を優先してください。
- テレビ画面の撮影では、傾きやモアレがあっても、読める名前を最大11名まで返してください。
- スクリーンショットでは、フォーメーション図の名前とリスト表示の名前を照合してください。

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
    return {
      teamName: ensureJapaneseText(
        analysis.teamName,
        teamType === 'home' ? 'ホームチーム' : 'アウェイチーム'
      ),
      formation: ensureJapaneseText(analysis.formation, '未解析'),
      players: normalizePlayers(analysis.players),
      confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.5,
    };
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

  try {
    assertGeminiApiKey();

    const prompt = `あなたはプロのサッカー戦術アナリストです。以下の試合情報をもとに、日本語で試合展開と勝敗予測を作成してください。

ホームチーム: ${homeTeam}
ホームのフォーメーション: ${homeFormation}
ホームの選手: ${homePlayers.join(', ') || '不明'}

アウェイチーム: ${awayTeam}
アウェイのフォーメーション: ${awayFormation}
アウェイの選手: ${awayPlayers.join(', ') || '不明'}

必ず日本語で、具体的な試合展開、攻撃・守備の噛み合わせ、勝敗予測の理由を説明してください。
戦術分析は300〜500文字にしてください。
戦術分析では、必ず両チームのフォーメーションに言及してください。
選手名が入力されている場合は、各チームから1〜3名ずつ自然に含めてください。
選手名が不足している場合は無理に架空の名前を作らず、「中盤」「前線」「サイド」「最終ライン」など役割で説明してください。
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
      homeWinProbability: 38,
      drawProbability: 31,
      awayWinProbability: 31,
      tacticalAnalysis: fallbackAnalysis,
    };
  }
}
