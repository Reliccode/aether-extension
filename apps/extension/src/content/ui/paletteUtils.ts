import type { KnowledgeField } from '@aether/contracts';

export function renderFieldValue(field: KnowledgeField, revealed: boolean): string {
  switch (field.type) {
    case 'text':
      return field.value;
    case 'secret':
      return revealed ? field.value : '••••••';
    case 'link':
      return `${field.value.label} (${field.value.url})`;
    default:
      return '';
  }
}

export function shouldMask(field: KnowledgeField, revealed: boolean): boolean {
  if (field.type !== 'secret') return false;
  return !revealed;
}
