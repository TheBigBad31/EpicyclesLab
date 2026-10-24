import { EpicycleTerm, sortEpicycles, CircleSortOrder } from '../math';

export interface WorkshopPreset {
  id: string;
  name: string;
  description: string;
  terms: EpicycleTerm[];
}

export class WorkshopModel {
  public terms: EpicycleTerm[] = [];
  private listeners: Array<() => void> = [];

  constructor(initialTerms: EpicycleTerm[] = []) {
    this.terms = initialTerms.length > 0 ? [...initialTerms] : this.createDefaultChain();
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getTerms(): readonly EpicycleTerm[] {
    return this.terms;
  }

  public setTerms(newTerms: EpicycleTerm[]): void {
    this.terms = [...newTerms];
    this.notify();
  }

  public addCircle(term?: Partial<EpicycleTerm>): void {
    const nextFreq = this.terms.length > 0 ? this.terms.length : 1;
    const newTerm: EpicycleTerm = {
      freq: term?.freq ?? nextFreq,
      amplitude: term?.amplitude ?? 50,
      phase: term?.phase ?? 0,
      re: 0,
      im: 0,
      direction: (term?.freq ?? nextFreq) < 0 ? 'cw' : 'ccw',
      color: term?.color,
    };
    newTerm.re = newTerm.amplitude * Math.cos(newTerm.phase);
    newTerm.im = newTerm.amplitude * Math.sin(newTerm.phase);

    this.terms.push(newTerm);
    this.notify();
  }

  public removeCircle(index: number): void {
    if (index >= 0 && index < this.terms.length) {
      this.terms.splice(index, 1);
      this.notify();
    }
  }

  public duplicateCircle(index: number): void {
    if (index >= 0 && index < this.terms.length) {
      const src = this.terms[index];
      const dup: EpicycleTerm = {
        ...src,
        freq: src.freq !== 0 ? -src.freq : 1, // Inverse la fréquence par défaut pour créer un motif intéressant
        direction: (src.freq !== 0 ? -src.freq : 1) < 0 ? 'cw' : 'ccw',
      };
      this.terms.splice(index + 1, 0, dup);
      this.notify();
    }
  }

  public updateCircle(index: number, updates: Partial<EpicycleTerm>): void {
    if (index >= 0 && index < this.terms.length) {
      const term = this.terms[index];

      if (updates.amplitude !== undefined) term.amplitude = Math.max(0, updates.amplitude);
      if (updates.freq !== undefined) {
        term.freq = updates.freq;
        term.direction = updates.freq < 0 ? 'cw' : 'ccw';
      }
      if (updates.phase !== undefined) term.phase = updates.phase;
      if (updates.direction !== undefined) {
        term.direction = updates.direction;
        if (updates.direction === 'cw' && term.freq > 0) term.freq = -term.freq;
        if (updates.direction === 'ccw' && term.freq < 0) term.freq = Math.abs(term.freq);
      }
      if (updates.color !== undefined) term.color = updates.color;

      term.re = term.amplitude * Math.cos(term.phase);
      term.im = term.amplitude * Math.sin(term.phase);

      this.notify();
    }
  }

  public moveCircle(fromIndex: number, toIndex: number): void {
    if (fromIndex < 0 || fromIndex >= this.terms.length) return;
    if (toIndex < 0 || toIndex >= this.terms.length) return;
    if (fromIndex === toIndex) return;

    const [item] = this.terms.splice(fromIndex, 1);
    this.terms.splice(toIndex, 0, item);
    this.notify();
  }

  public sort(order: CircleSortOrder): void {
    this.terms = sortEpicycles(this.terms, order);
    this.notify();
  }

  public clearAll(): void {
    this.terms = [];
    this.notify();
  }

  public createDefaultChain(): EpicycleTerm[] {
    return [
      { freq: 1, amplitude: 140, phase: 0, re: 140, im: 0, direction: 'ccw', color: '#38bdf8' },
      { freq: -2, amplitude: 70, phase: 0, re: 70, im: 0, direction: 'cw', color: '#818cf8' },
      { freq: 3, amplitude: 35, phase: 0, re: 35, im: 0, direction: 'ccw', color: '#c084fc' },
      { freq: -4, amplitude: 18, phase: 0, re: 18, im: 0, direction: 'cw', color: '#f472b6' },
    ];
  }

  public static getWorkshopPresets(): WorkshopPreset[] {
    return [
      {
        id: 'planetary',
        name: '🪐 Orbite Planétaire',
        description: 'Épicycles képlériens avec résonance harmonique 1:2:4',
        terms: [
          { freq: 1, amplitude: 150, phase: 0, re: 150, im: 0, direction: 'ccw', color: '#38bdf8' },
          { freq: 2, amplitude: 60, phase: Math.PI / 4, re: 60 * Math.SQRT1_2, im: 60 * Math.SQRT1_2, direction: 'ccw', color: '#facc15' },
          { freq: 4, amplitude: 25, phase: 0, re: 25, im: 0, direction: 'ccw', color: '#fb923c' },
        ],
      },
      {
        id: 'spiral-harmonic',
        name: '🌀 Spirale Harmonique',
        description: 'Fréquences opposées créant une rosace à pétales multiples',
        terms: [
          { freq: 1, amplitude: 130, phase: 0, re: 130, im: 0, direction: 'ccw', color: '#38bdf8' },
          { freq: -5, amplitude: 55, phase: 0, re: 55, im: 0, direction: 'cw', color: '#a855f7' },
          { freq: 7, amplitude: 30, phase: 0, re: 30, im: 0, direction: 'ccw', color: '#ec4899' },
          { freq: -11, amplitude: 15, phase: 0, re: 15, im: 0, direction: 'cw', color: '#06b6d4' },
        ],
      },
      {
        id: 'fourier-square',
        name: '⏹️ Carré de Fourier (5 harmoniques)',
        description: 'Synthèse additive des harmoniques impaires 1, 3, 5, 7, 9',
        terms: [
          { freq: 1, amplitude: 140, phase: 0, re: 140, im: 0, direction: 'ccw', color: '#60a5fa' },
          { freq: -3, amplitude: 140 / 3, phase: 0, re: 140 / 3, im: 0, direction: 'cw', color: '#34d399' },
          { freq: 5, amplitude: 140 / 5, phase: 0, re: 140 / 5, im: 0, direction: 'ccw', color: '#f59e0b' },
          { freq: -7, amplitude: 140 / 7, phase: 0, re: 140 / 7, im: 0, direction: 'cw', color: '#ef4444' },
          { freq: 9, amplitude: 140 / 9, phase: 0, re: 140 / 9, im: 0, direction: 'ccw', color: '#ec4899' },
        ],
      },
      {
        id: 'mechanical-star',
        name: '⭐ Étoile Mécanique',
        description: 'Hypotrochoïde fermée formant une étoile à 5 pointes brillantes',
        terms: [
          { freq: 1, amplitude: 140, phase: 0, re: 140, im: 0, direction: 'ccw', color: '#38bdf8' },
          { freq: -4, amplitude: 70, phase: 0, re: 70, im: 0, direction: 'cw', color: '#e879f9' },
          { freq: 6, amplitude: 25, phase: Math.PI / 2, re: 0, im: 25, direction: 'ccw', color: '#fbbf24' },
        ],
      },
    ];
  }
}
