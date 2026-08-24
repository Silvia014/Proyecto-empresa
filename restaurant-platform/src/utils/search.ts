import type { Customer, MenuItem } from "../types/models";

/**
 * Búsqueda lineal.
 * Recorre el array desde el principio hasta encontrar
 * un elemento que cumpla la condición
 */
export function linearSearch<T>(
  items: T[],
  predicate: (item: T) => boolean
): T | undefined {
  for (const item of items) {
    if (predicate(item)) {
      return item;
    }
  }

  return undefined;
}

/**
 * Búsqueda binaria.
 *
 * IMPORTANTE:
 * El array debe estar previamente ordenado según el valor
 * que devuelve getValue
 */
export function binarySearch<T, K>(
  items: T[],
  target: K,
  getValue: (item: T) => K,
  compare: (a: K, b: K) => number
): T | undefined {
  let left = 0;
  let right = items.length - 1;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const middleValue = getValue(items[middle]);

    const comparison = compare(middleValue, target);

    if (comparison === 0) {
      return items[middle];
    }

    if (comparison < 0) {
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  return undefined;
}

/**
 * Busca un cliente por ID en un array que no necesita
 * estar ordenado
 */
export function findCustomerById(
  customers: Customer[],
  id: string
): Customer | undefined {
  return linearSearch(customers, (customer) => customer.id === id);
}

/**
 * Busca un plato por precio utilizando búsqueda binaria.
 *
 * El array debe estar ordenado previamente por precio
 * de menor a mayor
 */
export function findMenuItemByPrice(
  menuItems: MenuItem[],
  price: number
): MenuItem | undefined {
  return binarySearch(
    menuItems,
    price,
    (menuItem) => menuItem.price,
    (a, b) => a - b
  );
}