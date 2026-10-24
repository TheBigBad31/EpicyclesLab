import { EpicycleRenderer } from '../render';
import { Point2D, EpicycleTerm, SpectralMetrics, GibbsWindowType } from '../math/types';
import { FourierWorkerClient } from '../worker/FourierWorkerClient';
import { DrawingPad } from './DrawingPad';
import { extractPointsFromSvgString } from './SvgImporter';
import { computeMetrics } from '../math/metrics';
import {
  generatePiPreset,
  generateHeartPreset,
  generateStarPreset,
  generateButterflyPreset,
  generateSquareWavePreset,
  generateLissajousPreset,
  generateClefPreset,
} from '../math/presets';
import {
  serializeToJson,
  deserializeFromJson,
  encodeConfigToUrlHash,
  EpicyclesLabProjectState,
} from '../state/serialization';
import { triggerDownload } from '../export';

export interface InverseDrawingUIOptions {
  container: HTMLElement;
  renderer: EpicycleRenderer;
  workerClient?: FourierWorkerClient;
  onTermsChanged?: (terms: EpicycleTerm[], metrics?: SpectralMetrics) => void;
}

export class InverseDrawingUI {
  private container: HTMLElement;
  private renderer: EpicycleRenderer;
  private workerClient: FourierWorkerClient;
  private drawingPad: DrawingPad | null = null;

  // État interne
  private currentRawPoints: Point2D[] = [];
  private resampledPoints: Point2D[] = [];
  private computedTerms: EpicycleTerm[] = [];
  private metrics: SpectralMetrics | null = null;
  private activePresetId: string = 'pi';

  // Paramètres
  private numSamples: number = 256;
  private smoothRadius: number = 0;
  private gibbsWindow: GibbsWindowType = 'none';
  private closedCurve: boolean = true;
  private activeCircles: number = 50;
  private isComputing: boolean = false;

  private onTermsChanged?: (terms: EpicycleTerm[], metrics?: SpectralMetrics) => void;

  constructor(options: InverseDrawingUIOptions) {
    this.container = options.container;
    this.renderer = options.renderer;
    this.workerClient = options.workerClient || new FourierWorkerClient();
    this.onTermsChanged = options.onTermsChanged;

    this.init();
  }

  private init(): void {
    this.renderLayout();
    this.setupDrawingPad();
    this.bindEvents();

    // Charger le modèle Pi par défaut au démarrage
    this.loadPreset('pi');
  }

