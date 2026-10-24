export interface Complex {
  re: number;
  im: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export type RotationDirection = 'cw' | 'ccw';

export interface EpicycleTerm {
  freq: number;          // Fréquence entière signée k (-N/2 à N/2-1)
  amplitude: number;     // Rayon R_k = |X_k|
  phase: number;         // Phase initiale phi_k = atan2(Im(X_k), Re(X_k))
  re: number;            // Re(X_k)
  im: number;            // Im(X_k)
  direction: RotationDirection; // 'cw' si freq < 0 (sens horaire), 'ccw' si freq > 0 (sens trigo/anti-horaire)
  color?: string;        // Optionnel pour stylisation visuelle
}

export interface EpicycleEvaluation {
  centers: Point2D[];    // Chaîne des centres successifs (z_0, z_1, ..., z_M)
  tip: Point2D;          // Position finale de la pointe
  t: number;             // Paramètre temporel dans [0, 2pi)
}

export interface SpectralMetrics {
  totalEnergy: number;           // Énergie totale spectrale (Parseval)
  capturedEnergy: number;        // Énergie cumulée des M cercles retenus
  energyRatio: number;           // Ratio d'énergie capturée in [0, 1]
  rmse: number;                  // Erreur quadratique moyenne (pixels)
  relativeRmse: number;          // RMSE relative (% de la diagonale du bounding box)
  numCircles: number;            // Nombre de cercles utilisés
  totalCircles: number;          // Nombre total de cercles disponibles
}

export type CircleSortOrder = 'amplitude-desc' | 'frequency-asc' | 'natural';
export type GibbsWindowType = 'none' | 'lanczos' | 'fejer';
