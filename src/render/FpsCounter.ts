export class FpsCounter {
  private frameCount: number = 0;
  private lastTime: number = 0;
  private fps: number = 60;
  private frameTimeMs: number = 16.6;

  constructor(initialTime: number = performance.now()) {
    this.lastTime = initialTime;
  }

  public reset(now: number = performance.now()): void {
    this.lastTime = now;
    this.frameCount = 0;
  }

  public update(now: number = performance.now()): void {
    this.frameCount++;
    const delta = now - this.lastTime;
    if (delta >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / delta);
      this.frameTimeMs = parseFloat((delta / this.frameCount).toFixed(1));
      this.frameCount = 0;
      this.lastTime = now;
    }
  }

  public getFps(): number {
    return this.fps;
  }

  public getFrameTimeMs(): number {
    return this.frameTimeMs;
  }
}