  private renderLayout(): void {
    this.container.innerHTML = `
      <div class="inverse-panel">
        <header class="panel-header">
          <div class="header-title">
            <span class="icon">✏️</span>
            <h3>Mode Dessin Inverse (Fourier)</h3>
          </div>
          <div class="header-actions">
            <span id="worker-badge" class="badge-status badge-ready">Worker Prêt</span>
          </div>
        </header>

        <!-- Zone de Dessin Tactile / Pad -->
        <section class="panel-section pad-section">
          <div class="section-header-between">
            <label class="section-label">1. Zone de Dessin Libre :</label>
            <div class="pad-tools">
              <button id="btn-clear-drawing" class="btn btn-sm btn-secondary" title="Effacer la zone de tracé">🧹 Effacer</button>
            </div>
          </div>
          <div class="drawing-pad-wrapper">
            <canvas id="inverse-drawing-canvas"></canvas>
            <div class="pad-placeholder" id="pad-placeholder">
              <span>✍️ Dessine une forme continue ici avec le doigt, le stylet ou la souris</span>
            </div>
          </div>
        </section>

        <!-- Modèles de Référence Préréglés & Import SVG -->
        <section class="panel-section presets-section">
          <label class="section-label">Ou sélectionne un modèle de référence :</label>
          <div class="preset-chips">
            <button class="chip active" data-preset="pi" title="Symbole Pi (π) - Vidéo de référence">π Pi</button>
            <button class="chip" data-preset="heart" title="Cœur paramétrique">❤️ Cœur</button>
            <button class="chip" data-preset="star" title="Étoile à 5 branches">⭐ Étoile</button>
            <button class="chip" data-preset="butterfly" title="Papillon de Temple Fay">🦋 Papillon</button>
            <button class="chip" data-preset="clef" title="Clé de sol / Note de musique">🎵 Musique</button>
            <button class="chip" data-preset="square" title="Onde carrée">⏹️ Onde Carrée</button>
            <button class="chip" data-preset="lissajous" title="Courbe de Lissajous">♾️ Lissajous</button>
          </div>
          <div class="svg-import-row">
            <label for="svg-file-input" class="btn btn-secondary btn-sm btn-upload">
              📁 Importer fichier SVG
            </label>
            <input type="file" id="svg-file-input" accept=".svg" style="display:none;" />
            <span id="svg-filename" class="text-muted text-xs"></span>
          </div>
        </section>

        <!-- Paramètres d'Échantillonnage & Lissage -->
        <section class="panel-section settings-section">
          <label class="section-label">2. Rééchantillonnage & Traitement Signal :</label>
          <div class="settings-grid">
            <div class="form-group">
              <label for="select-samples">Échantillons (N) :</label>
              <select id="select-samples" class="form-select">
                <option value="128">128 pts (Rapide)</option>
                <option value="256" selected>256 pts (Équilibré)</option>
                <option value="512">512 pts (Détaillé)</option>
                <option value="1024">1024 pts (Ultra-HD)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="select-smoothing">Lissage spatial :</label>
              <select id="select-smoothing" class="form-select">
                <option value="0" selected>Aucun (Brut)</option>
                <option value="2">Faible (Rayon 2)</option>
                <option value="4">Moyen (Rayon 4)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="select-gibbs">Anti-Gibbs :</label>
              <select id="select-gibbs" class="form-select">
                <option value="none" selected>Standard</option>
                <option value="lanczos">Lanczos (Sigma)</option>
                <option value="fejer">Fejér (Cesàro)</option>
              </select>
            </div>
            <div class="form-group checkbox-group">
              <label><input type="checkbox" id="chk-closed-curve" checked /> Fermer la boucle</label>
              <label><input type="checkbox" id="chk-show-target-trace" checked /> Filigrane original</label>
            </div>
          </div>
        </section>

        <!-- Curseur Interactif du Nombre de Cercles (Reconstruction) -->
        <section class="panel-section reconstruction-section">
          <div class="section-header-between">
            <label class="section-label">3. Reconstruction & Cercles Actifs :</label>
            <span class="badge-circles" id="label-active-circles">50 / 256 cercles</span>
          </div>
          <div class="slider-row">
            <input type="range" id="slider-num-circles" min="1" max="256" value="50" class="circle-slider" />
          </div>
          <div class="reconstruction-presets">
            <button class="btn btn-xs btn-outline" data-circles="1">1 (Ellipse)</button>
            <button class="btn btn-xs btn-outline" data-circles="5">5</button>
            <button class="btn btn-xs btn-outline" data-circles="15">15</button>
            <button class="btn btn-xs btn-outline" data-circles="50">50</button>
            <button class="btn btn-xs btn-outline" data-circles="120">120</button>
            <button class="btn btn-xs btn-outline" data-circles="all">Max</button>
          </div>
        </section>

        <!-- Métriques Mathématiques & Erreur RMSE en Temps Réel -->
        <section class="panel-section metrics-section">
          <label class="section-label">Indicateurs Mathématiques de Fidélité :</label>
          <div class="metrics-cards">
            <div class="metric-card">
              <div class="metric-label">Erreur RMSE</div>
              <div class="metric-value" id="val-rmse">0.0 px</div>
              <div class="metric-sub" id="val-relative-rmse">0.0 %</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Énergie Capturée</div>
              <div class="metric-value highlight" id="val-energy">100.0%</div>
              <div class="metric-sub">Théorème Parseval</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">Temps Calcul Worker</div>
              <div class="metric-value" id="val-duration">0 ms</div>
              <div class="metric-sub">Non bloquant 60fps</div>
            </div>
          </div>

          <!-- Mini-Spectre d'Amplitudes -->
          <div class="spectrum-container">
            <div class="spectrum-header">
              <span>Spectre des Amplitudes |X_k|</span>
              <span id="spectrum-info" class="text-muted text-xs">256 composantes</span>
            </div>
            <canvas id="spectrum-canvas" height="60"></canvas>
          </div>
        </section>

        <!-- Partage URL & Export JSON -->
        <footer class="panel-footer inverse-footer">
          <div class="footer-btn-grid">
            <button id="btn-share-link" class="btn btn-primary" title="Copier un lien direct de partage">
              🔗 Copier Lien URL
            </button>
            <button id="btn-export-json" class="btn btn-secondary" title="Télécharger le projet en JSON">
              💾 Exporter JSON
            </button>
            <label for="import-json-file" class="btn btn-secondary" title="Charger un fichier JSON">
              📂 Importer JSON
            </label>
            <input type="file" id="import-json-file" accept=".json" style="display:none;" />
          </div>
          <div id="share-toast" class="share-toast" style="display:none;">
            Lien de partage copié dans le presse-papier !
          </div>
        </footer>
      </div>
    `;
  }

