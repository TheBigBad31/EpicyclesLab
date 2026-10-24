export interface TrailPoint {
  x: number;
  y: number;
  t: number;      // Instant de génération
}

export interface TrailOptions {
  maxPoints?: number;
  color?: string;
  glowColor?: string;
  lineWidth?: number;
  fadeDuration?: number; // Durée relative dans [0, 1] ou > 1 pour infini (ex: 1 = 1 cycle complet)
}

export class TrailBuffer {
  private points: TrailPoint[] = [];
  public maxPoints: number;
  public fadeDuration: number; // 0.1 à 1.0 (ou Infinity pour trace permanente)
  public color: string;
  public glowColor: string;
  public lineWidth: number;

  constructor(options: TrailOptions = {}) {
    this.maxPoints = options.maxPoints ?? 5000;
    this.fadeDuration = options.fadeDuration ?? 1.0;
    this.color = options.color ?? '#38bdf8';
    this.glowColor = options.glowColor ?? 'rgba(56, 189, 248, 0.4)';
    this.lineWidth = options.lineWidth ?? 2.2;
  }

  public addPoint(x: number, y: number, t: number): void {
    const len = this.points.length;
    // Éviter d'ajouter des points redondants identiques
    if (len > 0) {
      const last = this.points[len - 1];
      const dx = last.x - x;
      const dy = last.y - y;
      if (dx * dx + dy * dy < 0.04) {
        return;
      }
    }

    this.points.push({ x, y, t });

    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }
  }

  public clear(): void {
    this.points = [];
  }

  public getPoints(): readonly TrailPoint[] {
    return this.points;
  }

  public getPointCount(): number {
    return this.points.length;
  }

  /**
   * Rendu haute performance de la traînée avec dégradé d'opacité temporel.
   * On segmente en tranches d'opacité pour limiter les appels de stroke.
   */
  public render(ctx: CanvasRenderingContext2D, currentZoom: number = 1): void {
    const total = this.points.length;
    if (total < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Épaisseur adaptative au zoom pour rester nette sans être gigantesque
    const baseWidth = Math.max(1, this.lineWidth / Math.sqrt(currentZoom));
    ctx.lineWidth = baseWidth;

    const isInfinite = !isFinite(this.fadeDuration) || this.fadeDuration >= 10;

    if (isInfinite) {
      // Trace permanente : un seul path continu optimisé
      ctx.strokeStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(this.points[0].x, this.points[0].y);
      for (let i = 1; i < total; i++) {
        ctx.lineTo(this.points[i].x, this.points[i].y);
      }
      ctx.stroke();
    } else {
      // Tranches de dégradé temporel (ex: 8 tranches pour un rendu fluide et rapide sans O(N) draw calls)
      const numBatches = 8;
      const batchSize = Math.ceil(total / numBatches);

      for (let b = 0; b < numBatches; b++) {
        const startIdx = b * batchSize;
        if (startIdx >= total - 1) break;
        const endIdx = Math.min(total - 1, (b + 1) * batchSize);

        const progress = (startIdx + endIdx) / (2 * total); // 0 (vieux) à 1 (récent)
        const alpha = Math.max(0.04, Math.min(1, progress * progress));

        ctx.strokeStyle = this.color;
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        ctx.moveTo(this.points[startIdx].x, this.points[startIdx].y);
        for (let i = startIdx + 1; i <= endIdx; i++) {
          ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
