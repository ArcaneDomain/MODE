# MODE — A Video.js v10 Skin for Every Occasion

**Official Entry for the Contra × Video.js v10 Skins Design Challenge**  
**Repository:** [https://github.com/ArcaneDomain/MODE](https://github.com/ArcaneDomain/MODE)  
**License:** [Apache License, Version 2.0](./LICENSE)  
**Engine:** `@videojs/html@10.3.0` (Video.js v10 Custom Elements)  
**Live Showcase & Judge's Workbench:** [https://arcanedoma.in/mode/](https://arcanedoma.in/mode/)  
**Live Production Site Deployment (+1 Bonus):** [https://arcanedoma.in/studio/](https://arcanedoma.in/studio/)  
**Mux Public Playback ID (+1 Bonus):** `rR8P8mSaKDzz02TsftugTUdI00cQPJX00oy` (Stream 1 Showcase) & `LRH6O8v9nAchc02njUk59MosxoHhvvReqiFNcqAP01a5w` (Stream 2 "The Storm" Master)

---

## Design Thinking

Video.js powers video across millions of websites, yet a single static skin rarely fits every viewing context. Built on Video.js v10 custom elements (`@videojs/html@10.3.0`), **MODE** introduces five context-aware presets that adapt typography, geometry, color science, and interactive tooling to how people actually watch:

1. **🎬 Movie Mode (`data-mode="movie"`) — Velvet Cinema:** Deep crimson velvet (`#7A1128`), royal purple (`#1F0924`), and warm champagne gold (`#E5C158`) accents with subtle 35mm film grain, theatrical stage glow, and a 1-click **Room Dimmer**.
2. **🎵 Music Mode (`data-mode="music"`) — Arcane Cyber-Reactive:** Frosted cyberpunk glass (`backdrop-filter: blur(18px)`) powered by a **15fps Offscreen Canvas Edge-Color Extractor** (`EdgeColorEngine.ts`) that samples the top, bottom, left, and right edge pixels of the active `<video>` element and reflects those colors onto the player borders and ambient halo. Paired with a **Web Audio API `AnalyserNode`** (`MusicVisualEngine.ts`) rendering an Aurora time-domain ribbon, mirrored frequency spectrum bars, bass-reactive particles, and Arcane Domain's signature **Perimeter Spark Orbit** comet trail around the control bar.
3. **📚 Study Mode (`data-mode="study"`) — Zen Focus & Polyglot:** Uncluttered pastel alabaster and slate grey (`#F4F5F8` / `#111827`) featuring native **Video.js v10 `<media-i18n>` live UI localization** across 11 languages (including RTL Arabic `ar`), **Live Dual-Caption Subtitle Translation**, a slide-out **Searchable Interactive Transcript & Bookmarks Drawer** (click any cue to seek) with a YouTube Chat-style **Pop-out window** (`↗ Popout` / `↙ Dock in Player`), and **A–B Loop Repeat** markers on the timeline.
4. **🌅 Chill Mode (`data-mode="chill"`) — Liquid Glass Island:** Floating pill-island controls (`border-radius: 9999px`) in sunset amber and twilight lavender liquid glass, accompanied by drifting lo-fi firefly bokeh and a **Zen Sleep Fade Timer** (`Off / 1m / 5m / 15m`) that gently fades audio and dims the viewport.
5. **🦴 Skeleton Mode (`data-mode="skeleton"`) — 75% Transparent Wireframe:** Bare-bones `rgba(0, 0, 0, 0.25)` surface (75% transparency) with a crisp `1px solid rgba(0, 0, 0, 0.95)` black wireframe, an inner high-contrast white hairline for dark-video legibility, zero blur, and a live 24fps **SMPTE Timecode & Frame Counter**.

### Universal Controls & Accessibility
- **Hover vs. Pinned Controls:** Controls remain hidden until hovered (`data-visible` / `:has(:focus-visible)`) unless the user toggles **"Always Visible Controls" (`📌 Pin Controls`)** in the top bar or settings menu (`data-pinned="true"`).
- **Activateable FX (`FX: ON | OFF`):** Every mode's animations and ambient effects can be toggled on/off at any time and automatically calm down when `@media (prefers-reduced-motion: reduce)` is active.
- **Responsive `@container` Queries & 44×44px Touch Targets:** Adapts cleanly from `320px` mobile embeds up to 4K fullscreen.

### 🎵 Original Music & Transmissions (Arcane Domain)
- **Track 2 ("The Storm"):** Video and music are *"The Storm"* from the album [**INDIVISION**](https://arcanedoma.in/indivision/) ([Spotify](https://open.spotify.com/album/3jsIdYxdkdAquafDNr1SHR?si=vb9H_Eq4RCu9wjncdHpH5A)) by **Arcane Domain**.
- **Track 4 ("High-Key Solar"):** Soundtrack is [**"Time in Space"**](https://open.spotify.com/album/57xYoj1g1HOYlxb7sPST2c?si=NB36MzHhRXKmP3Sc39bKKw) on Spotify by **Arcane Domain** (sampled ~1 minute into the track).

---

## Quick Start (Bare-Essentials Skin Integration)

The portable **MODE** skin lives entirely inside [`src/skin/`](./src/skin/) with zero site-specific dependencies beyond `@videojs/html` and `hls.js`. Copy `src/skin/` (plus the optional WebVTT captions in `public/tracks/`) into your project:

```ts
import './skin/mode-skin.css';
import { ModeSkinController } from './skin/mode-skin';

const mount = document.getElementById('player-mount')!;
const player = new ModeSkinController(mount, {
  initialMode: 'movie', // 'movie' | 'music' | 'study' | 'chill' | 'skeleton'
  initialFx: true,
  initialPinned: false,
  videoSrc: 'https://stream.mux.com/LRH6O8v9nAchc02njUk59MosxoHhvvReqiFNcqAP01a5w.m3u8',
  posterSrc: 'https://image.mux.com/LRH6O8v9nAchc02njUk59MosxoHhvvReqiFNcqAP01a5w/thumbnail.webp',
  storyboardVtt: 'https://image.mux.com/LRH6O8v9nAchc02njUk59MosxoHhvvReqiFNcqAP01a5w/storyboard.vtt',
  muxPlaybackId: 'LRH6O8v9nAchc02njUk59MosxoHhvvReqiFNcqAP01a5w',
});
```

### Repository Structure

```text
MODE/
├── LICENSE                         # Apache License 2.0
├── README.md
├── package.json                    # @videojs/html@^10.3.0 + hls.js@^1.7.4 + Vite
├── tsconfig.json
├── vite.config.ts
├── index.html                      # Interactive Judge Workbench
├── embed.html                      # Standalone chromeless embed entry
├── public/
│   ├── favicon.svg
│   └── tracks/                     # Multi-language WebVTT captions & chapters
└── src/
    ├── skin/                       # Portable MODE Skin (bare essentials)
    │   ├── mode-skin.css           # All 5 preset tokens, container queries & a11y styles
    │   ├── mode-skin.ts            # Video.js v10 custom elements & ModeSkinController
    │   ├── hls-renditions.ts       # hls.js ABR Auto & quality bridge to Video.js v10
    │   └── engines/
    │       ├── EdgeColorEngine.ts  # 15fps canvas video-edge RGB sampler
    │       ├── MusicVisualEngine.ts# Web Audio AnalyserNode + perimeter spark orbit
    │       ├── StudyToolsEngine.ts # <media-i18n>, dual captions, A-B loop & notes
    │       └── ChillEngine.ts      # Ambient firefly bokeh & Zen sleep fade timer
    ├── main.ts                     # Workbench UI controls & telemetry bindings
    ├── embed.ts                    # Embed query-param & postMessage controller
    └── workbench.css               # Workbench shell layout styling
```

### Run the Interactive Workbench Locally

```bash
npm install
npm run dev
```

*(Note: Large local `.mp4` test reels in `public/videos/` are excluded from Git via `.gitignore`; both default Mux HLS streams and storyboard thumbnails work out of the box, and the full contrast test suite is hosted live at [`https://arcanedoma.in/mode/`](https://arcanedoma.in/mode/).)*

