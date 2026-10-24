import { EpicycleRenderer } from './render';
import { WorkshopModel, WorkshopUI, TransportBar } from './workshop';
import { InverseDrawingUI } from './drawing';
import { decodeConfigFromUrlHash } from './state';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('epicycle-canvas') as HTMLCanvasElement;
  const workshopContainer = document.getElementById('workshop-container') as HTMLElement;
  const inverseContainer = document.getElementById('inverse-container') as HTMLElement;
  const transportContainer = document.getElementById('transport-bar-slot') as HTMLElement;

  if (!canvas || !workshopContainer || !inverseContainer || !transportContainer) {
    console.error("Éléments DOM d'initialisation manquants");
    return;
  }

  // 1. Modèle de données de l'atelier
  const workshopModel = new WorkshopModel();

  // 2. Moteur de rendu graphique 60 fps
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

  // 3. Interface utilisateur de l'atelier
  new WorkshopUI(workshopContainer, workshopModel, renderer);

  // 4. Interface utilisateur du mode Dessin Inverse
  const inverseUI = new InverseDrawingUI({
    container: inverseContainer,
    renderer,
  });

  // 5. Barre de transport temporel
  new TransportBar(transportContainer, renderer);

  // 6. Gestion du système d'onglets de Mode (Atelier vs Dessin Inverse)
  const tabWorkshop = document.getElementById('tab-workshop') as HTMLButtonElement;
  const tabInverse = document.getElementById('tab-inverse') as HTMLButtonElement;

  function switchMode(mode: 'workshop' | 'inverse') {
    if (mode === 'workshop') {
      tabWorkshop?.classList.add('active');
      tabInverse?.classList.remove('active');
      workshopContainer.style.display = 'block';
      inverseContainer.style.display = 'none';
      renderer.showTargetCurve = false;
      renderer.setTerms([...workshopModel.getTerms()], true);
    } else {
      tabInverse?.classList.add('active');
      tabWorkshop?.classList.remove('active');
      inverseContainer.style.display = 'block';
      workshopContainer.style.display = 'none';
      renderer.showTargetCurve = true;
    }
  }

  tabWorkshop?.addEventListener('click', () => switchMode('workshop'));
  tabInverse?.addEventListener('click', () => switchMode('inverse'));

  // 7. Vérifier la présence d'un hash de partage URL (#config=...)
  if (window.location.hash) {
    const sharedState = decodeConfigFromUrlHash(window.location.hash);
    if (sharedState) {
      if (sharedState.mode === 'workshop') {
        if (sharedState.terms) workshopModel.setTerms(sharedState.terms);
        switchMode('workshop');
      } else {
        inverseUI.restoreFromState(sharedState);
        switchMode('inverse');
      }
    }
  }

  // Démarrer la boucle de rendu Canvas 60 FPS
  renderer.start();
});
