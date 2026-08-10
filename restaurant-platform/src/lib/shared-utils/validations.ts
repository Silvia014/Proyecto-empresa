// ==========================================================
// validations.ts — validadores genéricos de negocio
//
// Trasladado desde `brasaland-utils`. Antes, rutas como POST /api/inventory
// y POST /api/orders no validaban nada más allá de que Prisma aceptara
// los tipos; con esto se comprueban reglas de negocio reales antes de
// tocar la base de datos.
// ==========================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function ok(): ValidationResult {
  return { valid: true, errors: [] };
}

function fail(errors: string[]): ValidationResult {
  return { valid: false, errors };
}

export function getMissingRequiredFields<T extends object>(
  obj: Partial<T>,
  requiredFields: (keyof T)[]
): (keyof T)[] {
  return requiredFields.filter((field) => {
    const value = obj[field];
    if (value === undefined || value === null) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    return false;
  });
}

export function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

export function isPastOrPresentDate(date: Date, referenceDate: Date = new Date()): boolean {
  return date.getTime() <= referenceDate.getTime();
}

// -----------------------------
// Validadores por entidad, adaptados a los modelos reales de Prisma
// -----------------------------

interface InventoryItemInput {
  name?: string;
  unit?: string;
  currentStock?: number;
  minStock?: number;
  price?: number;
  supplierId?: string;
  locationId?: string;
}

export function validateInventoryItemInput(item: Partial<InventoryItemInput>): ValidationResult {
  const errors: string[] = [];

  const missing = getMissingRequiredFields(item, ["name", "unit", "price", "supplierId", "locationId"]);
  if (missing.length > 0) {
    errors.push(`Faltan campos obligatorios: ${missing.join(", ")}`);
  }

  if (item.currentStock !== undefined && item.currentStock < 0) {
    errors.push("El stock actual no puede ser negativo");
  }

  if (item.minStock !== undefined && item.minStock < 0) {
    errors.push("El stock mínimo no puede ser negativo");
  }

  if (item.price !== undefined && !isInRange(item.price, 0.01, 1_000_000)) {
    errors.push("El precio debe ser mayor que 0");
  }

  return errors.length === 0 ? ok() : fail(errors);
}

interface OrderLineInput {
  dishName?: string;
  quantity?: number;
  unitPrice?: number;
}

export function validateOrderLines(items: Partial<OrderLineInput>[] | undefined): ValidationResult {
  const errors: string[] = [];

  if (!items || items.length === 0) {
    errors.push("El pedido debe tener al menos un artículo");
    return fail(errors);
  }

  items.forEach((line, index) => {
    if (!line.dishName || !line.dishName.trim()) {
      errors.push(`Línea ${index + 1}: falta el nombre del plato`);
    }
    if (line.quantity === undefined || line.quantity <= 0) {
      errors.push(`Línea ${index + 1}: la cantidad debe ser mayor que 0`);
    }
    if (line.unitPrice === undefined || line.unitPrice < 0) {
      errors.push(`Línea ${index + 1}: el precio unitario no puede ser negativo`);
    }
  });

  return errors.length === 0 ? ok() : fail(errors);
}
