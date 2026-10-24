import { Point2D } from '../math/types';

export interface SvgExtractionResult {
  points: Point2D[];
  name?: string;
  viewBox?: { width: number; height: number };
}

/**
 * Extrait les coordonnées des chemins vectoriels depuis un contenu textuel SVG.
 * Parcourt les éléments <path>, <polygon>, <polyline> et convertit en Point2D[].
 */
export function extractPointsFromSvgString(svgContent: string): SvgExtractionResult {
  if (!svgContent || typeof svgContent !== 'string') {
    return { points: [] };
  }

  // 1. Si environnement DOM disponible (navigateur)
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgContent, 'image/svg+xml');
      const parserError = doc.querySelector('parsererror');
      if (parserError) {
        console.warn('Erreur XML lors du parsing SVG :', parserError.textContent);
      } else {
        const svgEl = doc.querySelector('svg');
        let width = 300;
        let height = 300;

        if (svgEl) {
          const vb = svgEl.getAttribute('viewBox');
          if (vb) {
            const parts = vb.trim().split(/[\s,]+/).map(Number);
            if (parts.length === 4) {
              width = parts[2];
              height = parts[3];
            }
          }
        }

        // Examiner les paths
        const pathEls = Array.from(doc.querySelectorAll('path'));
        for (const path of pathEls) {
          const d = path.getAttribute('d');
          if (d && d.trim().length > 0) {
            // Utiliser getPointAtLength si SVGPathElement supporté dans le navigateur
            if (typeof (path as SVGPathElement).getTotalLength === 'function') {
              try {
                const totalLen = (path as SVGPathElement).getTotalLength();
                if (totalLen > 0) {
                  const pts: Point2D[] = [];
                  const samples = 256;
                  for (let i = 0; i < samples; i++) {
                    const pt = (path as SVGPathElement).getPointAtLength((i / samples) * totalLen);
                    pts.push({ x: pt.x, y: pt.y });
                  }
                  return { points: pts, viewBox: { width, height } };
                }
              } catch {
                // Repli sur le tokenizer d
              }
            }
          }
        }

        // Examiner polygon / polyline
        const polyEls = Array.from(doc.querySelectorAll('polygon, polyline'));
        for (const poly of polyEls) {
          const pointsAttr = poly.getAttribute('points');
          if (pointsAttr) {
            const coords = pointsAttr.trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
            const pts: Point2D[] = [];
            for (let i = 0; i < coords.length - 1; i += 2) {
              pts.push({ x: coords[i], y: coords[i + 1] });
            }
            if (pts.length > 2) {
              return { points: pts, viewBox: { width, height } };
            }
          }
        }
      }
    } catch {
      // repli regex
    }
  }

  // 2. Repli regex autonome (compatible Node / Vitest sans DOM)
  // Chercher <path ... d="..." />
  const pathMatch = /<path[^>]*\sd=["']([^"']+)["']/i.exec(svgContent);
  if (pathMatch && pathMatch[1]) {
    const d = pathMatch[1];
    const points = parseSvgPathQuick(d);
    if (points.length > 0) {
      return { points };
    }
  }

  // Chercher <polygon points="..." /> ou <polyline points="..." />
  const polyMatch = /<(?:polygon|polyline)[^>]*\spoints=["']([^"']+)["']/i.exec(svgContent);
  if (polyMatch && polyMatch[1]) {
    const coords = polyMatch[1].trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    const pts: Point2D[] = [];
    for (let i = 0; i < coords.length - 1; i += 2) {
      pts.push({ x: coords[i], y: coords[i + 1] });
    }
    if (pts.length > 0) {
      return { points: pts };
    }
  }

  return { points: [] };
}

/**
 * Tokenizer rapide de commandes de chemin SVG
 */
function parseSvgPathQuick(d: string): Point2D[] {
  const points: Point2D[] = [];
  const commandRegex = /([a-df-z])|([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/gi;
  const tokens: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = commandRegex.exec(d)) !== null) {
    tokens.push(match[0]);
  }

  let i = 0;
  let currX = 0;
  let currY = 0;
  let currentCmd = '';

  const parseNum = (): number => {
    if (i >= tokens.length) return 0;
    const v = parseFloat(tokens[i++]);
    return isNaN(v) ? 0 : v;
  };

  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[a-zA-Z]$/.test(token)) {
      currentCmd = token;
      i++;
    }

    const isRel = currentCmd === currentCmd.toLowerCase();
    const cmd = currentCmd.toUpperCase();

    if (cmd === 'M' || cmd === 'L') {
      const x = parseNum() + (isRel ? currX : 0);
      const y = parseNum() + (isRel ? currY : 0);
      currX = x;
      currY = y;
      points.push({ x, y });
    } else if (cmd === 'H') {
      const x = parseNum() + (isRel ? currX : 0);
      currX = x;
      points.push({ x: currX, y: currY });
    } else if (cmd === 'V') {
      const y = parseNum() + (isRel ? currY : 0);
      currY = y;
      points.push({ x: currX, y: currY });
    } else if (cmd === 'C') {
      parseNum(); parseNum(); // cp1
      parseNum(); parseNum(); // cp2
      const x = parseNum() + (isRel ? currX : 0);
      const y = parseNum() + (isRel ? currY : 0);
      currX = x;
      currY = y;
      points.push({ x, y });
    } else if (cmd === 'Q') {
      parseNum(); parseNum(); // cp
      const x = parseNum() + (isRel ? currX : 0);
      const y = parseNum() + (isRel ? currY : 0);
      currX = x;
      currY = y;
      points.push({ x, y });
    } else if (cmd === 'Z') {
      // Fermeture
      if (points.length > 0) {
        points.push({ ...points[0] });
      }
    } else {
      i++;
    }
  }

  return points;
}
