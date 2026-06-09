export interface FormationData {
  teamName: string;
  formation: string;
  players: string[];
  imageUri?: string;
  imageBase64?: string;
  mimeType?: string;
  analysisImages?: AnalysisImage[];
  teamHint?: string;
}

export interface AnalysisImage {
  base64: string;
  mimeType: string;
  label: string;
}

export interface AnalysisState {
  homeFormation: FormationData | null;
  awayFormation: FormationData | null;
  prediction: PredictionData | null;
  loading: boolean;
  error: string | null;
}

export interface PredictionData {
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

export type AppScreen = 'home' | 'upload' | 'confirmation' | 'prediction';
