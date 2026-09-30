export const LANGUAGES = ['pt-BR', 'en-US', 'fr', 'de', 'es'] as const;
export type Language = (typeof LANGUAGES)[number];

export interface Settings {
  language: Language;
  theme: string;
  showGraph: boolean;
  showTable: boolean;
  showControls: boolean;
  alwaysExpandedSplits: boolean;
  hotkeysEnabled: boolean;
  wsUrl: string;
  chromaKey: {
    enabled: boolean;
  };
}
