export interface RealTime {
  realTime: number | null;
}

export interface Segment {
  name: string;
  icon: string | null;
  splitTime: RealTime;
  comparisons: {
    [key: string]: RealTime;
  };
}

export interface RunData {
  timerState: 'NotRunning' | 'Running' | 'Paused' | 'Ended';
  currentTime: RealTime;
  currentSplitIndex: number | null;
  gameName: string;
  categoryName: string;
  run: {
    segments: Segment[];
    gameName?: string;
    categoryName?: string;
    metadata?: {
      gameId?: string;
      categoryId?: string;
      emulator?: boolean;
      variables?: Record<string, string>;
    };
  };
}

export type Language = 'pt-BR' | 'en-US' | 'fr' | 'de' | 'es';

export interface Settings {
  language: Language;
  theme: string;
  showGraph: boolean;
  showTable: boolean;
  showControls: boolean;
  alwaysExpandedSplits: boolean;
  wsUrl: string;
  chromaKey: {
    enabled: boolean;
  };
}
