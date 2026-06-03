import * as FileSystem from 'expo-file-system/legacy';

export const DAILY_FREE_ANALYSIS_LIMIT = 3;

export interface AnalysisUsage {
  date: string;
  used: number;
  rewardedCredits: number;
}

const USAGE_FILE = `${FileSystem.documentDirectory || ''}analysis-usage.json`;

export function getUsageDate() {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyUsage(): AnalysisUsage {
  return {
    date: getUsageDate(),
    used: 0,
    rewardedCredits: 0,
  };
}

export function getRemainingAnalyses(usage: AnalysisUsage) {
  return Math.max(0, DAILY_FREE_ANALYSIS_LIMIT + usage.rewardedCredits - usage.used);
}

export async function loadAnalysisUsage(): Promise<AnalysisUsage> {
  try {
    const info = await FileSystem.getInfoAsync(USAGE_FILE);
    if (!info.exists) {
      return createEmptyUsage();
    }

    const raw = await FileSystem.readAsStringAsync(USAGE_FILE);
    const parsed = JSON.parse(raw) as Partial<AnalysisUsage>;
    const today = getUsageDate();

    if (parsed.date !== today) {
      return createEmptyUsage();
    }

    return {
      date: today,
      used: Math.max(0, Number(parsed.used) || 0),
      rewardedCredits: Math.max(0, Number(parsed.rewardedCredits) || 0),
    };
  } catch (error) {
    console.warn('Failed to load analysis usage', error);
    return createEmptyUsage();
  }
}

export async function saveAnalysisUsage(usage: AnalysisUsage) {
  try {
    await FileSystem.writeAsStringAsync(USAGE_FILE, JSON.stringify(usage));
  } catch (error) {
    console.warn('Failed to save analysis usage', error);
  }
}