  private setupDrawingPad(): void {
    const padCanvas = this.container.querySelector('#inverse-drawing-canvas') as HTMLCanvasElement;
    const placeholder = this.container.querySelector('#pad-placeholder') as HTMLElement;
    if (!padCanvas) return;

    this.drawingPad = new DrawingPad(padCanvas, {
      strokeColor: '#38bdf8',
      lineWidth: 3,
      onStrokeUpdate: (pts) => {
        if (pts.length > 0 && placeholder) {
          placeholder.style.display = 'none';
        }
      },
      onStrokeComplete: (pts) => {
        if (pts.length >= 3) {
          this.activePresetId = 'custom';
          this.updateActiveChip(null);
          this.currentRawPoints = pts;
          this.computeFourier();
        }
      },
    });
  }

  private bindEvents(): void {
    // Bouton Effacer le tracé
    const btnClear = this.container.querySelector('#btn-clear-drawing');
    const placeholder = this.container.querySelector('#pad-placeholder') as HTMLElement;
    btnClear?.addEventListener('click', () => {
      this.drawingPad?.clear();
      this.currentRawPoints = [];
      if (placeholder) placeholder.style.display = 'flex';
    });

    // Puces de modèles préréglés
    const chips = this.container.querySelectorAll<HTMLButtonElement>('.preset-chips .chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const presetId = chip.dataset.preset;
        if (presetId) {
          this.loadPreset(presetId);
        }
      });
    });

    // Import SVG
    const svgInput = this.container.querySelector('#svg-file-input') as HTMLInputElement;
    const svgFilename = this.container.querySelector('#svg-filename') as HTMLElement;
    svgInput?.addEventListener('change', async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      if (svgFilename) svgFilename.textContent = file.name;
      const text = await file.text();
      const extracted = extractPointsFromSvgString(text);

      if (extracted.points.length >= 3) {
        this.activePresetId = 'svg';
        this.updateActiveChip(null);
        this.currentRawPoints = extracted.points;
        this.drawingPad?.setPoints(extracted.points);
        if (placeholder) placeholder.style.display = 'none';
        this.computeFourier();
      } else {
        alert("Impossible d'extraire un tracé vectoriel valide depuis ce fichier SVG.");
      }
    });

    // Options d'échantillonnage & lissage
    const selectSamples = this.container.querySelector('#select-samples') as HTMLSelectElement;
    selectSamples?.addEventListener('change', () => {
      this.numSamples = parseInt(selectSamples.value, 10) || 256;
      this.updateSliderMax(this.numSamples);
      this.computeFourier();
    });

    const selectSmoothing = this.container.querySelector('#select-smoothing') as HTMLSelectElement;
    selectSmoothing?.addEventListener('change', () => {
      this.smoothRadius = parseInt(selectSmoothing.value, 10) || 0;
      this.computeFourier();
    });

    const selectGibbs = this.container.querySelector('#select-gibbs') as HTMLSelectElement;
    selectGibbs?.addEventListener('change', () => {
      this.gibbsWindow = selectGibbs.value as GibbsWindowType;
      this.computeFourier();
    });

    const chkClosed = this.container.querySelector('#chk-closed-curve') as HTMLInputElement;
    chkClosed?.addEventListener('change', () => {
      this.closedCurve = chkClosed.checked;
      this.computeFourier();
    });

    const chkShowTarget = this.container.querySelector('#chk-show-target-trace') as HTMLInputElement;
    chkShowTarget?.addEventListener('change', () => {
      this.renderer.showTargetCurve = chkShowTarget.checked;
    });

    // Curseur du nombre de cercles
    const circleSlider = this.container.querySelector('#slider-num-circles') as HTMLInputElement;
    circleSlider?.addEventListener('input', () => {
      this.activeCircles = parseInt(circleSlider.value, 10);
      this.onCircleCountChanged();
    });

    // Raccourcis de nombre de cercles
    const circleQuickBtns = this.container.querySelectorAll<HTMLButtonElement>('.reconstruction-presets button');
    circleQuickBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.circles;
        if (val === 'all') {
          this.activeCircles = this.computedTerms.length;
        } else {
          this.activeCircles = Math.min(this.computedTerms.length, parseInt(val || '50', 10));
        }
        if (circleSlider) circleSlider.value = String(this.activeCircles);
        this.onCircleCountChanged();
      });
    });

    // Partage URL
    const btnShare = this.container.querySelector('#btn-share-link');
    btnShare?.addEventListener('click', () => {
      this.generateShareLink();
    });

    // Export JSON
    const btnExportJson = this.container.querySelector('#btn-export-json');
    btnExportJson?.addEventListener('click', () => {
      this.exportProjectJson();
    });

    // Import JSON
    const inputJson = this.container.querySelector('#import-json-file') as HTMLInputElement;
    inputJson?.addEventListener('change', async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        this.importProjectJson(text);
      } catch (err) {
        alert("Fichier JSON invalide : " + (err instanceof Error ? err.message : String(err)));
      }
    });
  }

  public loadPreset(presetId: string): void {
    this.activePresetId = presetId;
    this.updateActiveChip(presetId);

    let points: Point2D[] = [];
    switch (presetId) {
      case 'pi':
        points = generatePiPreset(this.numSamples);
        break;
      case 'heart':
        points = generateHeartPreset(this.numSamples);
        break;
      case 'star':
        points = generateStarPreset(this.numSamples);
        break;
      case 'butterfly':
        points = generateButterflyPreset(this.numSamples);
        break;
      case 'square':
        points = generateSquareWavePreset(this.numSamples);
        break;
      case 'lissajous':
        points = generateLissajousPreset(this.numSamples);
        break;
      case 'clef':
        points = generateClefPreset(this.numSamples);
        break;
      default:
        points = generatePiPreset(this.numSamples);
    }

    this.currentRawPoints = points;
    this.drawingPad?.setPoints(points);

    const placeholder = this.container.querySelector('#pad-placeholder') as HTMLElement;
    if (placeholder) placeholder.style.display = 'none';

    this.computeFourier();
  }

  private updateActiveChip(presetId: string | null): void {
    const chips = this.container.querySelectorAll<HTMLButtonElement>('.preset-chips .chip');
    chips.forEach(chip => {
      if (chip.dataset.preset === presetId) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  private updateSliderMax(max: number): void {
    const slider = this.container.querySelector('#slider-num-circles') as HTMLInputElement;
    if (slider) {
      slider.max = String(max);
      if (this.activeCircles > max) {
        this.activeCircles = max;
        slider.value = String(max);
      }
    }
  }

  private async computeFourier(): Promise<void> {
    if (this.currentRawPoints.length < 3 || this.isComputing) return;

    this.isComputing = true;
    const workerBadge = this.container.querySelector('#worker-badge');
    if (workerBadge) {
      workerBadge.textContent = 'Calcul FFT...';
      workerBadge.className = 'badge-status badge-computing';
    }

    try {
      const response = await this.workerClient.compute({
        points: this.currentRawPoints,
        numSamples: this.numSamples,
        closed: this.closedCurve,
        smoothRadius: this.smoothRadius,
        gibbsWindow: this.gibbsWindow,
        sortOrder: 'amplitude-desc',
        fitScale: 1.0,
      });

      this.resampledPoints = response.resampledPoints;
      this.computedTerms = response.terms;

      // Mettre à jour le slider et la limite
      this.updateSliderMax(this.computedTerms.length);

      // Mettre à jour le renderer avec la courbe cible en filigrane
      this.renderer.setTargetCurve(this.resampledPoints, true);
      this.renderer.setTerms(this.computedTerms, true);
      this.renderer.maxCircles = this.activeCircles;

      // Métriques
      this.updateMetricsUI(response.durationMs);

      // Spectre
      this.renderSpectrumCanvas();

      if (workerBadge) {
        workerBadge.textContent = 'Worker Prêt';
        workerBadge.className = 'badge-status badge-ready';
      }

      this.onTermsChanged?.(this.computedTerms, this.metrics || undefined);
    } catch (err) {
      console.error('Erreur lors du calcul FFT dans le Worker :', err);
      if (workerBadge) {
        workerBadge.textContent = 'Erreur Worker';
        workerBadge.className = 'badge-status badge-error';
      }
    } finally {
      this.isComputing = false;
    }
  }

  private onCircleCountChanged(): void {
    this.renderer.maxCircles = this.activeCircles;

    const label = this.container.querySelector('#label-active-circles');
    if (label) {
      label.textContent = `${this.activeCircles} / ${this.computedTerms.length} cercles`;
    }

    this.updateMetricsUI();
    this.renderSpectrumCanvas();
  }

  private updateMetricsUI(durationMs?: number): void {
    if (this.resampledPoints.length === 0 || this.computedTerms.length === 0) return;

    this.metrics = computeMetrics(this.resampledPoints, this.computedTerms, this.activeCircles);

    const valRmse = this.container.querySelector('#val-rmse');
    const valRelRmse = this.container.querySelector('#val-relative-rmse');
    const valEnergy = this.container.querySelector('#val-energy');
    const valDuration = this.container.querySelector('#val-duration');

    if (valRmse) valRmse.textContent = `${this.metrics.rmse.toFixed(2)} px`;
    if (valRelRmse) valRelRmse.textContent = `Écart: ${this.metrics.relativeRmse.toFixed(2)}%`;
    if (valEnergy) valEnergy.textContent = `${(this.metrics.energyRatio * 100).toFixed(1)}%`;
    if (durationMs !== undefined && valDuration) {
      valDuration.textContent = `${durationMs.toFixed(1)} ms`;
    }
  }

  private renderSpectrumCanvas(): void {
    const canvas = this.container.querySelector('#spectrum-canvas') as HTMLCanvasElement;
    if (!canvas || this.computedTerms.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(10, Math.floor(rect.width * dpr));
    canvas.height = Math.max(10, Math.floor(rect.height * dpr));
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    ctx.clearRect(0, 0, width, height);

    const N = this.computedTerms.length;
    const maxAmp = Math.max(0.001, ...this.computedTerms.map(t => t.amplitude));
    const barWidth = Math.max(1, width / N);

    for (let i = 0; i < N; i++) {
      const term = this.computedTerms[i];
      const normH = (term.amplitude / maxAmp) * (height - 6);
      const x = i * barWidth;
      const y = height - normH;

      // Les barres actives sont lumineuses, les filtrées sont grisées
      if (i < this.activeCircles) {
        ctx.fillStyle = '#38bdf8';
      } else {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      }
      ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), normH);
    }
  }

  public generateShareLink(): string {
    const state: EpicyclesLabProjectState = {
      version: 1,
      mode: 'inverse',
      title: `Épicycles - ${this.activePresetId}`,
      createdAt: new Date().toISOString(),
      terms: this.computedTerms,
      maxCircles: this.activeCircles,
      inverseConfig: {
        numSamples: this.numSamples,
        closed: this.closedCurve,
        smoothRadius: this.smoothRadius,
        gibbsWindow: this.gibbsWindow,
        sortOrder: 'amplitude-desc',
        activeCircles: this.activeCircles,
        presetId: this.activePresetId,
      },
    };

    const hash = encodeConfigToUrlHash(state);
    const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl).catch(() => {});
    }

    const toast = this.container.querySelector('#share-toast') as HTMLElement;
    if (toast) {
      toast.style.display = 'block';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 3000);
    }

    return fullUrl;
  }

  public exportProjectJson(): void {
    const state: EpicyclesLabProjectState = {
      version: 1,
      mode: 'inverse',
      title: `EpicyclesLab-${this.activePresetId}`,
      createdAt: new Date().toISOString(),
      terms: this.computedTerms,
      maxCircles: this.activeCircles,
      inverseConfig: {
        numSamples: this.numSamples,
        closed: this.closedCurve,
        smoothRadius: this.smoothRadius,
        gibbsWindow: this.gibbsWindow,
        sortOrder: 'amplitude-desc',
        activeCircles: this.activeCircles,
        presetId: this.activePresetId,
      },
    };

    const jsonStr = serializeToJson(state);
    triggerDownload(jsonStr, `epicycles-${this.activePresetId}-${Date.now()}.json`, 'application/json');
  }

  public importProjectJson(jsonStr: string): void {
    const state = deserializeFromJson(jsonStr);
    if (state.terms && state.terms.length > 0) {
      this.computedTerms = state.terms;
      this.activeCircles = state.maxCircles || state.terms.length;

      if (state.inverseConfig) {
        this.numSamples = state.inverseConfig.numSamples || 256;
        this.smoothRadius = state.inverseConfig.smoothRadius || 0;
        this.gibbsWindow = state.inverseConfig.gibbsWindow || 'none';
        this.closedCurve = state.inverseConfig.closed;
      }

      this.renderer.setTerms(this.computedTerms, true);
      this.renderer.maxCircles = this.activeCircles;

      this.updateSliderMax(this.computedTerms.length);
      const slider = this.container.querySelector('#slider-num-circles') as HTMLInputElement;
      if (slider) slider.value = String(this.activeCircles);

      this.onCircleCountChanged();
    }
  }

  public restoreFromState(state: Partial<EpicyclesLabProjectState>): void {
    if (state.terms && state.terms.length > 0) {
      this.computedTerms = state.terms;
      this.activeCircles = state.maxCircles || state.terms.length;

      if (state.inverseConfig?.presetId) {
        this.activePresetId = state.inverseConfig.presetId;
        this.updateActiveChip(this.activePresetId);
      }

      this.renderer.setTerms(this.computedTerms, true);
      this.renderer.maxCircles = this.activeCircles;

      this.updateSliderMax(this.computedTerms.length);
      const slider = this.container.querySelector('#slider-num-circles') as HTMLInputElement;
      if (slider) slider.value = String(this.activeCircles);

      this.onCircleCountChanged();
    }
  }

  public destroy(): void {
    this.workerClient.terminate();
  }
}
