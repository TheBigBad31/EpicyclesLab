export interface CameraState {
  x: number;       // Translation monde vers écran (centre de la vue dans le monde)
  y: number;
  zoom: number;    // Facteur d'échelle (> 0)
}

export interface CameraOptions {
  minZoom?: number;
  maxZoom?: number;
  smoothFactor?: number;
  followLead?: boolean;
}

export class Camera {
  public x: number = 0;
  public y: number = 0;
  public zoom: number = 1;

  public targetX: number = 0;
  public targetY: number = 0;
  public targetZoom: number = 1;

  public followTarget: boolean = false;
  public followZoom: number = 2.5;

  private minZoom: number;
  private maxZoom: number;
  private smoothFactor: number;

  constructor(options: CameraOptions = {}) {
    this.minZoom = options.minZoom ?? 0.05;
    this.maxZoom = options.maxZoom ?? 50;
    this.smoothFactor = options.smoothFactor ?? 0.15;
  }

  public setPosition(x: number, y: number, immediate: boolean = false): void {
    this.targetX = x;
    this.targetY = y;
    if (immediate) {
      this.x = x;
      this.y = y;
    }
  }

  public setZoom(zoom: number, immediate: boolean = false): void {
    const clamped = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    this.targetZoom = clamped;
    if (immediate) {
      this.zoom = clamped;
    }
  }

  public panBy(dxWorld: number, dyWorld: number): void {
    this.targetX += dxWorld;
    this.targetY += dyWorld;
    this.x = this.targetX;
    this.y = this.targetY;
    this.followTarget = false; // Tout pan manuel désactive le suivi automatique
  }

  public zoomAtScreenPoint(factor: number, screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): void {
    const oldZoom = this.targetZoom;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * factor));
    if (Math.abs(newZoom - oldZoom) < 1e-6) return;

    // Point dans le monde sous le curseur avant le zoom
    const worldPoint = this.screenToWorld(screenX, screenY, canvasWidth, canvasHeight);

    this.targetZoom = newZoom;
    this.zoom = newZoom; // Appliquer immédiatement pour un confort tactile/molette optimal

    // Ajuster le centre pour que le point sous la souris reste au même endroit écran
    // screenX = (worldPoint.x - newTargetX) * newZoom + canvasWidth / 2
    // => newTargetX = worldPoint.x - (screenX - canvasWidth / 2) / newZoom
    this.targetX = worldPoint.x - (screenX - canvasWidth / 2) / newZoom;
    this.targetY = worldPoint.y - (screenY - canvasHeight / 2) / newZoom;
    this.x = this.targetX;
    this.y = this.targetY;
  }

  public updateFollow(targetPoint: { x: number; y: number }, smooth: boolean = true): void {
    if (!this.followTarget) return;

    this.targetX = targetPoint.x;
    this.targetY = targetPoint.y;
    this.targetZoom = this.followZoom;

    if (!smooth) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.zoom = this.targetZoom;
    }
  }

  public tick(): void {
    // Interpolation douce vers la cible (damping exponentiel)
    this.x += (this.targetX - this.x) * this.smoothFactor;
    this.y += (this.targetY - this.y) * this.smoothFactor;
    this.zoom += (this.targetZoom - this.zoom) * this.smoothFactor;
  }

  public reset(immediate: boolean = true): void {
    this.targetX = 0;
    this.targetY = 0;
    this.targetZoom = 1;
    this.followTarget = false;
    if (immediate) {
      this.x = 0;
      this.y = 0;
      this.zoom = 1;
    }
  }

  public screenToWorld(screenX: number, screenY: number, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
    return {
      x: (screenX - canvasWidth / 2) / this.zoom + this.x,
      y: (screenY - canvasHeight / 2) / this.zoom + this.y,
    };
  }

  public worldToScreen(worldX: number, worldY: number, canvasWidth: number, canvasHeight: number): { x: number; y: number } {
    return {
      x: (worldX - this.x) * this.zoom + canvasWidth / 2,
      y: (worldY - this.y) * this.zoom + canvasHeight / 2,
    };
  }

  public applyTransform(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }
}
