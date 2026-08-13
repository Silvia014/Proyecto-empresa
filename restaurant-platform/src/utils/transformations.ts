import type { MenuItem, Order } from "../types/models";

/**
 * Cuenta cuántos elementos existen de cada categoría.
 */
export function countByCategory<T>(
  items: T[],
  getCategory: (item: T) => string
): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const category = getCategory(item);

    counts[category] = (counts[category] ?? 0) + 1;

    return counts;
  }, {});
}

/**
 * Suma un valor numérico de todos los elementos.
 */
export function sumBy<T>(
  items: T[],
  getValue: (item: T) => number
): number {
  return items.reduce((total, item) => total + getValue(item), 0);
}

/**
 * Encuentra el elemento con el valor numérico más alto.
 *
 * Devuelve undefined si el array está vacío.
 */
export function maxBy<T>(
  items: T[],
  getValue: (item: T) => number
): T | undefined {
  if (items.length === 0) {
    return undefined;
  }

  return items.reduce((maximum, item) => {
    return getValue(item) > getValue(maximum) ? item : maximum;
  });
}

/**
 * Encuentra el elemento con el valor numérico más bajo.
 *
 * Devuelve undefined si el array está vacío.
 */
export function minBy<T>(
  items: T[],
  getValue: (item: T) => number
): T | undefined {
  if (items.length === 0) {
    return undefined;
  }

  return items.reduce((minimum, item) => {
    return getValue(item) < getValue(minimum) ? item : minimum;
  });
}

/**
 * Calcula el promedio de un conjunto de valores.
 *
 * Devuelve 0 si el array está vacío.
 */
export function averageBy<T>(
  items: T[],
  getValue: (item: T) => number
): number {
  if (items.length === 0) {
    return 0;
  }

  const total = sumBy(items, getValue);

  return total / items.length;
}

/**
 * Número total de unidades vendidas en un conjunto de pedidos.
 */
export function countItemsSold(orders: Order[]): number {
  return orders.reduce((total, order) => {
    return (
      total +
      order.items.reduce((orderTotal, item) => {
        return orderTotal + item.quantity;
      }, 0)
    );
  }, 0);
}

/**
 * Precio medio de los platos disponibles.
 */
export function averageMenuItemPrice(menuItems: MenuItem[]): number {
  return averageBy(menuItems, (menuItem) => menuItem.price);
}

/**
 * Total de ventas de los pedidos.
 */
export function totalOrderValue(orders: Order[]): number {
  return sumBy(orders, (order) => order.totalUsd);
}