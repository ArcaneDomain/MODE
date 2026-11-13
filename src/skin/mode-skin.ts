/**
 * @file mode-skin.ts
 * @version 1.0.0
 * @description Core Video.js v10 Custom Elements registration, template factory, and controller
 * for "MODE — A Video.js v10 Skin for Every Occasion" (Apache-2.0).
 */

// Official Video.js v10 Core & UI Element Registrations (complete compound controls, sliders, menus, tooltips)
import '@videojs/html/video/player';
import '@videojs/html/video/ui';
import '@videojs/html/i18n/locales/all';
import '@videojs/html/icons/element';
import '@videojs/html/ui/volume-popover';

import { EdgeColorEngine, type EdgeColors } from './engines/EdgeColorEngine';
import { MusicVisualEngine } from './engines/MusicVisualEngine';
import {
  StudyToolsEngine,
  SUPPORTED_LOCALES,
  type PolyglotCue,
  type StudyBookmark,
} from './engines/StudyToolsEngine';
import { ChillEngine } from './engines/ChillEngine';
import {
  attachRenditionsBridge,
  getInitialBandwidthEstimate,
  type HlsRenditionList,
} from './hls-renditions';
import Hls from 'hls.js';

export type ModePreset = 'movie' | 'music' | 'study' | 'chill' | 'skeleton';

export interface ModeCaptionTrack {
  kind?: 'captions' | 'subtitles';
  srclang: string;
  label: string;
  src: string;
  default?: boolean;
}

export interface ModePlayerConfig {
  idPrefix?: string;
  initialMode?: ModePreset;
  initialFx?: boolean;
  initialPinned?: boolean;
  videoSrc: string;
  posterSrc?: string;
  storyboardVtt?: string;
  chaptersVtt?: string;
  captionTracks?: ModeCaptionTrack[];
  captions?: PolyglotCue[];
  bookmarks?: StudyBookmark[];
  muxPlaybackId?: string;
  title?: string;
  subtitle?: string;
  onStateChange?: (state: ModeSkinState) => void;
}

export interface ModeSkinState {
  mode: ModePreset;
  fx: boolean;
  pinned: boolean;
  theaterDimmed: boolean;
  uiLocale: string;
  targetLang: string;
  dualCaptions: boolean;
  edgeColors: EdgeColors;
  muxPlaybackId?: string;
}

export class ModeSkinController {
  private root: HTMLElement;
  private config: ModePlayerConfig;
  private prefix: string;

  private i18nEl!: HTMLElement;
  private containerEl!: HTMLElement;
  private videoEl!: HTMLVideoElement;

  public edgeEngine!: EdgeColorEngine;
  public musicEngine!: MusicVisualEngine;
  public studyEngine!: StudyToolsEngine;
  public chillEngine!: ChillEngine;

  private currentMode: ModePreset;
  private fxEnabled: boolean;
  private pinnedControls: boolean;
  private theaterDimmed = false;
  private transcriptOpen = false;
  private transcriptFilter = '';
  private popoutWin: Window | null = null;
  private popoutFilter = '';
  private lastPopoutActiveCueId = '';
  private smpteRafId: number | null = null;
  private hlsInstance: Hls | null = null;
  private renditionList!: HlsRenditionList;
  private lastStreamIsHls = false;

  constructor(mountEl: HTMLElement, config: ModePlayerConfig) {
    this.root = mountEl;
    this.config = config;
    this.prefix = config.idPrefix || 'mode-v10';
    this.currentMode = config.initialMode || 'movie';
    this.fxEnabled = config.initialFx !== undefined ? config.initialFx : true;
    this.pinnedControls = config.initialPinned !== undefined ? config.initialPinned : false;

    this.renderMarkup();
    this.initElementsAndEngines();
    this.bindUIEvents();
    this.applyState();
  }

