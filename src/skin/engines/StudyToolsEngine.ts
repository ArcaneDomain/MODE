/**
 * @file StudyToolsEngine.ts
 * @version 1.0.0
 * @description Polyglot Translation (<media-i18n> + Live Dual-Caption Subtitle Translator),
 * Interactive Searchable Transcript Drawer, A-B Loop Repeat, and Study Bookmark Pins for MODE Skin.
 */

export interface PolyglotCue {
  id: string;
  start: number;
  end: number;
  translations: Record<string, string>;
}

export interface StudyBookmark {
  id: string;
  time: number;
  label: string;
}

export const SUPPORTED_LOCALES: Array<{ code: string; label: string; native: string; dir: 'ltr' | 'rtl' }> = [
  { code: 'en', label: 'English', native: 'EN · English', dir: 'ltr' },
  { code: 'es', label: 'Spanish', native: 'ES · Español', dir: 'ltr' },
  { code: 'fr', label: 'French', native: 'FR · Français', dir: 'ltr' },
  { code: 'de', label: 'German', native: 'DE · Deutsch', dir: 'ltr' },
  { code: 'ja', label: 'Japanese', native: 'JA · 日本語', dir: 'ltr' },
  { code: 'ar', label: 'Arabic (RTL)', native: 'AR · العربية', dir: 'rtl' },
  { code: 'zh-CN', label: 'Chinese', native: 'ZH · 中文', dir: 'ltr' },
  { code: 'pt-BR', label: 'Portuguese', native: 'PT · Português', dir: 'ltr' },
  { code: 'ru', label: 'Russian', native: 'RU · Русский', dir: 'ltr' },
  { code: 'ko', label: 'Korean', native: 'KO · 한국어', dir: 'ltr' },
  { code: 'uk', label: 'Ukrainian', native: 'UK · Українська', dir: 'ltr' },
];

export class StudyToolsEngine {
  private video: HTMLVideoElement;
  private i18nEl: HTMLElement;
  private container: HTMLElement;

  private primaryLang = 'en';
  private targetLang = 'es';
  private dualCaptionsEnabled = true;

  private pointA: number | null = null;
  private pointB: number | null = null;
  private bookmarks: StudyBookmark[] = [];

  private cues: PolyglotCue[] = [];
  private onStateChange?: () => void;

  constructor(
    video: HTMLVideoElement,
    i18nEl: HTMLElement,
    container: HTMLElement,
    onStateChange?: () => void
  ) {
    this.video = video;
    this.i18nEl = i18nEl;
    this.container = container;
    this.onStateChange = onStateChange;

    this.video.addEventListener('timeupdate', () => this.handleTimeUpdate());
  }

