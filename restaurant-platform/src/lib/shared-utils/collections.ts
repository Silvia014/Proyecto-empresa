// ==========================================================
// collections.ts — filtrar, ordenar y agrupar arrays de forma genérica
//
// Trasladado desde el proyecto independiente `brasaland-utils`. Son las
// mismas funciones puras (no mutan el array de entrada), reutilizadas
// aquí directamente sobre los resultados de Prisma en vez de reescribir
// reduce()/sort() manuales en cada ruta.
// ==========================================================

export function filterItems<T>(items: T[], predicate: (item: T) => boolean): T[] {
  return items.filter(predicate);
}

export type SortDirection = "asc" | "desc";

export function sortItems<T, K extends string | number>(
  items: T[],
  keySelector: (item: T) => K,
  direction: SortDirection = "asc"
): T[] {
  const copy = [...items];
  copy.sort((a, b) => {
    const keyA = keySelector(a);
    const keyB = keySelector(b);
    if (keyA < keyB) return direction === "asc" ? -1 : 1;
    if (keyA > keyB) return direction === "asc" ? 1 : -1;
    return 0;
  });
  return copy;
}

export function groupItems<T, K extends PropertyKey>(
  items: T[],
  keySelector: (item: T) => K
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const key = keySelector(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}

export function uniqueItems<T, K>(items: T[], keySelector: (item: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of items) {
    const key = keySelector(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