  private renderMarkup(): void {
    const p = this.prefix;
    const storyboardTrack = this.config.storyboardVtt
      ? `<track kind="metadata" label="thumbnails" default data-mode-track="thumbnails" src="${this.config.storyboardVtt}" />`
      : '';
    const chaptersUrl = this.config.chaptersVtt;
    const chaptersTrack = chaptersUrl
      ? `<track kind="chapters" srclang="en" label="Chapters" default data-mode-track="chapters" src="${chaptersUrl}" />`
      : '';
    const captionTracksHtml = (this.config.captionTracks ?? [])
      .map(
        (t) =>
          `<track kind="${t.kind || 'subtitles'}" srclang="${t.srclang}" label="${t.label}" src="${t.src}"${t.default ? ' default' : ''} />`,
      )
      .join('\n              ');

    const localeOptionsHtml = SUPPORTED_LOCALES.map(
      (l) => `<option value="${l.code}">${l.native}</option>`
    ).join('');

    const targetLangOptionsHtml = SUPPORTED_LOCALES.filter((l) => l.code !== 'en')
      .map((l) => `<option value="${l.code}">Translate → ${l.native}</option>`)
      .join('');

    this.root.innerHTML = `
      <video-player class="mode-v10-player-host">
        <media-i18n id="${p}-i18n" lang="en" dir="ltr">
          <media-container
            id="${p}-container"
            class="vjs-mode-skin media-default-skin media-default-skin--video"
            data-mode="${this.currentMode}"
            data-fx="${this.fxEnabled ? 'on' : 'off'}"
            data-pinned="${this.pinnedControls ? 'true' : 'false'}"
          >
            <!-- Ambient Edge Halo & Curtain Stage Layers -->
            <div class="mode-ambient-halo" aria-hidden="true"></div>
            <div class="mode-film-grain" aria-hidden="true"></div>
            <div class="mode-chill-sleep-veil" aria-hidden="true"></div>

            <!-- Screen reader status announcer -->
            <media-status-announcer></media-status-announcer>

            <!-- Hotkeys (Space, K, M, F, C, Arrow keys, 0-9) -->
            <media-hotkey keys="Space" action="togglePaused"></media-hotkey>
            <media-hotkey keys="k" action="togglePaused"></media-hotkey>
            <media-hotkey keys="m" action="toggleMuted"></media-hotkey>
            <media-hotkey keys="f" action="toggleFullscreen"></media-hotkey>
            <media-hotkey keys="c" action="toggleSubtitles"></media-hotkey>
            <media-hotkey keys="i" action="togglePictureInPicture"></media-hotkey>
            <media-hotkey keys="ArrowRight" action="seekStep" value="5"></media-hotkey>
            <media-hotkey keys="ArrowLeft" action="seekStep" value="-5"></media-hotkey>
            <media-hotkey keys="l" action="seekStep" value="10"></media-hotkey>
            <media-hotkey keys="j" action="seekStep" value="-10"></media-hotkey>
            <media-hotkey keys="ArrowUp" action="volumeStep" value="0.05"></media-hotkey>
            <media-hotkey keys="ArrowDown" action="volumeStep" value="-0.05"></media-hotkey>
            <media-hotkey keys="0-9" action="seekToPercent"></media-hotkey>

            <!-- Core HTML5 Video Element (connected to Video.js v10 media store) -->
            <video
              id="${p}-video"
              slot="media"
              ${this.config.posterSrc ? `poster="${this.config.posterSrc}"` : ''}
              playsinline
              preload="auto"
              crossorigin="anonymous"
            >
              ${storyboardTrack}
              ${captionTracksHtml}
              ${chaptersTrack}
            </video>

            <!-- Poster Image -->
            <media-poster class="video-poster" ${this.config.posterSrc ? `src="${this.config.posterSrc}"` : ''}></media-poster>

            <!-- Touch & Pointer Gestures (Click anywhere on stage to play/pause like YouTube) -->
            <media-gesture type="tap" action="togglePaused" pointer="mouse"></media-gesture>
            <media-gesture type="doubletap" action="toggleFullscreen" pointer="mouse"></media-gesture>
            <media-gesture type="tap" action="toggleControls" pointer="touch"></media-gesture>
            <media-gesture type="doubletap" action="seekStep" value="-10" pointer="touch" region="left"></media-gesture>
            <media-gesture type="doubletap" action="toggleFullscreen" pointer="touch" region="center"></media-gesture>
            <media-gesture type="doubletap" action="seekStep" value="10" pointer="touch" region="right"></media-gesture>

            <!-- Buffering Spinner -->
            <media-buffering-indicator class="video-buffering-indicator">
              <div class="video-buffering-indicator-surface media-surface">
                <media-icon class="video-icon mode-dynamic-icon" family="default" name="spinner"></media-icon>
              </div>
            </media-buffering-indicator>

            <!-- Error Dialog -->
            <media-error-dialog class="video-error-dialog">
              <media-dialog-popup class="video-error-dialog-surface media-surface">
                <div class="video-error-dialog-content">
                  <media-dialog-title class="video-error-dialog-title"></media-dialog-title>
                  <media-dialog-description class="video-error-dialog-description"></media-dialog-description>
                </div>
                <div class="video-error-dialog-actions">
                  <media-dialog-close class="media-button media-button--subtle video-error-dialog-close"></media-dialog-close>
                </div>
              </media-dialog-popup>
            </media-error-dialog>

            <!-- ============================================================
                 TOP CONTEXTUAL MODE BAR (Mode Switcher + FX Toggle + Pin)
                 ============================================================ -->
            <div class="mode-top-bar" data-interactive="" role="toolbar" aria-label="MODE Skin Preset and Effect Controls">
              <div class="mode-top-left">
                <span class="mode-brand-badge" title="MODE — Video.js v10 Adaptive Skin">
                  <span class="mode-brand-dot"></span>
                  <span class="mode-brand-text">MODE</span>
                  <span class="mode-brand-version">v10</span>
                </span>
                <div class="mode-preset-pills" role="tablist" aria-label="Player Occasion Mode">
                  <button type="button" class="mode-pill-btn" data-select-mode="movie" role="tab" aria-selected="true" title="Movie Mode — Velvet Cinema & Gold">
                    <span class="mode-pill-icon" aria-hidden="true">🎬</span>
                    <span>Movie</span>
                  </button>
                  <button type="button" class="mode-pill-btn" data-select-mode="music" role="tab" aria-selected="false" title="Music Mode — Cyberpunk Edge-Color & Audio Visualizer">
                    <span class="mode-pill-icon" aria-hidden="true">🎵</span>
                    <span>Music</span>
                  </button>
                  <button type="button" class="mode-pill-btn" data-select-mode="study" role="tab" aria-selected="false" title="Study Mode — Pastel Minimal, Polyglot Translation & A-B Loop">
                    <span class="mode-pill-icon" aria-hidden="true">📚</span>
                    <span>Study</span>
                  </button>
                  <button type="button" class="mode-pill-btn" data-select-mode="chill" role="tab" aria-selected="false" title="Chill Mode — Liquid Glass Island & Zen Sleep Fade">
                    <span class="mode-pill-icon" aria-hidden="true">🌅</span>
                    <span>Chill</span>
                  </button>
                  <button type="button" class="mode-pill-btn" data-select-mode="skeleton" role="tab" aria-selected="false" title="Base Skeleton Mode — 75% Transparent Black Wireframe">
                    <span class="mode-pill-icon" aria-hidden="true">🦴</span>
                    <span>Skeleton</span>
                  </button>
                </div>
              </div>

              <div class="mode-top-right">
                <!-- Mode-Specific Contextual Badge / Action -->
                <button type="button" id="${p}-dimmer-btn" class="mode-chip-btn mode-only-movie" title="Dim surrounding page lights for cinema immersion">
                  <span aria-hidden="true">💡</span>
                  <span>Dim Room</span>
                </button>

                <div class="mode-edge-telemetry mode-only-music" title="Live Video Edge Color Sampling (Top, Bottom, Left, Right)">
                  <span class="mode-edge-label">EDGE RGB</span>
                  <span id="${p}-swatch-top" class="mode-edge-swatch" title="Top Edge"></span>
                  <span id="${p}-swatch-bottom" class="mode-edge-swatch" title="Bottom Edge"></span>
                  <span id="${p}-swatch-left" class="mode-edge-swatch" title="Left Edge"></span>
                  <span id="${p}-swatch-right" class="mode-edge-swatch" title="Right Edge"></span>
                </div>

                <button type="button" id="${p}-transcript-toggle-btn" class="mode-chip-btn mode-only-study" aria-expanded="false" title="Open Interactive Polyglot Transcript & Bookmarks Drawer">
                  <span aria-hidden="true">📖</span>
                  <span>Transcript &amp; Notes</span>
                </button>

                <div class="mode-chill-timer-group mode-only-chill" role="group" aria-label="Zen Sleep Fade Timer">
                  <span class="mode-chill-timer-label">🌙 Sleep:</span>
                  <button type="button" class="mode-sleep-btn is-active" data-sleep-sec="0">Off</button>
                  <button type="button" class="mode-sleep-btn" data-sleep-sec="60" title="1 Minute Demo Fade">1m</button>
                  <button type="button" class="mode-sleep-btn" data-sleep-sec="300">5m</button>
                  <button type="button" class="mode-sleep-btn" data-sleep-sec="900">15m</button>
                  <span id="${p}-sleep-readout" class="mode-sleep-readout" hidden></span>
                </div>

                <div id="${p}-smpte-readout" class="mode-smpte-badge mode-only-skeleton" title="SMPTE Frame Timecode (24fps)">
                  SMPTE 00:00:00:00 · FR 0000
                </div>

                <!-- Universal FX Toggle (Animations & Mode Effects ON / OFF) -->
                <button
                  type="button"
                  id="${p}-fx-btn"
                  class="mode-chip-btn is-active"
                  aria-pressed="true"
                  title="Toggle Mode Animations & Visual Effects (Auto-disabled under prefers-reduced-motion)"
                >
                  <span class="mode-fx-dot" aria-hidden="true"></span>
                  <span id="${p}-fx-label">FX: ON</span>
                </button>

                <!-- Universal Pin Controls Toggle (Hover vs Always Visible) -->
                <button
                  type="button"
                  id="${p}-pin-btn"
                  class="mode-chip-btn"
                  aria-pressed="false"
                  title="Pin Controls (Keep player controls always visible instead of hiding on mouse leave)"
                >
                  <span aria-hidden="true">📌</span>
                  <span id="${p}-pin-label">Hover</span>
                </button>
              </div>
            </div>

            <!-- ============================================================
                 UNIVERSAL LIVE CAPTION OVERLAY (Movie, Music, Chill, Skeleton)
                 Synced with Video.js v10 <media-captions-button> & TextTracks
                 ============================================================ -->
            <div id="${p}-live-caption-box" class="mode-live-captions" aria-live="polite" style="display: none;">
              <span id="${p}-live-caption-text"></span>
            </div>

            <!-- ============================================================
                 STUDY MODE: LIVE DUAL-CAPTION POLYGLOT OVERLAY
                 ============================================================ -->
            <div id="${p}-dual-caption-box" class="mode-dual-captions mode-only-study" aria-live="polite" style="display: none;">
              <div class="mode-dual-caption-primary" id="${p}-caption-primary"></div>
              <div class="mode-dual-caption-translated" id="${p}-caption-translated">
                <span class="mode-lang-pill" id="${p}-caption-lang-badge">ES</span>
                <span id="${p}-caption-target-text"></span>
              </div>
            </div>

            <!-- ============================================================
                 STUDY MODE: INTERACTIVE POLYGLOT TRANSCRIPT & BOOKMARKS DRAWER
                 ============================================================ -->
            <aside id="${p}-transcript-drawer" class="mode-transcript-drawer mode-only-study" data-interactive="" aria-label="Interactive Study Transcript and Bookmarks" hidden>
              <div class="mode-transcript-header">
                <div class="mode-transcript-title-row">
                  <strong>📖 Polyglot Transcript &amp; Study Notes</strong>
                  <div class="mode-transcript-actions">
                    <button
                      type="button"
                      id="${p}-transcript-popout"
                      class="mode-transcript-popout-btn"
                      title="Pop out Transcript & Study Notes into a separate window (like YouTube Chat)"
                      aria-label="Pop out Transcript and Study Notes into a separate window"
                    >
                      ↗ Popout
                    </button>
                    <button type="button" id="${p}-transcript-close" class="mode-transcript-close-btn" aria-label="Close Transcript Drawer">✕</button>
                  </div>
                </div>
                <div class="mode-transcript-search-row">
                  <input
                    type="search"
                    id="${p}-transcript-search"
                    class="mode-transcript-search-input"
                    placeholder="Search cues in primary or translated language…"
                    aria-label="Search transcript cues"
                  />
                </div>
              </div>
              <div id="${p}-transcript-list" class="mode-transcript-cues" role="list"></div>
              <div class="mode-bookmarks-section">
                <div class="mode-bookmarks-header">
                  <span>📌 Timestamp Bookmarks</span>
                  <button type="button" id="${p}-add-bookmark-drawer-btn" class="mode-mini-action-btn">+ Pin Current Time</button>
                </div>
                <div id="${p}-bookmarks-list" class="mode-bookmarks-list"></div>
              </div>
            </aside>

            <!-- ============================================================
                 VIDEO.JS v10 MEDIA CONTROLS BAR
                 ============================================================ -->
            <media-controls class="video-controls">
              <!-- STUDY MODE UTILITY STRIP (Polyglot i18n SDK + Subtitle Translator + A-B Loop) -->
              <div class="mode-study-ribbon mode-only-study" data-interactive="" role="region" aria-label="Study Mode Translation and Loop Tools">
                <div class="mode-study-group">
                  <label class="mode-study-label" for="${p}-ui-locale-select" title="Video.js v10 <media-i18n> Live Control Bar Localization">
                    <span>🌐 UI SDK:</span>
                  </label>
                  <select id="${p}-ui-locale-select" class="mode-study-select" aria-label="Player UI Language via Video.js v10 media-i18n">
                    ${localeOptionsHtml}
                  </select>

                  <label class="mode-study-label" for="${p}-target-lang-select" title="Live Subtitle Translation Target Language">
                    <span>💬 Subtitles:</span>
                  </label>
                  <select id="${p}-target-lang-select" class="mode-study-select" aria-label="Translated Subtitle Language">
                    ${targetLangOptionsHtml}
                  </select>

                  <button type="button" id="${p}-dual-sub-toggle" class="mode-study-btn is-active" aria-pressed="true" title="Toggle Dual-Language Subtitles">
                    Dual CC: ON
                  </button>
                </div>

                <div class="mode-study-group">
                  <span class="mode-study-label">🔁 A–B Loop:</span>
                  <button type="button" id="${p}-loop-a-btn" class="mode-study-btn" title="Set Loop Start Point A">[A: —]</button>
                  <button type="button" id="${p}-loop-b-btn" class="mode-study-btn" title="Set Loop End Point B">[B: —]</button>
                  <button type="button" id="${p}-loop-clear-btn" class="mode-study-btn" title="Clear A-B Loop" hidden>✕</button>

                  <button type="button" id="${p}-pin-note-btn" class="mode-study-btn" title="Bookmark current timestamp">
                    📌 +Note
                  </button>
                </div>
              </div>

              <!-- MAIN CONTROL BAR SURFACE -->
              <media-controls-content class="video-controls-content media-surface" data-interactive="">
                <!-- Music Mode Audio-Reactive Canvas (Aurora Wave + Mirrored Spectrum + Bass Particles) -->
                <canvas id="${p}-music-viz-canvas" class="mode-music-viz-canvas" aria-hidden="true"></canvas>
                <!-- Music Mode Perimeter Spark Orbit Canvas (Arcane Domain Signature Comet Trail) -->
                <canvas id="${p}-music-spark-canvas" class="mode-music-spark-canvas" aria-hidden="true"></canvas>
                <!-- Chill Mode Lo-Fi Bokeh & Firefly Canvas -->
                <canvas id="${p}-chill-bokeh-canvas" class="mode-chill-bokeh-canvas" aria-hidden="true"></canvas>

                <media-tooltip-group>
                  <!-- Play / Pause / Restart Button -->
                  <media-play-button id="${p}-play-button" class="media-button media-button--subtle media-button--icon video-play-button">
                    <media-icon class="video-play-icon video-icon mode-dynamic-icon" family="default" name="play" slot="play"></media-icon>
                    <media-icon class="video-pause-icon video-icon mode-dynamic-icon" family="default" name="pause" slot="pause"></media-icon>
                    <media-icon class="video-restart-icon video-icon mode-dynamic-icon" family="default" name="restart" slot="restart"></media-icon>
                  </media-play-button>
                  <media-tooltip trigger="${p}-play-button" side="top" class="media-surface video-tooltip"></media-tooltip>

                  <!-- -10s / +10s Seek Buttons (Helpful in Study & Movie modes) -->
                  <media-seek-button id="${p}-seek-back" value="-10" class="media-button media-button--subtle media-button--icon video-seek-button mode-seek-step-btn">
                    <media-icon class="video-seek-icon video-icon mode-dynamic-icon" family="default" name="seek" direction="backward"></media-icon>
                  </media-seek-button>
                  <media-tooltip trigger="${p}-seek-back" side="top" class="media-surface video-tooltip"></media-tooltip>

                  <media-seek-button id="${p}-seek-fwd" value="10" class="media-button media-button--subtle media-button--icon video-seek-button mode-seek-step-btn">
                    <media-icon class="video-seek-icon video-icon mode-dynamic-icon" family="default" name="seek" direction="forward"></media-icon>
                  </media-seek-button>
                  <media-tooltip trigger="${p}-seek-fwd" side="top" class="media-surface video-tooltip"></media-tooltip>

                  <!-- Time Display Group (Tabular Nums) -->
                  <media-time-group class="video-time-group">
                    <media-time class="video-time" type="current"></media-time>
                    <media-time-separator class="video-time-separator"></media-time-separator>
                    <media-time class="video-time" type="duration"></media-time>
                  </media-time-group>

                  <!-- Time Slider with ChapterSegments, Buffer, A-B Loop Overlay, and Storyboard Preview -->
                  <media-time-slider class="media-slider video-time-slider">
                    <media-time-slider-chapters class="video-time-slider-chapters">
                      <template>
                        <div class="media-slider-chapter video-time-slider-chapter">
                          <media-slider-track class="media-slider-track video-time-slider-track">
                            <media-slider-buffer class="media-slider-buffer video-time-slider-buffer"></media-slider-buffer>
                            <media-slider-fill class="media-slider-fill video-time-slider-fill"></media-slider-fill>
                          </media-slider-track>
                        </div>
                      </template>
                    </media-time-slider-chapters>
                    <!-- Study Mode A-B Loop Highlight Bar on Timeline -->
                    <div class="mode-ab-loop-bar" aria-hidden="true"></div>
                    <media-slider-thumb class="media-slider-thumb video-time-slider-thumb"></media-slider-thumb>
                    <media-slider-preview class="video-time-slider-preview" Part="preview">
                      <div class="video-time-slider-preview-surface media-surface">
                        <media-slider-thumbnail class="video-time-slider-thumbnail"></media-slider-thumbnail>
                        <media-slider-value class="video-time-slider-value" type="pointer"></media-slider-value>
                      </div>
                    </media-slider-preview>
                  </media-time-slider>

                  <!-- Secondary Actions Group (Automatically moves to top-right on narrow <520px players via @container query!) -->
                  <div class="video-button-group">
                    <!-- Mute Button + Volume Popover Slider -->
                    <media-mute-button
                      id="${p}-mute-button"
                      commandfor="${p}-volume-popover"
                      class="media-button media-button--subtle media-button--icon video-mute-button"
                    >
                      <media-icon class="video-volume-off-icon video-icon mode-dynamic-icon" family="default" name="volume-off" slot="off"></media-icon>
                      <media-icon class="video-volume-low-icon video-icon mode-dynamic-icon" family="default" name="volume-low" slot="low"></media-icon>
                      <media-icon class="video-volume-high-icon video-icon mode-dynamic-icon" family="default" name="volume-high" slot="high"></media-icon>
                    </media-mute-button>
                    <media-tooltip trigger="${p}-mute-button" side="top" class="media-surface video-tooltip"></media-tooltip>

                    <media-volume-popover
                      id="${p}-volume-popover"
                      side="top"
                      align="center"
                      class="video-volume-popover"
                    >
                      <div class="video-volume-popover-surface media-surface">
                        <media-volume-slider
                          class="media-slider video-volume-slider"
                          orientation="vertical"
                          thumb-alignment="edge"
                        >
                          <media-slider-track class="media-slider-track video-volume-slider-track">
                            <media-slider-fill class="media-slider-fill video-volume-slider-fill"></media-slider-fill>
                            <media-slider-thumb class="media-slider-thumb video-volume-slider-thumb"></media-slider-thumb>
                          </media-slider-track>
                        </media-volume-slider>
                      </div>
                    </media-volume-popover>

                    <!-- Captions Toggle Button -->
                    <media-captions-button id="${p}-captions-button" class="media-button media-button--subtle media-button--icon video-captions-button">
                      <media-icon class="video-captions-off-icon video-icon mode-dynamic-icon" family="default" name="captions-off" slot="off"></media-icon>
                      <media-icon class="video-captions-on-icon video-icon mode-dynamic-icon" family="default" name="captions-on" slot="on"></media-icon>
                    </media-captions-button>
                    <media-tooltip trigger="${p}-captions-button" side="top" class="media-surface video-tooltip"></media-tooltip>

                    <!-- Settings Menu Button + Nested Popover Menus (Quality ABR, Playback Rate, Subtitles, Mode Options) -->
                    <button
                      type="button"
                      id="${p}-settings-button"
                      commandfor="${p}-settings-menu"
                      class="media-button media-button--subtle media-button--icon video-settings-button"
                      aria-label="Settings"
                    >
                      <media-icon class="video-settings-icon video-icon mode-dynamic-icon" family="default" name="gear"></media-icon>
                    </button>
                    <media-tooltip trigger="${p}-settings-button" side="top" class="media-surface video-tooltip">
                      <media-text token="menu.settings">Settings</media-text>
                    </media-tooltip>

                    <media-menu id="${p}-settings-menu" side="top" align="end" class="video-menu media-surface" data-interactive="">
                      <media-menu-content class="video-menu-content">
                        <!-- Custom MODE Quick Settings inside native Video.js v10 Menu -->
                        <div class="mode-menu-custom-section">
                          <div class="mode-menu-section-heading">MODE SKIN CONTROLS</div>
                          <button type="button" id="${p}-menu-pin-toggle" class="mode-menu-toggle-row">
                            <span>📌 Always Visible Controls</span>
                            <span id="${p}-menu-pin-badge" class="mode-menu-pill">OFF</span>
                          </button>
                          <button type="button" id="${p}-menu-fx-toggle" class="mode-menu-toggle-row">
                            <span>✨ Mode Animations &amp; FX</span>
                            <span id="${p}-menu-fx-badge" class="mode-menu-pill is-on">ON</span>
                          </button>
                          <button type="button" id="${p}-menu-skeleton-toggle" class="mode-menu-toggle-row">
                            <span>🦴 Base Skeleton Wireframe</span>
                            <span id="${p}-menu-skeleton-badge" class="mode-menu-pill">OFF</span>
                          </button>
                        </div>

                        <media-menu-separator class="video-menu-separator"></media-menu-separator>

                        <!-- Native Video.js v10 Submenu Triggers (Quality, Speed, Subtitles/CC) -->
                        <media-menu-item commandfor="${p}-quality-menu" class="video-menu-item media-menu-trigger-item">
                          <media-icon class="video-menu-item-icon video-icon mode-dynamic-icon" family="default" name="switches"></media-icon>
                          <media-text class="video-menu-item-label" token="menu.quality">Quality</media-text>
                          <span class="media-menu-hint">
                            <span data-part="value" class="video-menu-button-value"></span>
                            <media-icon class="video-chevron-icon media-menu-forward-chevron video-icon mode-dynamic-icon" family="default" name="chevron"></media-icon>
                          </span>
                        </media-menu-item>
                        <media-menu-item id="${p}-quality-fallback-trigger" commandfor="${p}-quality-fallback-menu" class="video-menu-item media-menu-trigger-item mode-quality-fallback-trigger">
                          <media-icon class="video-menu-item-icon video-icon mode-dynamic-icon" family="default" name="switches"></media-icon>
                          <media-text class="video-menu-item-label" token="menu.quality">Quality</media-text>
                          <span class="media-menu-hint">
                            <span id="${p}-quality-fallback-value" class="video-menu-button-value">Auto</span>
                            <media-icon class="video-chevron-icon media-menu-forward-chevron video-icon mode-dynamic-icon" family="default" name="chevron"></media-icon>
                          </span>
                        </media-menu-item>

                        <media-menu-item commandfor="${p}-rate-menu" class="video-menu-item media-menu-trigger-item">
                          <media-icon class="video-menu-item-icon video-icon mode-dynamic-icon" family="default" name="speed"></media-icon>
                          <media-text class="video-menu-item-label" token="menu.speed">Speed</media-text>
                          <span class="media-menu-hint">
                            <span data-part="value" class="video-menu-button-value"></span>
                            <media-icon class="video-chevron-icon media-menu-forward-chevron video-icon mode-dynamic-icon" family="default" name="chevron"></media-icon>
                          </span>
                        </media-menu-item>

                        <media-menu-item commandfor="${p}-captions-menu" class="video-menu-item media-menu-trigger-item">
                          <media-icon class="video-menu-item-icon video-icon mode-dynamic-icon" family="default" name="speech"></media-icon>
                          <media-text class="video-menu-item-label" token="menu.captions">Subtitles / CC</media-text>
                          <span class="media-menu-hint">
                            <span data-part="value" class="video-menu-button-value"></span>
                            <media-icon class="video-chevron-icon media-menu-forward-chevron video-icon mode-dynamic-icon" family="default" name="chevron"></media-icon>
                          </span>
                        </media-menu-item>
                      </media-menu-content>

                      <media-menu-content id="${p}-quality-fallback-menu" class="video-menu-content">
                        <media-menu-item class="video-menu-item media-menu-back-item">
                          <media-icon class="video-chevron-icon media-menu-back-chevron video-icon mode-dynamic-icon" family="default" name="chevron"></media-icon>
                          <media-text class="video-menu-item-label" token="menu.quality">Quality</media-text>
                        </media-menu-item>
                        <media-menu-separator class="video-menu-separator"></media-menu-separator>
                        <media-menu-item id="${p}-quality-fallback-option" class="video-menu-item video-radio" data-checked>
                          <media-icon class="video-radio-check media-menu-item-indicator video-icon mode-dynamic-icon" family="default" name="check"></media-icon>
                          <span class="video-menu-item-label">
                            <span id="${p}-quality-fallback-option-label">Auto</span>
                            <sup id="${p}-quality-fallback-tier" class="mode-menu-tier"></sup>
                          </span>
                          <span id="${p}-quality-fallback-badge" class="mode-menu-bitrate-badge">Source</span>
                        </media-menu-item>
                        <div id="${p}-quality-fallback-note" class="mode-quality-fallback-note">Single-file source — manual resolution switching appears on multi-bitrate HLS streams.</div>
                      </media-menu-content>

                      <media-menu-content id="${p}-quality-menu" class="video-menu-content">
                        <media-menu-item class="video-menu-item media-menu-back-item">
                          <media-icon class="video-chevron-icon media-menu-back-chevron video-icon mode-dynamic-icon" family="default" name="chevron"></media-icon>
                          <media-text class="video-menu-item-label" token="menu.quality">Quality</media-text>
                        </media-menu-item>
                        <media-menu-separator class="video-menu-separator"></media-menu-separator>
                        <media-quality-radio-group class="video-radio-group">
                          <template>
                            <media-menu-radio-item class="video-menu-item video-radio media-menu-radio-item">
                              <media-icon class="video-radio-check media-menu-item-indicator video-icon mode-dynamic-icon" family="default" name="check"></media-icon>
                              <span class="video-menu-item-label">
                                <span data-part="label"></span>
                                <sup data-part="tier" class="mode-menu-tier"></sup>
                              </span>
                              <span data-part="badge" class="mode-menu-bitrate-badge"></span>
                            </media-menu-radio-item>
                          </template>
                        </media-quality-radio-group>
                      </media-menu-content>

                      <media-menu-content id="${p}-rate-menu" class="video-menu-content">
                        <media-menu-item class="video-menu-item media-menu-back-item">
                          <media-icon class="video-chevron-icon media-menu-back-chevron video-icon mode-dynamic-icon" family="default" name="chevron"></media-icon>
                          <media-text class="video-menu-item-label" token="menu.speed">Speed</media-text>
                        </media-menu-item>
                        <media-menu-separator class="video-menu-separator"></media-menu-separator>
                        <media-playback-rate-radio-group class="video-radio-group">
                          <template>
                            <media-menu-radio-item class="video-menu-item video-radio media-menu-radio-item">
                              <media-icon class="video-radio-check media-menu-item-indicator video-icon mode-dynamic-icon" family="default" name="check"></media-icon>
                              <span class="video-menu-item-label" data-part="label"></span>
                            </media-menu-radio-item>
                          </template>
                        </media-playback-rate-radio-group>
                      </media-menu-content>

                      <media-menu-content id="${p}-captions-menu" class="video-menu-content">
                        <media-menu-item class="video-menu-item media-menu-back-item">
                          <media-icon class="video-chevron-icon media-menu-back-chevron video-icon mode-dynamic-icon" family="default" name="chevron"></media-icon>
                          <media-text class="video-menu-item-label" token="menu.captions">Subtitles / CC</media-text>
                        </media-menu-item>
                        <media-menu-separator class="video-menu-separator"></media-menu-separator>
                        <media-captions-radio-group class="video-radio-group">
                          <template>
                            <media-menu-radio-item class="video-menu-item video-radio media-menu-radio-item">
                              <media-icon class="video-radio-check media-menu-item-indicator video-icon mode-dynamic-icon" family="default" name="check"></media-icon>
                              <span class="video-menu-item-label" data-part="label"></span>
                            </media-menu-radio-item>
                          </template>
                        </media-captions-radio-group>
                      </media-menu-content>
                    </media-menu>

                    <!-- Picture-in-Picture Button -->
                    <media-pip-button id="${p}-pip-button" class="media-button media-button--subtle media-button--icon video-pip-button">
                      <media-icon class="video-pip-enter-icon video-icon mode-dynamic-icon" family="default" name="pip-enter" slot="enter"></media-icon>
                      <media-icon class="video-pip-exit-icon video-icon mode-dynamic-icon" family="default" name="pip-exit" slot="exit"></media-icon>
                    </media-pip-button>
                    <media-tooltip trigger="${p}-pip-button" side="top" class="media-surface video-tooltip"></media-tooltip>

                    <!-- Fullscreen Button -->
                    <media-fullscreen-button id="${p}-fullscreen-button" class="media-button media-button--subtle media-button--icon video-fullscreen-button">
                      <media-icon class="video-fullscreen-enter-icon video-icon mode-dynamic-icon" family="default" name="fullscreen-enter" slot="enter"></media-icon>
                      <media-icon class="video-fullscreen-exit-icon video-icon mode-dynamic-icon" family="default" name="fullscreen-exit" slot="exit"></media-icon>
                    </media-fullscreen-button>
                    <media-tooltip trigger="${p}-fullscreen-button" side="top" class="media-surface video-tooltip"></media-tooltip>
                  </div>
                </media-tooltip-group>
              </media-controls-content>
            </media-controls>
          </media-container>
        </media-i18n>
      </video-player>
    `;
  }

