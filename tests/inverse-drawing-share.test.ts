import { describe, it, expect } from 'vitest';
import { processInverseFourier } from '../src/worker/fourier.worker';
import { FourierWorkerClient } from '../src/worker/FourierWorkerClient';
import { extractPointsFromSvgString } from '../src/drawing/SvgImporter';
import {
  serializeToJson,
  deserializeFromJson,
  encodeConfigToUrlHash,
  decodeConfigFromUrlHash,
  EpicyclesLabProjectState,
} from '../src/state/serialization';
import { generatePiPreset, generateHeartPreset } from '../src/math/presets';
import { computeMetrics } from '../src/math/metrics';

describe('Stage 3 - Mode Dessin Inverse & Web Worker', () => {
  it('calcule la DFT/FFT inverse de manière non-bloquante avec métriques', async () => {
    const piPoints = generatePiPreset(128);
    const workerClient = new FourierWorkerClient();

    const response = await workerClient.compute({
      points: piPoints,
      numSamples: 128,
      closed: true,
      smoothRadius: 0,
      gibbsWindow: 'none',
      sortOrder: 'amplitude-desc',
    });

    expect(response.terms).toBeDefined();
    expect(response.terms.length).toBe(128);
    expect(response.resampledPoints.length).toBe(128);
    expect(response.metrics.totalEnergy).toBeGreaterThan(0);
    expect(response.metrics.energyRatio).toBeCloseTo(1.0, 2);
    expect(response.durationMs).toBeGreaterThanOrEqual(0);

    // Les termes doivent être triés par amplitude décroissante
    for (let i = 0; i < response.terms.length - 1; i++) {
      expect(response.terms[i].amplitude).toBeGreaterThanOrEqual(response.terms[i + 1].amplitude);
    }
  });

  it('gère le lissage spatial et le fenêtrage Lanczos dans le worker', () => {
    const heartPoints = generateHeartPreset(64);
    const response = processInverseFourier({
      id: 'test-heart',
      points: heartPoints,
      numSamples: 64,
      smoothRadius: 2,
      gibbsWindow: 'lanczos',
      sortOrder: 'amplitude-desc',
    });

    expect(response.terms.length).toBe(64);
    expect(response.metrics.rmse).toBeDefined();
    expect(response.metrics.relativeRmse).toBeDefined();
  });

  it('reproduit le symbole π et un tracé à main levée avec erreur RMSE < seuil et énergie capturée > 98%', () => {
    // 1. Test sur le symbole Pi (N=128 points)
    const piPoints = generatePiPreset(128);
    const piRes = processInverseFourier({
      id: 'pi-quality',
      points: piPoints,
      numSamples: 128,
      closed: true,
      smoothRadius: 0,
      gibbsWindow: 'none',
      sortOrder: 'amplitude-desc',
    });

    // Vérification de la convergence partielle (M=40 cercles sur 128) et totale (M=128)
    const metrics40 = computeMetrics(piRes.resampledPoints, piRes.terms, 40);
    expect(metrics40.energyRatio).toBeGreaterThan(0.98);
    expect(metrics40.relativeRmse).toBeLessThan(5.0); // < 5% de la diagonale avec seulement 40 cercles

    expect(piRes.metrics.rmse).toBeLessThan(1e-6);
    expect(piRes.metrics.relativeRmse).toBeLessThan(0.01);
    expect(piRes.metrics.energyRatio).toBeGreaterThan(0.999);

    // 2. Test sur un tracé à main levée simulé (vitesse irrégulière, 90 points bruts)
    const freehandPoints = Array.from({ length: 90 }, (_, i) => {
      const u = (i / 90) * 2 * Math.PI;
      const angle = u + 0.25 * Math.sin(2 * u);
      return {
        x: 150 * Math.cos(angle) + 45 * Math.cos(3 * angle),
        y: 120 * Math.sin(angle) - 35 * Math.sin(2 * angle),
      };
    });

    const freehandRes = processInverseFourier({
      id: 'freehand-quality',
      points: freehandPoints,
      numSamples: 128,
      closed: true,
      smoothRadius: 1,
      gibbsWindow: 'none',
      sortOrder: 'amplitude-desc',
    });

    const freehandPartial = computeMetrics(freehandRes.resampledPoints, freehandRes.terms, 32);
    expect(freehandPartial.energyRatio).toBeGreaterThan(0.99);
    expect(freehandPartial.relativeRmse).toBeLessThan(3.0);
    expect(freehandRes.metrics.rmse).toBeLessThan(1e-6);
  });
});

describe('Stage 3 - Import SVG', () => {
  it('extrait les points d\'un chemin SVG path d="..."', () => {
    const svg = `<svg viewBox="0 0 100 100"><path d="M 10 10 L 90 10 L 90 90 L 10 90 Z" /></svg>`;
    const res = extractPointsFromSvgString(svg);
    expect(res.points.length).toBeGreaterThan(2);
    expect(res.points[0]).toEqual({ x: 10, y: 10 });
  });

  it('extrait les points d\'un élément polygon ou polyline', () => {
    const svgPoly = `<svg><polygon points="0,0 50,20 100,0 100,100 0,100" /></svg>`;
    const res = extractPointsFromSvgString(svgPoly);
    expect(res.points.length).toBe(5);
    expect(res.points[1]).toEqual({ x: 50, y: 20 });
  });

  it('gère gracieusement un SVG vide ou invalide', () => {
    const res = extractPointsFromSvgString('');
    expect(res.points).toEqual([]);
  });
});

describe('Stage 3 - Sérialisation JSON & Partage URL Hash', () => {
  const dummyState: EpicyclesLabProjectState = {
    version: 1,
    mode: 'inverse',
    title: 'Projet Test Pi',
    createdAt: '2026-10-24T12:00:00.000Z',
    terms: [
      { freq: 0, amplitude: 50, phase: 0, re: 50, im: 0, direction: 'ccw' },
      { freq: 1, amplitude: 25, phase: 1.57, re: 0, im: 25, direction: 'ccw' },
      { freq: -1, amplitude: 10, phase: -0.5, re: 8.77, im: -4.79, direction: 'cw' },
    ],
    maxCircles: 2,
    inverseConfig: {
      numSamples: 256,
      closed: true,
      smoothRadius: 2,
      gibbsWindow: 'lanczos',
      sortOrder: 'amplitude-desc',
      activeCircles: 2,
      presetId: 'pi',
    },
  };

  it('sérialise et désérialise un projet JSON sans perte de données', () => {
    const jsonStr = serializeToJson(dummyState);
    const restored = deserializeFromJson(jsonStr);

    expect(restored.version).toBe(dummyState.version);
    expect(restored.mode).toBe('inverse');
    expect(restored.terms.length).toBe(3);
    expect(restored.terms[0].amplitude).toBe(50);
    expect(restored.inverseConfig?.presetId).toBe('pi');
  });

  it('encode et décode une configuration en hash URL (#config=...)', () => {
    const hash = encodeConfigToUrlHash(dummyState);
    expect(hash.startsWith('#config=')).toBe(true);

    const decoded = decodeConfigFromUrlHash(hash);
    expect(decoded).not.toBeNull();
    expect(decoded?.mode).toBe('inverse');
    expect(decoded?.terms?.length).toBe(3);
    expect(decoded?.terms?.[0].freq).toBe(0);
    expect(decoded?.terms?.[0].amplitude).toBe(50);
    expect(decoded?.inverseConfig?.activeCircles).toBe(2);
    expect(decoded?.inverseConfig?.presetId).toBe('pi');
  });
});
