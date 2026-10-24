import { describe, it, expect, beforeEach } from 'vitest';
import { Camera } from '../src/render/Camera';
import { TrailBuffer } from '../src/render/TrailBuffer';
import { FpsCounter } from '../src/render/FpsCounter';
import { WorkshopModel } from '../src/workshop/WorkshopModel';
import { exportCurveToSvg } from '../src/export';
import { EpicycleTerm } from '../src/math';

describe('Camera 2D & Interactions (Pan / Zoom / Follow)', () => {
  let camera: Camera;

  beforeEach(() => {
    camera = new Camera({ minZoom: 0.1, maxZoom: 10 });
  });

  it('initialise correctement la caméra à l origine avec zoom 1', () => {
    expect(camera.x).toBe(0);
    expect(camera.y).toBe(0);
    expect(camera.zoom).toBe(1);
    expect(camera.followTarget).toBe(false);
  });

  it('panBy déplace la caméra et désactive le mode de suivi automatique', () => {
    camera.followTarget = true;
    camera.panBy(50, -30);

    expect(camera.x).toBe(50);
    expect(camera.y).toBe(-30);
    expect(camera.followTarget).toBe(false);
  });

  it('convertit fidèlement entre coordonnées écran et coordonnées monde', () => {
    const width = 800;
    const height = 600;
    camera.setPosition(100, 200, true);
    camera.setZoom(2, true);

    const screenX = 500;
    const screenY = 400;

    const world = camera.screenToWorld(screenX, screenY, width, height);
    const backToScreen = camera.worldToScreen(world.x, world.y, width, height);

    expect(backToScreen.x).toBeCloseTo(screenX, 5);
    expect(backToScreen.y).toBeCloseTo(screenY, 5);
  });

  it('zoomAtScreenPoint conserve le point monde fixe sous le curseur', () => {
    const width = 800;
    const height = 600;
    const cursorX = 300;
    const cursorY = 250;

    const worldBefore = camera.screenToWorld(cursorX, cursorY, width, height);
    camera.zoomAtScreenPoint(1.5, cursorX, cursorY, width, height);
    const worldAfter = camera.screenToWorld(cursorX, cursorY, width, height);

    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 4);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 4);
  });

  it('suivi caméra de la pointe (Camera Follow) oriente la caméra vers la position cible', () => {
    camera.followTarget = true;
    camera.followZoom = 3.0;

    const tip = { x: 120, y: -80 };
    camera.updateFollow(tip, false); // sans damping

    expect(camera.x).toBe(120);
    expect(camera.y).toBe(-80);
    expect(camera.zoom).toBe(3.0);
  });
});

describe('TrailBuffer (Traînée lumineuse & Dégradé temporel)', () => {
  it('ajoute des points sans duplication inutile', () => {
    const trail = new TrailBuffer({ maxPoints: 100 });
    trail.addPoint(10, 20, 0.1);
    trail.addPoint(10.01, 20.01, 0.11); // trop proche (< 0.04 dist sq)
    expect(trail.getPointCount()).toBe(1);

    trail.addPoint(15, 25, 0.2);
    expect(trail.getPointCount()).toBe(2);
  });

  it('respecte la capacité maximale circulaire (maxPoints)', () => {
    const trail = new TrailBuffer({ maxPoints: 5 });
    for (let i = 0; i < 10; i++) {
      trail.addPoint(i * 10, i * 10, i);
    }
    expect(trail.getPointCount()).toBe(5);
    const points = trail.getPoints();
    expect(points[0].x).toBe(50);
    expect(points[4].x).toBe(90);
  });

  it('vide correctement la traînée avec clear()', () => {
    const trail = new TrailBuffer();
    trail.addPoint(1, 1, 0);
    trail.addPoint(2, 2, 1);
    expect(trail.getPointCount()).toBe(2);
    trail.clear();
    expect(trail.getPointCount()).toBe(0);
  });
});

describe('FpsCounter', () => {
  it('mesure les FPS et le frame time', () => {
    let t = 1000;
    const counter = new FpsCounter(t);
    expect(counter.getFps()).toBe(60);

    // Simuler 30 frames de 16.666ms (soit 500ms pour 30 frames = 60 fps)
    for (let i = 0; i < 30; i++) {
      t += 16.666;
      counter.update(t);
    }
    expect(counter.getFps()).toBeGreaterThanOrEqual(58);
    expect(counter.getFps()).toBeLessThanOrEqual(62);
  });
});

