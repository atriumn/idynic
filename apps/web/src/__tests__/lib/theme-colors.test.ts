import { describe, it, expect } from 'vitest';
import {
  ARCHETYPE_STYLES,
  getArchetypeStyle,
  CLAIM_TYPE_STYLES,
  getClaimTypeStyle,
  CLAIM_TYPE_LABELS,
} from '@/lib/theme-colors';

describe('ARCHETYPE_STYLES', () => {
  it('should have all archetype styles defined', () => {
    const archetypes = [
      'Builder',
      'Optimizer',
      'Connector',
      'Guide',
      'Stabilizer',
      'Specialist',
      'Strategist',
      'Advocate',
      'Investigator',
      'Performer',
    ];

    for (const archetype of archetypes) {
      expect(ARCHETYPE_STYLES[archetype]).toBeDefined();
      expect(ARCHETYPE_STYLES[archetype].bg).toBeDefined();
      expect(ARCHETYPE_STYLES[archetype].text).toBeDefined();
      expect(ARCHETYPE_STYLES[archetype].border).toBeDefined();
    }
  });

  it('should use CSS variables for all styles', () => {
    for (const [, style] of Object.entries(ARCHETYPE_STYLES)) {
      expect(style.bg).toMatch(/^var\(--/);
      expect(style.text).toMatch(/^var\(--/);
      expect(style.border).toMatch(/^var\(--/);
    }
  });
});

describe('getArchetypeStyle', () => {
  it('should return correct style for known archetype', () => {
    const style = getArchetypeStyle('Builder');
    expect(style).toBe(ARCHETYPE_STYLES.Builder);
  });

  it('should return default style for null archetype', () => {
    const style = getArchetypeStyle(null);
    expect(style.bg).toContain('stabilizer');
  });

  it('should return default style for undefined archetype', () => {
    const style = getArchetypeStyle(undefined);
    expect(style.bg).toContain('stabilizer');
  });

  it('should return default style for unknown archetype', () => {
    const style = getArchetypeStyle('UnknownType');
    expect(style.bg).toContain('stabilizer');
  });
});

describe('CLAIM_TYPE_STYLES', () => {
  it('should have all claim type styles defined', () => {
    const types = ['skill', 'achievement', 'attribute', 'education', 'certification'];

    for (const type of types) {
      expect(CLAIM_TYPE_STYLES[type]).toBeDefined();
      expect(CLAIM_TYPE_STYLES[type].bg).toBeDefined();
      expect(CLAIM_TYPE_STYLES[type].text).toBeDefined();
      expect(CLAIM_TYPE_STYLES[type].border).toBeDefined();
    }
  });

  it('should use CSS variables for all styles', () => {
    for (const [, style] of Object.entries(CLAIM_TYPE_STYLES)) {
      expect(style.bg).toMatch(/^var\(--/);
      expect(style.text).toMatch(/^var\(--/);
      expect(style.border).toMatch(/^var\(--/);
    }
  });
});

describe('getClaimTypeStyle', () => {
  it('should return correct style for known claim type', () => {
    const style = getClaimTypeStyle('skill');
    expect(style).toBe(CLAIM_TYPE_STYLES.skill);
  });

  it('should return default style for null type', () => {
    const style = getClaimTypeStyle(null);
    expect(style.bg).toContain('muted');
  });

  it('should return default style for undefined type', () => {
    const style = getClaimTypeStyle(undefined);
    expect(style.bg).toContain('muted');
  });

  it('should return default style for unknown type', () => {
    const style = getClaimTypeStyle('unknown');
    expect(style.bg).toContain('muted');
  });
});

describe('CLAIM_TYPE_LABELS', () => {
  it('should have labels for all claim types', () => {
    expect(CLAIM_TYPE_LABELS.skill).toBe('Skills');
    expect(CLAIM_TYPE_LABELS.achievement).toBe('Achievements');
    expect(CLAIM_TYPE_LABELS.attribute).toBe('Attributes');
    expect(CLAIM_TYPE_LABELS.education).toBe('Education');
    expect(CLAIM_TYPE_LABELS.certification).toBe('Certifications');
  });
});
