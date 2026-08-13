import type {
  Customer,
  MenuItem,
  Order,
} from "./types/models";

import {
  filterMenuItemsByCategory,
  filterMenuItemsByPriceRange,
  filterOrdersByStatus,
  sortMenuItemsByPrice,
  sortOrdersByTotal,
} from "./utils/collections";

import {
  findCustomerById,
  findMenuItemByPrice,
} from "./utils/search";

import {
  averageMenuItemPrice,
  countByCategory,
  countItemsSold,
  maxBy,
  minBy,
  totalOrderValue,
} from "./utils/transformations";

import {
  validateCustomer,
  validateOrder,
} from "./utils/validations";

// --------------------------------------------------
// DATOS DE PRUEBA
// --------------------------------------------------

const customers: Customer[] = [
  {
    id: "customer-1",
    name: "Ana García",
    email: "ana@example.com",
    phone: "600123456",
    country: "Spain",
    city: "Seville",
  },
  {
    id: "customer-2",
    name: "Carlos López",
    email: "carlos@example.com",
    phone: "600654321",
    country: "Colombia",
    city: "Bogotá",
  },
];

const menuItems: MenuItem[] = [
  {
    id: "menu-1",
    name: "Brasa Burger",
    category: "Burgers",
    price: 15,
    currency: "EUR",
    available: true,
    locationId: "location-1",
  },
  {
    id: "menu-2",
    name: "Brasa Steak",
    category: "Main",
    price: 30,
    currency: "EUR",
    available: true,
    locationId: "location-1",
  },
  {
    id: "menu-3",
    name: "Patatas Bravas",
    category: "Sides",
    price: 8,
    currency: "EUR",
    available: true,
    locationId: "location-1",
  },
  {
    id: "menu-4",
    name: "Chocolate Cake",
    category: "Desserts",
    price: 10,
    currency: "EUR",
    available: true,
    locationId: "location-1",
  },
];

const orders: Order[] = [
  {
    id: "order-1",
    customerId: "customer-1",
    locationId: "location-1",
    items: [
      {
        id: "item-1",
        orderId: "order-1",
        dishName: "Brasa Burger",
        quantity: 2,
        unitPrice: 15,
      },
    ],
    totalUsd: 30,
    status: "COMPLETED",
    source: "ONLINE",
    fulfillment: "pickup",
    brasapointsDiscount: 0,
    brasapointsUsed: 0,
    brasapointsEarned: 0,
    createdAt: new Date(),
  },
  {
    id: "order-2",
    customerId: "customer-2",
    locationId: "location-1",
    items: [
      {
        id: "item-2",
        orderId: "order-2",
        dishName: "Brasa Steak",
        quantity: 1,
        unitPrice: 30,
      },
      {
        id: "item-3",
        orderId: "order-2",
        dishName: "Patatas Bravas",
        quantity: 2,
        unitPrice: 8,
      },
    ],
    totalUsd: 46,
    status: "PREPARING",
    source: "ONLINE",
    fulfillment: "delivery",
    deliveryAddress: "Bogotá",
    brasapointsDiscount: 0,
    brasapointsUsed: 0,
    brasapointsEarned: 0,
    createdAt: new Date(),
  },
];

// --------------------------------------------------
// COLLECTIONS
// --------------------------------------------------

console.log("=== COLLECTIONS ===");

console.log(
  "Pedidos completados:",
  filterOrdersByStatus(orders, "COMPLETED")
);

console.log(
  "Platos de categoría Burgers:",
  filterMenuItemsByCategory(menuItems, "Burgers")
);

console.log(
  "Platos entre 10 y 30:",
  filterMenuItemsByPriceRange(menuItems, 10, 30)
);

console.log(
  "Pedidos ordenados por total:",
  sortOrdersByTotal(orders)
);

console.log(
  "Platos ordenados por precio:",
  sortMenuItemsByPrice(menuItems)
);

// --------------------------------------------------
// SEARCH
// --------------------------------------------------

console.log("\n=== SEARCH ===");

console.log(
  "Cliente encontrado:",
  findCustomerById(customers, "customer-2")
);

const sortedMenuItems = sortMenuItemsByPrice(menuItems);

console.log(
  "Plato encontrado por precio:",
  findMenuItemByPrice(sortedMenuItems, 15)
);

console.log(
  "Cliente inexistente:",
  findCustomerById(customers, "customer-999")
);

// --------------------------------------------------
// TRANSFORMATIONS
// --------------------------------------------------

console.log("\n=== TRANSFORMATIONS ===");

console.log(
  "Platos por categoría:",
  countByCategory(menuItems, (item) => item.category)
);

console.log(
  "Valor total de pedidos:",
  totalOrderValue(orders)
);

console.log(
  "Unidades vendidas:",
  countItemsSold(orders)
);

console.log(
  "Precio medio:",
  averageMenuItemPrice(menuItems)
);

console.log(
  "Pedido de mayor valor:",
  maxBy(orders, (order) => order.totalUsd)
);

console.log(
  "Pedido de menor valor:",
  minBy(orders, (order) => order.totalUsd)
);

// --------------------------------------------------
// VALIDATIONS
// --------------------------------------------------

console.log("\n=== VALIDATIONS ===");

console.log(
  "Cliente válido:",
  validateCustomer(customers[0])
);

console.log(
  "Pedido válido:",
  validateOrder(orders[0])
);

const invalidCustomer: Customer = {
  id: "",
  name: "",
  email: "email-invalido",
};

console.log(
  "Cliente inválido:",
  validateCustomer(invalidCustomer)
);