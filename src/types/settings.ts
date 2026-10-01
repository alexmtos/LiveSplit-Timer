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
  /** Order of the sections on the page, top to bottom: every section exactly once, shown or not. */
  sectionOrder: OverlaySection[];
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
  /** Largest width or height of the game image in the header, in CSS pixels (whichever it reaches first). */
  gameIconSize: number;
  /** Largest width or height of the split icons in the table, in CSS pixels (whichever they reach first). */
  splitIconSize: number;
  /** Times per second the running timer, deltas and graph are redrawn (one of REFRESH_RATES in lib/ticker). */
  refreshRate: number;
}

/** Sections of the overlay, in their default order; each one can be hidden, moved or served alone on its own route. */
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
