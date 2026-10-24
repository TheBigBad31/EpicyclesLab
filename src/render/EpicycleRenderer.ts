import { EpicycleTerm, Point2D, evaluateEpicycles } from '../math';
import { Camera } from './Camera';
import { TrailBuffer, TrailOptions } from './TrailBuffer';
import { FpsCounter } from './FpsCounter';
import { EpicycleThemeId, THEMES, ThemeColors } from './themes';

export interface EpicycleRendererOptions {
  canvas: HTMLCanvasElement;
  terms?: EpicycleTerm[];
  maxCircles?: number;
  trailOptions?: TrailOptions;
  showCircles?: boolean;
  showVectors?: boolean;
  showTrail?: boolean;
  showStats?: boolean;
  showAxes?: boolean;
  showTargetCurve?: boolean;
  targetCurvePoints?: Point2D[];
  theme?: EpicycleThemeId | 'dark' | 'light';
}

export class EpicycleRenderer {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public camera: Camera;
  public trail: TrailBuffer;
  public fpsCounter: FpsCounter;

  public terms: EpicycleTerm[] = [];
  public maxCircles: number = 200;

  public showCircles: boolean = true;
  public showVectors: boolean = true;
  public showTrail: boolean = true;
  public showStats: boolean = true;
  public showAxes: boolean = true;
  public showTargetCurve: boolean = false;
  public targetCurvePoints: Point2D[] = [];
  public theme: EpicycleThemeId = 'cosmos';

  // Animation & transport temporel
  public isPlaying: boolean = true;
  public time: number = 0;             // t dans [0, 2pi)
  public speedMultiplier: number = 1.0; // 0.1x à 4x
  public basePeriodSeconds: number = 12; // Temps d'un tour complet (2pi) à 1x

  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private dpr: number = 1;
  private resizeObserver: ResizeObserver | null = null;

  // Interaction pointeurs / gestes tactiles
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private activePointers = new Map<number, { x: number; y: number }>();
  private initialPinchDist: number | null = null;

  // Derniers centres calculés pour l'inspection
  public lastCenters: Point2D[] = [];
  public lastTip: Point2D = { x: 0, y: 0 };

  constructor(options: EpicycleRendererOptions) {
    this.canvas = options.canvas;
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error("Impossible d'obtenir le contexte CanvasRenderingContext2D");
    }
    this.ctx = ctx;

    this.camera = new Camera();
    this.fpsCounter = new FpsCounter();

    if (options.theme) {
      this.setTheme(options.theme);
    } else {
      this.setTheme('cosmos');
    }

    this.trail = new TrailBuffer({
      ...options.trailOptions,
      color: THEMES[this.theme].trailColor,
      glowColor: THEMES[this.theme].trailGlowColor,
    });

    if (options.terms) this.terms = options.terms;
    if (options.maxCircles !== undefined) this.maxCircles = options.maxCircles;
    if (options.showCircles !== undefined) this.showCircles = options.showCircles;
    if (options.showVectors !== undefined) this.showVectors = options.showVectors;
    if (options.showTrail !== undefined) this.showTrail = options.showTrail;
    if (options.showStats !== undefined) this.showStats = options.showStats;
    if (options.showAxes !== undefined) this.showAxes = options.showAxes;
    if (options.showTargetCurve !== undefined) this.showTargetCurve = options.showTargetCurve;
    if (options.targetCurvePoints) this.targetCurvePoints = options.targetCurvePoints;

