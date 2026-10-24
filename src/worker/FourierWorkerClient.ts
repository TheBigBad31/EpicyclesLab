import { WorkerComputeRequest, WorkerComputeResponse, processInverseFourier } from './fourier.worker';

export type { WorkerComputeRequest, WorkerComputeResponse };

export class FourierWorkerClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, {
    resolve: (res: WorkerComputeResponse) => void;
    reject: (err: Error) => void;
  }>();
  private requestCounter: number = 0;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(
          new URL('./fourier.worker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (e: MessageEvent<WorkerComputeResponse | { id: string; error: string }>) => {
          const data = e.data;
          const pending = this.pendingRequests.get(data.id);
          if (!pending) return;

          this.pendingRequests.delete(data.id);
          if ('error' in data && data.error) {
            pending.reject(new Error(data.error));
          } else {
            pending.resolve(data as WorkerComputeResponse);
          }
        };

        this.worker.onerror = (err) => {
          console.warn('Erreur Worker Fourier, repli synchrone :', err);
        };
      } catch (e) {
        console.warn('Impossible d’initialiser le Worker, mode fallback activé :', e);
        this.worker = null;
      }
    }
  }

  public async compute(request: Omit<WorkerComputeRequest, 'id'>): Promise<WorkerComputeResponse> {
    const id = `req_${++this.requestCounter}_${Date.now()}`;
    const fullRequest: WorkerComputeRequest = { ...request, id };

    // Si Worker actif dans le navigateur
    if (this.worker) {
      return new Promise<WorkerComputeResponse>((resolve, reject) => {
        this.pendingRequests.set(id, { resolve, reject });
        this.worker!.postMessage(fullRequest);
      });
    }

    // Fallback synchrone direct (pour tests Vitest ou navigateurs bridés)
    try {
      const response = processInverseFourier(fullRequest);
      return Promise.resolve(response);
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.pendingRequests.clear();
    }
  }
}
