import { describe, it, expect } from 'vitest';
import type { KnowledgeField } from '@aether/contracts';
import { renderFieldValue, shouldMask } from '../../src/content/ui/paletteUtils';

describe('palette field helpers', () => {
  const secretField: KnowledgeField = { type: 'secret', value: '7391', revealPolicy: 'mask' };
  const textField: KnowledgeField = { type: 'text', value: 'hello' };
  const linkField: KnowledgeField = { type: 'link', value: { label: 'map', url: 'https://example.com' } };

  it('masks secret when not revealed', () => {
    expect(renderFieldValue(secretField, false)).toBe('••••••');
  });

  it('shows secret when revealed', () => {
    expect(renderFieldValue(secretField, true)).toBe('7391');
  });

  it('renders text', () => {
    expect(renderFieldValue(textField, false)).toBe('hello');
  });

  it('renders link', () => {
    expect(renderFieldValue(linkField, false)).toBe('map (https://example.com)');
  });

  it('shouldMask respects secret type', () => {
    expect(shouldMask(secretField, false)).toBe(true);
    expect(shouldMask(secretField, true)).toBe(false);
    expect(shouldMask(textField, false)).toBe(false);
  });
});
