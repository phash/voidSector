import type { ModuleSource } from '@void-sector/shared';

export function getModuleSourceColor(source: ModuleSource | undefined): string {
  switch (source) {
    case 'found':
      return '#b8860b';
    case 'researched':
      return '#4499cc';
    default:
      return '#4a9';
  }
}