    this.setupDprAndResize();
    this.setupInteractions();
  }

  public setTheme(themeId: EpicycleThemeId | 'dark' | 'light'): void {
    let resolved: EpicycleThemeId = 'cosmos';
    if (themeId === 'dark') resolved = 'cosmos';
    else if (themeId === 'light') resolved = 'paper';
    else if (THEMES[themeId]) resolved = themeId;

    this.theme = resolved;
    const currentTheme = THEMES[this.theme];
    if (this.trail) {
      this.trail.color = currentTheme.trailColor;
      this.trail.glowColor = currentTheme.trailGlowColor;
    }
  }

  public getThemeConfig(): ThemeColors {
    return THEMES[this.theme] || THEMES.cosmos;
  }

  private setupDprAndResize(): void {
    const updateSize = () => {
      this.dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(10, Math.floor(rect.width));
      const height = Math.max(10, Math.floor(rect.height));

      this.canvas.width = Math.floor(width * this.dpr);
      this.canvas.height = Math.floor(height * this.dpr);
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        updateSize();
      });
      this.resizeObserver.observe(this.canvas);
    } else {
      window.addEventListener('resize', updateSize);
    }
  }

  private setupInteractions(): void {
    const canvas = this.canvas;

    // Zoom molette souris fluide
    canvas.addEventListener(
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        const factor = Math.exp(-e.deltaY * 0.0015);
        this.camera.zoomAtScreenPoint(
          factor,
          screenX,
          screenY,
          rect.width,
          rect.height
        );
      },
      { passive: false }
    );

    // Pan & Pincement tactile multi-touch (Pointer Events)
    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 1) {
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
      } else if (this.activePointers.size === 2) {
        // Début du pincement à deux doigts
        this.isDragging = false;
        const pts = Array.from(this.activePointers.values());
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        this.initialPinchDist = Math.hypot(dx, dy);
      }
    });

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.activePointers.has(e.pointerId)) return;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 1 && this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;

        // Déplacement monde proportionnel au zoom inverse
        this.camera.panBy(dx / this.camera.zoom, dy / this.camera.zoom);
      } else if (this.activePointers.size === 2 && this.initialPinchDist !== null) {
        // Pincement tactile (Pinch-to-zoom)
        const pts = Array.from(this.activePointers.values());
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const dist = Math.hypot(dx, dy);

        if (this.initialPinchDist > 0) {
          const rect = canvas.getBoundingClientRect();
          const centerX = (pts[0].x + pts[1].x) / 2 - rect.left;
          const centerY = (pts[0].y + pts[1].y) / 2 - rect.top;
          const factor = dist / this.initialPinchDist;
          this.initialPinchDist = dist; // Glissement continu fluide
          this.camera.zoomAtScreenPoint(
            factor,
            centerX,
            centerY,
            rect.width,
            rect.height
          );
        }
      }
    });

    const onPointerUp = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size === 1) {
        const remaining = Array.from(this.activePointers.values())[0];
        this.isDragging = true;
        this.dragStartX = remaining.x;
        this.dragStartY = remaining.y;
        this.initialPinchDist = null;
      } else if (this.activePointers.size === 0) {
        this.isDragging = false;
        this.initialPinchDist = null;
      }
    };

    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
  }

  public setTerms(terms: EpicycleTerm[], resetTrail: boolean = true): void {
    this.terms = terms;
    if (resetTrail) {
      this.trail.clear();
    }
  }

  public start(): void {
    if (this.animationFrameId !== null) return;
    this.lastFrameTime = performance.now();
    const loop = (now: number) => {
      this.renderFrame(now);
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public setTime(t: number): void {
    this.time = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    this.evaluateCurrentState();
  }

  public evaluateCurrentState(): { centers: Point2D[]; tip: Point2D } {
    const activeTermsCount = Math.min(this.terms.length, this.maxCircles);
    const evalResult = evaluateEpicycles(this.terms, this.time, activeTermsCount);
    this.lastCenters = evalResult.centers;
    this.lastTip = evalResult.tip;
    return evalResult;
  }

  public renderFrame(now: number = performance.now()): void {
    this.fpsCounter.update(now);

    const deltaSeconds = this.lastFrameTime > 0 ? (now - this.lastFrameTime) / 1000 : 0.016;
    this.lastFrameTime = now;

    // Progression temporelle
    if (this.isPlaying) {
      const dt = ((2 * Math.PI) / this.basePeriodSeconds) * this.speedMultiplier * deltaSeconds;
      this.time = (this.time + dt) % (2 * Math.PI);
    }

    // Évaluation mathématique des centres
    const { centers, tip } = this.evaluateCurrentState();

    // Ajout à la traînée
    if (this.showTrail && centers.length > 0) {
      this.trail.addPoint(tip.x, tip.y, this.time);
    }

    // Mise à jour de la caméra
    if (this.camera.followTarget && centers.length > 0) {
      this.camera.updateFollow(tip, true);
    }
    this.camera.tick();

    // Rendu Canvas
    this.drawScene(centers, tip);
  }

  private drawScene(centers: Point2D[], tip: Point2D): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const logicalWidth = width / this.dpr;
    const logicalHeight = height / this.dpr;
    const themeCfg = this.getThemeConfig();

    // Reset du canvas
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = themeCfg.bgMain;
    ctx.fillRect(0, 0, width, height);

    // Grille de fond discrète et repères cartésiens
    this.drawBackgroundGrid(logicalWidth, logicalHeight);

    // Application de la caméra avec support DPR
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    this.camera.applyTransform(ctx, logicalWidth, logicalHeight);

    // 0. Superposition filigrane de la courbe cible originale (Mode Dessin Inverse)
    if (this.showTargetCurve && this.targetCurvePoints.length > 1) {
      this.drawTargetCurve(ctx);
    }

    // 1. Rendu de la traînée lumineuse (Trail)
    if (this.showTrail) {
      this.trail.render(ctx, this.camera.zoom);
    }

    // 2. Rendu des cercles et vecteurs orbitaux
    const activeCount = Math.min(this.terms.length, this.maxCircles);
    if (activeCount > 0 && centers.length >= 2) {
      this.drawEpicycles(ctx, centers, activeCount);
    }

    // 3. Pointe traçante brillante (Tip Glow)
    if (centers.length > 0) {
      this.drawTipGlow(ctx, tip);
    }

    ctx.restore();

    // 4. Overlays UI & Stats discrètes (FPS, Cercles, Frame time)
    if (this.showStats) {
      this.drawStatsOverlay();
    }
  }

  public setTargetCurve(points: Point2D[], show: boolean = true): void {
    this.targetCurvePoints = [...points];
    this.showTargetCurve = show;
  }

  private drawTargetCurve(ctx: CanvasRenderingContext2D): void {
    const pts = this.targetCurvePoints;
    if (pts.length < 2) return;
    const themeCfg = this.getThemeConfig();

    ctx.save();
    ctx.strokeStyle = themeCfg.targetCurveColor;
    ctx.lineWidth = Math.max(1, 2 / Math.sqrt(this.camera.zoom));
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private drawBackgroundGrid(logicalWidth: number, logicalHeight: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const themeCfg = this.getThemeConfig();
    const isBlueprint = this.theme === 'blueprint';
    const baseGridSize = isBlueprint ? 40 : 50;
    const effectiveGridSize = baseGridSize * this.camera.zoom;

    // 1. Grille millimétrée / cartésienne
    if (effectiveGridSize > 15) {
      ctx.strokeStyle = themeCfg.gridColor;
      ctx.lineWidth = isBlueprint ? 0.8 : 1;

      const offsetX = ((logicalWidth / 2 - this.camera.x * this.camera.zoom) % effectiveGridSize + effectiveGridSize) % effectiveGridSize;
      const offsetY = ((logicalHeight / 2 - this.camera.y * this.camera.zoom) % effectiveGridSize + effectiveGridSize) % effectiveGridSize;

      ctx.beginPath();
      for (let x = offsetX; x < logicalWidth; x += effectiveGridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, logicalHeight);
      }
      for (let y = offsetY; y < logicalHeight; y += effectiveGridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(logicalWidth, y);
      }
      ctx.stroke();
    }

    // 2. Axes du repère complexe (Re, Im)
    if (this.showAxes) {
      const originX = logicalWidth / 2 - this.camera.x * this.camera.zoom;
      const originY = logicalHeight / 2 - this.camera.y * this.camera.zoom;

      ctx.strokeStyle = themeCfg.axisColor;
      ctx.lineWidth = isBlueprint ? 1.5 : 1.2;
      ctx.setLineDash(isBlueprint ? [] : [4, 4]);

      ctx.beginPath();
      // Axe Réel (Re) horizontal
      if (originY >= 0 && originY <= logicalHeight) {
        ctx.moveTo(0, originY);
        ctx.lineTo(logicalWidth, originY);
      }
      // Axe Imaginaire (Im) vertical
      if (originX >= 0 && originX <= logicalWidth) {
        ctx.moveTo(originX, 0);
        ctx.lineTo(originX, logicalHeight);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Étiquettes Re et Im
      ctx.fillStyle = themeCfg.axisColor;
      ctx.font = '10px ui-monospace, monospace';
      if (originY >= 20 && originY <= logicalHeight - 10) {
        ctx.fillText('Re(z)', logicalWidth - 42, originY - 6);
      }
      if (originX >= 10 && originX <= logicalWidth - 40) {
        ctx.fillText('Im(z)', originX + 6, 20);
      }
    }

    ctx.restore();
  }

  private drawEpicycles(ctx: CanvasRenderingContext2D, centers: Point2D[], activeCount: number): void {
    const themeCfg = this.getThemeConfig();
    const zoom = this.camera.zoom;
    const baseLineWidth = Math.max(0.6, 1.2 / Math.sqrt(zoom));

    for (let i = 0; i < activeCount; i++) {
      const prevCenter = centers[i];
      const nextCenter = centers[i + 1];
      const term = this.terms[i];
      if (!term || !nextCenter) continue;

      const radius = term.amplitude;
      if (radius < 0.2 / zoom) continue; // Culling des cercles sub-pixels pour fluidité maximale

      const circleColor = term.color || themeCfg.circleDefault;
      const vectorColor = term.color || themeCfg.vectorDefault;

      // Cercle orbital
      if (this.showCircles) {
        ctx.beginPath();
        ctx.arc(prevCenter.x, prevCenter.y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = circleColor;
        ctx.lineWidth = baseLineWidth;
        ctx.stroke();
      }

      // Rayon vecteur reliant le centre précédent au centre suivant
      if (this.showVectors) {
        ctx.beginPath();
        ctx.moveTo(prevCenter.x, prevCenter.y);
        ctx.lineTo(nextCenter.x, nextCenter.y);
        ctx.strokeStyle = vectorColor;
        ctx.lineWidth = baseLineWidth * 1.3;
        ctx.stroke();

        // Articulation / pivot (petit disque)
        const pivotRadius = Math.max(1.2, 2.5 / Math.sqrt(zoom));
        ctx.beginPath();
        ctx.arc(prevCenter.x, prevCenter.y, pivotRadius, 0, 2 * Math.PI);
        ctx.fillStyle = themeCfg.pivotColor;
        ctx.fill();
      }
    }
  }

  private drawTipGlow(ctx: CanvasRenderingContext2D, tip: Point2D): void {
    const themeCfg = this.getThemeConfig();
    const zoom = this.camera.zoom;
    const r = Math.max(2.5, 4.5 / Math.sqrt(zoom));

    // Halo lumineux externe
    ctx.save();
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, r * 2.8, 0, 2 * Math.PI);
    ctx.fillStyle = themeCfg.tipGlowColor;
    ctx.fill();

    // Pointe interne éclatante
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = themeCfg.tipColor;
    ctx.shadowColor = themeCfg.tipGlowColor;
    ctx.shadowBlur = this.theme === 'paper' ? 3 : 8;
    ctx.fill();
    ctx.restore();
  }

  private drawStatsOverlay(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const fps = this.fpsCounter.getFps();
    const ms = this.fpsCounter.getFrameTimeMs();
    const active = Math.min(this.terms.length, this.maxCircles);
    const total = this.terms.length;
    const themeCfg = this.getThemeConfig();
    const isDark = this.theme !== 'paper';

    const text = `${fps} FPS | ${ms} ms | ${active}/${total} cercles | Zoom: ${this.camera.zoom.toFixed(2)}x`;

    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    const textWidth = ctx.measureText(text).width;
    const paddingX = 8;
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = 22;
    const x = 12;
    const y = 12;

    // Fond pill discret
    ctx.fillStyle = themeCfg.statsBgColor;
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, boxWidth, boxHeight, 6) : ctx.rect(x, y, boxWidth, boxHeight);
    ctx.fill();
    ctx.stroke();

    // Couleur du texte dynamique selon les FPS
    let fpsColor = isDark ? '#4ade80' : '#16a34a'; // vert
    if (fps < 45) fpsColor = isDark ? '#facc15' : '#ca8a04'; // jaune
    if (fps < 30) fpsColor = isDark ? '#f87171' : '#dc2626'; // rouge

    ctx.fillStyle = fpsColor;
    ctx.fillText(`${fps} FPS`, x + paddingX, y + 15);

    ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
    const fpsWidth = ctx.measureText(`${fps} FPS `).width;
    ctx.fillText(`| ${ms} ms | ${active}/${total} cercles | ${this.camera.zoom.toFixed(2)}x`, x + paddingX + fpsWidth, y + 15);

    ctx.restore();
  }

  public destroy(): void {
    this.stop();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }
}
