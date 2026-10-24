import { Point2D, EpicycleTerm } from '../math/types';
import { resampleByArcLength, smoothPoints, normalizePoints } from '../math/resampling';
import { computeFourierTransform, applyGibbsDamping, sortEpicycles } from '../math/fourier';
import { computeMetrics } from '../math/metrics';

export interface WorkerComputeRequest {
  id: string;
  points: Point2D[];
  numSamples: number;
  closed?: boolean;
  smoothRadius?: number;
  gibbsWindow?: 'none' | 'lanczos' | 'fejer';
  sortOrder?: 'amplitude-desc' | 'frequency-asc' | 'natural';
  fitScale?: number;
}

export interface WorkerComputeResponse {
  id: string;
  terms: EpicycleTerm[];
  resampledPoints: Point2D[];
  metrics: {
    totalEnergy: number;
    capturedEnergy: number;
    energyRatio: number;
    rmse: number;
    relativeRmse: number;
    numCircles: number;
    totalCircles: number;
  };
  durationMs: number;
}

// Fonction pure exécutant le pipeline complet (utilisable directement ou dans le worker)
export function processInverseFourier(request: WorkerComputeRequest): WorkerComputeResponse {
  const startTime = performance.now();

  const numSamples = request.numSamples || 256;
  const closed = request.closed !== false;
  const smoothRadius = request.smoothRadius || 0;
  const gibbsWindow = request.gibbsWindow || 'none';
  const sortOrder = request.sortOrder || 'amplitude-desc';
  const fitScale = request.fitScale || 1.0;

  // 1. Rééchantillonnage par abscisse curviligne uniforme
  let resampled = resampleByArcLength(request.points, numSamples, closed);

  // 2. Lissage optionnel
  if (smoothRadius > 0) {
    resampled = smoothPoints(resampled, smoothRadius);
  }

  // 3. Normalisation centrée si besoin de cadrage homogène
  if (fitScale > 0) {
    resampled = normalizePoints(resampled, {
      targetWidth: 280 * fitScale,
      targetHeight: 280 * fitScale,
      centerX: 0,
      centerY: 0,
      fitScale: 1.0,
    });
  }

  // 4. DFT / FFT
  let terms = computeFourierTransform(resampled);

  // 5. Fenêtrage Gibbs optionnel
  if (gibbsWindow !== 'none') {
    terms = applyGibbsDamping(terms, gibbsWindow);
  }

  // 6. Tri des cercles (ex: amplitude décroissante par défaut)
  if (sortOrder !== 'natural') {
    terms = sortEpicycles(terms, sortOrder);
  }

  // 7. Calcul des métriques globales
  const metrics = computeMetrics(resampled, terms);

  const durationMs = performance.now() - startTime;

  return {
    id: request.id,
    terms,
    resampledPoints: resampled,
    metrics,
    durationMs,
  };
}

// Listener de message pour le Web Worker
if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function' && typeof window === 'undefined') {
  self.addEventListener('message', (e: MessageEvent<WorkerComputeRequest>) => {
    try {
      const response = processInverseFourier(e.data);
      self.postMessage(response);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      self.postMessage({ id: e.data?.id, error: errorMessage });
    }
  });
}
