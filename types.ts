export enum ViewMode {
  CHART = 'CHART',
  CHAT = 'CHAT',
  SETTINGS = 'SETTINGS',
  HISTORY = 'HISTORY'
}

export enum Sender {
  USER = 'USER',
  AI = 'AI',
  SYSTEM = 'SYSTEM'
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
  imageData?: string; // Base64 string
  imageList?: string[]; // Multiple images for 2-image mode
  isAnalysis?: boolean;
}

export interface ScheduleConfig {
  enabled: boolean;
  intervalMinutes: number; // e.g., 60 for hourly
  nextRun: number | null; // Timestamp
  dailyTrainingEnabled: boolean;
  dailyTrainingTime: string; // "08:00"
  dailyTrainingMessage?: string;
  quietHoursEnabled?: boolean;
  quietStart?: string; // "23:00"
  quietEnd?: string;   // "05:00"
  quietTimezone?: string; // IANA tz, e.g., "Asia/Dhaka"
}

export interface AppSettings {
  customPrompt: string;
  modelName: string;
  notificationsEnabled: boolean;
  maxDailyCaptures: number;
  autoSheetSyncEnabled?: boolean;
  captureSource: 'external' | 'web';
  twoImageModeEnabled?: boolean;
  modelProvider?: 'gemini' | 'openai';
}

export interface AnalysisLog {
  id: string;
  timestamp: Date;
  symbol: string;
  summary: string;
  fullResponse: string;
}
