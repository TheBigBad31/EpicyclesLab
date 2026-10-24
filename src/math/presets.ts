import { Point2D } from './types';
import { resampleByArcLength, normalizePoints } from './resampling';

/**
 * 1. Symbole Pi (π) - Contour inspiré de la vidéo de référence "Spinning Circles Can Draw Anything (Even π)"
 * Dessiné comme un tracé fermé fidèle avec les deux jambes, la barre horizontale et les empattements.
 */
export function generatePiPreset(numSamples: number = 256): Point2D[] {
  // Contour vectoriel stylisé d'un symbole Pi (fermé)
  const basePolygon: Point2D[] = [
    // Barre supérieure gauche
    { x: -70, y: -50 },
    { x: -50, y: -50 },
    // Descente jambe gauche (intérieur)
    { x: -45, y: -20 },
    { x: -40, y: 30 },
    { x: -50, y: 50 },
    // Bas pied gauche (crochet gauche)
    { x: -60, y: 55 },
    { x: -60, y: 60 },
    { x: -30, y: 60 },
    { x: -25, y: 40 },
    // Remontée jambe gauche
    { x: -20, y: -20 },
    // Espace entre les deux jambes sous la barre
    { x: 15, y: -20 },
    // Descente jambe droite
    { x: 20, y: 20 },
    { x: 25, y: 45 },
    { x: 40, y: 55 },
    { x: 55, y: 50 },
    // Crochet retour pied droit
    { x: 50, y: 40 },
    { x: 38, y: 35 },
    { x: 35, y: -20 },
    // Vers barre supérieure droite
    { x: 65, y: -20 },
    { x: 70, y: -35 },
    { x: 75, y: -50 },
    { x: 60, y: -55 },
    // Toit supérieur barre
    { x: 0, y: -52 },
    { x: -60, y: -53 },
  ];

  return resampleByArcLength(normalizePoints(basePolygon), numSamples, true);
}

/**
 * 2. Cœur paramétrique
 * x(t) = 16 sin^3(t)
 * y(t) = -(13 cos(t) - 5 cos(2t) - 2 cos(3t) - cos(4t))
 */
