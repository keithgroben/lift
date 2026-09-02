import { createStore } from 'solid-js/store';

/**
 * The saves panel's state, and the one place the HUD talks *back* to the game.
 *
 * `hud/store.ts` is deliberately one-way — `app.js` pushes computed values,
 * components read them. A save list cannot work that way: its buttons have to
 * reach the live tower. So the data still flows in through `setSaves(...)`,
 * and the verbs live in `savesBridge`, which `app.js` fills at startup. The
 * panel calls a verb and then waits to be told what happened, exactly as it
 * would if the click had come from a key press — which is the point, because
 * both routes go through the same functions in `app.js`.
 */

export interface SaveSummary {
  day: number;
  floors: number;
  basements: number;
  population: number;
  money: number;
  star: string;
  seed: number;
  over: boolean;
  deliveryRate: number | null;
}

export interface SaveRow {
  key: string;
  name: string;
  savedAt: number;
  summary: SaveSummary | null;
  version: number;
  /** True when this save exists only in this tab — the store refused it. */
  memoryOnly?: boolean;
}

export interface SavesState {
  open: boolean;
  rows: SaveRow[];
  /** What just happened, in the player's terms. Tone drives the colour. */
  message: { text: string; tone: 'good' | 'bad' | 'info' } | null;
  busy: boolean;
  /** Set when nothing can be stored at all, so the panel can stop promising. */
  storageWarning: string;
  /** The autosave's key, so the list can pin and label it. */
  autosaveKey: string;
  /** The key the panel is asking about before it overwrites or deletes. */
  confirming: { key: string; verb: 'load' | 'delete' } | null;
}

const initial: SavesState = {
  open: false,
  rows: [],
  message: null,
  busy: false,
  storageWarning: '',
  autosaveKey: 'autosave',
  confirming: null,
};

export const [saves, setSaves] = createStore<SavesState>(initial);

export interface SavesBridge {
  saveNamed(name: string): void | Promise<void>;
  load(key: string): void | Promise<void>;
  remove(key: string): void | Promise<void>;
  download(key: string): void | Promise<void>;
  upload(file: File): void | Promise<void>;
  close(): void;
}

const notWired = () => { throw new Error('the saves panel was opened before app.js wired it'); };

export const savesBridge: SavesBridge = {
  saveNamed: notWired,
  load: notWired,
  remove: notWired,
  download: notWired,
  upload: notWired,
  close: notWired,
};

/** Called once by `app.js`. Keeps the panel importable without a live game. */
export function wireSaves(verbs: Partial<SavesBridge>) {
  Object.assign(savesBridge, verbs);
}
