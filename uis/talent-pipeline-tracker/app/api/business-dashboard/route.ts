import { NextResponse } from "next/server";
import { canAccess } from "@/lib/staff-access";
import { getStaffActor, isDenied } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 500;

async function readAllRows<T>(
  readPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await readPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

type OrderRow = {
  id: string;
  createdAt: string;
  total: number;
  subtotal: number;
  discount: number;
  brasapointsDiscount: number;
  currency: string;
  source: string;
  status: string;
  paymentStatus: string;
  guestCount: number | null;
  reservationId: string | null;
  Location: { name: string } | { name: string }[] | null;
  OrderItem: Array<{ dishName: string; quantity: number; subtotal: number; menuItemId: string | null }>;
};

type ReservationRow = { status: string; party_size: number };

export async function GET(request: Request) {
  const actor = await getStaffActor(request);
  if (isDenied(actor)) return actor;
  if (!canAccess(actor.role, "dashboard")) {
    return NextResponse.json({ error: "You do not have access to business intelligence." }, { status: 403 });
  }

  const { service: supabase } = actor;
  try {
    const [orders, reservations, feedbackRows] = await Promise.all([
      readAllRows<OrderRow>(async (from, to) => supabase.from("Order")
        .select('id, createdAt, total, subtotal, discount, brasapointsDiscount, currency, source, status, paymentStatus, guestCount, reservationId, Location(name), OrderItem(dishName, quantity, subtotal, menuItemId)')
        .order("createdAt", { ascending: false })
        .range(from, to)),
      readAllRows<ReservationRow>(async (from, to) => supabase.from("reservations")
        .select("status, party_size")
        .range(from, to)),
      readAllRows<{ value_for_money_rating: number; comment: string; created_at: string }>(async (from, to) => supabase.from("customer_feedback")
        .select("value_for_money_rating, comment, created_at")
        .order("created_at", { ascending: false })
        .range(from, to)),
    ]);
    const menuItems = await readAllRows<{ id: string; category: string }>(async (from, to) => supabase.from("MenuItem")
      .select("id, category")
      .range(from, to));
    const menuCategoryById = new Map(menuItems.map((item) => [item.id, item.category]));

    const onlineOrders = orders.filter((order) => order.source === "ONLINE");
    const realizedOrders = orders.filter((order) => order.paymentStatus === "PAID" && order.status !== "CANCELLED");
    const revenueByCurrency: Record<string, number> = {};
    const coveredRevenueByCurrency: Record<string, number> = {};
    const discountByCurrency: Record<string, number> = {};
    const guestCountByCurrency: Record<string, number> = {};
    const tableCheckTotals: Record<string, number> = {};
    const tableCheckCounts: Record<string, number> = {};
    const monthly: Record<string, { month: string; revenueByCurrency: Record<string, number>; paidOrders: number }> = {};
    const productSales: Record<string, { name: string; category: string; quantity: number; revenueByCurrency: Record<string, number> }> = {};

    for (const order of realizedOrders) {
      const currency = (order.currency || "UNKNOWN").toUpperCase();
      revenueByCurrency[currency] = (revenueByCurrency[currency] ?? 0) + Number(order.total || 0);
      discountByCurrency[currency] = (discountByCurrency[currency] ?? 0)
        + Number(order.discount || 0) + Number(order.brasapointsDiscount || 0);
      guestCountByCurrency[currency] = (guestCountByCurrency[currency] ?? 0) + Number(order.guestCount || 0);
      if (order.reservationId) {
        tableCheckTotals[currency] = (tableCheckTotals[currency] ?? 0) + Number(order.total || 0);
        tableCheckCounts[currency] = (tableCheckCounts[currency] ?? 0) + 1;
      }
      if (Number(order.guestCount || 0) > 0) {
        coveredRevenueByCurrency[currency] = (coveredRevenueByCurrency[currency] ?? 0) + Number(order.total || 0);
      }

      const month = String(order.createdAt).slice(0, 7);
      monthly[month] ??= { month, revenueByCurrency: {}, paidOrders: 0 };
      monthly[month].revenueByCurrency[currency] = (monthly[month].revenueByCurrency[currency] ?? 0) + Number(order.total || 0);
      monthly[month].paidOrders += 1;

      for (const item of order.OrderItem ?? []) {
        const name = item.dishName || "Unnamed product";
        const category = item.menuItemId ? menuCategoryById.get(item.menuItemId) || "Uncategorized" : "Uncategorized";
        const productKey = `${category}\u0000${name}`;
        productSales[productKey] ??= { name, category, quantity: 0, revenueByCurrency: {} };
        productSales[productKey].quantity += Number(item.quantity || 0);
        productSales[productKey].revenueByCurrency[currency] = (productSales[productKey].revenueByCurrency[currency] ?? 0) + Number(item.subtotal || 0);
      }
    }

    const locationName = (value: OrderRow["Location"]) => Array.isArray(value) ? value[0]?.name ?? "" : value?.name ?? "";
    const guestsServed = realizedOrders.reduce((sum, order) => sum + Number(order.guestCount || 0), 0);
    const averageSpendPerGuestByCurrency = Object.fromEntries(Object.entries(revenueByCurrency).map(([currency, total]) => [
      currency,
      guestCountByCurrency[currency] ? (coveredRevenueByCurrency[currency] || 0) / guestCountByCurrency[currency] : null,
    ]));
    const feedbackAverage = feedbackRows.length
      ? feedbackRows.reduce((sum, row) => sum + Number(row.value_for_money_rating || 0), 0) / feedbackRows.length
      : null;
    const response = {
      generatedAt: new Date().toISOString(),
      orders: onlineOrders.map((order) => ({
        id: order.id,
        createdAt: order.createdAt,
        total: Number(order.total || 0),
        currency: order.currency,
        status: order.status,
        paymentStatus: order.paymentStatus,
        locationName: locationName(order.Location),
        items: (order.OrderItem ?? []).map((item) => ({ name: item.dishName, quantity: item.quantity })),
      })),
      metrics: {
        revenueByCurrency,
        averagePaidOrderByCurrency: Object.fromEntries(Object.entries(revenueByCurrency).map(([currency, total]) => [
          currency,
          realizedOrders.filter((order) => (order.currency || "UNKNOWN").toUpperCase() === currency).length
            ? total / realizedOrders.filter((order) => (order.currency || "UNKNOWN").toUpperCase() === currency).length
            : 0,
        ])),
        averageTableCheckByCurrency: Object.fromEntries(Object.entries(tableCheckTotals).map(([currency, total]) => [currency, total / tableCheckCounts[currency]])),
        averageSpendPerGuestByCurrency,
        guestCountByCurrency,
        paidOrderCount: realizedOrders.length,
        onlineOrderCount: onlineOrders.length,
        monthlySales: Object.values(monthly).sort((a, b) => a.month.localeCompare(b.month)).slice(-12),
        productsSold: Object.values(productSales).sort((a, b) => b.quantity - a.quantity),
        discountsByCurrency: discountByCurrency,
        cancelledOrders: orders.filter((order) => String(order.status).toUpperCase() === "CANCELLED").length,
        cancelledReservations: reservations.filter((reservation) => String(reservation.status).toUpperCase() === "CANCELLED").length,
        guestsServed,
        valueForMoneyAverage: feedbackAverage,
        feedbackCount: feedbackRows.length,
      },
      dataAvailability: {
        customerFeedback: feedbackRows.length > 0,
        orderGuestCount: guestsServed > 0,
        note: "Feedback and guest counts appear as soon as customers submit a review and staff record the covers for orders.",
        recentFeedback: feedbackRows.slice(0, 10).map((row) => ({
          rating: Number(row.value_for_money_rating),
          comment: row.comment,
          createdAt: row.created_at,
        })),
      },
    };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Business dashboard query failed:", detail);
    return NextResponse.json({ error: "Business performance data could not be read. Confirm migration 20261106190505_business_feedback_dining_covers.sql is applied to the production Supabase project and that the ERP tables contain records." }, { status: 503 });
  }
}
