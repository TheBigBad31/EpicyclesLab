import { Point2D } from '../math/types';

export interface DrawingCanvasOptions {
  onStrokeComplete?: (points: Point2D[]) => void;
  onStrokeUpdate?: (points: Point2D[]) => void;
  strokeColor?: string;
  lineWidth?: number;
}

export class DrawingPad {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  private isDrawing: boolean = false;
  private rawPoints: Point2D[] = [];
  private onStrokeComplete?: (points: Point2D[]) => void;
  private onStrokeUpdate?: (points: Point2D[]) => void;

  public strokeColor: string = '#38bdf8';
  public lineWidth: number = 3;

  constructor(canvas: HTMLCanvasElement, options: DrawingCanvasOptions = {}) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Contexte 2D indisponible pour le DrawingPad');
    }
    this.ctx = ctx;

    this.onStrokeComplete = options.onStrokeComplete;
    this.onStrokeUpdate = options.onStrokeUpdate;
    if (options.strokeColor) this.strokeColor = options.strokeColor;
    if (options.lineWidth) this.lineWidth = options.lineWidth;

    this.initEvents();
    this.resizeCanvas();
  }

  public resizeCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(10, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(10, Math.floor(rect.height * dpr));
    this.ctx.scale(dpr, dpr);
    this.redraw();
  }

  private initEvents(): void {
    const canvas = this.canvas;
    canvas.style.touchAction = 'none';

    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      this.isDrawing = true;
      this.rawPoints = [];

      const pt = this.getCanvasPoint(e);
      this.rawPoints.push(pt);
      this.redraw();
      this.onStrokeUpdate?.([...this.rawPoints]);
    });

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.isDrawing) return;
      const pt = this.getCanvasPoint(e);

      // Éviter d'enregistrer des doublons consécutifs à distance nulle
      const last = this.rawPoints[this.rawPoints.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 2) {
        return;
      }

      this.rawPoints.push(pt);
      this.redraw();
      this.onStrokeUpdate?.([...this.rawPoints]);
    });

    const onPointerUp = (e: PointerEvent) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      if (this.rawPoints.length > 2) {
        this.onStrokeComplete?.([...this.rawPoints]);
      }
    };

    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
  }

  private getCanvasPoint(e: PointerEvent): Point2D {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  public clear(): void {
    this.rawPoints = [];
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);
  }

  public getPoints(): Point2D[] {
    return [...this.rawPoints];
  }

  public setPoints(points: Point2D[]): void {
    this.rawPoints = [...points];
    this.redraw();
  }

  public redraw(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    if (this.rawPoints.length < 2) return;

    this.ctx.save();
    this.ctx.strokeStyle = this.strokeColor;
    this.ctx.lineWidth = this.lineWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(this.rawPoints[0].x, this.rawPoints[0].y);
    for (let i = 1; i < this.rawPoints.length; i++) {
      this.ctx.lineTo(this.rawPoints[i].x, this.rawPoints[i].y);
    }
    this.ctx.stroke();

    // Petits points d'échantillonnage discrets
    this.ctx.fillStyle = '#60a5fa';
    for (const p of this.rawPoints) {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.restore();
  }
}
