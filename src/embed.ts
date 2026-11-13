/**
 * @file embed.ts
 * @version 1.0.0
 * @description Standalone Video.js v10 MODE Player embed entry for https://arcanedoma.in/studio.
 * Supports query parameters (?mode=music&src=...&fx=on&pinned=false) and parent window postMessage.
 */

import './skin/mode-skin.css';
import { ModeSkinController, type ModePreset } from './skin/mode-skin';
import {
  ARCANE_SONIC_BOOKMARKS,
  MODE_EXPLAINER_CAPTION_TRACKS,
  MODE_EXPLAINER_CUES,
} from './scenario-cues';

const STORM_MUX_ID = 'LRH6O8v9nAchc02njUk59MosxoHhvvReqiFNcqAP01a5w';

document.addEventListener('DOMContentLoaded', () => {
  const mount = document.getElementById('studio-mode-mount');
  if (!mount) return;

  const params = new URLSearchParams(window.location.search);
  const initialMode = (params.get('mode') as ModePreset) || 'music';
  const initialFx = params.get('fx') !== 'off';
  const initialPinned = params.get('pinned') === 'true';
  const videoSrc = params.get('src') || `https://stream.mux.com/${STORM_MUX_ID}.m3u8`;
  const posterSrc = params.get('poster') || `https://image.mux.com/${STORM_MUX_ID}/thumbnail.webp`;
  const storyboardVtt = params.get('storyboard') || `https://image.mux.com/${STORM_MUX_ID}/storyboard.vtt`;
  const chaptersVtt = params.get('chapters') || (videoSrc.includes(STORM_MUX_ID) ? './tracks/chapters-en.vtt' : undefined);

  const controller = new ModeSkinController(mount, {
    idPrefix: 'mode-studio',
    initialMode,
    initialFx,
    initialPinned,
    videoSrc,
    posterSrc,
    storyboardVtt,
    chaptersVtt,
    captionTracks: MODE_EXPLAINER_CAPTION_TRACKS,
    captions: videoSrc.includes(STORM_MUX_ID) ? MODE_EXPLAINER_CUES : undefined,
    bookmarks: videoSrc.includes(STORM_MUX_ID) ? ARCANE_SONIC_BOOKMARKS : undefined,
    muxPlaybackId: STORM_MUX_ID,
    onStateChange: (state) => {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'MODE_STATE_UPDATE', state }, '*');
      }
    },
  });

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'SET_MODE' && data.mode) {
      controller.setMode(data.mode as ModePreset);
    } else if (data.type === 'SET_FX' && typeof data.fx === 'boolean') {
      controller.setFx(data.fx);
    } else if (data.type === 'SET_PINNED' && typeof data.pinned === 'boolean') {
      controller.setPinned(data.pinned);
    } else if (data.type === 'SET_SOURCE' && data.src) {
      controller.setVideoSource({
        src: data.src,
        poster: data.poster,
        storyboardVtt: data.storyboardVtt,
        chaptersVtt: data.chaptersVtt,
        captions: data.captions,
        bookmarks: data.bookmarks,
        muxPlaybackId: data.muxPlaybackId,
        recommendedMode: data.recommendedMode,
      });
    }
  });
});

