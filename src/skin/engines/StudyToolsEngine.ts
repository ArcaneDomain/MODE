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

export const DEFAULT_POLYGLOT_CUES: PolyglotCue[] = [
  {
    id: 'cue-1',
    start: 0,
    end: 6.5,
    translations: {
      en: 'Welcome to MODE — an adaptive Video.js v10 skin engineered for every viewing occasion.',
      es: 'Bienvenido a MODE — una interfaz adaptable de Video.js v10 diseñada para cada ocasión.',
      fr: 'Bienvenue dans MODE — un habillage Video.js v10 adaptatif conçu pour chaque occasion.',
      de: 'Willkommen bei MODE — einem adaptiven Video.js v10 Skin für jeden Anlass.',
      ja: 'MODEへようこそ — あらゆる視聴シーンに対応する適応型 Video.js v10 スキンです。',
      ar: 'مرحبًا بك في MODE — واجهة Video.js v10 المتكيفة المصممة لكل مناسبة مشاهدة.',
      'zh-CN': '欢迎体验 MODE —— 专为每种观看场景打造的自适应 Video.js v10 播放器皮肤。',
      'pt-BR': 'Bem-vindo ao MODE — uma skin adaptativa do Video.js v10 projetada para cada ocasião.',
      ru: 'Добро пожаловать в MODE — адаптивный скин Video.js v10 для любого сценария просмотра.',
      ko: 'MODE에 오신 것을 환영합니다 — 모든 시청 환경을 위해 설계된 맞춤형 Video.js v10 스킨입니다.',
      uk: 'Ласкаво просимо до MODE — адаптивної оболонки Video.js v10 для кожного сценарію перегляду.',
    },
  },
  {
    id: 'cue-2',
    start: 6.5,
    end: 13.5,
    translations: {
      en: 'In Movie Mode, deep crimson velvet and champagne gold frame the cinema viewport without distraction.',
      es: 'En el Modo Película, el terciopelo carmesí y el oro champán enmarcan el cine sin distracciones.',
      fr: 'En mode Cinéma, le velours cramoisi et l’or champagne encadrent l’écran sans distraction.',
      de: 'Im Filmmodus rahmen tiefes Purpur-Samt und Champagnergold das Bild ohne Ablenkung ein.',
      ja: 'ムービーモードでは、深紅のベルベットとシャンパンゴールドが映像を美しく引き立てます。',
      ar: 'في وضع السينما، يحيط المخمل القرمزي والذهب الشامبانيا بشاشة العرض دون أي تشتيت.',
      'zh-CN': '在电影模式下，深红天鹅绒与香槟金边框营造沉浸式影院体验。',
      'pt-BR': 'No Modo Filme, o veludo carmesim e o ouro champanhe emolduram a tela sem distrações.',
      ru: 'В режиме Кино глубокий малиновый бархат и золотой акцент создают атмосферу кинозала.',
      ko: '무비 모드에서는 짙은 크림슨 벨벳과 샴페인 골드가 몰입감 있는 시네마 환경을 제공합니다.',
      uk: 'У режимі Кіно глибокий оксамит і золотий акцент створюють атмосферу кінозалу.',
    },
  },
  {
    id: 'cue-3',
    start: 13.5,
    end: 21.0,
    translations: {
      en: 'In Music Mode, offscreen canvas edge sampling reflects live video colors onto the frosted cyberpunk controls.',
      es: 'En el Modo Música, el muestreo de bordes refleja los colores del video en vivo sobre los controles cyberpunk.',
      fr: 'En mode Musique, l’échantillonnage des bords reflète les couleurs vidéo en direct sur les contrôles cyberpunk.',
      de: 'Im Musikmodus projiziert die Kantenfarbanalyse Live-Videofarben auf die Cyberpunk-Steuerung.',
      ja: 'ミュージックモードでは、映像の端の色彩をリアルタイム抽出し、サイバーパンクUIに反映します。',
      ar: 'في وضع الموسيقى، يعكس استشعار حواف الفيديو الألوان الحية على عناصر التحكم السايبر بانك.',
      'zh-CN': '在音乐模式下，实时边缘色彩采样将画面色调映射至赛博朋克磨砂控制栏。',
      'pt-BR': 'No Modo Música, a amostragem de bordas reflete as cores do vídeo ao vivo nos controles cyberpunk.',
      ru: 'В режиме Музыка анализ краев кадра проецирует цвета видео на киберпанк-панель управления.',
      ko: '뮤직 모드에서는 실시간 영상 가장자리 색상 추출이 사이버펑크 컨트롤 바에 반영됩니다.',
      uk: 'У режимі Музика аналіз країв кадру переносить кольори відео на кіберпанк-панель.',
    },
  },
  {
    id: 'cue-4',
    start: 21.0,
    end: 28.5,
    translations: {
      en: 'In Study Mode, Video.js v10 media-i18n and live dual-caption translation empower focused learning.',
      es: 'En el Modo Estudio, media-i18n de Video.js v10 y los subtítulos duales impulsan el aprendizaje enfocado.',
      fr: 'En mode Étude, media-i18n de Video.js v10 et la double traduction favorisent l’apprentissage concentré.',
      de: 'Im Lernmodus unterstützen Video.js v10 media-i18n und duale Untertitel das konzentrierte Studium.',
      ja: 'スタディモードでは、Video.js v10の多言語対応と二ヶ国語字幕が集中学習をサポートします。',
      ar: 'في وضع الدراسة، يدعم نظام الترجمة المزدوجة في Video.js v10 التعلم المركز بعدة لغات.',
      'zh-CN': '在学习模式下，Video.js v10 多语言组件与双语对照字幕助力高效专注学习。',
      'pt-BR': 'No Modo Estudo, o media-i18n do Video.js v10 e a tradução dupla impulsionam o aprendizado focado.',
      ru: 'В режиме Учеба локализация Video.js v10 и двойные субтитры помогают эффективному обучению.',
      ko: '스터디 모드에서는 Video.js v10 다국어 지원과 이중 자막 번역이 집중 학습을 돕습니다.',
      uk: 'У режимі Навчання локалізація Video.js v10 та подвійні субтитри допомагають навчанню.',
    },
  },
  {
    id: 'cue-5',
    start: 28.5,
    end: 38.0,
    translations: {
      en: 'In Chill and Skeleton modes, switch effortlessly between liquid-glass serenity and a 75% transparent wireframe.',
      es: 'En los modos Chill y Esqueleto, alterna entre cristal líquido sereno y una estructura 75% transparente.',
      fr: 'En modes Chill et Squelette, passez de la sérénité liquide à un fil de fer transparent à 75 %.',
      de: 'Wechseln Sie im Chill- und Skeleton-Modus zwischen Liquid-Glass-Ruhe und einem 75 % transparenten Wireframe.',
      ja: 'チルモードとスケルトンモードでは、リキッドガラスの癒やしと75%透過ワイヤーフレームを自在に切り替えられます。',
      ar: 'في وضعي الاسترخاء والهيكل، انتقل بسلاسة بين الزجاج السائل الهادئ والإطار الشفاف بنسبة 75%.',
      'zh-CN': '在放松与骨架模式下，可在液态玻璃美学与 75% 透明极简线框之间自由切换。',
      'pt-BR': 'Nos modos Chill e Esqueleto, alterne entre a serenidade líquida e um wireframe 75% transparente.',
      ru: 'В режимах Чилл и Скелет переключайтесь между жидким стеклом и 75% прозрачным каркасом.',
      ko: '칠 모드와 스켈레톤 모드에서는 리퀴드 글래스 감성과 75% 투명 와이어프레임 사이를 자유롭게 전환합니다.',
      uk: 'У режимах Чілл та Скелет перемикайтеся між рідким склом і 75% прозорим каркасом.',
    },
  },
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
  private bookmarks: StudyBookmark[] = [
    { id: 'bm-1', time: 3.0, label: 'Architecture Overview' },
    { id: 'bm-2', time: 14.0, label: 'Edge Color Sampling' },
    { id: 'bm-3', time: 22.0, label: 'Polyglot SDK & i18n' },
  ];

  private cues: PolyglotCue[] = DEFAULT_POLYGLOT_CUES;
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

  public getActiveCue(): PolyglotCue {
    const dur = this.video.duration && isFinite(this.video.duration) ? this.video.duration : 38;
    const t = (this.video.currentTime || 0) % Math.max(1, Math.min(dur, 38));
    return (
      this.cues.find((c) => t >= c.start && t <= c.end) ||
      this.cues[0]
    );
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
