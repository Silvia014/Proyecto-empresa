import type { Customer, Order, OrderItem } from "../types/models";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Valida los datos básicos de un cliente.
 */
export function validateCustomer(customer: Customer): ValidationResult {
  const errors: string[] = [];

  if (!customer.id.trim()) {
    errors.push("El cliente debe tener un ID.");
  }

  if (!customer.name.trim()) {
    errors.push("El nombre del cliente es obligatorio.");
  }

  if (customer.email !== undefined && !customer.email.includes("@")) {
    errors.push("El email del cliente no es válido.");
  }

  if (customer.phone !== undefined && customer.phone.trim().length < 6) {
    errors.push("El teléfono debe tener al menos 6 caracteres.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida una línea individual de un pedido.
 */
export function validateOrderItem(item: OrderItem): ValidationResult {
  const errors: string[] = [];

  if (!item.id.trim()) {
    errors.push("La línea del pedido debe tener un ID.");
  }

  if (!item.orderId.trim()) {
    errors.push("La línea del pedido debe tener un orderId.");
  }

  if (!item.dishName.trim()) {
    errors.push("El nombre del plato es obligatorio.");
  }

  if (item.quantity <= 0) {
    errors.push("La cantidad debe ser mayor que 0.");
  }

  if (item.unitPrice < 0) {
    errors.push("El precio unitario no puede ser negativo.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida todas las líneas de un pedido.
 */
export function validateOrderItems(items: OrderItem[]): ValidationResult {
  const errors: string[] = [];

  if (items.length === 0) {
    errors.push("El pedido debe contener al menos un artículo.");
  }

  items.forEach((item, index) => {
    const result = validateOrderItem(item);

    result.errors.forEach((error) => {
      errors.push(`Artículo ${index + 1}: ${error}`);
    });
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida los datos principales de un pedido.
 */
export function validateOrder(order: Order): ValidationResult {
  const errors: string[] = [];

  if (!order.id.trim()) {
    errors.push("El pedido debe tener un ID.");
  }

  if (!order.customerId.trim()) {
    errors.push("El pedido debe tener un cliente.");
  }

  if (!order.locationId.trim()) {
    errors.push("El pedido debe tener un local.");
  }

  if (order.totalUsd < 0) {
    errors.push("El total del pedido no puede ser negativo.");
  }

  if (order.brasapointsUsed < 0) {
    errors.push("Los Brasapoints utilizados no pueden ser negativos.");
  }

  if (order.brasapointsEarned < 0) {
    errors.push("Los Brasapoints obtenidos no pueden ser negativos.");
  }

  if (order.brasapointsDiscount < 0) {
    errors.push("El descuento de Brasapoints no puede ser negativo.");
  }

  const itemsValidation = validateOrderItems(order.items);

  errors.push(...itemsValidation.errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}