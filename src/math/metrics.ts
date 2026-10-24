import { Point2D, EpicycleTerm, SpectralMetrics } from './types';
import { getBoundingBox } from './resampling';
import { reconstructPath } from './fourier';

/**
 * Calcule les métriques d'approximation spectrale et d'erreur spatiale :
 * - Énergie totale spectrale (Théorème de Parseval) : sum |X_k|^2
 * - Énergie capturée par les M premiers cercles : sum_{k=1}^M |X_k|^2
 * - Erreur quadratique moyenne (RMSE) entre la courbe originale et reconstruite
 * - Erreur relative par rapport à la diagonale de la figure (%)
 */
export function computeMetrics(
  originalPoints: Point2D[],
  terms: EpicycleTerm[],
  numCircles?: number
): SpectralMetrics {
  const N = terms.length;
  const M = numCircles !== undefined ? Math.min(Math.max(0, numCircles), N) : N;

  // 1. Énergie spectrale (Parseval)
  let totalEnergy = 0;
  for (let i = 0; i < N; i++) {
    totalEnergy += terms[i].amplitude * terms[i].amplitude;
  }

  let capturedEnergy = 0;
  for (let i = 0; i < M; i++) {
    capturedEnergy += terms[i].amplitude * terms[i].amplitude;
  }

  const energyRatio = totalEnergy > 0 ? Math.min(1.0, capturedEnergy / totalEnergy) : 1.0;

  // 2. Erreur spatiale RMSE
  const sampleCount = originalPoints.length;
  let rmse = 0;
  let relativeRmse = 0;

  if (sampleCount > 0) {
    const reconstructed = reconstructPath(terms, sampleCount, M);
    let sumSqDist = 0;

    for (let i = 0; i < sampleCount; i++) {
      const pOrig = originalPoints[i];
      const pReco = reconstructed[i];
      const dx = pOrig.x - pReco.x;
      const dy = pOrig.y - pReco.y;
      sumSqDist += dx * dx + dy * dy;
    }

    rmse = Math.sqrt(sumSqDist / sampleCount);

    const bbox = getBoundingBox(originalPoints);
    const scaleRef = bbox.diagonal > 0 ? bbox.diagonal : 1.0;
    relativeRmse = (rmse / scaleRef) * 100; // En pourcentage
  }

  return {
    totalEnergy,
    capturedEnergy,
    energyRatio,
    rmse,
    relativeRmse,
    numCircles: M,
    totalCircles: N,
  };
}

/**
 * Vérifie l'identité de Parseval entre le domaine temporel/spatial et fréquentiel :
 * (1/N) * sum_{n=0}^{N-1} |z_n|^2 == sum_k |X_k|^2
 */
export function verifyParsevalIdentity(points: Point2D[], terms: EpicycleTerm[]): {
  timeEnergy: number;
  freqEnergy: number;
  diff: number;
  ratio: number;
} {
  const N = points.length;
  if (N === 0) return { timeEnergy: 0, freqEnergy: 0, diff: 0, ratio: 1 };

  let timeEnergy = 0;
  for (let i = 0; i < N; i++) {
    timeEnergy += points[i].x * points[i].x + points[i].y * points[i].y;
  }
  timeEnergy /= N;

  let freqEnergy = 0;
  for (let i = 0; i < terms.length; i++) {
    freqEnergy += terms[i].amplitude * terms[i].amplitude;
  }

  const diff = Math.abs(timeEnergy - freqEnergy);
  const ratio = freqEnergy > 0 ? timeEnergy / freqEnergy : 1;

  return {
    timeEnergy,
    freqEnergy,
    diff,
    ratio,
  };
}
