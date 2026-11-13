/**
 * @file EdgeColorEngine.ts
 * @version 1.0.0
 * @description Real-time Video Edge Color Ambilight Extractor for MODE Skin (Music & Movie modes).
 * Samples top, bottom, left, and right edge pixels of the active <video> element onto a 32x18
 * offscreen canvas and projects boosted neon/cinema RGB values onto the player's CSS variables.
 */

export interface EdgeColors {
  top: string;
  bottom: string;
  left: string;
  right: string;
  primary: string;
  secondary: string;
  hexPrimary: string;
  hexSecondary: string;
}

export class EdgeColorEngine {
  private video: HTMLVideoElement;
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private timerId: number | null = null;
  private active = false;
  private corsTainted = false;
  private onUpdate?: (colors: EdgeColors) => void;

  private currentColors: EdgeColors = {
    top: 'rgb(0, 240, 255)',
    bottom: 'rgb(176, 38, 255)',
    left: 'rgb(0, 210, 255)',
    right: 'rgb(217, 70, 239)',
    primary: 'rgb(0, 240, 255)',
    secondary: 'rgb(176, 38, 255)',
    hexPrimary: '#00f0ff',
    hexSecondary: '#b026ff',
  };

  constructor(
    video: HTMLVideoElement,
    container: HTMLElement,
    onUpdate?: (colors: EdgeColors) => void
  ) {
    this.video = video;
    this.container = container;
    this.onUpdate = onUpdate;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 32;
    this.canvas.height = 18;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  private lastAppliedKey = '';

  public start(): void {
    if (this.active) return;
    this.active = true;
    this.sampleFrame();
    this.timerId = window.setInterval(() => this.sampleFrame(), 66);
  }

  public resetCors(): void {
    this.corsTainted = false;
  }

  public stop(): void {
    this.active = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public getColors(): EdgeColors {
    return this.currentColors;
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Boosts saturation and ensures minimum luminance so dark video edges still cast
   * a vibrant cyberpunk/cinema edge reflection on the player chrome.
   */
  private boostColor(r: number, g: number, b: number): [number, number, number] {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = (max + min) / 2;

    if (max < 24) {
      // Very dark region: inject subtle arcane cyan/violet undertone
      return [38, 175, 245];
    }

    // Boost saturation around average
    const avg = (r + g + b) / 3;
    const satBoost = 1.55;
    let br = avg + (r - avg) * satBoost;
    let bg = avg + (g - avg) * satBoost;
    let bb = avg + (b - avg) * satBoost;

    // Ensure readable glow brightness
    if (lum < 95) {
      const lift = 95 / Math.max(lum, 18);
      br *= lift;
      bg *= lift;
      bb *= lift;
    }

    return [
      Math.max(20, Math.min(255, Math.round(br))),
      Math.max(20, Math.min(255, Math.round(bg))),
      Math.max(20, Math.min(255, Math.round(bb))),
    ];
  }

  private sampleRegion(
    data: Uint8ClampedArray,
    w: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): [number, number, number] {
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * w + x) * 4;
        r += data[idx];
        g += data[idx + 1];
        b += data[idx + 2];
        count++;
      }
    }
    if (count === 0) return [0, 240, 255];
    return this.boostColor(r / count, g / count, b / count);
  }

  public sampleFrame(): void {
    if (!this.active) return;

    if (!this.corsTainted && this.ctx && this.video.readyState >= 2 && this.video.videoWidth > 0) {
      try {
        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.drawImage(this.video, 0, 0, w, h);
        const frame = this.ctx.getImageData(0, 0, w, h).data;

        const top = this.sampleRegion(frame, w, 2, 0, w - 2, 3);
        const bottom = this.sampleRegion(frame, w, 2, h - 3, w - 2, h);
        const left = this.sampleRegion(frame, w, 0, 2, 4, h - 2);
        const right = this.sampleRegion(frame, w, w - 4, 2, w, h - 2);

        this.applyColors(top, bottom, left, right);
        return;
      } catch {
        // Cross-origin stream without CORS headers: switch to harmonic time-synced synthesis
        this.corsTainted = true;
      }
    }

    // Harmonic time-synced edge color synthesis fallback (or while video is buffering/paused)
    const t = (this.video.currentTime || performance.now() * 0.001) * 0.85;
    const top: [number, number, number] = [
      Math.round(40 + 180 * (0.5 + 0.5 * Math.sin(t))),
      Math.round(160 + 90 * (0.5 + 0.5 * Math.cos(t * 0.7))),
      255,
    ];
    const bottom: [number, number, number] = [
      Math.round(165 + 85 * (0.5 + 0.5 * Math.cos(t * 1.1))),
      Math.round(35 + 110 * (0.5 + 0.5 * Math.sin(t * 0.9))),
      255,
    ];
    const left: [number, number, number] = [
      0,
      Math.round(195 + 60 * Math.sin(t * 0.8)),
      Math.round(220 + 35 * Math.cos(t)),
    ];
    const right: [number, number, number] = [
      Math.round(190 + 60 * Math.sin(t * 1.2)),
      Math.round(45 + 90 * Math.cos(t * 0.6)),
      245,
    ];
    this.applyColors(top, bottom, left, right);
  }

  private applyColors(
    top: [number, number, number],
    bottom: [number, number, number],
    left: [number, number, number],
    right: [number, number, number]
  ): void {
    const topRgb = `rgb(${top[0]}, ${top[1]}, ${top[2]})`;
    const bottomRgb = `rgb(${bottom[0]}, ${bottom[1]}, ${bottom[2]})`;
    const leftRgb = `rgb(${left[0]}, ${left[1]}, ${left[2]})`;
    const rightRgb = `rgb(${right[0]}, ${right[1]}, ${right[2]})`;

    this.currentColors = {
      top: topRgb,
      bottom: bottomRgb,
      left: leftRgb,
      right: rightRgb,
      primary: bottomRgb,
      secondary: topRgb,
      hexPrimary: this.rgbToHex(bottom[0], bottom[1], bottom[2]),
      hexSecondary: this.rgbToHex(top[0], top[1], top[2]),
    };

    const key = `${top[0] >> 1},${top[1] >> 1},${top[2] >> 1}|${bottom[0] >> 1},${bottom[1] >> 1},${bottom[2] >> 1}|${left[0] >> 1},${left[1] >> 1},${left[2] >> 1}|${right[0] >> 1},${right[1] >> 1},${right[2] >> 1}`;
    if (key === this.lastAppliedKey) return;
    this.lastAppliedKey = key;

    const s = this.container.style;
    s.setProperty('--mode-edge-top', topRgb);
    s.setProperty('--mode-edge-bottom', bottomRgb);
    s.setProperty('--mode-edge-left', leftRgb);
    s.setProperty('--mode-edge-right', rightRgb);
    s.setProperty('--mode-edge-primary', bottomRgb);
    s.setProperty('--mode-edge-secondary', topRgb);
    s.setProperty('--mode-edge-primary-rgb', `${bottom[0]}, ${bottom[1]}, ${bottom[2]}`);
    s.setProperty('--mode-edge-secondary-rgb', `${top[0]}, ${top[1]}, ${top[2]}`);

    if (this.onUpdate) {
      this.onUpdate(this.currentColors);
    }
  }
}