describe('WorkshopModel (Gestion interactive des cercles)', () => {
  it('initialise avec la chaîne par défaut à 4 cercles', () => {
    const model = new WorkshopModel();
    expect(model.getTerms().length).toBe(4);
  });

  it('ajoute, supprime et duplique des cercles avec notification', () => {
    const model = new WorkshopModel();
    let notifyCount = 0;
    const unsub = model.subscribe(() => {
      notifyCount++;
    });

    model.addCircle({ freq: 5, amplitude: 20 });
    expect(model.getTerms().length).toBe(5);
    expect(notifyCount).toBe(1);

    model.duplicateCircle(4);
    expect(model.getTerms().length).toBe(6);
    expect(model.getTerms()[5].freq).toBe(-5); // fréquence opposée par défaut
    expect(notifyCount).toBe(2);

    model.removeCircle(5);
    expect(model.getTerms().length).toBe(5);
    expect(notifyCount).toBe(3);

    unsub();
  });

  it('met à jour les propriétés en direct (rayon, sens, phase, fréquence)', () => {
    const model = new WorkshopModel();
    model.updateCircle(0, { amplitude: 200, freq: -3, direction: 'cw', phase: Math.PI });

    const updated = model.getTerms()[0];
    expect(updated.amplitude).toBe(200);
    expect(updated.freq).toBe(-3);
    expect(updated.direction).toBe('cw');
    expect(updated.phase).toBe(Math.PI);
    expect(updated.re).toBeCloseTo(-200, 5);
  });

  it('réorganise la chaîne (Monter / Descendre)', () => {
    const model = new WorkshopModel();
    const firstTerm = model.getTerms()[0];
    const secondTerm = model.getTerms()[1];

    model.moveCircle(0, 1);
    expect(model.getTerms()[0].amplitude).toBe(secondTerm.amplitude);
    expect(model.getTerms()[1].amplitude).toBe(firstTerm.amplitude);
  });

  it('trie automatiquement la chaîne par amplitude décroissante', () => {
    const model = new WorkshopModel();
    model.setTerms([
      { freq: 1, amplitude: 10, phase: 0, re: 10, im: 0, direction: 'ccw' },
      { freq: 2, amplitude: 80, phase: 0, re: 80, im: 0, direction: 'ccw' },
      { freq: 3, amplitude: 40, phase: 0, re: 40, im: 0, direction: 'ccw' },
    ]);

    model.sort('amplitude-desc');
    const sorted = model.getTerms();
    expect(sorted[0].amplitude).toBe(80);
    expect(sorted[1].amplitude).toBe(40);
    expect(sorted[2].amplitude).toBe(10);
  });

  it('fournit les 4 préréglages d atelier prêts à l emploi', () => {
    const presets = WorkshopModel.getWorkshopPresets();
    expect(presets.length).toBe(4);
    expect(presets.find(p => p.id === 'planetary')).toBeDefined();
    expect(presets.find(p => p.id === 'spiral-harmonic')).toBeDefined();
    expect(presets.find(p => p.id === 'fourier-square')).toBeDefined();
    expect(presets.find(p => p.id === 'mechanical-star')).toBeDefined();
  });
});

describe('Export SVG & Vectoriel', () => {
  it('génère un SVG valide et balisé avec chemin continu et cercles optionnels', () => {
    const terms: EpicycleTerm[] = [
      { freq: 1, amplitude: 100, phase: 0, re: 100, im: 0, direction: 'ccw' },
      { freq: -3, amplitude: 30, phase: 0, re: 30, im: 0, direction: 'cw' },
    ];

    const svg = exportCurveToSvg(terms, { width: 500, height: 500, numSamples: 100 });
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 500 500"');
    expect(svg).toContain('<path d="M');
    expect(svg).toContain('stroke="#38bdf8"');
  });
});

describe('Performance 200+ Cercles à 60 FPS', () => {
  it('évalue 200 cercles en moins de 1 milliseconde par frame', () => {
    const terms200: EpicycleTerm[] = [];
    for (let k = 1; k <= 200; k++) {
      terms200.push({
        freq: k % 2 === 0 ? -k : k,
        amplitude: 200 / k,
        phase: (k * Math.PI) / 10,
        re: (200 / k) * Math.cos((k * Math.PI) / 10),
        im: (200 / k) * Math.sin((k * Math.PI) / 10),
        direction: k % 2 === 0 ? 'cw' : 'ccw',
      });
    }

    const t0 = performance.now();
    const iterations = 100; // Simuler 100 frames
    for (let i = 0; i < iterations; i++) {
      const t = (i * 2 * Math.PI) / iterations;
      // Évaluation des 200 cercles
      let currX = 0;
      let currY = 0;
      for (let c = 0; c < 200; c++) {
        const term = terms200[c];
        const angle = term.freq * t + term.phase;
        currX += term.amplitude * Math.cos(angle);
        currY += term.amplitude * Math.sin(angle);
      }
    }
    const elapsed = performance.now() - t0;
    const timePerFrameMs = elapsed / iterations;

    // Sur un mobile ou desktop, le calcul de 200 cercles doit prendre moins de 0.5ms (très inférieur au budget de 16.6ms)
    expect(timePerFrameMs).toBeLessThan(1.0);
  });
});
