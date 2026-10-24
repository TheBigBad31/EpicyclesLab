# 🌀 EpicyclesLab — Atelier Interactif d'Épicycles & Séries de Fourier

Application web interactive **PWA Mobile-First & Desktop Studio** inspirée de la vidéo [*"Spinning Circles Can Draw Anything (Even π)"* (Transcendental Space)](https://www.youtube.com/shorts/f86hEjFkm8g), permettant de manipuler des cercles imbriqués en rotation (épicycles) et de décomposer n'importe quel tracé en séries de Fourier complexes à **60 fps**.

---

## 🚀 Déploiement Vercel & Intégration AppHub

- **URL de Production Vercel** : `https://epicycles-lab.vercel.app`
- **Déploiement / Import Vercel en 1 clic** : [`https://vercel.com/new/clone?repository-url=https://github.com/TheBigBad31/EpicyclesLab&project-name=epicycles-lab`](https://vercel.com/new/clone?repository-url=https://github.com/TheBigBad31/EpicyclesLab&project-name=epicycles-lab)
- **Portail Central AppHub** : Référencé dans [`TheBigBad31/AppHub`](https://github.com/TheBigBad31/AppHub) (`https://apphub-beryl.vercel.app`) dans la catégorie **Maths & Animation**.

---

## ✨ Fonctionnalités Principales

### 1. Mode Dessin Inverse (Analyse de Fourier DFT / FFT)
- **Tracé à main levée** fluide (souris, stylet, tactile mobile multi-touch sans défilement parasite).
- **8 Courbes de référence intégrées** : Symbole **$\pi$ (Pi)**, Cœur paramétrique, Étoile à 5 branches, Papillon de Temple Fay, Clé de Sol, Onde carrée 2D, Épitrochoïde et Courbe de Lissajous.
- **Import de contour SVG** (`<path d="...">`, `<polygon>`, `<polyline>`).
- **Calcul asynchrone en Web Worker** :
  - Rééchantillonnage paramétrique uniforme par **abscisse curviligne (longueur d'arc)** ($N = 64 \dots 1024$),
  - **FFT Radix-2 (Cooley-Tukey)** en $O(N \log N)$ et **DFT exacte** centrée sur $k \in [-\lfloor N/2 \rfloor, \lceil N/2 \rceil - 1]$,
  - Atténuation du **phénomène de Gibbs** (fenêtrage $\sigma$ de **Lanczos** et sommes de **Fejér / Cesàro**) et lissage spatial gaussien.
- **Curseur dynamique du nombre de cercles ($M$ de $1$ à $N$)** avec affichage en temps réel de :
  - l'**erreur d'approximation RMSE** (en pixels et en % relatif),
  - le **ratio d'énergie spectrale capturée (%)** (identité de Parseval),
  - le mini-spectre interactif des amplitudes.

### 2. Mode Atelier (Synthèse Directe)
- Création, duplication, suppression et réorganisation libre d'une chaîne d'épicycles :
  - **Rayon (amplitude)**, **Fréquence / vitesse ($k$)**, **Phase initiale ($0^\circ \dots 360^\circ$)**, **Sens de rotation (Horaire ↻ / Anti-horaire ↺)** et **Couleur**.
- Tri en 1 clic par amplitude décroissante ou par ordre fréquentiel.
- 4 préréglages d'atelier : *Orbite Planétaire*, *Spirale Harmonique*, *Carré de Fourier*, *Étoile Mécanique*.

### 3. Moteur de Rendu 60 FPS, Caméra & Exports
- **60 fps constants avec 200+ cercles simultanés** (culling sub-pixel, `TrailBuffer` segmenté, support `devicePixelRatio` Retina/OLED).
- **Caméra interactive** : Zoom/Pan + mode **Camera Follow (Suivi zoomé de la pointe traçante)**.
- **3 Thèmes visuels** : *Cosmos Neon* (défaut), *Blueprint Mathématique* (grille complexe $\text{Re}/\text{Im}$), *Papier & Encre* (mode clair).
- **Exports & Partage** : Export **PNG haute résolution**, **SVG vectoriel**, **JSON complet** et **lien de partage par URL (`#config=...`)**.

---

## 🛠️ Architecture & Commandes

```text
src/
├── math/       # Bibliothèque mathématique pure (Complex, DFT/FFT, Resampling, Gibbs, Metrics, Presets, SVG parser)
├── worker/     # Web Worker DFT/FFT asynchrone + client avec fallback transparent
├── render/     # Moteur Canvas 2D 60fps (EpicycleRenderer, Camera, TrailBuffer, FpsCounter)
├── workshop/   # Modèle réactif du Mode Atelier & barre de transport temporelle
├── drawing/    # Capture Pointer Events à main levée & importateur SVG
├── state/      # Sérialisation JSON, encodage URL Hash Base64URL & gestion des thèmes
└── export/     # Générateurs d'exports vectoriels SVG et matriciels PNG
```

```bash
npm install
npm test          # Exécute la suite de tests unitaires Vitest
npm run build     # Vérifie le typage TypeScript (tsc) et compile le bundle de production Vite
npm run dev       # Lance le serveur de développement local
```
