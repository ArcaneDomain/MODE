/**
 * @file hls-renditions.ts
 * @version 1.0.0
 * @description Bridges hls.js quality levels and live ABR state to Video.js v10's native
 * `video.videoRenditions` interface (`qualityFeature` + `<media-quality-radio-group>`).
 */

import type Hls from 'hls.js';
import type { Level } from 'hls.js';

export interface HlsVideoRendition {
  id: string;
  width?: number;
  height?: number;
  bitrate?: number;
  frameRate?: number;
  codec?: string;
  selected: boolean;
  active: boolean;
  hlsLevelIndex: number;
}

/**
 * Estimates initial downstream bandwidth (bps) for hls.js ABR Auto selection
 * using the Network Information API when available, falling back to 5 Mbps.
 */
export function getInitialBandwidthEstimate(): number {
  const nav = navigator as Navigator & { connection?: { downlink?: number } };
  const downlinkMbps = nav.connection?.downlink;
  if (typeof downlinkMbps === 'number' && Number.isFinite(downlinkMbps) && downlinkMbps > 0) {
    return Math.max(400_000, Math.round(downlinkMbps * 1_000_000 * 0.75));
  }
  return 5_000_000;
}

/**
 * Spec-style VideoRenditionList EventTarget read by `@videojs/core` `qualityFeature`.
 * Defaults to Auto (`selectedIndex === -1` -> `hls.currentLevel = -1`) so playback
 * adapts to downstream bandwidth, while exposing manual resolutions in Settings.
 */
export class HlsRenditionList extends EventTarget {
  private items: HlsVideoRendition[] = [];
  private hls: Hls | null = null;
  private manualIndex = -1;

  public get length(): number {
    return this.items.length;
  }

  public [Symbol.iterator](): IterableIterator<HlsVideoRendition> {
    return this.items.values();
  }

  public get selectedIndex(): number {
    return this.manualIndex;
  }

  public set selectedIndex(index: number) {
    if (index < -1 || index >= this.items.length) return;
    this.manualIndex = index;

    this.items.forEach((item, i) => {
      item.selected = i === index;
      if (index !== -1) {
        item.active = i === index;
      }
    });

    if (this.hls) {
      if (index === -1) {
        // Restore true ABR Auto for downstream bandwidth adaptation
        this.hls.currentLevel = -1;
        const activeLvl = this.hls.loadLevel >= 0 ? this.hls.loadLevel : this.hls.nextAutoLevel;
        this.items.forEach((item) => {
          item.active = item.hlsLevelIndex === activeLvl;
        });
      } else {
        this.hls.currentLevel = this.items[index].hlsLevelIndex;
      }
    }

    this.dispatchEvent(new Event('change'));
    this.dispatchEvent(new Event('activechange'));
  }

  public setHlsLevels(hls: Hls, levels: Level[], activeLevelIndex: number): void {
    this.hls = hls;
    this.manualIndex = -1;

    const hasVideoLevels = levels.some((lvl) => lvl.height > 0 || lvl.width > 0);
    const mapped = levels
      .map((lvl, idx) => ({ lvl, idx }))
      .filter(({ lvl }) => !hasVideoLevels || lvl.height > 0 || lvl.width > 0)
      .sort((a, b) => {
        const heightDiff = (b.lvl.height || 0) - (a.lvl.height || 0);
        if (heightDiff !== 0) return heightDiff;
        return (b.lvl.bitrate || 0) - (a.lvl.bitrate || 0);
      });

    this.items = mapped.map(({ lvl, idx }) => ({
      id: `hls-${idx}`,
      ...(lvl.width > 0 && { width: lvl.width }),
      ...(lvl.height > 0 && { height: lvl.height }),
      ...(lvl.bitrate > 0 && { bitrate: lvl.bitrate }),
      ...(lvl.frameRate > 0 && { frameRate: lvl.frameRate }),
      ...(lvl.videoCodec && { codec: lvl.videoCodec }),
      selected: false,
      active: idx === activeLevelIndex,
      hlsLevelIndex: idx,
    }));

    this.dispatchEvent(new Event('addrendition'));
    this.dispatchEvent(new Event('change'));
    this.dispatchEvent(new Event('activechange'));
  }

  public syncActiveLevel(levelIndex: number): void {
    if (!this.items.length) return;
    let changed = false;
    for (const item of this.items) {
      const shouldBeActive = item.hlsLevelIndex === levelIndex;
      if (item.active !== shouldBeActive) {
        item.active = shouldBeActive;
        changed = true;
      }
    }
    if (changed) {
      this.dispatchEvent(new Event('activechange'));
    }
  }

  public clear(): void {
    const hadItems = this.items.length > 0;
    this.hls = null;
    this.manualIndex = -1;
    this.items = [];
    if (hadItems) {
      this.dispatchEvent(new Event('removerendition'));
      this.dispatchEvent(new Event('change'));
      this.dispatchEvent(new Event('activechange'));
    }
  }
}

/**
 * Installs a persistent `videoRenditions` property on `<video>` before
 * Video.js v10's `qualityFeature` binds on `loadstart`.
 */
export function attachRenditionsBridge(videoEl: HTMLVideoElement): HlsRenditionList {
  const existing = (videoEl as unknown as { videoRenditions?: unknown }).videoRenditions;
  if (existing instanceof HlsRenditionList) {
    return existing;
  }

  const list = new HlsRenditionList();
  const ownDesc = Object.getOwnPropertyDescriptor(videoEl, 'videoRenditions');
  if (!ownDesc || ownDesc.configurable) {
    Object.defineProperty(videoEl, 'videoRenditions', {
      value: list,
      configurable: true,
    });
  }
  return list;
}
