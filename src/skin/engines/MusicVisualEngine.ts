/**
 * @file MusicVisualEngine.ts
 * @version 1.0.0
 * @description Arcane Domain Audio-Reactive Visualizer & Perimeter Spark Orbit Engine for MODE Skin.
 * Directly inspired by arcanedoma.in's global music player (js/main.js):
 *  1. Aurora Time-Domain Oscilloscope Ribbon
 *  2. Mirrored Center-Out Frequency Spectrum Bars with glowing caps
 *  3. Bass-Reactive Particle Bursts (VisualParticle)
 *  4. Perimeter Spark Orbit (startSparkOrbit) tracing the rounded control bar border
 */

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
}

export class MusicVisualEngine {
  private video: HTMLVideoElement;
  private container: HTMLElement;
  private vizCanvas: HTMLCanvasElement;
  private sparkCanvas: HTMLCanvasElement;
  private vizCtx: CanvasRenderingContext2D | null;
  private sparkCtx: CanvasRenderingContext2D | null;

  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(128);
  private timeData: Uint8Array<ArrayBuffer> = new Uint8Array(128);

  private particles: SparkParticle[] = [];
  private sparkDistance = 0;
  private sparkTrail: Array<{ x: number; y: number }> = [];
  private rafId: number | null = null;
  private running = false;
  private audioConnected = false;
  private audioFailed = false;

  constructor(
    video: HTMLVideoElement,
    container: HTMLElement,
    vizCanvas: HTMLCanvasElement,
    sparkCanvas: HTMLCanvasElement
  ) {
    this.video = video;
    this.container = container;
    this.vizCanvas = vizCanvas;
    this.sparkCanvas = sparkCanvas;
    this.vizCtx = vizCanvas.getContext('2d');
    this.sparkCtx = sparkCanvas.getContext('2d');
  }

