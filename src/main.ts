/**
 * @file main.ts
 * @version 1.0.0
 * @description Entry point for the MODE — Video.js v10 Skin Judge's Workbench (https://arcanedoma.in/mode/).
 */

import './skin/mode-skin.css';
import './workbench.css';
import { ModeSkinController, type ModePreset, type ModeSkinState } from './skin/mode-skin';
import type { PolyglotCue, StudyBookmark } from './skin/engines/StudyToolsEngine';
import {
  ARCANE_SONIC_BOOKMARKS,
  ARCANE_SONIC_CUES,
  BRIGHT_SOLAR_BOOKMARKS,
  BRIGHT_SOLAR_CUES,
  DYREWOOD_BOOKMARKS,
  DYREWOOD_CUES,
  MODE_EXPLAINER_CAPTION_TRACKS,
  MUX_DEMO_BOOKMARKS,
  MUX_DEMO_CUES,
} from './scenario-cues';

const DEMO_MUX_PLAYBACK_ID = 'rR8P8mSaKDzz02TsftugTUdI00cQPJX00oy';
const STORM_MUX_PLAYBACK_ID = 'LRH6O8v9nAchc02njUk59MosxoHhvvReqiFNcqAP01a5w';

interface VideoScenario {
  id: string;
  label: string;
  src: string;
  poster?: string;
  storyboardVtt?: string;
  chaptersVtt?: string;
  captions?: PolyglotCue[];
  bookmarks?: StudyBookmark[];
  muxPlaybackId?: string;
  recommendedMode: ModePreset;
}

const SCENARIOS: Record<string, VideoScenario> = {
  'mux-cosmic': {
    id: 'mux-cosmic',
    label: '1. Mux Stream (rR8P8mSa... · Storyboard VTT · +1 Bonus)',
    src: `https://stream.mux.com/${DEMO_MUX_PLAYBACK_ID}.m3u8`,
    poster: `https://image.mux.com/${DEMO_MUX_PLAYBACK_ID}/thumbnail.webp`,
    storyboardVtt: `https://image.mux.com/${DEMO_MUX_PLAYBACK_ID}/storyboard.vtt`,
    chaptersVtt: './tracks/mux-demo-chapters.vtt',
    captions: MUX_DEMO_CUES,
    bookmarks: MUX_DEMO_BOOKMARKS,
    muxPlaybackId: DEMO_MUX_PLAYBACK_ID,
    recommendedMode: 'movie',
  },
  'arcane-sonic': {
    id: 'arcane-sonic',
    label: '2. Arcane Domain — "The Storm" (from the album INDIVISION · Mux HLS 1080p · Cyber Sonic Reel)',
    src: `https://stream.mux.com/${STORM_MUX_PLAYBACK_ID}.m3u8`,
    poster: `https://image.mux.com/${STORM_MUX_PLAYBACK_ID}/thumbnail.webp`,
    storyboardVtt: `https://image.mux.com/${STORM_MUX_PLAYBACK_ID}/storyboard.vtt`,
    chaptersVtt: './tracks/chapters-en.vtt',
    captions: ARCANE_SONIC_CUES,
    bookmarks: ARCANE_SONIC_BOOKMARKS,
    muxPlaybackId: STORM_MUX_PLAYBACK_ID,
    recommendedMode: 'music',
  },
  'dyrewood-dark': {
    id: 'dyrewood-dark',
    label: '3. Dyrewood 616 — Gothic Cinema (Dark Contrast Test)',
    src: 'https://arcanedoma.in/dyrewood/dyrewood_showcase.mp4',
    poster: 'https://arcanedoma.in/assets/images/directives/dyrewood.jpg',
    storyboardVtt: './tracks/dyrewood-storyboard.vtt',
    chaptersVtt: './tracks/dyrewood-chapters.vtt',
    captions: DYREWOOD_CUES,
    bookmarks: DYREWOOD_BOOKMARKS,
    recommendedMode: 'movie',
  },
  'bright-snow': {
    id: 'bright-snow',
    label: '4. High-Key Solar — "Time in Space" by Arcane Domain (Bright Contrast Stress Test)',
    src: './videos/bright-contrast-test.mp4?v=3',
    poster: './tracks/bright-poster.jpg',
    storyboardVtt: './tracks/bright-storyboard.vtt',
    chaptersVtt: './tracks/bright-chapters.vtt',
    captions: BRIGHT_SOLAR_CUES,
    bookmarks: BRIGHT_SOLAR_BOOKMARKS,
    recommendedMode: 'skeleton',
  },
};

