import { describe, it, expect } from 'vitest';
import { THEMES, EpicycleThemeId } from '../src/render/themes';

describe('Thèmes Visuels Configurables (Cosmos, Blueprint, Papier)', () => {
  it('fournit les 3 thèmes requis avec leurs palettes complètes', () => {
    const expectedThemes: EpicycleThemeId[] = ['cosmos', 'blueprint', 'paper'];
    
    expectedThemes.forEach(themeId => {
      const theme = THEMES[themeId];
      expect(theme).toBeDefined();
      expect(theme.id).toBe(themeId);
      expect(theme.name).toBeTypeOf('string');
      expect(theme.bgMain).toBeTypeOf('string');
      expect(theme.gridColor).toBeTypeOf('string');
      expect(theme.axisColor).toBeTypeOf('string');
      expect(theme.circleDefault).toBeTypeOf('string');
      expect(theme.vectorDefault).toBeTypeOf('string');
      expect(theme.pivotColor).toBeTypeOf('string');
      expect(theme.trailColor).toBeTypeOf('string');
      expect(theme.trailGlowColor).toBeTypeOf('string');
      expect(theme.tipColor).toBeTypeOf('string');
      expect(theme.tipGlowColor).toBeTypeOf('string');
      expect(theme.targetCurveColor).toBeTypeOf('string');
      expect(theme.statsTextColor).toBeTypeOf('string');
      expect(theme.statsBgColor).toBeTypeOf('string');
    });
  });

  it('Cosmos Neon possède les couleurs caractéristiques 3Blue1Brown / Transcendental Space', () => {
    const cosmos = THEMES.cosmos;
    expect(cosmos.bgMain.toLowerCase()).toBe('#070b19');
    expect(cosmos.vectorDefault.toLowerCase()).toBe('#fbbf24'); // Doré
    expect(cosmos.trailColor.toLowerCase()).toBe('#38bdf8'); // Cyan fluo
  });

  it('Blueprint Mathématique offre une ambiance technique avec des contrastes cyan/bleu', () => {
    const blueprint = THEMES.blueprint;
    expect(blueprint.bgMain.toLowerCase()).toBe('#0b192c');
    expect(blueprint.vectorDefault.toLowerCase()).toBe('#00d2ff');
  });

  it('Papier & Encre offre un fond clair haute lisibilité et une encre sombre', () => {
    const paper = THEMES.paper;
    expect(paper.bgMain.toLowerCase()).toBe('#f9f6f0');
    expect(paper.trailColor.toLowerCase()).toBe('#0f172a');
  });
});
