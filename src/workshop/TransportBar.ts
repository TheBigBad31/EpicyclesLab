import { EpicycleRenderer } from '../render';

export class TransportBar {
  private container: HTMLElement;
  private renderer: EpicycleRenderer;
  private timeScrubber: HTMLInputElement | null = null;
  private timeLabel: HTMLElement | null = null;
  private btnPlay: HTMLButtonElement | null = null;
  private isUserScrubbing: boolean = false;
  private isRunning: boolean = true;

  constructor(container: HTMLElement, renderer: EpicycleRenderer) {
    this.container = container;
    this.renderer = renderer;

    this.init();
  }

  private init(): void {
    this.container.innerHTML = `
      <div class="transport-bar" role="region" aria-label="Contrôles de transport temporel">
        <div class="transport-controls">
          <button id="btn-play" class="btn btn-primary transport-btn" title="Lecture / Pause (Espace)" aria-label="Lecture ou Pause de l'animation">
            ${this.renderer.isPlaying ? '⏸ Pause' : '▶ Lecture'}
          </button>
          
          <div class="speed-selector">
            <label for="sel-speed" class="transport-label">Vitesse :</label>
            <select id="sel-speed" class="select-sm" aria-label="Vitesse d'animation">
              <option value="0.1">0.1x</option>
              <option value="0.25">0.25x</option>
              <option value="0.5">0.5x</option>
              <option value="1.0" selected>1.0x</option>
              <option value="1.5">1.5x</option>
              <option value="2.0">2.0x</option>
              <option value="4.0">4.0x</option>
            </select>
          </div>

          <div class="fade-selector">
            <label for="sel-fade" class="transport-label">Traînée :</label>
            <select id="sel-fade" class="select-sm" aria-label="Persistance de la traînée">
              <option value="0.25">25% tour</option>
              <option value="0.5">50% tour</option>
              <option value="1.0" selected>1 tour (100%)</option>
              <option value="999">Trace infinie</option>
            </select>
          </div>

          <button id="btn-clear-trail" class="btn btn-secondary transport-btn" title="Effacer la traînée" aria-label="Effacer la trace">
            🧹 Effacer trace
          </button>
        </div>

        <div class="scrubber-container">
          <label for="time-scrubber" class="transport-label">t :</label>
          <input type="range" id="time-scrubber" min="0" max="6.2831853" step="0.005" value="0" aria-label="Progression temporelle" />
          <span id="time-val" class="time-display" aria-live="polite">0.00 / 2π</span>
        </div>
      </div>
    `;

    this.btnPlay = this.container.querySelector('#btn-play');
    this.timeScrubber = this.container.querySelector('#time-scrubber');
    this.timeLabel = this.container.querySelector('#time-val');

    this.bindEvents();
    this.startScrubberSync();
  }

  public updatePlayState(isPlaying: boolean): void {
    if (this.btnPlay) {
      this.btnPlay.textContent = isPlaying ? '⏸ Pause' : '▶ Lecture';
    }
  }

  private bindEvents(): void {
    // Lecture / Pause
    this.btnPlay?.addEventListener('click', () => {
      this.renderer.isPlaying = !this.renderer.isPlaying;
      this.updatePlayState(this.renderer.isPlaying);
    });

    // Raccourci barre d'espace
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        this.renderer.isPlaying = !this.renderer.isPlaying;
        this.updatePlayState(this.renderer.isPlaying);
      }
    });

    // Vitesse
    const selSpeed = this.container.querySelector('#sel-speed') as HTMLSelectElement;
    selSpeed?.addEventListener('change', () => {
      this.renderer.speedMultiplier = parseFloat(selSpeed.value);
    });

    // Fade / Longueur de la traînée
    const selFade = this.container.querySelector('#sel-fade') as HTMLSelectElement;
    selFade?.addEventListener('change', () => {
      this.renderer.trail.fadeDuration = parseFloat(selFade.value);
    });

    // Effacer trace
    this.container.querySelector('#btn-clear-trail')?.addEventListener('click', () => {
      this.renderer.trail.clear();
    });

    // Scrubbing temporel
    this.timeScrubber?.addEventListener('input', () => {
      this.isUserScrubbing = true;
      if (this.timeScrubber) {
        const t = parseFloat(this.timeScrubber.value);
        this.renderer.setTime(t);
        this.updateTimeDisplay(t);
      }
    });

    this.timeScrubber?.addEventListener('change', () => {
      this.isUserScrubbing = false;
    });
  }

  private updateTimeDisplay(t: number): void {
    if (this.timeLabel) {
      const frac = (t / (2 * Math.PI)).toFixed(2);
      this.timeLabel.textContent = `${t.toFixed(2)} rad (${Math.round(parseFloat(frac) * 100)}%)`;
    }
  }

  private startScrubberSync(): void {
    const sync = () => {
      if (!this.isRunning) return;
      if (!this.isUserScrubbing && this.timeScrubber && this.timeLabel) {
        this.timeScrubber.value = this.renderer.time.toString();
        this.updateTimeDisplay(this.renderer.time);
      }
      requestAnimationFrame(sync);
    };
    requestAnimationFrame(sync);
  }

  public destroy(): void {
    this.isRunning = false;
  }
}
