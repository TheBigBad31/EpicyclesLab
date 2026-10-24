export type EpicycleThemeId = 'cosmos' | 'blueprint' | 'paper';

export interface ThemeColors {
  id: EpicycleThemeId;
  name: string;
  bgMain: string;
  gridColor: string;
  axisColor: string;
  circleDefault: string;
  vectorDefault: string;
  pivotColor: string;
  trailColor: string;
  trailGlowColor: string;
  tipColor: string;
  tipGlowColor: string;
  targetCurveColor: string;
  statsTextColor: string;
  statsBgColor: string;
}

export const THEMES: Record<EpicycleThemeId, ThemeColors> = {
  cosmos: {
    id: 'cosmos',
    name: 'Cosmos Neon',
    bgMain: '#070b19',
    gridColor: 'rgba(56, 189, 248, 0.05)',
    axisColor: 'rgba(56, 189, 248, 0.18)',
    circleDefault: 'rgba(99, 102, 241, 0.22)',
    vectorDefault: '#fbbf24', // Vecteurs dorés 3Blue1Brown
    pivotColor: '#38bdf8',
    trailColor: '#38bdf8',
    trailGlowColor: 'rgba(56, 189, 248, 0.6)',
    tipColor: '#ffffff',
    tipGlowColor: '#38bdf8',
    targetCurveColor: 'rgba(244, 63, 94, 0.5)',
    statsTextColor: '#38bdf8',
    statsBgColor: 'rgba(7, 11, 25, 0.82)',
  },
  blueprint: {
    id: 'blueprint',
    name: 'Blueprint Mathématique',
    bgMain: '#0b192c',
    gridColor: 'rgba(0, 168, 232, 0.12)',
    axisColor: 'rgba(0, 210, 255, 0.5)',
    circleDefault: 'rgba(0, 168, 232, 0.28)',
    vectorDefault: '#00d2ff',
    pivotColor: '#ffffff',
    trailColor: '#00ffc8',
    trailGlowColor: 'rgba(0, 255, 200, 0.45)',
    tipColor: '#ffffff',
    tipGlowColor: '#00ffc8',
    targetCurveColor: 'rgba(255, 170, 0, 0.6)',
    statsTextColor: '#00d2ff',
    statsBgColor: 'rgba(11, 25, 44, 0.88)',
  },
  paper: {
    id: 'paper',
    name: 'Papier & Encre',
    bgMain: '#f9f6f0',
    gridColor: 'rgba(120, 100, 80, 0.12)',
    axisColor: 'rgba(100, 80, 60, 0.35)',
    circleDefault: 'rgba(120, 100, 90, 0.22)',
    vectorDefault: '#8b4513', // Encre sépia / brune intense
    pivotColor: '#1a1a2e',
    trailColor: '#0f172a',    // Encre noire / marine dense
    trailGlowColor: 'rgba(15, 23, 42, 0.2)',
    tipColor: '#b91c1c',
    tipGlowColor: 'rgba(185, 28, 28, 0.4)',
    targetCurveColor: 'rgba(220, 38, 38, 0.55)',
    statsTextColor: '#1e293b',
    statsBgColor: 'rgba(249, 246, 240, 0.88)',
  },
};
