import { EpicycleTerm, Point2D, reconstructPath } from '../math';

export interface SvgExportOptions {
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  numSamples?: number;
  includeEpicyclesState?: {
    centers: Point2D[];
    terms: EpicycleTerm[];
  };
}

export function exportCurveToSvg(
  terms: readonly EpicycleTerm[],
  options: SvgExportOptions = {}
): string {
  const width = options.width ?? 800;
  const height = options.height ?? 800;
  const strokeColor = options.strokeColor ?? '#38bdf8';
  const strokeWidth = options.strokeWidth ?? 2;
  const backgroundColor = options.backgroundColor ?? '#0b0f19';
  const numSamples = options.numSamples ?? 1000;

  const points = reconstructPath([...terms], numSamples);
  if (points.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="${backgroundColor}"/></svg>`;
  }

  // Calcul du bounding box pour centrer automatiquement dans le SVG
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const curveWidth = Math.max(1, maxX - minX);
  const curveHeight = Math.max(1, maxY - minY);
  const curveCenterX = (minX + maxX) / 2;
  const curveCenterY = (minY + maxY) / 2;

  const padding = 60;
  const scale = Math.min((width - padding * 2) / curveWidth, (height - padding * 2) / curveHeight);

  // Construction du chemin SVG (d attribute)
  let d = '';
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const sx = width / 2 + (p.x - curveCenterX) * scale;
    const sy = height / 2 + (p.y - curveCenterY) * scale;
    if (i === 0) {
      d += `M ${sx.toFixed(2)} ${sy.toFixed(2)}`;
    } else {
      d += ` L ${sx.toFixed(2)} ${sy.toFixed(2)}`;
    }
  }
  d += ' Z';

  let epicyclesElements = '';
  if (options.includeEpicyclesState && options.includeEpicyclesState.centers.length > 1) {
    const { centers, terms: currentTerms } = options.includeEpicyclesState;
    for (let i = 0; i < currentTerms.length && i < centers.length - 1; i++) {
      const c = centers[i];
      const nextC = centers[i + 1];
      const radius = currentTerms[i].amplitude * scale;
      const sx = width / 2 + (c.x - curveCenterX) * scale;
      const sy = height / 2 + (c.y - curveCenterY) * scale;
      const nextSx = width / 2 + (nextC.x - curveCenterX) * scale;
      const nextSy = height / 2 + (nextC.y - curveCenterY) * scale;

      epicyclesElements += `  <circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="${radius.toFixed(2)}" fill="none" stroke="rgba(148,163,184,0.3)" stroke-width="1" />\n`;
      epicyclesElements += `  <line x1="${sx.toFixed(2)}" y1="${sy.toFixed(2)}" x2="${nextSx.toFixed(2)}" y2="${nextSy.toFixed(2)}" stroke="#38bdf8" stroke-width="1.5" />\n`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="${backgroundColor}"/>
${epicyclesElements}  <path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

export function exportCurveToPngDataUrl(
  terms: readonly EpicycleTerm[],
  options: SvgExportOptions = {}
): string {
  if (typeof document === 'undefined') {
    return '';
  }

  const width = options.width ?? 1200;
  const height = options.height ?? 1200;
  const strokeColor = options.strokeColor ?? '#38bdf8';
  const strokeWidth = options.strokeWidth ?? 3;
  const backgroundColor = options.backgroundColor ?? '#0b0f19';
  const numSamples = options.numSamples ?? 2000;

  const points = reconstructPath([...terms], numSamples);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fond
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  if (points.length < 2) return canvas.toDataURL('image/png');

  // Bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const curveWidth = Math.max(1, maxX - minX);
  const curveHeight = Math.max(1, maxY - minY);
  const curveCenterX = (minX + maxX) / 2;
  const curveCenterY = (minY + maxY) / 2;

  const padding = 80;
  const scale = Math.min((width - padding * 2) / curveWidth, (height - padding * 2) / curveHeight);

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-curveCenterX, -curveCenterY);

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth / scale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.restore();

  return canvas.toDataURL('image/png');
}

export function triggerDownload(content: string, filename: string, mimeType: string): void {
  if (typeof document === 'undefined') return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
