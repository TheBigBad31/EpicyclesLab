import { Complex, Point2D, EpicycleTerm, EpicycleEvaluation, CircleSortOrder, GibbsWindowType } from './types';
import { ComplexOps } from './complex';

/**
 * Calcul exact de la Transformée de Fourier Discrète (DFT).
 * Pour N points complexes z_n, calcule les coefficients :
 * X_k = (1/N) * sum_{n=0}^{N-1} z_n * exp(-i * 2 * pi * k * n / N)
 * pour k in [-floor(N/2), ceil(N/2) - 1].
 */
export function computeDFT(points: (Complex | Point2D)[]): EpicycleTerm[] {
  const N = points.length;
  if (N === 0) return [];

  const complexPoints: Complex[] = points.map(p => 're' in p ? p : ComplexOps.fromPoint(p));
  const terms: EpicycleTerm[] = [];

  const minK = -Math.floor(N / 2);
  const maxK = Math.ceil(N / 2) - 1;

  for (let k = minK; k <= maxK; k++) {
    let sumRe = 0;
    let sumIm = 0;

    for (let n = 0; n < N; n++) {
      const phi = (-2 * Math.PI * k * n) / N;
      const cosPhi = Math.cos(phi);
      const sinPhi = Math.sin(phi);
      const zn = complexPoints[n];

      // zn * exp(i*phi) = (zn.re + i*zn.im) * (cos + i*sin)
      sumRe += zn.re * cosPhi - zn.im * sinPhi;
      sumIm += zn.re * sinPhi + zn.im * cosPhi;
    }

    const re = sumRe / N;
    const im = sumIm / N;
    const amplitude = Math.hypot(re, im);
    const phase = Math.atan2(im, re);
    const direction = k < 0 ? 'cw' : 'ccw';

    terms.push({
      freq: k,
      amplitude,
      phase,
      re,
      im,
      direction,
    });
  }

  return terms;
}

/**
 * Vérifie si N est une puissance de 2 (N = 2^p).
 */
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * FFT Cooley-Tukey Radix-2 standard (in-place ou out-of-place).
 * Calcule Y_m = sum_{n=0}^{N-1} z_n * exp(-i * 2 * pi * m * n / N) pour m in [0, N-1].
 * Inverse sign = 1 pour IFFT, -1 pour FFT.
 */
function cooleyTukeyRadix2(input: Complex[], invert: boolean = false): Complex[] {
  const n = input.length;
  if (n <= 1) return [...input];

  if (!isPowerOfTwo(n)) {
    throw new Error(`Cooley-Tukey Radix-2 requiert une taille de tableau puissance de 2 (reçu N=${n})`);
  }

  // Bit reversal permutation
  const output: Complex[] = new Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    output[i] = { ...input[j] };
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
  }

  // Cooley-Tukey iterative
  const sign = invert ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (sign * 2 * Math.PI) / len;
    const wBase = ComplexOps.create(Math.cos(angle), Math.sin(angle));

    for (let i = 0; i < n; i += len) {
      let w = ComplexOps.create(1, 0);
      for (let k = 0; k < halfLen; k++) {
        const u = output[i + k];
        const v = ComplexOps.mul(output[i + k + halfLen], w);

        output[i + k] = ComplexOps.add(u, v);
        output[i + k + halfLen] = ComplexOps.sub(u, v);

        w = ComplexOps.mul(w, wBase);
      }
    }
  }

  return output;
}

/**
 * Transformée de Fourier Rapide (FFT) Radix-2 avec réorganisation des fréquences centrées
 * k in [-N/2, N/2 - 1] et normalisation par 1/N.
 */
export function computeFFT(points: (Complex | Point2D)[]): EpicycleTerm[] {
  const N = points.length;
  if (N === 0) return [];
  if (!isPowerOfTwo(N)) {
    // Si N n'est pas puissance de 2, repli transparent sur la DFT directe exacte
    return computeDFT(points);
  }

  const complexPoints: Complex[] = points.map(p => 're' in p ? p : ComplexOps.fromPoint(p));
  const rawFFT = cooleyTukeyRadix2(complexPoints, false);

  // rawFFT[m] correspond à la fréquence non centrée m in [0, N-1].
  // Pour mapper vers les fréquences signées k in [-N/2, N/2 - 1] :
  // Si k >= 0 : m = k (m in [0, N/2 - 1])
  // Si k < 0 : m = N + k (m in [N/2, N - 1])
  const terms: EpicycleTerm[] = [];
  const minK = -Math.floor(N / 2);
  const maxK = Math.ceil(N / 2) - 1;

  for (let k = minK; k <= maxK; k++) {
    const m = k >= 0 ? k : N + k;
    const rawVal = rawFFT[m];
    const re = rawVal.re / N;
    const im = rawVal.im / N;
    const amplitude = Math.hypot(re, im);
    const phase = Math.atan2(im, re);
    const direction = k < 0 ? 'cw' : 'ccw';

    terms.push({
      freq: k,
      amplitude,
      phase,
      re,
      im,
      direction,
    });
  }

  return terms;
}

