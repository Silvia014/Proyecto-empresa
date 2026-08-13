export interface Location {
  id: string;
  name: string;
  city: string;
  country: string;
  currency: string;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
  preferences?: string;
}

export type OrderStatus =
  | "RECEIVED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export type OrderSource =
  | "ONLINE"
  | "POS"
  | "COUNTER";

export interface OrderItem {
  id: string;
  orderId: string;
  dishName: string;
  quantity: number;
  unitPrice: number;
  menuItemId?: string;
}

export interface Order {
  id: string;
  customerId: string;
  locationId: string;
  items: OrderItem[];
  totalUsd: number;
  totalCop?: number;
  subtotal?: number;
  brasapointsDiscount: number;
  brasapointsUsed: number;
  brasapointsEarned: number;
  status: OrderStatus;
  source: OrderSource;
  fulfillment: string;
  deliveryAddress?: string;
  createdAt: Date;
}

export interface MenuItem {
  id: string;
  name: string;
  nameEn?: string;
  description?: string;
  category: string;
  price: number;
  currency: string;
  imageUrl?: string;
  available: boolean;
  locationId: string;
}

export type BrasapointsTransactionType =
  | "WELCOME"
  | "ORDER_REWARD"
  | "REDEMPTION"
  | "MANUAL_ADJUSTMENT";

export interface BrasapointsAccount {
  id: string;
  customerId: string;
  balance: number;
}

export interface BrasapointsTransaction {
  id: string;
  accountId: string;
  type: BrasapointsTransactionType;
  points: number;
  orderId?: string;
  description?: string;
  createdAt: Date;
}