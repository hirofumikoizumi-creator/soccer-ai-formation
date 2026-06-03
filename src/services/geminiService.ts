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

function assertGeminiApiKey() {
  if (!GEMINI_API_KEY) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY');
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
      console.error(`Gemini request failed with model ${model}:`, error);
    }
  }

  throw lastError;
}

export async function analyzeFormationImage(
  imageBase64: string,
  teamType: 'home' | 'away',
  mimeType = 'image/jpeg'
): Promise<FormationAnalysis> {
  try {
    assertGeminiApiKey();

    const prompt = `You are an expert football/soccer analyst and OCR assistant.
Analyze the uploaded formation image for the ${teamType === 'home' ? 'home' : 'away'} team.

Extract:
1. Team name, if visible. If it is not visible, use "${teamType === 'home' ? 'ホームチーム' : 'アウェイチーム'}".
2. Formation shape, such as "4-3-3", "4-2-3-1", "3-4-2-1", or infer it from player positions if text is not visible.
3. Player names from labels on the pitch. Read Japanese, English, and romanized names. Ignore shirt numbers unless they are part of the visible label.

Return ONLY valid JSON in this exact format:
{
  "teamName": "string",
  "formation": "string",
  "players": ["player1", "player2", ...],
  "confidence": 0.0-1.0
}

If the image is low resolution, still infer the formation from positions and return any readable player names.
Do not include markdown, comments, or explanatory text.`;

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
        temperature: 0.1,
      },
    });

    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('No response from Gemini API');
    }

    const analysis = extractJsonObject(content);
    return {
      teamName: analysis.teamName || (teamType === 'home' ? 'ホームチーム' : 'アウェイチーム'),
      formation: analysis.formation || '未解析',
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
  try {
    assertGeminiApiKey();

    const prompt = `You are a professional soccer analyst. Based on the following match information, provide a prediction:

Home Team: ${homeTeam}
Home Formation: ${homeFormation}
Home Players: ${homePlayers.join(', ') || 'Unknown'}

Away Team: ${awayTeam}
Away Formation: ${awayFormation}
Away Players: ${awayPlayers.join(', ') || 'Unknown'}

Provide a detailed analysis and prediction. Return ONLY valid JSON in this exact format:
{
  "predictedScore": "X-Y",
  "homeWinProbability": 0-100,
  "drawProbability": 0-100,
  "awayWinProbability": 0-100,
  "tacticalAnalysis": "Detailed tactical analysis explaining the prediction"
}

Important: The three probabilities MUST sum to 100. Do not include any other text or markdown.`;

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
      (prediction.homeWinProbability || 0) +
      (prediction.drawProbability || 0) +
      (prediction.awayWinProbability || 0);

    if (Math.abs(total - 100) > 1) {
      // Normalize if slightly off
      const factor = 100 / total;
      prediction.homeWinProbability = Math.round(prediction.homeWinProbability * factor);
      prediction.drawProbability = Math.round(prediction.drawProbability * factor);
      prediction.awayWinProbability = 100 - prediction.homeWinProbability - prediction.drawProbability;
    }

    return {
      homeTeam,
      awayTeam,
      homeFormation,
      awayFormation,
      homePlayers,
      awayPlayers,
      predictedScore: prediction.predictedScore || '1-1',
      homeWinProbability: Math.max(0, Math.min(100, prediction.homeWinProbability || 33)),
      drawProbability: Math.max(0, Math.min(100, prediction.drawProbability || 34)),
      awayWinProbability: Math.max(0, Math.min(100, prediction.awayWinProbability || 33)),
      tacticalAnalysis: prediction.tacticalAnalysis || 'Tactical analysis pending...',
    };
  } catch (error) {
    console.error('Error predicting match outcome:', error);
    throw error;
  }
}
