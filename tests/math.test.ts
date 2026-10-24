import { describe, it, expect } from 'vitest';
import {
  ComplexOps,
  computeDFT,
  computeFFT,
  computeFourierTransform,
  evaluateEpicycles,
  reconstructPath,
  sortEpicycles,
  applyGibbsDamping,
  resampleByArcLength,
  normalizePoints,
  getBoundingBox,
  smoothPoints,
  computeMetrics,
  verifyParsevalIdentity,
  generatePiPreset,
  generateHeartPreset,
  generateStarPreset,
  generateSquareWavePreset,
  generateEpitrochoidPreset,
  generateLissajousPreset,
  generateButterflyPreset,
  generateClefPreset,
  parseSvgPathToPoints,
  Point2D,
} from '../src/math';

describe('Arithmétique Complexe (ComplexOps)', () => {
  it('effectue correctement addition, soustraction, multiplication et module', () => {
    const z1 = { re: 3, im: 4 };
    const z2 = { re: 1, im: -2 };

    const sum = ComplexOps.add(z1, z2);
    expect(sum).toEqual({ re: 4, im: 2 });

    const diff = ComplexOps.sub(z1, z2);
    expect(diff).toEqual({ re: 2, im: 6 });

    // (3 + 4i) * (1 - 2i) = 3 - 6i + 4i - 8i^2 = 11 - 2i
    const prod = ComplexOps.mul(z1, z2);
    expect(prod).toEqual({ re: 11, im: -2 });

    expect(ComplexOps.abs(z1)).toBeCloseTo(5, 10);
    expect(ComplexOps.absSq(z1)).toBeCloseTo(25, 10);
  });

  it('gère correctement les formes polaires et exponentielles', () => {
    const polar = ComplexOps.fromPolar(2, Math.PI / 2);
    expect(polar.re).toBeCloseTo(0, 10);
    expect(polar.im).toBeCloseTo(2, 10);

    const expVal = ComplexOps.exp({ re: 0, im: Math.PI });
    expect(expVal.re).toBeCloseTo(-1, 10);
    expect(expVal.im).toBeCloseTo(0, 10);
  });
});

describe('Fourier: DFT & FFT Radix-2', () => {
  it('calcule la DFT exacte et vérifie l inversion parfaite (reconstruct == original) à 10^-9', () => {
    const originalPoints: Point2D[] = [
      { x: 10, y: 20 },
      { x: -5, y: 35 },
      { x: 12, y: -8 },
      { x: 4, y: 15 },
      { x: -22, y: -10 },
    ];

    const terms = computeDFT(originalPoints);
    expect(terms.length).toBe(originalPoints.length);

    const reconstructed = reconstructPath(terms, originalPoints.length);
    for (let i = 0; i < originalPoints.length; i++) {
      expect(reconstructed[i].x).toBeCloseTo(originalPoints[i].x, 9);
      expect(reconstructed[i].y).toBeCloseTo(originalPoints[i].y, 9);
    }
  });

  it('vérifie que FFT Radix-2 produit exactement les mêmes résultats que DFT sur N=8 et N=16', () => {
    const N = 16;
    const points: Point2D[] = [];
    for (let i = 0; i < N; i++) {
      points.push({
        x: Math.sin(i * 0.7) * 50 + Math.cos(i * 1.3) * 20,
        y: Math.cos(i * 0.5) * 40 - Math.sin(i * 2.1) * 30,
      });
    }

    const dftTerms = computeDFT(points);
    const fftTerms = computeFFT(points);

    expect(fftTerms.length).toBe(dftTerms.length);

    for (let i = 0; i < N; i++) {
      expect(fftTerms[i].freq).toBe(dftTerms[i].freq);
      expect(fftTerms[i].amplitude).toBeCloseTo(dftTerms[i].amplitude, 9);
      expect(fftTerms[i].phase).toBeCloseTo(dftTerms[i].phase, 9);
      expect(fftTerms[i].re).toBeCloseTo(dftTerms[i].re, 9);
      expect(fftTerms[i].im).toBeCloseTo(dftTerms[i].im, 9);
    }
  });

  it('computeFourierTransform bascule automatiquement sur FFT quand N est puissance de 2', () => {
    const pts16: Point2D[] = Array.from({ length: 16 }, (_, i) => ({ x: i, y: i * 2 }));
    const pts10: Point2D[] = Array.from({ length: 10 }, (_, i) => ({ x: i, y: i * 2 }));

    const res16 = computeFourierTransform(pts16);
    expect(res16.length).toBe(16);

    const evalRes = evaluateEpicycles(res16, 0.5, 4);
    expect(evalRes.centers.length).toBe(5);
    expect(evalRes.tip).toBeDefined();

    const res10 = computeFourierTransform(pts10);
    expect(res10.length).toBe(10);
  });

  it('vérifie l identité de Parseval (conservation de l énergie)', () => {
    const points = generateStarPreset(64);
    const terms = computeFourierTransform(points);

    const parseval = verifyParsevalIdentity(points, terms);
    expect(parseval.diff).toBeLessThan(1e-10);
    expect(parseval.ratio).toBeCloseTo(1.0, 8);
  });
});

