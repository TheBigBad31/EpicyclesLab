import { EpicycleRenderer } from './render';
import { WorkshopModel, WorkshopUI, TransportBar } from './workshop';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('epicycle-canvas') as HTMLCanvasElement;
  const workshopContainer = document.getElementById('workshop-container') as HTMLElement;
  const transportContainer = document.getElementById('transport-bar-slot') as HTMLElement;

  if (!canvas || !workshopContainer || !transportContainer) {
    console.error("Éléments DOM d'initialisation manquants");
    return;
  }

  // Modèle de données de l'atelier
  const workshopModel = new WorkshopModel();

  // Moteur de rendu graphique 60 fps
  const renderer = new EpicycleRenderer({
    canvas,
    terms: [...workshopModel.getTerms()],
    maxCircles: 200,
    showCircles: true,
    showVectors: true,
    showTrail: true,
    showStats: true,
    theme: 'dark',
  });

  // Interface utilisateur de l'atelier
  new WorkshopUI(workshopContainer, workshopModel, renderer);

  // Barre de transport temporel
  new TransportBar(transportContainer, renderer);

  // Démarrer la boucle de rendu Canvas 60 FPS
  renderer.start();
});