  private loadStreamSource(src: string): void {
    if (this.hlsInstance) {
      this.hlsInstance.destroy();
      this.hlsInstance = null;
    }
    this.renditionList?.clear();

    const isHls = src.includes('.m3u8') || src.includes('stream.mux.com');
    this.lastStreamIsHls = isHls;
    const canPlayNativeHls = Boolean(
      this.videoEl.canPlayType('application/vnd.apple.mpegurl')
      || this.videoEl.canPlayType('application/x-mpegurl'),
    );
    const hasMse = typeof MediaSource !== 'undefined'
      || typeof (window as Window & { ManagedMediaSource?: unknown }).ManagedMediaSource !== 'undefined';

    if (isHls && Hls.isSupported() && (!canPlayNativeHls || hasMse)) {
      if (this.videoEl.hasAttribute('src')) {
        this.videoEl.removeAttribute('src');
        this.videoEl.load();
      }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        capLevelToPlayerSize: false,
        startLevel: -1,
        abrEwmaDefaultEstimate: getInitialBandwidthEstimate(),
      });
      let recoveredMediaError = false;
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (this.hlsInstance !== hls) return;
        if (data.levels && data.levels.length > 0) {
          // Default to ABR Auto (-1) so hls.js picks the optimal quality for downstream speed
          hls.currentLevel = -1;
          const initialActive = hls.loadLevel >= 0 ? hls.loadLevel : hls.nextAutoLevel;
          this.renditionList?.setHlsLevels(hls, data.levels, initialActive);
        }
        this.syncQualityFallbackUI();
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        if (this.hlsInstance !== hls) return;
        this.renditionList?.syncActiveLevel(data.level);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal || this.hlsInstance !== hls) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recoveredMediaError) {
          recoveredMediaError = true;
          hls.recoverMediaError();
          return;
        }
        if (canPlayNativeHls) {
          hls.destroy();
          if (this.hlsInstance === hls) {
            this.hlsInstance = null;
            this.renditionList?.clear();
            this.videoEl.src = src;
            this.syncQualityFallbackUI();
          }
        }
      });
      this.hlsInstance = hls;
      hls.attachMedia(this.videoEl);
      hls.loadSource(src);
    } else {
      this.videoEl.src = src;
    }

    this.syncQualityFallbackUI();
  }

  private syncQualityFallbackUI(): void {
    const p = this.prefix;
    const fallbackTrigger = this.root.querySelector(`#${p}-quality-fallback-trigger`) as HTMLElement | null;
    if (!fallbackTrigger) return;

    const hasMultiQuality = (this.renditionList?.length ?? 0) > 1;
    if (hasMultiQuality) {
      fallbackTrigger.setAttribute('data-hidden', '');
      fallbackTrigger.setAttribute('aria-hidden', 'true');
      const fallbackMenu = this.root.querySelector(`#${p}-quality-fallback-menu`) as (HTMLElement & { close?: () => void }) | null;
      if (fallbackMenu && !fallbackMenu.hidden) {
        fallbackMenu.close?.();
      }
      return;
    }

    fallbackTrigger.removeAttribute('data-hidden');
    fallbackTrigger.removeAttribute('aria-hidden');

    const w = this.videoEl?.videoWidth ?? 0;
    const h = this.videoEl?.videoHeight ?? 0;
    const shortSide = w > 0 && h > 0 ? Math.min(w, h) : h;
    const resLabel = shortSide > 0 ? `${shortSide}p` : '';
    const displayVal = resLabel ? `Auto (${resLabel})` : 'Auto';
    const tier = shortSide >= 2160 ? '4K' : shortSide >= 1080 ? 'HD' : '';

    const valEl = this.root.querySelector(`#${p}-quality-fallback-value`);
    if (valEl) valEl.textContent = displayVal;

    const optLabelEl = this.root.querySelector(`#${p}-quality-fallback-option-label`);
    if (optLabelEl) optLabelEl.textContent = displayVal;

    const tierEl = this.root.querySelector(`#${p}-quality-fallback-tier`);
    if (tierEl) tierEl.textContent = tier;

    const badgeEl = this.root.querySelector(`#${p}-quality-fallback-badge`);
    const noteEl = this.root.querySelector(`#${p}-quality-fallback-note`);
    if (this.lastStreamIsHls) {
      if (this.hlsInstance && (this.renditionList?.length ?? 0) === 0) {
        if (badgeEl) badgeEl.textContent = 'ABR';
        if (noteEl) noteEl.textContent = 'Detecting downstream speed and adaptive HLS renditions...';
      } else if ((this.renditionList?.length ?? 0) === 1) {
        if (badgeEl) badgeEl.textContent = 'HLS';
        if (noteEl) noteEl.textContent = 'Single-rendition HLS stream — manual levels appear when multiple bitrates exist.';
      } else {
        if (badgeEl) badgeEl.textContent = 'ABR';
        if (noteEl) noteEl.textContent = 'Browser-managed adaptive HLS streaming based on downstream speed.';
      }
    } else {
      if (badgeEl) badgeEl.textContent = 'MP4';
      if (noteEl) noteEl.textContent = 'Single-file source — manual resolution switching appears on multi-bitrate HLS streams.';
    }
  }

  private initElementsAndEngines(): void {
    const p = this.prefix;
    this.i18nEl = this.root.querySelector(`#${p}-i18n`) as HTMLElement;
    this.containerEl = this.root.querySelector(`#${p}-container`) as HTMLElement;
    this.videoEl = this.root.querySelector(`#${p}-video`) as HTMLVideoElement;
    this.renditionList = attachRenditionsBridge(this.videoEl);
    this.videoEl.dispatchEvent(new Event('loadstart'));
    this.loadStreamSource(this.config.videoSrc);

    const vizCanvas = this.root.querySelector(`#${p}-music-viz-canvas`) as HTMLCanvasElement;
    const sparkCanvas = this.root.querySelector(`#${p}-music-spark-canvas`) as HTMLCanvasElement;
    const bokehCanvas = this.root.querySelector(`#${p}-chill-bokeh-canvas`) as HTMLCanvasElement;

    // 1. Edge Color Ambilight Engine
    this.edgeEngine = new EdgeColorEngine(this.videoEl, this.containerEl, (colors) => {
      this.updateEdgeSwatches(colors);
      this.emitState();
    });
    this.edgeEngine.start();

    // 2. Music Visualizer + Perimeter Spark Engine
    this.musicEngine = new MusicVisualEngine(this.videoEl, this.containerEl, vizCanvas, sparkCanvas);
    this.musicEngine.start();

    // 3. Study Polyglot & A-B Loop Engine
    this.studyEngine = new StudyToolsEngine(this.videoEl, this.i18nEl, this.containerEl, () => {
      this.updateStudyUI();
      this.emitState();
    });
    if (this.config.captions !== undefined || this.config.bookmarks !== undefined) {
      this.studyEngine.setCues(
        this.config.captions ?? [],
        this.config.bookmarks ?? [],
      );
    }

    // 4. Chill Bokeh & Sleep Fade Engine
    const sleepReadout = this.root.querySelector(`#${p}-sleep-readout`) as HTMLElement;
    this.chillEngine = new ChillEngine(this.videoEl, this.containerEl, bokehCanvas, (rem, active) => {
      if (!sleepReadout) return;
      if (!active) {
        sleepReadout.hidden = true;
      } else {
        sleepReadout.hidden = false;
        const m = Math.floor(rem / 60);
        const s = (rem % 60).toString().padStart(2, '0');
        sleepReadout.textContent = `${m}:${s}`;
      }
    });
    this.chillEngine.start();

    // 5. Skeleton SMPTE Timecode Loop
    const smpteBadge = this.root.querySelector(`#${p}-smpte-readout`) as HTMLElement;
    const updateSmpte = () => {
      if (this.currentMode === 'skeleton' && smpteBadge) {
        const t = this.videoEl.currentTime || 0;
        const hrs = Math.floor(t / 3600).toString().padStart(2, '0');
        const mins = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
        const secs = Math.floor(t % 60).toString().padStart(2, '0');
        const fps = 24;
        const ff = Math.floor((t % 1) * fps).toString().padStart(2, '0');
        const totalFrames = Math.floor(t * fps).toString().padStart(4, '0');
        smpteBadge.textContent = `SMPTE ${hrs}:${mins}:${secs}:${ff} · FR ${totalFrames}`;
      }
      this.smpteRafId = requestAnimationFrame(updateSmpte);
    };
    this.smpteRafId = requestAnimationFrame(updateSmpte);

    const bindTrackCueListener = (track: TextTrack) => {
      if (track.kind === 'captions' || track.kind === 'subtitles') {
        track.addEventListener('cuechange', () => this.updateStudyUI());
      }
    };
    if (this.videoEl.textTracks) {
      for (let i = 0; i < this.videoEl.textTracks.length; i++) {
        bindTrackCueListener(this.videoEl.textTracks[i]);
      }
      this.videoEl.textTracks.addEventListener('addtrack', (ev) => {
        if (ev.track) bindTrackCueListener(ev.track);
        this.updateStudyUI();
      });
      this.videoEl.textTracks.addEventListener('change', () => {
        this.updateStudyUI();
      });
    }

    this.updateStudyUI();
  }

  private bindUIEvents(): void {
    const p = this.prefix;

    // Mode pill buttons inside player top bar
    this.root.querySelectorAll<HTMLButtonElement>('[data-select-mode]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = btn.getAttribute('data-select-mode') as ModePreset;
        if (mode) this.setMode(mode);
      });
    });

    // FX Toggle
    const fxBtn = this.root.querySelector(`#${p}-fx-btn`);
    fxBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setFx(!this.fxEnabled);
    });

    const menuFxToggle = this.root.querySelector(`#${p}-menu-fx-toggle`);
    menuFxToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setFx(!this.fxEnabled);
    });

    // Pin Controls Toggle
    const pinBtn = this.root.querySelector(`#${p}-pin-btn`);
    pinBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setPinned(!this.pinnedControls);
    });

    const menuPinToggle = this.root.querySelector(`#${p}-menu-pin-toggle`);
    menuPinToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setPinned(!this.pinnedControls);
    });

    // Menu Base Skeleton Toggle
    const menuSkeletonToggle = this.root.querySelector(`#${p}-menu-skeleton-toggle`);
    menuSkeletonToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.setMode(this.currentMode === 'skeleton' ? 'movie' : 'skeleton');
    });

    // Movie Mode Theater Dimmer
    const dimmerBtn = this.root.querySelector(`#${p}-dimmer-btn`);
    dimmerBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleTheaterDimmer();
    });

    // Study Mode: UI Locale (<media-i18n>)
    const uiLocaleSelect = this.root.querySelector(`#${p}-ui-locale-select`) as HTMLSelectElement;
    uiLocaleSelect?.addEventListener('change', (e) => {
      e.stopPropagation();
      this.studyEngine.setUiLocale(uiLocaleSelect.value);
      const targetSelect = this.root.querySelector(`#${p}-target-lang-select`) as HTMLSelectElement;
      if (targetSelect && uiLocaleSelect.value !== 'en') {
        targetSelect.value = uiLocaleSelect.value;
      }
    });

    // Study Mode: Target Subtitle Translation
    const targetLangSelect = this.root.querySelector(`#${p}-target-lang-select`) as HTMLSelectElement;
    targetLangSelect?.addEventListener('change', (e) => {
      e.stopPropagation();
      this.studyEngine.setTargetTranslationLang(targetLangSelect.value);
    });

    // Study Mode: Dual Captions Toggle
    const dualSubBtn = this.root.querySelector(`#${p}-dual-sub-toggle`) as HTMLButtonElement;
    dualSubBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const on = this.studyEngine.toggleDualCaptions();
      dualSubBtn.classList.toggle('is-active', on);
      dualSubBtn.setAttribute('aria-pressed', String(on));
      dualSubBtn.textContent = on ? 'Dual CC: ON' : 'Dual CC: OFF';
    });

    // Study Mode: A-B Loop buttons
    const loopABtn = this.root.querySelector(`#${p}-loop-a-btn`) as HTMLButtonElement;
    const loopBBtn = this.root.querySelector(`#${p}-loop-b-btn`) as HTMLButtonElement;
    const loopClearBtn = this.root.querySelector(`#${p}-loop-clear-btn`) as HTMLButtonElement;

    loopABtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.studyEngine.setLoopPointA();
    });
    loopBBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.studyEngine.setLoopPointB();
    });
    loopClearBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.studyEngine.clearLoop();
    });

    // Study Mode: Pin Bookmark & Transcript Drawer
    const pinNoteBtn = this.root.querySelector(`#${p}-pin-note-btn`);
    pinNoteBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.studyEngine.addBookmark();
      this.toggleTranscriptDrawer(true);
    });

    const addBmDrawerBtn = this.root.querySelector(`#${p}-add-bookmark-drawer-btn`);
    addBmDrawerBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.studyEngine.addBookmark();
    });

    const transcriptToggleBtn = this.root.querySelector(`#${p}-transcript-toggle-btn`);
    transcriptToggleBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.isTranscriptPoppedOut()) {
        this.dockTranscriptPopout(true);
      } else {
        this.toggleTranscriptDrawer();
      }
    });

    const transcriptPopoutBtn = this.root.querySelector(`#${p}-transcript-popout`);
    transcriptPopoutBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openTranscriptPopout();
    });

    const transcriptCloseBtn = this.root.querySelector(`#${p}-transcript-close`);
    transcriptCloseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleTranscriptDrawer(false);
    });

    const transcriptSearch = this.root.querySelector(`#${p}-transcript-search`) as HTMLInputElement;
    transcriptSearch?.addEventListener('input', () => {
      this.transcriptFilter = transcriptSearch.value.trim().toLowerCase();
      this.renderTranscriptList();
    });

    // Chill Mode: Sleep Timer buttons
    this.root.querySelectorAll<HTMLButtonElement>('[data-sleep-sec]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sec = parseInt(btn.getAttribute('data-sleep-sec') || '0', 10);
        this.root.querySelectorAll('[data-sleep-sec]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.chillEngine.setSleepTimer(sec);
      });
    });

    // Sync fallback quality display with video metadata & HLS rendition changes
    this.videoEl.addEventListener('loadedmetadata', () => this.syncQualityFallbackUI());
    this.videoEl.addEventListener('resize', () => this.syncQualityFallbackUI());
    this.renditionList?.addEventListener('addrendition', () => this.syncQualityFallbackUI());
    this.renditionList?.addEventListener('removerendition', () => this.syncQualityFallbackUI());
    this.syncQualityFallbackUI();
  }

  private updateEdgeSwatches(colors: EdgeColors): void {
    const p = this.prefix;
    const sTop = this.root.querySelector(`#${p}-swatch-top`) as HTMLElement | null;
    const sBot = this.root.querySelector(`#${p}-swatch-bottom`) as HTMLElement | null;
    const sLeft = this.root.querySelector(`#${p}-swatch-left`) as HTMLElement | null;
    const sRight = this.root.querySelector(`#${p}-swatch-right`) as HTMLElement | null;
    if (sTop) sTop.style.backgroundColor = colors.top;
    if (sBot) sBot.style.backgroundColor = colors.bottom;
    if (sLeft) sLeft.style.backgroundColor = colors.left;
    if (sRight) sRight.style.backgroundColor = colors.right;
  }

  private updateStudyUI(): void {
    const p = this.prefix;
    const cue = this.studyEngine.getActiveCue();
    const primaryLang = this.studyEngine.getPrimaryLang();
    const targetLang = this.studyEngine.getTargetTranslationLang();
    const dualOn = this.studyEngine.isDualCaptionsEnabled();

    const dualBox = this.root.querySelector(`#${p}-dual-caption-box`) as HTMLElement | null;
    const primaryEl = this.root.querySelector(`#${p}-caption-primary`) as HTMLElement | null;
    const targetTextEl = this.root.querySelector(`#${p}-caption-target-text`) as HTMLElement | null;
    const badgeEl = this.root.querySelector(`#${p}-caption-lang-badge`) as HTMLElement | null;
    const liveCaptionBox = this.root.querySelector(`#${p}-live-caption-box`) as HTMLElement | null;
    const liveCaptionText = this.root.querySelector(`#${p}-live-caption-text`) as HTMLElement | null;

    let showingTrack: TextTrack | null = null;
    let targetTrack: TextTrack | null = null;
    let showingLang: string | null = null;
    const tracks = this.videoEl.textTracks;
    if (tracks && tracks.length > 0) {
      for (let i = 0; i < tracks.length; i++) {
        const tr = tracks[i];
        if (tr.kind === 'captions' || tr.kind === 'subtitles') {
          if (!showingTrack && tr.mode === 'showing') {
            showingTrack = tr;
            showingLang = tr.language || 'en';
          }
          if (!targetTrack && tr.language === targetLang) {
            targetTrack = tr;
          }
        }
      }
    } else {
      showingLang = 'en';
    }

    const activeTrackCue = showingTrack?.activeCues?.[0] as (TextTrackCue & { text?: string }) | undefined;
    const activeTargetCue = targetTrack?.activeCues?.[0] as (TextTrackCue & { text?: string }) | undefined;
    const nativeText = (activeTrackCue?.text || '').trim();
    const nativeTargetText = (activeTargetCue?.text || '').trim();

    const standardText =
      (cue && showingLang
        ? cue.translations[showingLang] || cue.translations[primaryLang] || cue.translations.en
        : '') || nativeText;

    const showStandardCaptions =
      Boolean(standardText) && showingLang !== null && !(this.currentMode === 'study' && dualOn);

    if (liveCaptionBox) {
      liveCaptionBox.style.display = showStandardCaptions ? 'inline-flex' : 'none';
    }
    if (liveCaptionText) {
      liveCaptionText.textContent = standardText;
    }

    const dualPrimaryText =
      (cue ? cue.translations[primaryLang] || cue.translations.en : '') || nativeText;
    const dualTranslatedText =
      (cue ? cue.translations[targetLang] || cue.translations.es : '') || nativeTargetText;

    this.containerEl.setAttribute('data-dual-cc', dualOn ? 'on' : 'off');
    if (dualBox) {
      dualBox.style.display =
        Boolean(dualPrimaryText) && this.currentMode === 'study' && dualOn ? 'flex' : 'none';
    }
    if (primaryEl) {
      primaryEl.textContent = dualPrimaryText;
    }
    if (targetTextEl) {
      targetTextEl.textContent = dualTranslatedText;
      const translatedRow = targetTextEl.parentElement;
      if (translatedRow) {
        translatedRow.style.display = dualTranslatedText ? 'flex' : 'none';
      }
    }
    if (badgeEl) {
      badgeEl.textContent = targetLang.toUpperCase();
    }

    // Update A-B loop button labels
    const { pointA, pointB } = this.studyEngine.getLoopPoints();
    const loopABtn = this.root.querySelector(`#${p}-loop-a-btn`) as HTMLButtonElement | null;
    const loopBBtn = this.root.querySelector(`#${p}-loop-b-btn`) as HTMLButtonElement | null;
    const loopClearBtn = this.root.querySelector(`#${p}-loop-clear-btn`) as HTMLButtonElement | null;

    if (loopABtn) {
      loopABtn.textContent = pointA !== null ? `A: ${this.studyEngine.formatTime(pointA)}` : '[Set A]';
      loopABtn.classList.toggle('is-active', pointA !== null);
    }
    if (loopBBtn) {
      loopBBtn.textContent = pointB !== null ? `B: ${this.studyEngine.formatTime(pointB)}` : '[Set B]';
      loopBBtn.classList.toggle('is-active', pointB !== null);
    }
    if (loopClearBtn) {
      loopClearBtn.hidden = pointA === null && pointB === null;
    }

    this.renderTranscriptList();
    this.renderBookmarksList();
    this.syncPopoutWindow();
  }

  private renderTranscriptList(): void {
    const p = this.prefix;
    const listEl = this.root.querySelector(`#${p}-transcript-list`) as HTMLElement | null;
    if (!listEl) return;

    const activeCue = this.studyEngine.getActiveCue();
    const targetLang = this.studyEngine.getTargetTranslationLang();
    let engineCues = this.studyEngine.getCues();

    if (engineCues.length === 0 && this.videoEl.textTracks) {
      let captionTrack: TextTrack | null = null;
      for (let i = 0; i < this.videoEl.textTracks.length; i++) {
        const tr = this.videoEl.textTracks[i];
        if (tr.kind === 'captions' || tr.kind === 'subtitles') {
          if (tr.mode === 'showing' || !captionTrack) {
            captionTrack = tr;
            if (tr.mode === 'showing') break;
          }
        }
      }
      if (captionTrack?.cues && captionTrack.cues.length > 0) {
        engineCues = Array.from(captionTrack.cues).map((c, idx) => ({
          id: `native-${idx}`,
          start: c.startTime,
          end: c.endTime,
          translations: { en: (c as TextTrackCue & { text?: string }).text || '' },
        }));
      }
    }

    const cues = engineCues.filter((c) => {
      if (!this.transcriptFilter) return true;
      const enText = (c.translations.en || '').toLowerCase();
      const trText = (c.translations[targetLang] || '').toLowerCase();
      return enText.includes(this.transcriptFilter) || trText.includes(this.transcriptFilter);
    });

    if (cues.length === 0) {
      listEl.innerHTML = `<div class="mode-transcript-empty" style="padding:10px 8px;opacity:0.65;font-size:0.72rem;">No captions loaded for this video.</div>`;
      return;
    }

    listEl.innerHTML = cues
      .map((c) => {
        const isActive = activeCue
          ? c.id === activeCue.id
          : this.videoEl.currentTime >= c.start && this.videoEl.currentTime <= c.end;
        const translated = c.translations[targetLang] || '';
        return `
          <button
            type="button"
            class="mode-transcript-cue-item ${isActive ? 'is-active' : ''}"
            data-seek-time="${c.start}"
            role="listitem"
          >
            <span class="mode-cue-time">${this.studyEngine.formatTime(c.start)}</span>
            <span class="mode-cue-texts">
              <span class="mode-cue-en">${c.translations.en}</span>
              ${translated ? `<span class="mode-cue-tr">[${targetLang.toUpperCase()}] ${translated}</span>` : ''}
            </span>
          </button>
        `;
      })
      .join('');

    listEl.querySelectorAll<HTMLButtonElement>('[data-seek-time]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = parseFloat(btn.getAttribute('data-seek-time') || '0');
        this.videoEl.currentTime = t;
      });
    });
  }

  private renderBookmarksList(): void {
    const p = this.prefix;
    const bmEl = this.root.querySelector(`#${p}-bookmarks-list`) as HTMLElement | null;
    if (!bmEl) return;

    const bms = this.studyEngine.getBookmarks();
    bmEl.innerHTML = bms
      .map(
        (b) => `
        <div class="mode-bookmark-chip">
          <button type="button" class="mode-bookmark-jump" data-bm-seek="${b.time}">
            <span class="mode-bm-time">${this.studyEngine.formatTime(b.time)}</span>
            <span class="mode-bm-label">${b.label}</span>
          </button>
          <button type="button" class="mode-bookmark-del" data-bm-del="${b.id}" aria-label="Remove bookmark">✕</button>
        </div>
      `
      )
      .join('');

    bmEl.querySelectorAll<HTMLButtonElement>('[data-bm-seek]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.videoEl.currentTime = parseFloat(btn.getAttribute('data-bm-seek') || '0');
      });
    });

    bmEl.querySelectorAll<HTMLButtonElement>('[data-bm-del]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-bm-del');
        if (id) this.studyEngine.removeBookmark(id);
      });
    });
  }

  public isTranscriptPoppedOut(): boolean {
    return Boolean(this.popoutWin && !this.popoutWin.closed);
  }

  public toggleTranscriptDrawer(force?: boolean): void {
    const p = this.prefix;
    const popped = this.isTranscriptPoppedOut();
    if (popped && force === true) {
      this.popoutWin?.focus();
      this.updateTranscriptButtonState();
      return;
    }
    this.transcriptOpen = force !== undefined ? force : !this.transcriptOpen;
    const drawer = this.root.querySelector(`#${p}-transcript-drawer`) as HTMLElement | null;
    if (drawer) {
      drawer.hidden = !this.transcriptOpen || popped;
    }
    this.updateTranscriptButtonState();
  }

  private updateTranscriptButtonState(): void {
    const p = this.prefix;
    const popped = this.isTranscriptPoppedOut();
    const inPlayerOpen = this.transcriptOpen && !popped;
    this.containerEl.setAttribute('data-transcript-open', inPlayerOpen ? 'true' : 'false');

    const drawer = this.root.querySelector(`#${p}-transcript-drawer`) as HTMLElement | null;
    if (drawer) {
      drawer.hidden = !inPlayerOpen;
      drawer.style.display = inPlayerOpen ? '' : 'none';
    }

    const btn = this.root.querySelector(`#${p}-transcript-toggle-btn`) as HTMLButtonElement | null;
    if (btn) {
      btn.classList.toggle('is-active', inPlayerOpen || popped);
      btn.setAttribute('aria-expanded', String(inPlayerOpen || popped));
      btn.innerHTML = popped
        ? `<span aria-hidden="true">↙</span><span>Dock Transcript</span>`
        : `<span aria-hidden="true">📖</span><span>Transcript &amp; Notes</span>`;
      btn.title = popped
        ? 'Dock Popped-Out Transcript & Study Notes back into Player'
        : 'Open Interactive Polyglot Transcript & Bookmarks Drawer';
    }
  }

  public dockTranscriptPopout(openInPlayer = true): void {
    if (this.popoutWin && !this.popoutWin.closed) {
      this.popoutWin.close();
    }
    this.popoutWin = null;
    this.lastPopoutActiveCueId = '';
    this.transcriptOpen = openInPlayer;
    const p = this.prefix;
    const drawer = this.root.querySelector(`#${p}-transcript-drawer`) as HTMLElement | null;
    if (drawer) drawer.hidden = !openInPlayer;
    this.updateTranscriptButtonState();
  }

  public openTranscriptPopout(): void {
    if (this.isTranscriptPoppedOut()) {
      this.popoutWin?.focus();
      return;
    }

    const p = this.prefix;
    const win = window.open(
      '',
      `${p}_TranscriptPopout`,
      'width=440,height=680,resizable=yes,scrollbars=yes'
    );

    if (!win) {
      return;
    }

    this.popoutWin = win;
    this.popoutFilter = this.transcriptFilter;
    this.lastPopoutActiveCueId = '';

    // Hide the in-player drawer so captions & video have 100% of the viewport
    const drawer = this.root.querySelector(`#${p}-transcript-drawer`) as HTMLElement | null;
    if (drawer) drawer.hidden = true;
    this.updateTranscriptButtonState();

    const targetLangOptionsHtml = SUPPORTED_LOCALES.filter((l) => l.code !== 'en')
      .map(
        (l) =>
          `<option value="${l.code}" ${
            l.code === this.studyEngine.getTargetTranslationLang() ? 'selected' : ''
          }>Translate → ${l.native}</option>`
      )
      .join('');

    const doc = win.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>📖 Polyglot Transcript & Study Notes — MODE v10 Popout</title>
  <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    .pop-header {
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 9px;
      box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
      z-index: 2;
    }
    .pop-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .pop-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pop-dock-btn {
      appearance: none;
      border: 1px solid #cbd5e1;
      background: #f1f5f9;
      color: #1e293b;
      padding: 4px 10px;
      border-radius: 7px;
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .pop-dock-btn:hover {
      background: #e2e8f0;
      border-color: #94a3b8;
    }
    .pop-controls-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pop-search {
      flex: 1;
      padding: 6px 10px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #0f172a;
      font-size: 0.76rem;
    }
    .pop-lang-select {
      padding: 6px 8px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #0f172a;
      font-size: 0.74rem;
      font-weight: 600;
      cursor: pointer;
    }
    .pop-cues {
      flex: 1;
      overflow-y: auto;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .pop-cue-item {
      appearance: none;
      width: 100%;
      text-align: left;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      border-radius: 10px;
      padding: 9px 11px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      cursor: pointer;
      transition: all 0.14s ease;
    }
    .pop-cue-item:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }
    .pop-cue-item.is-active {
      background: #eff6ff;
      border-color: #3b82f6;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.12);
    }
    .pop-cue-time {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.72rem;
      font-weight: 700;
      color: #2563eb;
      background: #dbeafe;
      padding: 2px 6px;
      border-radius: 5px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .pop-cue-texts {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .pop-cue-en {
      font-size: 0.78rem;
      font-weight: 600;
      color: #0f172a;
      line-height: 1.38;
    }
    .pop-cue-tr {
      font-size: 0.74rem;
      color: #475569;
      line-height: 1.35;
    }
    .pop-bookmarks {
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 185px;
    }
    .pop-bm-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.76rem;
      font-weight: 700;
      color: #1e293b;
    }
    .pop-bm-add {
      appearance: none;
      border: none;
      background: #2563eb;
      color: #ffffff;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
    }
    .pop-bm-add:hover {
      background: #1d4ed8;
    }
    .pop-bm-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      overflow-y: auto;
    }
    .pop-bm-chip {
      display: inline-flex;
      align-items: center;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      overflow: hidden;
    }
    .pop-bm-jump {
      appearance: none;
      border: none;
      background: transparent;
      padding: 4px 8px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.72rem;
      cursor: pointer;
      color: #0f172a;
    }
    .pop-bm-jump:hover {
      background: #e2e8f0;
    }
    .pop-bm-time {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      color: #2563eb;
    }
    .pop-bm-del {
      appearance: none;
      border: none;
      border-left: 1px solid #cbd5e1;
      background: transparent;
      padding: 4px 6px;
      font-size: 0.68rem;
      cursor: pointer;
      color: #64748b;
    }
    .pop-bm-del:hover {
      background: #fee2e2;
      color: #dc2626;
    }
  </style>
</head>
<body>
  <header class="pop-header">
    <div class="pop-title-row">
      <div class="pop-title">📖 Polyglot Transcript &amp; Study Notes</div>
      <button type="button" id="pop-dock-btn" class="pop-dock-btn" title="Dock back into video player">↙ Dock in Player</button>
    </div>
    <div class="pop-controls-row">
      <input type="search" id="pop-search" class="pop-search" placeholder="Search cues in primary or translated language…" value="${this.popoutFilter}" />
      <select id="pop-lang-select" class="pop-lang-select" aria-label="Target Translation Language">
        ${targetLangOptionsHtml}
      </select>
    </div>
  </header>
  <main id="pop-cues-list" class="pop-cues" role="list"></main>
  <footer class="pop-bookmarks">
    <div class="pop-bm-header">
      <span>📌 Timestamp Bookmarks</span>
      <button type="button" id="pop-bm-add" class="pop-bm-add">+ Pin Current Time</button>
    </div>
    <div id="pop-bm-list" class="pop-bm-list"></div>
  </footer>
</body>
</html>`);
    doc.close();

    const dockBtn = doc.getElementById('pop-dock-btn');
    dockBtn?.addEventListener('click', () => {
      this.dockTranscriptPopout(true);
    });

    const searchInput = doc.getElementById('pop-search') as HTMLInputElement | null;
    searchInput?.addEventListener('input', () => {
      this.popoutFilter = searchInput.value.trim().toLowerCase();
      this.syncPopoutWindow(true);
    });

    const langSelect = doc.getElementById('pop-lang-select') as HTMLSelectElement | null;
    langSelect?.addEventListener('change', () => {
      this.studyEngine.setTargetTranslationLang(langSelect.value);
      const inPlayerSelect = this.root.querySelector(`#${p}-target-lang-select`) as HTMLSelectElement | null;
      if (inPlayerSelect) inPlayerSelect.value = langSelect.value;
    });

    const bmAddBtn = doc.getElementById('pop-bm-add');
    bmAddBtn?.addEventListener('click', () => {
      this.studyEngine.addBookmark();
    });

    win.addEventListener('unload', () => {
      setTimeout(() => {
        if (!this.isTranscriptPoppedOut()) {
          this.popoutWin = null;
          this.updateTranscriptButtonState();
        }
      }, 60);
    });

    this.syncPopoutWindow(true);
  }

  private syncPopoutWindow(forceRender = false): void {
    if (!this.isTranscriptPoppedOut() || !this.popoutWin) return;
    const doc = this.popoutWin.document;
    const cuesEl = doc.getElementById('pop-cues-list');
    const bmEl = doc.getElementById('pop-bm-list');
    const langSelect = doc.getElementById('pop-lang-select') as HTMLSelectElement | null;
    if (!cuesEl || !bmEl) return;

    const activeCue = this.studyEngine.getActiveCue();
    const targetLang = this.studyEngine.getTargetTranslationLang();

    if (langSelect && langSelect.value !== targetLang) {
      langSelect.value = targetLang;
    }

    const cues = this.studyEngine.getCues().filter((c) => {
      if (!this.popoutFilter) return true;
      const enText = (c.translations.en || '').toLowerCase();
      const trText = (c.translations[targetLang] || '').toLowerCase();
      return enText.includes(this.popoutFilter) || trText.includes(this.popoutFilter);
    });

    cuesEl.innerHTML = cues
      .map((c) => {
        const isActive = activeCue ? c.id === activeCue.id : false;
        return `
          <button
            type="button"
            class="pop-cue-item ${isActive ? 'is-active' : ''}"
            data-pop-seek="${c.start}"
            data-cue-id="${c.id}"
          >
            <span class="pop-cue-time">${this.studyEngine.formatTime(c.start)}</span>
            <span class="pop-cue-texts">
              <span class="pop-cue-en">${c.translations.en}</span>
              <span class="pop-cue-tr">[${targetLang.toUpperCase()}] ${c.translations[targetLang] || c.translations.es}</span>
            </span>
          </button>
        `;
      })
      .join('');

    cuesEl.querySelectorAll<HTMLButtonElement>('[data-pop-seek]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const t = parseFloat(btn.getAttribute('data-pop-seek') || '0');
        this.videoEl.currentTime = t;
      });
    });

    if (activeCue && (forceRender || this.lastPopoutActiveCueId !== activeCue.id)) {
      this.lastPopoutActiveCueId = activeCue.id;
      const activeNode = cuesEl.querySelector<HTMLElement>('.pop-cue-item.is-active');
      activeNode?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    const bms = this.studyEngine.getBookmarks();
    bmEl.innerHTML = bms
      .map(
        (b) => `
        <div class="pop-bm-chip">
          <button type="button" class="pop-bm-jump" data-pop-bm-seek="${b.time}">
            <span class="pop-bm-time">${this.studyEngine.formatTime(b.time)}</span>
            <span>${b.label}</span>
          </button>
          <button type="button" class="pop-bm-del" data-pop-bm-del="${b.id}" aria-label="Remove bookmark">✕</button>
        </div>
      `
      )
      .join('');

    bmEl.querySelectorAll<HTMLButtonElement>('[data-pop-bm-seek]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.videoEl.currentTime = parseFloat(btn.getAttribute('data-pop-bm-seek') || '0');
      });
    });

    bmEl.querySelectorAll<HTMLButtonElement>('[data-pop-bm-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-pop-bm-del');
        if (id) this.studyEngine.removeBookmark(id);
      });
    });
  }

  public toggleTheaterDimmer(force?: boolean): boolean {
    const p = this.prefix;
    this.theaterDimmed = force !== undefined ? force : !this.theaterDimmed;
    document.body.classList.toggle('mode-theater-dimmed', this.theaterDimmed);
    const btn = this.root.querySelector(`#${p}-dimmer-btn`);
    btn?.classList.toggle('is-active', this.theaterDimmed);
    this.emitState();
    return this.theaterDimmed;
  }

  public setMode(mode: ModePreset): void {
    this.currentMode = mode;
    this.applyState();
  }

  public getMode(): ModePreset {
    return this.currentMode;
  }

  public setFx(enabled: boolean): void {
    this.fxEnabled = enabled;
    this.applyState();
  }

  public getFx(): boolean {
    return this.fxEnabled;
  }

  public setPinned(pinned: boolean): void {
    this.pinnedControls = pinned;
    this.applyState();
  }

  public getPinned(): boolean {
    return this.pinnedControls;
  }

  private appendDynamicTrack(attrs: {
    kind: 'metadata' | 'chapters';
    label: string;
    src: string;
    srclang?: string;
    role: string;
  }): void {
    const trackEl = document.createElement('track');
    trackEl.kind = attrs.kind;
    trackEl.label = attrs.label;
    if (attrs.srclang) trackEl.srclang = attrs.srclang;
    trackEl.default = true;
    trackEl.setAttribute('default', '');
    trackEl.setAttribute('data-mode-track', attrs.role);
    trackEl.src = attrs.src;

    const notifyTrackChange = () => {
      this.videoEl.textTracks?.dispatchEvent?.(new Event('change'));
    };
    trackEl.addEventListener('load', notifyTrackChange);
    trackEl.addEventListener('error', notifyTrackChange);

    this.videoEl.appendChild(trackEl);
    try {
      if (trackEl.track) {
        trackEl.track.mode = 'hidden';
      }
    } catch {
      // Synthetic mocks may expose non-writable track objects
    }
    if (trackEl.readyState === 2) {
      notifyTrackChange();
    }
  }

  private syncMetadataAndChapterTracks(storyboardVtt?: string, chaptersVtt?: string): void {
    const staleTracks = Array.from(this.videoEl.querySelectorAll('track')).filter((tr) => {
      const kind = tr.getAttribute('kind') || tr.kind;
      const label = tr.getAttribute('label') || tr.label;
      const role = tr.getAttribute('data-mode-track');
      return (
        role === 'thumbnails'
        || role === 'chapters'
        || kind === 'chapters'
        || (kind === 'metadata' && label === 'thumbnails')
      );
    });

    for (const tr of staleTracks) {
      try {
        if (tr.track) tr.track.mode = 'disabled';
      } catch {
        // Ignore non-writable track state
      }
      tr.remove();
    }

    const thumbEl = this.root.querySelector('media-slider-thumbnail') as (HTMLElement & { thumbnails?: unknown }) | null;
    if (thumbEl && thumbEl.thumbnails !== undefined) {
      thumbEl.thumbnails = undefined;
    }

    // Flush stale storyboard/chapters out of @videojs/core store synchronously before loading new VTTs
    this.videoEl.textTracks?.dispatchEvent?.(new Event('change'));

    if (storyboardVtt) {
      this.appendDynamicTrack({
        kind: 'metadata',
        label: 'thumbnails',
        src: storyboardVtt,
        role: 'thumbnails',
      });
    }

    if (chaptersVtt) {
      this.appendDynamicTrack({
        kind: 'chapters',
        label: 'Chapters',
        srclang: 'en',
        src: chaptersVtt,
        role: 'chapters',
      });
    }

    this.videoEl.textTracks?.dispatchEvent?.(new Event('change'));
  }

  public setVideoSource(options: {
    src: string;
    poster?: string;
    storyboardVtt?: string;
    chaptersVtt?: string;
    captions?: PolyglotCue[];
    bookmarks?: StudyBookmark[];
    muxPlaybackId?: string;
    recommendedMode?: ModePreset;
  }): void {
    const resolvedSrc = options.src;
    const wasPlaying = !this.videoEl.paused;
    this.config.videoSrc = resolvedSrc;
    this.config.posterSrc = options.poster;
    this.config.storyboardVtt = options.storyboardVtt;
    this.config.chaptersVtt = options.chaptersVtt;
    this.config.captions = options.captions;
    this.config.bookmarks = options.bookmarks;
    this.config.muxPlaybackId = options.muxPlaybackId;

    this.loadStreamSource(resolvedSrc);
    this.syncMetadataAndChapterTracks(options.storyboardVtt, options.chaptersVtt);

    const posterEl = this.root.querySelector('media-poster');
    if (options.poster) {
      this.videoEl.poster = options.poster;
      posterEl?.setAttribute('src', options.poster);
    } else {
      this.videoEl.removeAttribute('poster');
      posterEl?.removeAttribute('src');
    }

    if (options.captions !== undefined || options.bookmarks !== undefined) {
      this.studyEngine.setCues(
        options.captions ?? [],
        options.bookmarks ?? [],
      );
    }

    if (options.recommendedMode) {
      this.setMode(options.recommendedMode);
    }

    if (wasPlaying) {
      this.videoEl.play().catch(() => {});
    }
    this.edgeEngine.resetCors();
    this.edgeEngine.sampleFrame();
    this.emitState();
  }

  public getVideoElement(): HTMLVideoElement {
    return this.videoEl;
  }

  public getContainerElement(): HTMLElement {
    return this.containerEl;
  }

  private applyState(): void {
    const p = this.prefix;
    this.containerEl.setAttribute('data-mode', this.currentMode);
    this.containerEl.setAttribute('data-fx', this.fxEnabled ? 'on' : 'off');
    this.containerEl.setAttribute('data-pinned', this.pinnedControls ? 'true' : 'false');

    // Switch Video.js v10 <media-icon> family to match the active mode's personality!
    const iconFamilyMap: Record<ModePreset, string> = {
      movie: 'default',
      music: 'neutral',
      study: 'neutral',
      chill: 'default',
      skeleton: 'scaffold',
    };
    const targetFamily = iconFamilyMap[this.currentMode] || 'default';
    this.root.querySelectorAll('.mode-dynamic-icon').forEach((icon) => {
      icon.setAttribute('family', targetFamily);
    });

    // Update top mode pill active states
    this.root.querySelectorAll<HTMLButtonElement>('[data-select-mode]').forEach((btn) => {
      const m = btn.getAttribute('data-select-mode');
      const active = m === this.currentMode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    // Update FX button & menu badge
    const fxBtn = this.root.querySelector(`#${p}-fx-btn`);
    const fxLabel = this.root.querySelector(`#${p}-fx-label`);
    const menuFxBadge = this.root.querySelector(`#${p}-menu-fx-badge`);
    if (fxBtn) {
      fxBtn.classList.toggle('is-active', this.fxEnabled);
      fxBtn.setAttribute('aria-pressed', String(this.fxEnabled));
    }
    if (fxLabel) fxLabel.textContent = this.fxEnabled ? 'FX: ON' : 'FX: OFF';
    if (menuFxBadge) {
      menuFxBadge.textContent = this.fxEnabled ? 'ON' : 'OFF';
      menuFxBadge.classList.toggle('is-on', this.fxEnabled);
    }

    // Update Pin button & menu badge
    const pinBtn = this.root.querySelector(`#${p}-pin-btn`);
    const pinLabel = this.root.querySelector(`#${p}-pin-label`);
    const menuPinBadge = this.root.querySelector(`#${p}-menu-pin-badge`);
    if (pinBtn) {
      pinBtn.classList.toggle('is-active', this.pinnedControls);
      pinBtn.setAttribute('aria-pressed', String(this.pinnedControls));
    }
    if (pinLabel) pinLabel.textContent = this.pinnedControls ? 'Pinned' : 'Hover';
    if (menuPinBadge) {
      menuPinBadge.textContent = this.pinnedControls ? 'ON' : 'OFF';
      menuPinBadge.classList.toggle('is-on', this.pinnedControls);
    }

    // Update Skeleton menu badge
    const menuSkelBadge = this.root.querySelector(`#${p}-menu-skeleton-badge`);
    if (menuSkelBadge) {
      const isSkel = this.currentMode === 'skeleton';
      menuSkelBadge.textContent = isSkel ? 'ON' : 'OFF';
      menuSkelBadge.classList.toggle('is-on', isSkel);
    }

    this.updateTranscriptButtonState();
    this.updateStudyUI();
    this.emitState();
  }

  private emitState(): void {
    if (!this.config.onStateChange) return;
    this.config.onStateChange({
      mode: this.currentMode,
      fx: this.fxEnabled,
      pinned: this.pinnedControls,
      theaterDimmed: this.theaterDimmed,
      uiLocale: this.studyEngine ? this.studyEngine.getUiLocale() : 'en',
      targetLang: this.studyEngine ? this.studyEngine.getTargetTranslationLang() : 'es',
      dualCaptions: this.studyEngine ? this.studyEngine.isDualCaptionsEnabled() : true,
      edgeColors: this.edgeEngine ? this.edgeEngine.getColors() : {
        top: '#00f0ff',
        bottom: '#b026ff',
        left: '#00f0ff',
        right: '#b026ff',
        primary: '#b026ff',
        secondary: '#00f0ff',
        hexPrimary: '#b026ff',
        hexSecondary: '#00f0ff',
      },
      muxPlaybackId: this.config.muxPlaybackId,
    });
  }
}
