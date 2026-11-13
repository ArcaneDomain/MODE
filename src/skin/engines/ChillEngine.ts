/**
 * @file ChillEngine.ts
 * @version 1.0.0
 * @description Ambient Lo-Fi Firefly/Bokeh Drift & Zen Sleep Fade Timer for MODE Skin (Chill Mode).
 */

interface BokehMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  phase: number;
  color: string;
}

export class ChillEngine {
  private video: HTMLVideoElement;
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private motes: BokehMote[] = [];
  private rafId: number | null = null;
  private running = false;

  // Sleep timer state
  private sleepDurationSec = 0;
  private sleepRemainingSec = 0;
  private sleepIntervalId: number | null = null;
  private savedVolume = 0.85;
  private onSleepTick?: (remainingSec: number, active: boolean) => void;

  private readonly palette = [
    'rgba(255, 158, 100, 0.55)', // Sunset Amber
    'rgba(232, 121, 249, 0.45)', // Rose Dusk
    'rgba(167, 139, 250, 0.5)',  // Twilight Lavender
    'rgba(253, 224, 71, 0.45)',  // Warm Firefly Gold
  ];

  constructor(
    video: HTMLVideoElement,
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    onSleepTick?: (remainingSec: number, active: boolean) => void
  ) {
    this.video = video;
    this.container = container;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSleepTick = onSleepTick;

    for (let i = 0; i < 22; i++) {
      this.motes.push({
        x: Math.random() * 800,
        y: Math.random() * 80,
        vx: (Math.random() - 0.5) * 0.28,
        vy: -(Math.random() * 0.22 + 0.06),
        radius: Math.random() * 6 + 2.5,
        alpha: Math.random() * 0.55 + 0.2,
        phase: Math.random() * Math.PI * 2,
        color: this.palette[i % this.palette.length],
      });
    }
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public setSleepTimer(seconds: number): void {
    if (this.sleepIntervalId !== null) {
      clearInterval(this.sleepIntervalId);
      this.sleepIntervalId = null;
    }
    this.sleepDurationSec = seconds;
    this.sleepRemainingSec = seconds;

    if (seconds <= 0) {
      this.container.style.removeProperty('--chill-sleep-dim');
      if (this.onSleepTick) this.onSleepTick(0, false);
      return;
    }

    this.savedVolume = this.video.volume > 0.05 ? this.video.volume : 0.8;
    if (this.onSleepTick) this.onSleepTick(this.sleepRemainingSec, true);

    this.sleepIntervalId = window.setInterval(() => {
      this.sleepRemainingSec = Math.max(0, this.sleepRemainingSec - 1);
      const progress = 1 - this.sleepRemainingSec / Math.max(1, this.sleepDurationSec);

      // Gently fade audio and dim screen during final 40% of timer
      if (progress > 0.6) {
        const fadeRatio = 1 - (progress - 0.6) / 0.4;
        this.video.volume = Math.max(0.02, this.savedVolume * fadeRatio);
        this.container.style.setProperty('--chill-sleep-dim', `${(1 - fadeRatio) * 0.55}`);
      }

      if (this.onSleepTick) {
        this.onSleepTick(this.sleepRemainingSec, this.sleepRemainingSec > 0);
      }

      if (this.sleepRemainingSec <= 0) {
        if (this.sleepIntervalId !== null) {
          clearInterval(this.sleepIntervalId);
          this.sleepIntervalId = null;
        }
        this.video.pause();
        this.video.volume = this.savedVolume;
        this.container.style.removeProperty('--chill-sleep-dim');
      }
    }, 1000);
  }

  private render(): void {
    const mode = this.container.getAttribute('data-mode');
    const fx = this.container.getAttribute('data-fx') !== 'off';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (mode !== 'chill' || !fx || reducedMotion || !this.ctx) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(200, Math.floor(rect.width));
    const h = Math.max(48, Math.floor(rect.height));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // Warm sunset breathing wave
    const now = performance.now() * 0.0012;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, `rgba(255, 158, 100, ${0.12 + Math.sin(now) * 0.04})`);
    grad.addColorStop(0.5, `rgba(232, 121, 249, ${0.1 + Math.cos(now * 0.8) * 0.04})`);
    grad.addColorStop(1, `rgba(129, 140, 248, ${0.12 + Math.sin(now * 1.1) * 0.04})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Floating lo-fi bokeh & firefly motes
    ctx.save();
    for (const m of this.motes) {
      m.x += m.vx + Math.sin(now + m.phase) * 0.15;
      m.y += m.vy;
      if (m.y < -12) {
        m.y = h + 10;
        m.x = Math.random() * w;
      }
      if (m.x < -12) m.x = w + 10;
      if (m.x > w + 12) m.x = -10;

      const pulse = 0.55 + 0.45 * Math.sin(now * 1.8 + m.phase);
      const rg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.radius * 2.2);
      rg.addColorStop(0, m.color);
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.globalAlpha = m.alpha * pulse;
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