  private ensureAudioGraph(): void {
    if (this.audioConnected || this.audioFailed) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.82;
      this.sourceNode = this.audioCtx.createMediaElementSource(this.video);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
      this.audioConnected = true;
    } catch {
      // If MediaElementSource already attached or CORS-restricted, use procedural audio-reactive synthesis
      this.audioFailed = true;
    }
  }

  public start(): void {
    if (this.running) return;
    this.running = true;

    const resumeAudio = () => {
      this.ensureAudioGraph();
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    };

    this.video.addEventListener('play', resumeAudio, { passive: true });
    if (!this.video.paused) {
      resumeAudio();
    }

    const loop = () => {
      if (!this.running) return;
      this.renderFrame();
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
    if (this.vizCtx) {
      this.vizCtx.clearRect(0, 0, this.vizCanvas.width, this.vizCanvas.height);
    }
    if (this.sparkCtx) {
      this.sparkCtx.clearRect(0, 0, this.sparkCanvas.width, this.sparkCanvas.height);
    }
  }

  private populateAudioData(): { bassAvg: number; isPlaying: boolean } {
    const isPlaying = !this.video.paused && !this.video.ended;

    if (this.audioConnected && this.analyser && isPlaying && !this.video.muted) {
      this.analyser.getByteFrequencyData(this.freqData);
      this.analyser.getByteTimeDomainData(this.timeData);

      let sum = 0;
      for (let i = 0; i < 12; i++) sum += this.freqData[i];
      if (sum > 0) {
        let bassSum = 0;
        for (let b = 0; b < 8; b++) bassSum += this.freqData[b];
        return { bassAvg: bassSum / (8 * 255), isPlaying };
      }
    }

    // Harmonic audio-reactive synthesis when video is muted, paused, or cross-origin stream
    const now = performance.now() * 0.004;
    const energy = isPlaying ? 1.0 : 0.22;
    let bassSum = 0;
    for (let i = 0; i < this.freqData.length; i++) {
      const wave =
        Math.sin(now * 1.9 + i * 0.18) * 0.45 +
        Math.cos(now * 3.1 - i * 0.09) * 0.35 +
        Math.sin(now * 5.4 + i * 0.35) * 0.2;
      const decay = Math.max(0.15, 1 - i / (this.freqData.length * 0.95));
      const val = Math.max(4, Math.min(255, Math.round((115 + wave * 115) * decay * energy)));
      this.freqData[i] = val;
      if (i < 8) bassSum += val;

      const tWave = Math.sin(now * 2.4 + i * 0.14) * 42 * energy + Math.cos(now * 4.2 - i * 0.22) * 18 * energy;
      this.timeData[i] = Math.max(0, Math.min(255, Math.round(128 + tWave)));
    }

    return { bassAvg: (bassSum / (8 * 255)) * energy, isPlaying };
  }

  /**
   * Maps distance `d` along a rounded rectangle perimeter of width `w`, height `h`, and corner radius `r`
   * to exact `(x, y)` coordinates — identical to arcanedoma.in's `getRoundedRectPoint` in `js/main.js`.
   */
  private getRoundedRectPoint(d: number, w: number, h: number, r: number): { x: number; y: number } {
    const topEdge = Math.max(0, w - 2 * r);
    const rightEdge = Math.max(0, h - 2 * r);
    const bottomEdge = topEdge;
    const leftEdge = rightEdge;
    const arcLen = 0.5 * Math.PI * r;
    const totalLen = topEdge + rightEdge + bottomEdge + leftEdge + 4 * arcLen;
    if (totalLen <= 0) return { x: 0, y: 0 };

    d = ((d % totalLen) + totalLen) % totalLen;

    if (d < topEdge) return { x: r + d, y: 0 };
    d -= topEdge;

    if (d < arcLen) {
      const angle = -0.5 * Math.PI + (d / arcLen) * (0.5 * Math.PI);
      return { x: w - r + Math.cos(angle) * r, y: r + Math.sin(angle) * r };
    }
    d -= arcLen;

    if (d < rightEdge) return { x: w, y: r + d };
    d -= rightEdge;

    if (d < arcLen) {
      const angle = 0 + (d / arcLen) * (0.5 * Math.PI);
      return { x: w - r + Math.cos(angle) * r, y: h - r + Math.sin(angle) * r };
    }
    d -= arcLen;

    if (d < bottomEdge) return { x: w - r - d, y: h };
    d -= bottomEdge;

    if (d < arcLen) {
      const angle = 0.5 * Math.PI + (d / arcLen) * (0.5 * Math.PI);
      return { x: r + Math.cos(angle) * r, y: h - r + Math.sin(angle) * r };
    }
    d -= arcLen;

    if (d < leftEdge) return { x: 0, y: h - r - d };
    d -= leftEdge;

    const angle = Math.PI + (d / arcLen) * (0.5 * Math.PI);
    return { x: r + Math.cos(angle) * r, y: r + Math.sin(angle) * r };
  }

  private renderFrame(): void {
    const mode = this.container.getAttribute('data-mode') || 'movie';
    const fx = this.container.getAttribute('data-fx') !== 'off';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (mode !== 'music' || !fx || reducedMotion) {
      if (this.vizCtx) this.vizCtx.clearRect(0, 0, this.vizCanvas.width, this.vizCanvas.height);
      if (this.sparkCtx) this.sparkCtx.clearRect(0, 0, this.sparkCanvas.width, this.sparkCanvas.height);
      return;
    }

    const { bassAvg, isPlaying } = this.populateAudioData();
    const edgePrimary = this.container.style.getPropertyValue('--mode-edge-primary').trim() || '#b026ff';
    const edgeSecondary = this.container.style.getPropertyValue('--mode-edge-secondary').trim() || '#00f0ff';

    this.renderVisualizerCanvas(bassAvg, isPlaying, edgePrimary, edgeSecondary);
    this.renderPerimeterSparkCanvas(bassAvg, isPlaying, edgePrimary, edgeSecondary);
  }

  private renderVisualizerCanvas(
    bassAvg: number,
    isPlaying: boolean,
    edgePrimary: string,
    edgeSecondary: string
  ): void {
    const ctx = this.vizCtx;
    if (!ctx) return;

    const w = Math.max(200, this.vizCanvas.offsetWidth || 640);
    const h = Math.max(48, this.vizCanvas.offsetHeight || 72);
    if (this.vizCanvas.width !== w || this.vizCanvas.height !== h) {
      this.vizCanvas.width = w;
      this.vizCanvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);

    // 1. Ambient Bass Reactive Pulse Glow
    if (bassAvg > 0.25) {
      const bassGlow = ctx.createRadialGradient(w / 2, h, 2, w / 2, h, w * 0.65);
      bassGlow.addColorStop(0, `rgba(176, 38, 255, ${(bassAvg - 0.25) * 0.42})`);
      bassGlow.addColorStop(0.5, `rgba(0, 240, 255, ${(bassAvg - 0.25) * 0.22})`);
      bassGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bassGlow;
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Aurora Time-Domain Ribbon Wave
    ctx.save();
    ctx.beginPath();
    const sliceWidth = w / (this.timeData.length - 1);
    let x = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = this.timeData[i] / 128.0;
      const y = (v * h) / 2;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = x - sliceWidth;
        const prevV = this.timeData[i - 1] / 128.0;
        const prevY = (prevV * h) / 2;
        const midX = (prevX + x) / 2;
        const midY = (prevY + y) / 2;
        ctx.quadraticCurveTo(prevX, prevY, midX, midY);
      }
      x += sliceWidth;
    }
    const waveGrad = ctx.createLinearGradient(0, 0, w, 0);
    waveGrad.addColorStop(0, 'rgba(176, 38, 255, 0)');
    waveGrad.addColorStop(0.25, edgePrimary);
    waveGrad.addColorStop(0.5, edgeSecondary);
    waveGrad.addColorStop(0.75, edgePrimary);
    waveGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.strokeStyle = waveGrad;
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 10;
    ctx.shadowColor = edgeSecondary;
    ctx.stroke();
    ctx.restore();

    // 3. Mirrored Frequency Spectrum Bars (Radiating from Center)
    const numBars = 40;
    const totalBarSpace = w * 0.86;
    const startX = (w - totalBarSpace) / 2;
    const barStep = totalBarSpace / (numBars * 2);
    const barWidth = Math.max(1.5, barStep * 0.64);
    const centerX = startX + totalBarSpace / 2;

    ctx.save();
    for (let i = 0; i < numBars; i++) {
      const dataIndex = Math.floor((i / numBars) * (this.freqData.length * 0.65));
      const val = this.freqData[dataIndex] / 255.0;
      const barHeight = Math.max(2, Math.pow(val, 1.35) * (h * 0.72));

      const barGrad = ctx.createLinearGradient(0, h, 0, h - barHeight);
      barGrad.addColorStop(0, 'rgba(176, 38, 255, 0.08)');
      barGrad.addColorStop(0.55, edgePrimary);
      barGrad.addColorStop(1, edgeSecondary);
      ctx.fillStyle = barGrad;

      const xRight = centerX + i * barStep;
      const xLeft = centerX - (i + 1) * barStep;

      ctx.beginPath();
      ctx.roundRect(xRight, h - barHeight, barWidth, barHeight, [2, 2, 0, 0]);
      ctx.roundRect(xLeft, h - barHeight, barWidth, barHeight, [2, 2, 0, 0]);
      ctx.fill();

      if (val > 0.35) {
        ctx.fillStyle = `rgba(255, 255, 255, ${val * 0.78})`;
        ctx.fillRect(xRight, h - barHeight - 2, barWidth, 1.5);
        ctx.fillRect(xLeft, h - barHeight - 2, barWidth, 1.5);
      }
    }
    ctx.restore();

    // 4. Bass-Reactive Floating Particles (VisualParticle)
    if (isPlaying && bassAvg > 0.38 && this.particles.length < 36) {
      this.particles.push({
        x: Math.random() * w,
        y: h + 4,
        vx: (Math.random() - 0.5) * 0.85,
        vy: -(Math.random() * 1.4 + 0.45) * (1 + bassAvg * 1.6),
        size: Math.random() * 2.2 + 0.8,
        alpha: Math.random() * 0.65 + 0.25,
        decay: Math.random() * 0.012 + 0.006,
        color: Math.random() > 0.45 ? edgeSecondary : edgePrimary,
      });
    }

    ctx.save();
    for (let p = this.particles.length - 1; p >= 0; p--) {
      const pt = this.particles[p];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.alpha -= pt.decay;
      if (pt.alpha <= 0 || pt.y < -8) {
        this.particles.splice(p, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderPerimeterSparkCanvas(
    bassAvg: number,
    isPlaying: boolean,
    edgePrimary: string,
    edgeSecondary: string
  ): void {
    const ctx = this.sparkCtx;
    if (!ctx) return;

    const parent = this.sparkCanvas.parentElement;
    if (!parent) return;

    const pad = 10;
    const pw = parent.offsetWidth;
    const ph = parent.offsetHeight;
    if (pw < 40 || ph < 20) return;

    const cw = pw + pad * 2;
    const ch = ph + pad * 2;
    if (this.sparkCanvas.width !== cw || this.sparkCanvas.height !== ch) {
      this.sparkCanvas.width = cw;
      this.sparkCanvas.height = ch;
    }

    ctx.clearRect(0, 0, cw, ch);

    const r = Math.min(20, ph / 2);
    const speed = isPlaying ? 2.1 + bassAvg * 2.8 : 0.85;
    this.sparkDistance += speed;

    const pos = this.getRoundedRectPoint(this.sparkDistance, pw, ph, r);
    const sx = pos.x + pad;
    const sy = pos.y + pad;

    this.sparkTrail.push({ x: sx, y: sy });
    const maxTrail = isPlaying ? 30 : 18;
    while (this.sparkTrail.length > maxTrail) {
      this.sparkTrail.shift();
    }

    // Draw fading comet tail along control bar perimeter
    for (let i = 1; i < this.sparkTrail.length; i++) {
      const ratio = i / this.sparkTrail.length;
      ctx.beginPath();
      ctx.moveTo(this.sparkTrail[i - 1].x, this.sparkTrail[i - 1].y);
      ctx.lineTo(this.sparkTrail[i].x, this.sparkTrail[i].y);
      ctx.strokeStyle = i > this.sparkTrail.length * 0.6 ? edgeSecondary : edgePrimary;
      ctx.globalAlpha = ratio * 0.8;
      ctx.lineWidth = ratio * 2.6;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Outer halo of perimeter spark
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 9);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    glow.addColorStop(0.35, edgeSecondary);
    glow.addColorStop(0.7, edgePrimary);
    glow.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, 9, 0, Math.PI * 2);
    ctx.fill();

    // Bright diamond core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
