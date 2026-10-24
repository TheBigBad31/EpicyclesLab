import { Point2D } from './types';

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  diagonal: number;
}

/**
 * Calcule le rectangle englobant (bounding box) d'un nuage de points.
 */
export function getBoundingBox(points: Point2D[]): BoundingBox {
  if (points.length === 0) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 0,
      height: 0,
      centerX: 0,
      centerY: 0,
      diagonal: 0,
    };
  }

  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;

  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const diagonal = Math.hypot(width, height);

  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    centerX,
    centerY,
    diagonal,
  };
}

/**
 * Normalise et centre un ensemble de points dans une plage donnée (ex: [-1, 1] ou dimension d'écran).
 * Préserve le ratio d'aspect (isotropic scaling).
 */
export function normalizePoints(
  points: Point2D[],
  options: {
    targetWidth?: number;
    targetHeight?: number;
    centerX?: number;
    centerY?: number;
    fitScale?: number; // Ex: 0.9 pour garder 10% de marge
  } = {}
): Point2D[] {
  if (points.length === 0) return [];

  const {
    targetWidth = 2,
    targetHeight = 2,
    centerX = 0,
    centerY = 0,
    fitScale = 1.0,
  } = options;

  const bbox = getBoundingBox(points);
  if (bbox.width === 0 && bbox.height === 0) {
    return points.map(() => ({ x: centerX, y: centerY }));
  }

  const scaleX = bbox.width > 0 ? targetWidth / bbox.width : 1;
  const scaleY = bbox.height > 0 ? targetHeight / bbox.height : 1;
  const scale = Math.min(scaleX, scaleY) * fitScale;

  return points.map(p => ({
    x: (p.x - bbox.centerX) * scale + centerX,
    y: (p.y - bbox.centerY) * scale + centerY,
  }));
}

/**
 * Calcule la longueur totale d'une polyline (et la distance cumulée de chaque sommet).
 */
export function computeCumulativeDistances(points: Point2D[], closed: boolean): { totalLength: number; dists: number[] } {
  const n = points.length;
  if (n === 0) return { totalLength: 0, dists: [] };
  if (n === 1) return { totalLength: 0, dists: [0] };

  const dists: number[] = [0];
  let totalLength = 0;

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    totalLength += Math.hypot(dx, dy);
    dists.push(totalLength);
  }

  if (closed) {
    const dx = points[0].x - points[n - 1].x;
    const dy = points[0].y - points[n - 1].y;
    totalLength += Math.hypot(dx, dy);
    // Le point de fermeture virtuelle dists[n] = totalLength
  }

  return { totalLength, dists };
}

/**
 * Rééchantillonnage paramétrique par abscisse curviligne uniforme.
 * Élimine les distorsions temporelles et vitesses de tracé irrégulières.
 * Si closed est true (par défaut), la courbe forme une boucle fermée.
 * Si closed est false, on applique une fermeture douce par interpolation miroir (aller-retour).
 */
export function resampleByArcLength(
  inputPoints: Point2D[],
  targetCount: number,
  closed: boolean = true
): Point2D[] {
  if (inputPoints.length <= 1 || targetCount <= 0) return [...inputPoints];

  // Si non fermé, on crée un aller-retour symétrique pour éviter la discontinuité de saut de bord
  let points = inputPoints;
  if (!closed) {
    const reverse = [...inputPoints.slice(1, -1)].reverse();
    points = [...inputPoints, ...reverse];
  }

  const { totalLength, dists } = computeCumulativeDistances(points, true);

  if (totalLength === 0) {
    return Array.from({ length: targetCount }, () => ({ ...points[0] }));
  }

  const resampled: Point2D[] = [];
  const step = totalLength / targetCount;
  let currentIndex = 0;
  const n = points.length;

  for (let i = 0; i < targetCount; i++) {
    const targetDist = i * step;

    // Trouver le segment contenant targetDist
    while (
      currentIndex < n - 1 &&
      dists[currentIndex + 1] < targetDist
    ) {
      currentIndex++;
    }

    if (currentIndex >= n - 1) {
      // Dernier segment vers le point initial points[0]
      const segStartDist = dists[n - 1];
      const segLen = totalLength - segStartDist;
      const t = segLen > 0 ? (targetDist - segStartDist) / segLen : 0;
      const p1 = points[n - 1];
      const p2 = points[0];
      resampled.push({
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
      });
    } else {
      const segStartDist = dists[currentIndex];
      const segEndDist = dists[currentIndex + 1];
      const segLen = segEndDist - segStartDist;
      const t = segLen > 0 ? (targetDist - segStartDist) / segLen : 0;
      const p1 = points[currentIndex];
      const p2 = points[currentIndex + 1];
      resampled.push({
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
      });
    }
  }

  return resampled;
}

/**
 * Lissage spatial pré-FFT par filtre gaussien ou moyenne mobile circulaire.
 * windowRadius: rayon en nombre de points (ex: 2 ou 3)
 */
export function smoothPoints(points: Point2D[], windowRadius: number = 2): Point2D[] {
  const n = points.length;
  if (n <= 2 || windowRadius <= 0) return [...points];

  const smoothed: Point2D[] = [];
  const sigma = windowRadius / 2;
  const weights: number[] = [];
  let weightSum = 0;

  for (let r = -windowRadius; r <= windowRadius; r++) {
    const w = Math.exp(-(r * r) / (2 * sigma * sigma));
    weights.push(w);
    weightSum += w;
  }

  for (let i = 0; i < n; i++) {
    let sumX = 0;
    let sumY = 0;

    for (let r = -windowRadius; r <= windowRadius; r++) {
      const w = weights[r + windowRadius];
      // Index circulaire périodique
      const idx = (i + r + n * windowRadius) % n;
      sumX += points[idx].x * w;
      sumY += points[idx].y * w;
    }

    smoothed.push({
      x: sumX / weightSum,
      y: sumY / weightSum,
    });
  }

  return smoothed;
}