export function generateHeartPreset(numSamples: number = 256): Point2D[] {
  const points: Point2D[] = [];
  const dt = (2 * Math.PI) / numSamples;

  for (let i = 0; i < numSamples; i++) {
    const t = i * dt;
    const sinT = Math.sin(t);
    const x = 16 * Math.pow(sinT, 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    points.push({ x, y });
  }

  return normalizePoints(points);
}

/**
 * 3. Étoile à 5 branches
 */
export function generateStarPreset(numSamples: number = 256, pointsCount: number = 5, innerRadius: number = 0.4): Point2D[] {
  const vertices: Point2D[] = [];
  const totalVertices = pointsCount * 2;
  const dAngle = Math.PI / pointsCount;

  for (let i = 0; i < totalVertices; i++) {
    const angle = i * dAngle - Math.PI / 2;
    const r = i % 2 === 0 ? 1.0 : innerRadius;
    vertices.push({
      x: r * Math.cos(angle),
      y: r * Math.sin(angle),
    });
  }

  return resampleByArcLength(normalizePoints(vertices), numSamples, true);
}

/**
 * 4. Onde carrée 2D (Square Wave fermée)
 */
export function generateSquareWavePreset(numSamples: number = 256): Point2D[] {
  const vertices: Point2D[] = [
    { x: -1, y: -0.5 },
    { x: -0.5, y: -0.5 },
    { x: -0.5, y: 0.5 },
    { x: 0, y: 0.5 },
    { x: 0, y: -0.5 },
    { x: 0.5, y: -0.5 },
    { x: 0.5, y: 0.5 },
    { x: 1, y: 0.5 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
  ];

  return resampleByArcLength(normalizePoints(vertices), numSamples, true);
}

/**
 * 5. Épitrochoïde / Rosace
 * R = 5, r = 1, d = 3
 */
export function generateEpitrochoidPreset(numSamples: number = 256, R: number = 5, r: number = 1, d: number = 3): Point2D[] {
  const points: Point2D[] = [];
  const dt = (2 * Math.PI) / numSamples;

  for (let i = 0; i < numSamples; i++) {
    const t = i * dt;
    const x = (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t);
    const y = (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t);
    points.push({ x, y });
  }

  return normalizePoints(points);
}

/**
 * 6. Courbe de Lissajous
 * x = A sin(a * t + delta), y = B sin(b * t)
 */
export function generateLissajousPreset(numSamples: number = 256, a: number = 3, b: number = 2, delta: number = Math.PI / 2): Point2D[] {
  const points: Point2D[] = [];
  const dt = (2 * Math.PI) / numSamples;

  for (let i = 0; i < numSamples; i++) {
    const t = i * dt;
    const x = Math.sin(a * t + delta);
    const y = Math.sin(b * t);
    points.push({ x, y });
  }

  return normalizePoints(points);
}

/**
 * 7. Courbe Papillon (Butterfly curve de Temple H. Fay)
 * r = e^cos(theta) - 2 cos(4 theta) + sin^5(theta / 12)
 * Pour theta in [0, 24 pi] ou replié en [0, 2 pi] avec paramétrisation périodique
 */
export function generateButterflyPreset(numSamples: number = 256): Point2D[] {
  const points: Point2D[] = [];
  const totalRange = 12 * Math.PI; // Périodicité complète
  const dt = totalRange / numSamples;

  for (let i = 0; i < numSamples; i++) {
    const t = i * dt;
    const r = Math.exp(Math.cos(t)) - 2 * Math.cos(4 * t) + Math.pow(Math.sin(t / 12), 5);
    // Dans le repère graphique standard avec y inversé
    const x = r * Math.sin(t);
    const y = -r * Math.cos(t);
    points.push({ x, y });
  }

  return normalizePoints(points);
}

/**
 * 8. Clé de Sol / Note de musique stylisée
 */
export function generateClefPreset(numSamples: number = 256): Point2D[] {
  // Tracé représentatif d'une double croche / note de musique
  const vertices: Point2D[] = [
    // Tête de note 1 (ovale)
    { x: -50, y: 40 },
    { x: -40, y: 50 },
    { x: -30, y: 45 },
    { x: -25, y: 35 },
    // Tige 1 vers le haut
    { x: -25, y: -40 },
    // Barre horizontale de liaison double croche
    { x: 25, y: -45 },
    // Tige 2 vers le bas
    { x: 25, y: 25 },
    // Tête de note 2
    { x: 35, y: 35 },
    { x: 45, y: 30 },
    { x: 35, y: 15 },
    { x: 25, y: 20 },
    // Remontée tige 2
    { x: 25, y: -30 },
    // Seconde barre de liaison
    { x: -15, y: -25 },
    { x: -25, y: 30 },
  ];

  return resampleByArcLength(normalizePoints(vertices), numSamples, true);
}

/**
 * Parseur de chemin SVG autonome (sans dépendance DOM).
 * Supporte les commandes M, L, H, V, C, Q, Z (majuscules absolues et minuscules relatives).
 */
export function parseSvgPathToPoints(svgPathD: string, numSamples: number = 256): Point2D[] {
  if (!svgPathD || svgPathD.trim() === '') return [];

  const rawPoints: Point2D[] = [];
  // Tokenizer simple pour les commandes SVG
  const commandRegex = /([a-df-z])|([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/gi;
  const tokens: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = commandRegex.exec(svgPathD)) !== null) {
    tokens.push(match[0]);
  }

  let i = 0;
  let currX = 0;
  let currY = 0;
  let startX = 0;
  let startY = 0;
  let currentCmd = '';

  const parseNextNumber = (): number => {
    if (i >= tokens.length) return 0;
    const val = parseFloat(tokens[i++]);
    return isNaN(val) ? 0 : val;
  };

  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[a-zA-Z]$/.test(token)) {
      currentCmd = token;
      i++;
    }

    const isRelative = currentCmd === currentCmd.toLowerCase();
    const cmd = currentCmd.toUpperCase();

    if (cmd === 'M') {
      const x = parseNextNumber() + (isRelative ? currX : 0);
      const y = parseNextNumber() + (isRelative ? currY : 0);
      currX = x;
      currY = y;
      startX = x;
      startY = y;
      rawPoints.push({ x, y });
      currentCmd = isRelative ? 'l' : 'L'; // commandes suivantes implicites
    } else if (cmd === 'L') {
      const x = parseNextNumber() + (isRelative ? currX : 0);
      const y = parseNextNumber() + (isRelative ? currY : 0);
      currX = x;
      currY = y;
      rawPoints.push({ x, y });
    } else if (cmd === 'H') {
      const x = parseNextNumber() + (isRelative ? currX : 0);
      currX = x;
      rawPoints.push({ x: currX, y: currY });
    } else if (cmd === 'V') {
      const y = parseNextNumber() + (isRelative ? currY : 0);
      currY = y;
      rawPoints.push({ x: currX, y: currY });
    } else if (cmd === 'C') {
      // Courbe de Bézier cubique : x1 y1 x2 y2 x y
      const x1 = parseNextNumber() + (isRelative ? currX : 0);
      const y1 = parseNextNumber() + (isRelative ? currY : 0);
      const x2 = parseNextNumber() + (isRelative ? currX : 0);
      const y2 = parseNextNumber() + (isRelative ? currY : 0);
      const x = parseNextNumber() + (isRelative ? currX : 0);
      const y = parseNextNumber() + (isRelative ? currY : 0);

      // Échantillonner la courbe de Bézier en plusieurs sous-segments
      const steps = 10;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const mt = 1 - t;
        const bx =
          mt * mt * mt * currX +
          3 * mt * mt * t * x1 +
          3 * mt * t * t * x2 +
          t * t * t * x;
        const by =
          mt * mt * mt * currY +
          3 * mt * mt * t * y1 +
          3 * mt * t * t * y2 +
          t * t * t * y;
        rawPoints.push({ x: bx, y: by });
      }
      currX = x;
      currY = y;
    } else if (cmd === 'Q') {
      // Courbe de Bézier quadratique : x1 y1 x y
      const x1 = parseNextNumber() + (isRelative ? currX : 0);
      const y1 = parseNextNumber() + (isRelative ? currY : 0);
      const x = parseNextNumber() + (isRelative ? currX : 0);
      const y = parseNextNumber() + (isRelative ? currY : 0);

      const steps = 8;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const mt = 1 - t;
        const bx = mt * mt * currX + 2 * mt * t * x1 + t * t * x;
        const by = mt * mt * currY + 2 * mt * t * y1 + t * t * y;
        rawPoints.push({ x: bx, y: by });
      }
      currX = x;
      currY = y;
    } else if (cmd === 'Z') {
      currX = startX;
      currY = startY;
      rawPoints.push({ x: currX, y: currY });
    } else {
      // Commande non supportée ou argument suivant
      i++;
    }
  }

  if (rawPoints.length === 0) return [];
  return resampleByArcLength(normalizePoints(rawPoints), numSamples, true);
}