const MODE_LABELS: Record<ModePreset, string> = {
  movie: 'MOVIE // VELVET CINEMA',
  music: 'MUSIC // CYBER EDGE-REACTIVE',
  study: 'STUDY // POLYGLOT & A-B LOOP',
  chill: 'CHILL // LIQUID GLASS ISLAND',
  skeleton: 'SKELETON // 75% TRANSPARENT WIREFRAME',
};

const MODE_DEFAULT_ACCENTS: Record<ModePreset, string> = {
  movie: '#e5c158',
  music: '#00f0ff',
  study: '#2563eb',
  chill: '#ff9e64',
  skeleton: '#ffffff',
};

function initWorkbench(): void {
  const mountEl = document.getElementById('mode-player-mount');
  if (!mountEl) return;

  const initialScenario = SCENARIOS['mux-cosmic'];

  const controller = new ModeSkinController(mountEl, {
    idPrefix: 'mode-wb',
    initialMode: 'movie',
    initialFx: true,
    initialPinned: false,
    videoSrc: initialScenario.src,
    posterSrc: initialScenario.poster,
    storyboardVtt: initialScenario.storyboardVtt,
    chaptersVtt: initialScenario.chaptersVtt,
    captionTracks: MODE_EXPLAINER_CAPTION_TRACKS,
    captions: initialScenario.captions,
    bookmarks: initialScenario.bookmarks,
    muxPlaybackId: initialScenario.muxPlaybackId,
    onStateChange: (state: ModeSkinState) => {
      syncWorkbenchTelemetry(state);
    },
  });

  // 1. Mode Deck Cards
  document.querySelectorAll<HTMLButtonElement>('[data-wb-mode]').forEach((card) => {
    card.addEventListener('click', () => {
      const mode = card.getAttribute('data-wb-mode') as ModePreset;
      if (mode) {
        controller.setMode(mode);
        const accentPicker = document.getElementById('wb-accent-picker') as HTMLInputElement | null;
        if (accentPicker) {
          accentPicker.value = MODE_DEFAULT_ACCENTS[mode];
          controller.getContainerElement().style.removeProperty('--media-accent-color');
        }
      }
    });
  });

  // 2. Scenario Switcher
  const scenarioSelect = document.getElementById('wb-scenario-select') as HTMLSelectElement | null;
  scenarioSelect?.addEventListener('change', () => {
    const sc = SCENARIOS[scenarioSelect.value];
    if (sc) {
      controller.setVideoSource({
        src: sc.src,
        poster: sc.poster,
        storyboardVtt: sc.storyboardVtt,
        chaptersVtt: sc.chaptersVtt,
        captions: sc.captions,
        bookmarks: sc.bookmarks,
        muxPlaybackId: sc.muxPlaybackId,
        recommendedMode: sc.recommendedMode,
      });
      const muxCode = document.getElementById('wb-mux-id-code');
      if (muxCode) {
        muxCode.textContent = sc.muxPlaybackId || 'Direct MP4 (No Mux ID)';
      }
    }
  });

  // 3. Responsive Width Resizer
  const resizableWrap = document.getElementById('wb-player-resizable') as HTMLElement | null;
  const widthSlider = document.getElementById('wb-width-slider') as HTMLInputElement | null;
  const widthReadout = document.getElementById('wb-width-readout') as HTMLElement | null;

  document.querySelectorAll<HTMLButtonElement>('[data-wb-width]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-wb-width') || '100%';
      document.querySelectorAll('[data-wb-width]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      if (resizableWrap) {
        resizableWrap.style.width = val === '100%' ? '100%' : `${val}px`;
      }
      if (widthReadout) {
        widthReadout.textContent = val === '100%' ? '100%' : `${val}px`;
      }
      if (widthSlider) {
        widthSlider.value = val === '100%' ? '1160' : val;
      }
    });
  });

  widthSlider?.addEventListener('input', () => {
    const px = widthSlider.value;
    document.querySelectorAll('[data-wb-width]').forEach((b) => b.classList.remove('is-active'));
    if (resizableWrap) resizableWrap.style.width = `${px}px`;
    if (widthReadout) widthReadout.textContent = `${px}px`;
  });

  // 4. FX & Pin Controls Toggles in Workbench Toolbar
  const wbFxBtn = document.getElementById('wb-toggle-fx');
  wbFxBtn?.addEventListener('click', () => {
    controller.setFx(!controller.getFx());
  });

  const wbPinBtn = document.getElementById('wb-toggle-pin');
  wbPinBtn?.addEventListener('click', () => {
    controller.setPinned(!controller.getPinned());
  });

  // 5. Custom --media-accent-color Picker
  const accentPicker = document.getElementById('wb-accent-picker') as HTMLInputElement | null;
  accentPicker?.addEventListener('input', () => {
    controller.getContainerElement().style.setProperty('--media-accent-color', accentPicker.value);
  });

  // 6. Custom Mux Playback ID Form
  const muxForm = document.getElementById('wb-mux-form') as HTMLFormElement | null;
  const muxInput = document.getElementById('wb-custom-mux-input') as HTMLInputElement | null;
  muxForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    let raw = muxInput?.value.trim() || '';
    if (!raw) return;
    const playbackId = raw.replace(/^https?:\/\/stream\.mux\.com\//, '').replace(/\.m3u8.*$/, '');
    const matchedScenario = Object.values(SCENARIOS).find((s) => s.muxPlaybackId === playbackId);
    controller.setVideoSource({
      src: `https://stream.mux.com/${playbackId}.m3u8`,
      poster: `https://image.mux.com/${playbackId}/thumbnail.webp`,
      storyboardVtt: `https://image.mux.com/${playbackId}/storyboard.vtt`,
      chaptersVtt: matchedScenario?.chaptersVtt,
      captions: matchedScenario?.captions ?? [],
      bookmarks: matchedScenario?.bookmarks ?? [],
      muxPlaybackId: playbackId,
    });
    const muxCode = document.getElementById('wb-mux-id-code');
    if (muxCode) muxCode.textContent = playbackId;
  });

  // 7. Copy Buttons (Mux Playback ID & Submission Description)
  const copyMuxBtn = document.getElementById('wb-copy-mux-btn');
  copyMuxBtn?.addEventListener('click', () => {
    const idText = document.getElementById('wb-mux-id-code')?.textContent || DEMO_MUX_PLAYBACK_ID;
    navigator.clipboard?.writeText(idText);
    copyMuxBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyMuxBtn.textContent = 'Copy ID';
    }, 1800);
  });

  const copyDescBtn = document.getElementById('wb-copy-desc-btn');
  copyDescBtn?.addEventListener('click', () => {
    const blurb = document.getElementById('wb-submission-blurb')?.textContent?.trim() || '';
    navigator.clipboard?.writeText(blurb);
    copyDescBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyDescBtn.textContent = 'Copy Description';
    }, 1800);
  });
}

