import type { Order, MenuItem } from "../types/models";

export function filterOrdersByStatus(
  orders: Order[],
  status: Order["status"]
): Order[] {
  return orders.filter((order) => order.status === status);
}

export function filterMenuItemsByCategory(
  menuItems: MenuItem[],
  category: string
): MenuItem[] {
  return menuItems.filter((menuItem) => menuItem.category === category);
}

export function filterMenuItemsByPriceRange(
  menuItems: MenuItem[],
  minimumPrice: number,
  maximumPrice: number
): MenuItem[] {
  return menuItems.filter(
    (menuItem) =>
      menuItem.price >= minimumPrice &&
      menuItem.price <= maximumPrice
  );
}

export function sortOrdersByTotal(
  orders: Order[],
  direction: "asc" | "desc" = "asc"
): Order[] {
  return [...orders].sort((firstOrder, secondOrder) => {
    const difference = firstOrder.totalUsd - secondOrder.totalUsd;

    return direction === "asc" ? difference : -difference;
  });
}

export function sortMenuItemsByPrice(
  menuItems: MenuItem[],
  direction: "asc" | "desc" = "asc"
): MenuItem[] {
  return [...menuItems].sort((firstItem, secondItem) => {
    const difference = firstItem.price - secondItem.price;

    return direction === "asc" ? difference : -difference;
  });
}