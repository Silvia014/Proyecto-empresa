// ==========================================================
// transformations.ts — agregaciones genéricas
//
// Trasladado desde `brasaland-utils`. Se usan para reemplazar reduce()
// manuales repetidos en las rutas de BI/inventario por funciones con
// nombre, testeables de forma aislada.
// ==========================================================

import { groupItems } from "./collections";

export function countBy<T, K extends PropertyKey>(items: T[], keySelector: (item: T) => K): Record<K, number> {
  const groups = groupItems(items, keySelector);
  const counts = {} as Record<K, number>;
  for (const key in groups) {
    counts[key] = groups[key]?.length ?? 0;
  }
  return counts;
}

export function sumBy<T>(items: T[], valueSelector: (item: T) => number): number {
  return items.reduce((total, item) => total + valueSelector(item), 0);
}

export function averageBy<T>(items: T[], valueSelector: (item: T) => number): number {
  if (items.length === 0) return 0;
  return sumBy(items, valueSelector) / items.length;
}

export function maxBy<T>(items: T[], valueSelector: (item: T) => number): T | undefined {
  if (items.length === 0) return undefined;
  return items.reduce((best, item) => (valueSelector(item) > valueSelector(best) ? item : best));
}

export function minBy<T>(items: T[], valueSelector: (item: T) => number): T | undefined {
  if (items.length === 0) return undefined;
  return items.reduce((best, item) => (valueSelector(item) < valueSelector(best) ? item : best));
}