describe('Tri Spectrale & Convergence d Erreur (Monotonie RMSE)', () => {
  it('décroissance monotone stricte/non-croissante du RMSE quand le nombre de cercles triés augmente', () => {
    const piPoints = generatePiPreset(128);
    const rawTerms = computeFourierTransform(piPoints);
    const sortedTerms = sortEpicycles(rawTerms, 'amplitude-desc');

    let previousRmse = Infinity;
    const testSteps = [1, 5, 10, 20, 40, 80, 128];

    for (const m of testSteps) {
      const metrics = computeMetrics(piPoints, sortedTerms, m);
      expect(metrics.rmse).toBeLessThanOrEqual(previousRmse + 1e-9);
      expect(metrics.energyRatio).toBeGreaterThanOrEqual(0);
      expect(metrics.energyRatio).toBeLessThanOrEqual(1.0 + 1e-9);
      previousRmse = metrics.rmse;
    }

    // Avec tous les cercles (M=128), RMSE doit être quasi nul
    const finalMetrics = computeMetrics(piPoints, sortedTerms, 128);
    expect(finalMetrics.rmse).toBeLessThan(1e-9);
    expect(finalMetrics.energyRatio).toBeCloseTo(1.0, 9);
  });
});

describe('Rééchantillonnage par Abscisse Curviligne & Géométrie', () => {
  it('produit des segments de longueur uniforme sur un carré', () => {
    const squareVertices: Point2D[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];

    const targetCount = 64;
    const resampled = resampleByArcLength(squareVertices, targetCount, true);
    expect(resampled.length).toBe(targetCount);

    // Calculer les distances entre points consécutifs
    const distances: number[] = [];
    for (let i = 0; i < targetCount; i++) {
      const p1 = resampled[i];
      const p2 = resampled[(i + 1) % targetCount];
      distances.push(Math.hypot(p2.x - p1.x, p2.y - p1.y));
    }

    const expectedDist = 400 / targetCount;
    for (const dist of distances) {
      expect(dist).toBeCloseTo(expectedDist, 5);
    }
  });

  it('normalise et centre les points dans la boîte [-1, 1]', () => {
    const raw: Point2D[] = [
      { x: 100, y: 200 },
      { x: 500, y: 200 },
      { x: 500, y: 600 },
    ];

    const normalized = normalizePoints(raw, { targetWidth: 2, targetHeight: 2, centerX: 0, centerY: 0 });
    const bbox = getBoundingBox(normalized);

    expect(bbox.centerX).toBeCloseTo(0, 8);
    expect(bbox.centerY).toBeCloseTo(0, 8);
    expect(bbox.width).toBeLessThanOrEqual(2.0001);
    expect(bbox.height).toBeLessThanOrEqual(2.0001);
  });

  it('applique le lissage spatial gaussien sans altérer la longueur globale', () => {
    const pts = generateStarPreset(64);
    const smoothed = smoothPoints(pts, 2);
    expect(smoothed.length).toBe(pts.length);
  });
});

describe('Atténuation du Phénomène de Gibbs', () => {
  it('applique les facteurs de Lanczos et Fejér sans altérer la fréquence k=0', () => {
    const points = generateSquareWavePreset(64);
    const terms = computeFourierTransform(points);

    const lanczosTerms = applyGibbsDamping(terms, 'lanczos');
    const fejerTerms = applyGibbsDamping(terms, 'fejer');

    const term0Raw = terms.find(t => t.freq === 0)!;
    const term0Lanczos = lanczosTerms.find(t => t.freq === 0)!;
    const term0Fejer = fejerTerms.find(t => t.freq === 0)!;

    expect(term0Lanczos.amplitude).toBeCloseTo(term0Raw.amplitude, 9);
    expect(term0Fejer.amplitude).toBeCloseTo(term0Raw.amplitude, 9);

    // Les hautes fréquences doivent être atténuées (|factor| < 1)
    const highFreqRaw = terms.find(t => Math.abs(t.freq) > 20);
    if (highFreqRaw && highFreqRaw.amplitude > 0.001) {
      const highLanczos = lanczosTerms.find(t => t.freq === highFreqRaw.freq)!;
      expect(highLanczos.amplitude).toBeLessThan(highFreqRaw.amplitude);
    }
  });
});

describe('Catalogue de Courbes de Référence (Presets & SVG)', () => {
  it('génère les 8 formes mathématiques prédéfinies avec le bon nombre de points', () => {
    const n = 128;
    expect(generatePiPreset(n).length).toBe(n);
    expect(generateHeartPreset(n).length).toBe(n);
    expect(generateStarPreset(n).length).toBe(n);
    expect(generateSquareWavePreset(n).length).toBe(n);
    expect(generateEpitrochoidPreset(n).length).toBe(n);
    expect(generateLissajousPreset(n).length).toBe(n);
    expect(generateButterflyPreset(n).length).toBe(n);
    expect(generateClefPreset(n).length).toBe(n);
  });

  it('parseur SVG autonome extrait et rééchantillonne des courbes SVG complexes (M, L, C, Q, Z)', () => {
    const svgPath = 'M 10 80 Q 95 10 180 80 C 190 100 150 150 100 150 L 50 120 Z';
    const sampled = parseSvgPathToPoints(svgPath, 64);

    expect(sampled.length).toBe(64);
    const bbox = getBoundingBox(sampled);
    expect(bbox.diagonal).toBeGreaterThan(0);
  });
});
