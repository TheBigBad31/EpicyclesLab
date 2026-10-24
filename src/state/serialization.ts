import { EpicycleTerm, Point2D, GibbsWindowType, CircleSortOrder } from '../math/types';

export interface EpicyclesLabProjectState {
  version: number;
  mode: 'workshop' | 'inverse';
  title?: string;
  createdAt: string;
  terms: EpicycleTerm[];
  maxCircles?: number;
  inverseConfig?: {
    numSamples: number;
    closed: boolean;
    smoothRadius: number;
    gibbsWindow: GibbsWindowType;
    sortOrder: CircleSortOrder;
    activeCircles: number;
    targetPoints?: Point2D[];
    presetId?: string;
  };
  renderConfig?: {
    showCircles: boolean;
    showVectors: boolean;
    showTrail: boolean;
    showTargetCurve: boolean;
    speedMultiplier: number;
    theme: 'dark' | 'light';
  };
}

/**
 * Sérialisation d'un projet en chaîne JSON formatée
 */
export function serializeToJson(state: EpicyclesLabProjectState): string {
  return JSON.stringify(state, null, 2);
}

/**
 * Désérialisation d'un projet depuis un flux JSON avec validation des champs requis
 */
export function deserializeFromJson(jsonStr: string): EpicyclesLabProjectState {
  const data = JSON.parse(jsonStr) as Partial<EpicyclesLabProjectState>;

  if (!data || typeof data !== 'object') {
    throw new Error('Données JSON invalides : objet attendu');
  }

  if (!Array.isArray(data.terms)) {
    throw new Error('Propriété "terms" manquante ou invalide dans le JSON');
  }

  return {
    version: data.version || 1,
    mode: data.mode === 'inverse' ? 'inverse' : 'workshop',
    title: data.title || 'Création Épicycles',
    createdAt: data.createdAt || new Date().toISOString(),
    terms: data.terms.map(t => ({
      freq: Number(t.freq) || 0,
      amplitude: Number(t.amplitude) || 0,
      phase: Number(t.phase) || 0,
      re: Number(t.re) || 0,
      im: Number(t.im) || 0,
      direction: t.direction === 'cw' ? 'cw' : 'ccw',
      color: t.color,
    })),
    maxCircles: typeof data.maxCircles === 'number' ? data.maxCircles : undefined,
    inverseConfig: data.inverseConfig,
    renderConfig: data.renderConfig,
  };
}

/**
 * Encode une configuration complète d'épicycles en chaîne Base64URL compacte
 * pour partage sécurisé et direct dans un hash d'URL (#config=...)
 */
export function encodeConfigToUrlHash(state: EpicyclesLabProjectState): string {
  // Version allégée pour minimiser la taille de l'URL
  const compactPayload = {
    v: state.version || 1,
    m: state.mode,
    t: state.terms.map(term => [
      term.freq,
      parseFloat(term.amplitude.toFixed(3)),
      parseFloat(term.phase.toFixed(3)),
      term.direction === 'cw' ? 1 : 0,
    ]),
    mc: state.maxCircles,
    ic: state.inverseConfig ? {
      n: state.inverseConfig.numSamples,
      c: state.inverseConfig.closed ? 1 : 0,
      s: state.inverseConfig.smoothRadius,
      g: state.inverseConfig.gibbsWindow,
      ac: state.inverseConfig.activeCircles,
      p: state.inverseConfig.presetId,
    } : undefined,
  };

  const jsonStr = JSON.stringify(compactPayload);
  const base64 = typeof window !== 'undefined' && typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(jsonStr)))
    : Buffer.from(jsonStr, 'utf-8').toString('base64');

  // Remplacement Base64URL standard (+ -> -, / -> _, = éliminé)
  const base64Url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `#config=${base64Url}`;
}

/**
 * Décode une chaîne Base64URL issue du hash d'URL pour restaurer l'état
 */
export function decodeConfigFromUrlHash(hashString: string): Partial<EpicyclesLabProjectState> | null {
  if (!hashString) return null;

  const match = /[#&]config=([A-Za-z0-9_-]+)/.exec(hashString);
  if (!match || !match[1]) return null;

  try {
    let base64 = match[1].replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }

    const jsonStr = typeof window !== 'undefined' && typeof atob === 'function'
      ? decodeURIComponent(escape(atob(base64)))
      : Buffer.from(base64, 'base64').toString('utf-8');

    const raw = JSON.parse(jsonStr);

    if (raw && Array.isArray(raw.t)) {
      const terms: EpicycleTerm[] = raw.t.map((item: number[]) => {
        const [freq, amplitude, phase, dirCode] = item;
        const re = amplitude * Math.cos(phase);
        const im = amplitude * Math.sin(phase);
        return {
          freq,
          amplitude,
          phase,
          re,
          im,
          direction: dirCode === 1 ? 'cw' : 'ccw',
        };
      });

      return {
        version: raw.v || 1,
        mode: raw.m || 'workshop',
        terms,
        maxCircles: raw.mc,
        inverseConfig: raw.ic ? {
          numSamples: raw.ic.n || 256,
          closed: raw.ic.c === 1,
          smoothRadius: raw.ic.s || 0,
          gibbsWindow: raw.ic.g || 'none',
          sortOrder: 'amplitude-desc',
          activeCircles: raw.ic.ac || terms.length,
          presetId: raw.ic.p,
        } : undefined,
      };
    }
  } catch (e) {
    console.warn('Erreur lors du décodage du hash de partage :', e);
  }

  return null;
}