/**
 * Calcul automatique de la transformée de Fourier la plus adaptée (FFT si 2^p, sinon DFT).
 */
export function computeFourierTransform(points: (Complex | Point2D)[]): EpicycleTerm[] {
  if (isPowerOfTwo(points.length)) {
    return computeFFT(points);
  }
  return computeDFT(points);
}

/**
 * Applique un fenêtrage d'atténuation de Gibbs (Lanczos sigma ou Fejér) aux coefficients.
 */
export function applyGibbsDamping(
  terms: EpicycleTerm[],
  windowType: GibbsWindowType,
  totalCutoff?: number
): EpicycleTerm[] {
  if (windowType === 'none') return terms.map(t => ({ ...t }));

  const M = totalCutoff ?? Math.max(...terms.map(t => Math.abs(t.freq)));
  if (M <= 0) return terms.map(t => ({ ...t }));

  return terms.map(term => {
    const k = Math.abs(term.freq);
    let factor = 1.0;

    if (windowType === 'lanczos') {
      // Lanczos sigma-factor: sinc(pi * k / M) = sin(pi * k / M) / (pi * k / M)
      if (k === 0) {
        factor = 1.0;
      } else if (k <= M) {
        const x = (Math.PI * k) / M;
        factor = Math.sin(x) / x;
      } else {
        factor = 0.0;
      }
    } else if (windowType === 'fejer') {
      // Fejér kernel factor (Cesàro sum): 1 - k / M pour k <= M
      factor = k <= M ? 1.0 - k / M : 0.0;
    }

    const re = term.re * factor;
    const im = term.im * factor;
    return {
      ...term,
      re,
      im,
      amplitude: Math.hypot(re, im),
      phase: Math.atan2(im, re),
    };
  });
}

/**
 * Trie les termes d'épicycles selon la stratégie demandée.
 */
export function sortEpicycles(terms: EpicycleTerm[], order: CircleSortOrder = 'amplitude-desc'): EpicycleTerm[] {
  const copy = [...terms];
  if (order === 'amplitude-desc') {
    return copy.sort((a, b) => b.amplitude - a.amplitude);
  } else if (order === 'frequency-asc') {
    return copy.sort((a, b) => {
      const absA = Math.abs(a.freq);
      const absB = Math.abs(b.freq);
      if (absA !== absB) return absA - absB;
      return a.freq - b.freq;
    });
  }
  return copy;
}

/**
 * Évalue la chaîne d'épicycles à un instant t in [0, 2pi).
 * Retourne la position successive de chaque centre et la pointe finale.
 */
export function evaluateEpicycles(
  terms: EpicycleTerm[],
  t: number,
  maxCircles?: number
): EpicycleEvaluation {
  const count = maxCircles !== undefined ? Math.min(maxCircles, terms.length) : terms.length;
  const centers: Point2D[] = [{ x: 0, y: 0 }];

  let currentX = 0;
  let currentY = 0;

  for (let i = 0; i < count; i++) {
    const term = terms[i];
    const angle = term.freq * t + term.phase;
    currentX += term.amplitude * Math.cos(angle);
    currentY += term.amplitude * Math.sin(angle);
    centers.push({ x: currentX, y: currentY });
  }

  const tip = centers[centers.length - 1];
  return {
    centers,
    tip,
    t,
  };
}

/**
 * Reconstruit la trajectoire complète échantillonnée sur `numSamples` points pour t in [0, 2pi).
 */
export function reconstructPath(
  terms: EpicycleTerm[],
  numSamples: number,
  maxCircles?: number
): Point2D[] {
  if (numSamples <= 0) return [];
  const path: Point2D[] = [];
  const dt = (2 * Math.PI) / numSamples;

  for (let i = 0; i < numSamples; i++) {
    const t = i * dt;
    const { tip } = evaluateEpicycles(terms, t, maxCircles);
    path.push(tip);
  }

  return path;
}
