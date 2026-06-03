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
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export async function analyzeFormationImage(
  imageBase64: string,
  teamType: 'home' | 'away'
): Promise<FormationAnalysis> {
  try {
    const prompt = `You are a soccer/football expert. Analyze this formation image and extract:
1. Team name (if visible, otherwise return "Unknown Team")
2. Formation (e.g., "4-3-3", "4-2-3-1", etc.)
3. Player names (if visible, otherwise return empty array)

Return ONLY valid JSON in this exact format:
{
  "teamName": "string",
  "formation": "string",
  "players": ["player1", "player2", ...],
  "confidence": 0.0-1.0
}

Do not include any other text or markdown formatting.`;

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: imageBase64,
                },
              },
            ],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('No response from Gemini API');
    }

    // Parse the JSON response
    const analysis = JSON.parse(content);
    return {
      teamName: analysis.teamName || 'Unknown Team',
      formation: analysis.formation || '4-3-3',
      players: Array.isArray(analysis.players) ? analysis.players : [],
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

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new Error('No response from Gemini API');
    }

    // Parse the JSON response
    const prediction = JSON.parse(content);

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
