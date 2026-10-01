export const LANGUAGES = ['pt-BR', 'en-US', 'fr', 'de', 'es'] as const;
export type Language = (typeof LANGUAGES)[number];

export interface Settings {
  language: Language;
  theme: string;
  showHeader: boolean;
  showTimer: boolean;
  showPredictions: boolean;
  showControls: boolean;
  showGraph: boolean;
  showTable: boolean;
  alwaysExpandedSplits: boolean;
  hotkeysEnabled: boolean;
  /** Hides the settings button unless the pointer is over it (for stream overlays). */
  streamMode: boolean;
  wsUrl: string;
  /** Token required by the component when set in its settings (protocol 2). */
  token: string;
  chromaKey: {
    enabled: boolean;
  };
  /** In transparent mode, how transparent the background is: 100 = fully transparent, 0 = the theme's background. */
  transparency: number;
  /** Times per second the running timer, deltas and graph are redrawn (one of REFRESH_RATES in lib/ticker). */
  refreshRate: number;
}

/** Sections of the overlay; each one can be hidden or served alone on its own route. */
export const OVERLAY_SECTIONS = ['header', 'timer', 'predictions', 'graph', 'controls', 'splits'] as const;
export type OverlaySection = (typeof OVERLAY_SECTIONS)[number];

export const SECTION_SETTING: Record<OverlaySection, keyof Settings> = {
  header: 'showHeader',
  timer: 'showTimer',
  predictions: 'showPredictions',
  controls: 'showControls',
  graph: 'showGraph',
  splits: 'showTable',
};