function syncWorkbenchTelemetry(state: ModeSkinState): void {
  // Sync Mode cards
  document.querySelectorAll<HTMLButtonElement>('[data-wb-mode]').forEach((card) => {
    card.classList.toggle('is-active', card.getAttribute('data-wb-mode') === state.mode);
  });

  // Sync FX & Pin buttons
  const wbFxBtn = document.getElementById('wb-toggle-fx');
  if (wbFxBtn) {
    wbFxBtn.classList.toggle('is-on', state.fx);
    wbFxBtn.textContent = state.fx ? '✨ Mode FX: ON' : '✨ Mode FX: OFF';
  }

  const wbPinBtn = document.getElementById('wb-toggle-pin');
  if (wbPinBtn) {
    wbPinBtn.classList.toggle('is-on', state.pinned);
    wbPinBtn.textContent = state.pinned ? '📌 Controls: Pinned' : '📌 Controls: Hover';
  }

  // Telemetry Bar
  const telMode = document.getElementById('wb-tel-mode');
  if (telMode) telMode.textContent = MODE_LABELS[state.mode];

  const sw1 = document.getElementById('wb-tel-swatch-1');
  const sw2 = document.getElementById('wb-tel-swatch-2');
  const edgeHex = document.getElementById('wb-tel-edge-hex');
  if (sw1) sw1.style.backgroundColor = state.edgeColors.primary;
  if (sw2) sw2.style.backgroundColor = state.edgeColors.secondary;
  if (edgeHex) edgeHex.textContent = `${state.edgeColors.hexPrimary} · ${state.edgeColors.hexSecondary}`;

  const telLocale = document.getElementById('wb-tel-locale');
  if (telLocale) {
    telLocale.textContent = `lang="${state.uiLocale}" · Dual CC → ${state.targetLang.toUpperCase()}`;
  }
}

document.addEventListener('DOMContentLoaded', initWorkbench);

