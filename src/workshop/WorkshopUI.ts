import { WorkshopModel } from './WorkshopModel';
import { EpicycleRenderer } from '../render';
import { exportCurveToSvg, exportCurveToPngDataUrl, triggerDownload } from '../export';

export class WorkshopUI {
  private container: HTMLElement;
  private model: WorkshopModel;
  private renderer: EpicycleRenderer;

  constructor(container: HTMLElement, model: WorkshopModel, renderer: EpicycleRenderer) {
    this.container = container;
    this.model = model;
    this.renderer = renderer;

    this.init();
  }

  private init(): void {
    this.renderLayout();
    this.bindEvents();
    this.model.subscribe(() => {
      this.renderer.setTerms([...this.model.getTerms()], false);
      this.renderCircleList();
    });
  }

  private renderLayout(): void {
    this.container.innerHTML = `
      <div class="workshop-panel">
        <header class="panel-header">
          <div class="header-title">
            <span class="icon">🌀</span>
            <h3>Mode Atelier (Synthèse)</h3>
          </div>
          <div class="header-actions">
            <button id="btn-add-circle" class="btn btn-primary" title="Ajouter un nouveau cercle">+ Cercle</button>
          </div>
        </header>

        <!-- Préréglages rapides -->
        <section class="panel-section presets-section">
          <label class="section-label">Préréglages d'atelier :</label>
          <div class="preset-buttons">
            ${WorkshopModel.getWorkshopPresets()
              .map(p => `<button class="btn btn-preset" data-preset="${p.id}" title="${p.description}">${p.name}</button>`)
              .join('')}
          </div>
        </section>

        <!-- Tri & Actions globales de la chaîne -->
        <section class="panel-section chain-tools">
          <div class="tool-group">
            <label>Tri automatique :</label>
            <div class="btn-group">
              <button id="btn-sort-amp" class="btn btn-sm">Amplitude ↓</button>
              <button id="btn-sort-freq" class="btn btn-sm">Fréquence ↑</button>
            </div>
          </div>
          <div class="tool-group">
            <label>Affichage :</label>
            <div class="checkbox-row">
              <label><input type="checkbox" id="chk-show-circles" checked /> Cercles</label>
              <label><input type="checkbox" id="chk-show-vectors" checked /> Rayons</label>
              <label><input type="checkbox" id="chk-show-trail" checked /> Traînée</label>
              <label><input type="checkbox" id="chk-follow-tip" /> Suivre pointe</label>
            </div>
          </div>
        </section>

        <!-- Liste ordonnée des cercles éditables -->
        <section class="circle-list-container">
          <div class="circle-list-header">
            <span>Ordre & Épicycle</span>
            <span>Rayon / Vitesse / Phase / Sens</span>
            <span>Actions</span>
          </div>
          <div id="circle-items-list" class="circle-items-list">
            <!-- Rendu dynamique -->
          </div>
        </section>

        <!-- Exports & Raccourcis -->
        <footer class="panel-footer">
          <div class="export-group">
            <button id="btn-export-svg" class="btn btn-secondary">📐 Export SVG</button>
            <button id="btn-export-png" class="btn btn-secondary">🖼️ Export PNG</button>
            <button id="btn-reset-cam" class="btn btn-secondary" title="Recentrer la caméra">🎯 Recentrer</button>
          </div>
        </footer>
      </div>
    `;

    this.renderCircleList();
  }

  private renderCircleList(): void {
    const listEl = this.container.querySelector('#circle-items-list');
    if (!listEl) return;

    const terms = this.model.getTerms();
    if (terms.length === 0) {
      listEl.innerHTML = `<div class="empty-state">Aucun cercle dans la chaîne. Cliquez sur "+ Cercle" pour commencer.</div>`;
      return;
    }

    listEl.innerHTML = terms
      .map((term, idx) => {
        const phaseDeg = Math.round(((term.phase * 180) / Math.PI) % 360);
        const color = term.color || '#38bdf8';

        return `
          <div class="circle-item" data-index="${idx}">
            <div class="item-meta">
              <span class="circle-index">#${idx + 1}</span>
              <input type="color" class="color-picker" value="${color}" title="Couleur de l'épicycle" />
            </div>

            <div class="item-controls">
              <!-- Rayon -->
              <div class="control-row">
                <span class="ctrl-label">R:</span>
                <input type="range" class="range-amp" min="0" max="300" step="1" value="${Math.round(term.amplitude)}" />
                <span class="ctrl-val val-amp">${Math.round(term.amplitude)}</span>
              </div>

              <!-- Vitesse / Fréquence -->
              <div class="control-row">
                <span class="ctrl-label">k:</span>
                <input type="number" class="num-freq" min="-100" max="100" step="1" value="${term.freq}" />
                <button class="btn-toggle-dir btn-sm" title="Sens de rotation (${term.direction === 'cw' ? 'Horaire' : 'Trigonométrique/Anti-horaire'})">
                  ${term.direction === 'cw' ? '↻ CW' : '↺ CCW'}
                </button>
              </div>

              <!-- Phase initiale -->
              <div class="control-row">
                <span class="ctrl-label">φ:</span>
                <input type="range" class="range-phase" min="0" max="360" step="1" value="${phaseDeg}" />
                <span class="ctrl-val val-phase">${phaseDeg}°</span>
              </div>
            </div>

            <div class="item-actions">
              <div class="move-btns">
                <button class="btn-move-up btn-icon" ${idx === 0 ? 'disabled' : ''} title="Monter">▲</button>
                <button class="btn-move-down btn-icon" ${idx === terms.length - 1 ? 'disabled' : ''} title="Descendre">▼</button>
              </div>
              <button class="btn-dup btn-icon" title="Dupliquer">⎘</button>
              <button class="btn-del btn-icon text-danger" title="Supprimer">✕</button>
            </div>
          </div>
        `;
      })
      .join('');

    this.bindCircleItemEvents();
  }