  public setUiLocale(code: string): void {
    const entry = SUPPORTED_LOCALES.find((l) => l.code === code) || SUPPORTED_LOCALES[0];
    this.i18nEl.setAttribute('lang', entry.code);
    this.i18nEl.setAttribute('dir', entry.dir);
    this.targetLang = entry.code === 'en' ? 'es' : entry.code;

    // Also sync native HTML5 <track> elements if present
    const tracks = this.video.textTracks;
    let anyShowing = false;
    for (let i = 0; i < tracks.length; i++) {
      if ((tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions') && tracks[i].mode === 'showing') {
        anyShowing = true;
        break;
      }
    }
    if (anyShowing) {
      for (let i = 0; i < tracks.length; i++) {
        const tr = tracks[i];
        if (tr.kind === 'subtitles' || tr.kind === 'captions') {
          tr.mode = tr.language === entry.code ? 'showing' : 'disabled';
        }
      }
    }

    this.notify();
  }

  public getUiLocale(): string {
    return this.i18nEl.getAttribute('lang') || 'en';
  }

  public setTargetTranslationLang(code: string): void {
    this.targetLang = code;
    this.notify();
  }

  public getTargetTranslationLang(): string {
    return this.targetLang;
  }

  public setPrimaryLang(code: string): void {
    this.primaryLang = code;
    this.notify();
  }

  public getPrimaryLang(): string {
    return this.primaryLang;
  }

  public toggleDualCaptions(force?: boolean): boolean {
    this.dualCaptionsEnabled = force !== undefined ? force : !this.dualCaptionsEnabled;
    this.notify();
    return this.dualCaptionsEnabled;
  }

  public isDualCaptionsEnabled(): boolean {
    return this.dualCaptionsEnabled;
  }

  public getActiveCue(): PolyglotCue | null {
    if (this.cues.length === 0) return null;
    const t = Math.max(0, this.video.currentTime || 0);
    return (
      this.cues.find((c) => t >= c.start && t <= c.end) ||
      (t < this.cues[0].start ? this.cues[0] : null)
    );
  }

  public setCues(cues: PolyglotCue[], bookmarks?: StudyBookmark[]): void {
    this.cues = cues;
    if (bookmarks !== undefined) {
      this.bookmarks = [...bookmarks];
    }
    this.pointA = null;
    this.pointB = null;
    this.notify();
  }

  public getCues(): PolyglotCue[] {
    return this.cues;
  }

  // A-B Loop controls
  public setLoopPointA(time?: number): number {
    this.pointA = time !== undefined ? time : this.video.currentTime;
    if (this.pointB !== null && this.pointB <= this.pointA) {
      this.pointB = null;
    }
    this.notify();
    return this.pointA;
  }

  public setLoopPointB(time?: number): number | null {
    const t = time !== undefined ? time : this.video.currentTime;
    if (this.pointA === null) {
      this.pointA = Math.max(0, t - 4);
    }
    if (t > this.pointA + 0.5) {
      this.pointB = t;
    } else {
      this.pointB = this.pointA + 5;
    }
    this.notify();
    return this.pointB;
  }

  public clearLoop(): void {
    this.pointA = null;
    this.pointB = null;
    this.notify();
  }

  public getLoopPoints(): { pointA: number | null; pointB: number | null } {
    return { pointA: this.pointA, pointB: this.pointB };
  }

  // Bookmarks
  public addBookmark(customLabel?: string): StudyBookmark {
    const time = Math.round(this.video.currentTime * 10) / 10;
    const bm: StudyBookmark = {
      id: `bm-${Date.now()}`,
      time,
      label: customLabel || `Study Note @ ${this.formatTime(time)}`,
    };
    this.bookmarks.push(bm);
    this.bookmarks.sort((a, b) => a.time - b.time);
    this.notify();
    return bm;
  }

  public removeBookmark(id: string): void {
    this.bookmarks = this.bookmarks.filter((b) => b.id !== id);
    this.notify();
  }

  public getBookmarks(): StudyBookmark[] {
    return this.bookmarks;
  }

  public formatTime(sec: number): string {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = (s % 60).toString().padStart(2, '0');
    return `${m}:${rem}`;
  }

  private handleTimeUpdate(): void {
    if (this.pointA !== null && this.pointB !== null && this.pointB > this.pointA) {
      if (this.video.currentTime >= this.pointB || this.video.currentTime < this.pointA - 0.5) {
        this.video.currentTime = this.pointA;
      }
    }
    this.notify();
  }

  private notify(): void {
    // Update CSS variables for A-B Loop indicator on the timeline
    const dur = this.video.duration && isFinite(this.video.duration) && this.video.duration > 0 ? this.video.duration : 38;
    if (this.pointA !== null) {
      const pctA = Math.max(0, Math.min(100, (this.pointA / dur) * 100));
      this.container.style.setProperty('--study-loop-a', `${pctA}%`);
    } else {
      this.container.style.removeProperty('--study-loop-a');
    }

    if (this.pointA !== null && this.pointB !== null) {
      const pctA = Math.max(0, Math.min(100, (this.pointA / dur) * 100));
      const pctB = Math.max(pctA, Math.min(100, (this.pointB / dur) * 100));
      this.container.style.setProperty('--study-loop-width', `${pctB - pctA}%`);
      this.container.setAttribute('data-ab-loop', 'active');
    } else if (this.pointA !== null) {
      this.container.setAttribute('data-ab-loop', 'point-a');
    } else {
      this.container.removeAttribute('data-ab-loop');
      this.container.style.removeProperty('--study-loop-width');
    }

    if (this.onStateChange) {
      this.onStateChange();
    }
  }
}
