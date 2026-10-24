import { EpicycleRenderer } from './render';
import { EpicycleThemeId } from './render/themes';
import { WorkshopModel, WorkshopUI, TransportBar } from './workshop';
import { InverseDrawingUI } from './drawing';
import { decodeConfigFromUrlHash } from './state';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('epicycle-canvas') as HTMLCanvasElement;
  const workshopContainer = document.getElementById('workshop-container') as HTMLElement;
  const inverseContainer = document.getElementById('inverse-container') as HTMLElement;
  const transportContainer = document.getElementById('transport-bar-slot') as HTMLElement;
  const sidebar = document.getElementById('sidebar-container') as HTMLElement;
  const sidebarBackdrop = document.getElementById('sidebar-backdrop') as HTMLElement;

  if (!canvas || !workshopContainer || !inverseContainer || !transportContainer) {
    console.error("Éléments DOM d'initialisation manquants");
    return;
  }

  // 1. Récupération du thème sauvegardé dans localStorage
  const savedTheme = (localStorage.getItem('epicycleslab_theme') as EpicycleThemeId) || 'cosmos';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // 2. Modèle de données de l'atelier
  const workshopModel = new WorkshopModel();

  // 3. Moteur de rendu graphique 60 fps
  const renderer = new EpicycleRenderer({
    canvas,
    terms: [...workshopModel.getTerms()],
    maxCircles: 200,
    showCircles: true,
    showVectors: true,
    showTrail: true,
    showStats: true,
    showAxes: true,
    theme: savedTheme,
  });

  // 4. Interface utilisateur de l'atelier
  new WorkshopUI(workshopContainer, workshopModel, renderer);

  // 5. Interface utilisateur du mode Dessin Inverse
  const inverseUI = new InverseDrawingUI({
    container: inverseContainer,
    renderer,
  });

  // 6. Barre de transport temporel
  const transportBar = new TransportBar(transportContainer, renderer);

  // 7. Gestion du système d'onglets de Mode (Atelier vs Dessin Inverse)
  const tabWorkshop = document.getElementById('tab-workshop') as HTMLButtonElement;
  const tabInverse = document.getElementById('tab-inverse') as HTMLButtonElement;
  const mobLabelMode = document.getElementById('mob-label-mode') as HTMLElement;
  let currentMode: 'workshop' | 'inverse' = 'inverse';

  function switchMode(mode: 'workshop' | 'inverse') {
    currentMode = mode;
    if (mode === 'workshop') {
      tabWorkshop?.classList.add('active');
      tabWorkshop?.setAttribute('aria-selected', 'true');
      tabInverse?.classList.remove('active');
      tabInverse?.setAttribute('aria-selected', 'false');
      workshopContainer.style.display = 'block';
      inverseContainer.style.display = 'none';
      renderer.showTargetCurve = false;
      renderer.setTerms([...workshopModel.getTerms()], true);
      if (mobLabelMode) mobLabelMode.textContent = 'Dessin Inv.';
    } else {
      tabInverse?.classList.add('active');
      tabInverse?.setAttribute('aria-selected', 'true');
      tabWorkshop?.classList.remove('active');
      tabWorkshop?.setAttribute('aria-selected', 'false');
      inverseContainer.style.display = 'block';
      workshopContainer.style.display = 'none';
      renderer.showTargetCurve = true;
      if (mobLabelMode) mobLabelMode.textContent = 'Mode Atelier';
    }
  }

  tabWorkshop?.addEventListener('click', () => switchMode('workshop'));
  tabInverse?.addEventListener('click', () => switchMode('inverse'));

  // 8. Gestion des 3 Thèmes Visuels (Cosmos, Blueprint, Papier) avec persistance localStorage
  const themeButtons = document.querySelectorAll<HTMLButtonElement>('.btn-theme');
  function applyTheme(themeId: EpicycleThemeId) {
    document.documentElement.setAttribute('data-theme', themeId);
    renderer.setTheme(themeId);
    localStorage.setItem('epicycleslab_theme', themeId);

    themeButtons.forEach(btn => {
      const match = btn.dataset.themeId === themeId;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-pressed', match ? 'true' : 'false');
    });
  }

  themeButtons.forEach(btn => {
    const tId = btn.dataset.themeId as EpicycleThemeId;
    btn.addEventListener('click', () => applyTheme(tId));
    if (tId === savedTheme) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
  });

  // 9. Contrôles Vue Flottants (Suivi pointe, Recentrer, Repère complexe Re/Im)
  const btnViewFollow = document.getElementById('btn-view-follow');
  const btnViewReset = document.getElementById('btn-view-reset');
  const btnViewAxes = document.getElementById('btn-view-axes');

  btnViewFollow?.addEventListener('click', () => {
    renderer.camera.followTarget = !renderer.camera.followTarget;
    btnViewFollow.classList.toggle('active', renderer.camera.followTarget);
  });

  btnViewReset?.addEventListener('click', () => {
    renderer.camera.reset(true);
    btnViewFollow?.classList.remove('active');
  });

  btnViewAxes?.addEventListener('click', () => {
    renderer.showAxes = !renderer.showAxes;
    btnViewAxes.classList.toggle('active', renderer.showAxes);
  });

  // 10. Tiroir Mobile (Drawer) & Barre Inférieure
  const btnToggleDrawer = document.getElementById('btn-toggle-drawer');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  const mobBtnOpenSettings = document.getElementById('mob-btn-open-settings');
  const mobBtnPlay = document.getElementById('mob-btn-play');
  const mobBtnPresetPi = document.getElementById('mob-btn-preset-pi');
  const mobBtnSwitchMode = document.getElementById('mob-btn-switch-mode');

  function openDrawer() {
    sidebar?.classList.add('open');
    sidebarBackdrop?.classList.add('active');
  }

  function closeDrawer() {
    sidebar?.classList.remove('open');
    sidebarBackdrop?.classList.remove('active');
  }

  btnToggleDrawer?.addEventListener('click', openDrawer);
  mobBtnOpenSettings?.addEventListener('click', openDrawer);
  btnCloseDrawer?.addEventListener('click', closeDrawer);
  sidebarBackdrop?.addEventListener('click', closeDrawer);

  mobBtnPlay?.addEventListener('click', () => {
    renderer.isPlaying = !renderer.isPlaying;
    transportBar.updatePlayState(renderer.isPlaying);
    mobBtnPlay.classList.toggle('active', renderer.isPlaying);
  });

  mobBtnPresetPi?.addEventListener('click', () => {
    if (currentMode !== 'inverse') {
      switchMode('inverse');
    }
    inverseUI.loadPreset('pi');
  });

  mobBtnSwitchMode?.addEventListener('click', () => {
    switchMode(currentMode === 'inverse' ? 'workshop' : 'inverse');
  });

  // 11. Modal Raccourcis Clavier & Plein écran
  const shortcutsDialog = document.getElementById('shortcuts-dialog') as HTMLDialogElement | null;
  const btnShortcutsModal = document.getElementById('btn-shortcuts-modal');
  const btnCloseShortcuts = document.getElementById('btn-close-shortcuts');
  const btnShortcutsOk = document.getElementById('btn-shortcuts-ok');
  const btnFullscreen = document.getElementById('btn-fullscreen');

  btnShortcutsModal?.addEventListener('click', () => shortcutsDialog?.showModal());
  btnCloseShortcuts?.addEventListener('click', () => shortcutsDialog?.close());
  btnShortcutsOk?.addEventListener('click', () => shortcutsDialog?.close());

  btnFullscreen?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // 12. Raccourcis Clavier Globaux (Espace, R, F, A, C, 1-8)
  const presetKeys: Record<string, string> = {
    '1': 'pi',
    '2': 'heart',
    '3': 'star',
    '4': 'butterfly',
    '5': 'clef',
    '6': 'square',
    '7': 'lissajous',
  };

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') {
      return;
    }

    // R: Reset Caméra
    if (e.key === 'r' || e.key === 'R') {
      renderer.camera.reset(true);
      btnViewFollow?.classList.remove('active');
    }
    // F: Suivi pointe
    else if (e.key === 'f' || e.key === 'F') {
      renderer.camera.followTarget = !renderer.camera.followTarget;
      btnViewFollow?.classList.toggle('active', renderer.camera.followTarget);
    }
    // A: Repère Axes
    else if (e.key === 'a' || e.key === 'A') {
      renderer.showAxes = !renderer.showAxes;
      btnViewAxes?.classList.toggle('active', renderer.showAxes);
    }
    // C: Clear trail
    else if (e.key === 'c' || e.key === 'C') {
      renderer.trail.clear();
    }
    // Presets 1-7
    else if (presetKeys[e.key]) {
      const presetId = presetKeys[e.key];
      if (currentMode !== 'inverse') {
        switchMode('inverse');
      }
      inverseUI.loadPreset(presetId);
    }
  });

  // 13. Vérifier la présence d'un hash de partage URL (#config=...)
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