  private bindEvents(): void {
    // Bouton Ajouter
    this.container.querySelector('#btn-add-circle')?.addEventListener('click', () => {
      this.model.addCircle();
    });

    // Préréglages
    this.container.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.preset;
        const preset = WorkshopModel.getWorkshopPresets().find(p => p.id === id);
        if (preset) {
          this.model.setTerms(preset.terms);
          this.renderer.trail.clear();
        }
      });
    });

    // Tris
    this.container.querySelector('#btn-sort-amp')?.addEventListener('click', () => {
      this.model.sort('amplitude-desc');
    });
    this.container.querySelector('#btn-sort-freq')?.addEventListener('click', () => {
      this.model.sort('frequency-asc');
    });

    // Toggles visibilité
    const chkCircles = this.container.querySelector('#chk-show-circles') as HTMLInputElement;
    chkCircles?.addEventListener('change', () => {
      this.renderer.showCircles = chkCircles.checked;
    });

    const chkVectors = this.container.querySelector('#chk-show-vectors') as HTMLInputElement;
    chkVectors?.addEventListener('change', () => {
      this.renderer.showVectors = chkVectors.checked;
    });

    const chkTrail = this.container.querySelector('#chk-show-trail') as HTMLInputElement;
    chkTrail?.addEventListener('change', () => {
      this.renderer.showTrail = chkTrail.checked;
    });

    const chkFollow = this.container.querySelector('#chk-follow-tip') as HTMLInputElement;
    chkFollow?.addEventListener('change', () => {
      this.renderer.camera.followTarget = chkFollow.checked;
    });

    // Recentrer la caméra
    this.container.querySelector('#btn-reset-cam')?.addEventListener('click', () => {
      this.renderer.camera.reset(true);
      if (chkFollow) chkFollow.checked = false;
    });

    // Exports
    this.container.querySelector('#btn-export-svg')?.addEventListener('click', () => {
      const currentTerms = [...this.model.getTerms()];
      const svg = exportCurveToSvg(currentTerms, {
        includeEpicyclesState: {
          centers: this.renderer.lastCenters,
          terms: currentTerms,
        },
      });
      triggerDownload(svg, 'epicycles-workshop.svg', 'image/svg+xml');
    });

    this.container.querySelector('#btn-export-png')?.addEventListener('click', () => {
      const dataUrl = exportCurveToPngDataUrl(this.model.getTerms());
      if (dataUrl) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'epicycles-workshop.png';
        a.click();
      }
    });
  }

  private bindCircleItemEvents(): void {
    const listEl = this.container.querySelector('#circle-items-list');
    if (!listEl) return;

    listEl.querySelectorAll('.circle-item').forEach(itemEl => {
      const index = parseInt((itemEl as HTMLElement).dataset.index || '0', 10);

      // Rayon
      const rangeAmp = itemEl.querySelector('.range-amp') as HTMLInputElement;
      const valAmp = itemEl.querySelector('.val-amp') as HTMLElement;
      rangeAmp?.addEventListener('input', () => {
        const amp = parseFloat(rangeAmp.value);
        valAmp.textContent = `${Math.round(amp)}`;
        this.model.updateCircle(index, { amplitude: amp });
      });

      // Fréquence
      const numFreq = itemEl.querySelector('.num-freq') as HTMLInputElement;
      numFreq?.addEventListener('change', () => {
        const freq = parseInt(numFreq.value, 10) || 0;
        this.model.updateCircle(index, { freq });
      });

      // Toggle Sens
      const btnDir = itemEl.querySelector('.btn-toggle-dir') as HTMLButtonElement;
      btnDir?.addEventListener('click', () => {
        const currentTerm = this.model.getTerms()[index];
        const nextDir = currentTerm.direction === 'cw' ? 'ccw' : 'cw';
        this.model.updateCircle(index, { direction: nextDir });
      });

      // Phase
      const rangePhase = itemEl.querySelector('.range-phase') as HTMLInputElement;
      const valPhase = itemEl.querySelector('.val-phase') as HTMLElement;
      rangePhase?.addEventListener('input', () => {
        const deg = parseFloat(rangePhase.value);
        valPhase.textContent = `${Math.round(deg)}°`;
        const rad = (deg * Math.PI) / 180;
        this.model.updateCircle(index, { phase: rad });
      });

      // Couleur
      const colorPicker = itemEl.querySelector('.color-picker') as HTMLInputElement;
      colorPicker?.addEventListener('input', () => {
        this.model.updateCircle(index, { color: colorPicker.value });
      });

      // Monter / Descendre
      itemEl.querySelector('.btn-move-up')?.addEventListener('click', () => {
        this.model.moveCircle(index, index - 1);
      });
      itemEl.querySelector('.btn-move-down')?.addEventListener('click', () => {
        this.model.moveCircle(index, index + 1);
      });

      // Dupliquer
      itemEl.querySelector('.btn-dup')?.addEventListener('click', () => {
        this.model.duplicateCircle(index);
      });

      // Supprimer
      itemEl.querySelector('.btn-del')?.addEventListener('click', () => {
        this.model.removeCircle(index);
      });
    });
  }
}
