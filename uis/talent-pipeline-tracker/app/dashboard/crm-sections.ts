export type LocationSummary = {
  id: number | string;
  name: string;
  city?: string | null;
  country?: string | null;
};

type SectionMetric = { label: string; value: string };
type SectionRecord = { name: string; meta: string; status?: string };

export type CrmSection = {
  slug: string;
  title: string;
  route: string;
  navLabel: string;
  description: string;
  panelTitle: string;
  panelDescription: string;
  ctaLabel: string;
  metrics: SectionMetric[];
  recordsTitle: string;
  records: SectionRecord[];
};

const sectionDefinitions = [
  {
    slug: "dashboard", title: "Dashboard", route: "/dashboard",
    navLabel: "Business intelligence", description: "Live business performance across sales, orders, products, and reservations.",
    panelTitle: "Business intelligence", panelDescription: "Operational and sales metrics from the ERP database, refreshed automatically.",
    ctaLabel: "View business dashboard", recordsTitle: "Business performance",
  },
  {
    slug: "suppliers", title: "Suppliers", route: "/dashboard/suppliers",
    navLabel: "Vendor control", description: "Supplier records and operations.",
    panelTitle: "Supplier operations", panelDescription: "Supplier information currently available in the ERP database.",
    ctaLabel: "Open suppliers workspace", recordsTitle: "Suppliers",
  },
  {
    slug: "locations", title: "Locations", route: "/dashboard/locations",
    navLabel: "Store map", description: "Restaurant locations stored in the ERP.",
    panelTitle: "Restaurant locations", panelDescription: "Locations read from the ERP database.",
    ctaLabel: "Open locations workspace", recordsTitle: "Locations in the database",
  },
  {
    slug: "customers", title: "Customers", route: "/dashboard/customers",
    navLabel: "Relationship desk", description: "Customer records.",
    panelTitle: "Customer records", panelDescription: "Customer information currently available in the ERP database.",
    ctaLabel: "Open customers workspace", recordsTitle: "Customers",
  },
  {
    slug: "reservations", title: "Online reservations", route: "/dashboard/reservations",
    navLabel: "Website bookings", description: "Reservations received from the public website.",
    panelTitle: "Online reservations", panelDescription: "Review booking requests submitted through the website.",
    ctaLabel: "Open reservations", recordsTitle: "Reservations",
  },
  {
    slug: "online-orders", title: "Online orders", route: "/dashboard/online-orders",
    navLabel: "Website orders", description: "Orders submitted through the public website.",
    panelTitle: "Online orders", panelDescription: "Review orders placed through the public website and their payment status.",
    ctaLabel: "Open online orders", recordsTitle: "Online orders",
  },
  {
    slug: "orders", title: "Orders", route: "/dashboard/orders",
    navLabel: "Table service", description: "In-person reservations and restaurant checks entered by staff.",
    panelTitle: "Restaurant service", panelDescription: "Add today's in-person reservations and record the items each table consumed.",
    ctaLabel: "Open restaurant orders", recordsTitle: "Restaurant orders",
  },
  {
    slug: "candidates", title: "HR", route: "/dashboard/candidates",
    navLabel: "People and payroll", description: "Job applications, staff leave, payroll records, and rota scheduling.",
    panelTitle: "Human resources", panelDescription: "Manage website applications and CVs, staff absences, holiday requests, payroll status, and work schedules.",
    ctaLabel: "Open HR workspace", recordsTitle: "Staff and applications",
  },
  {
    slug: "inventory", title: "Inventory", route: "/dashboard/inventory",
    navLabel: "Stock room", description: "Inventory records.",
    panelTitle: "Inventory records", panelDescription: "Inventory information currently available in the ERP database.",
    ctaLabel: "Open inventory workspace", recordsTitle: "Inventory items",
  },
  {
    slug: "brasapuntos", title: "Brasapuntos", route: "/dashboard/brasapuntos",
    navLabel: "Loyalty engine", description: "Brasaclub members and their points.",
    panelTitle: "Brasapuntos", panelDescription: "Registered Brasaclub customers and their current points balances.",
    ctaLabel: "Open Brasaclub members", recordsTitle: "Brasaclub members",
  },
  {
    slug: "profile", title: "Profile", route: "/profile",
    navLabel: "My account", description: "Your account settings.",
    panelTitle: "Profile and permissions", panelDescription: "Your staff account settings.",
    ctaLabel: "Profile settings", recordsTitle: "Profile",
  },
].map((section) => ({ ...section, metrics: [], records: [] })) satisfies CrmSection[];

export const crmSectionSlugs = sectionDefinitions.map((section) => section.slug);

export function getCrmSections(locations: LocationSummary[] = []): CrmSection[] {
  return sectionDefinitions.map((section) => {
    if (section.slug !== "locations") return section;
    const records = locations.map((location) => ({
      name: location.name,
      meta: [location.city, location.country].filter(Boolean).join(", "),
    }));
    return {
      ...section,
      metrics: [{ label: "Locations in database", value: String(locations.length) }],
      records,
    };
  });
}

export function getCrmSectionBySlug(
  slug: string,
  locations: LocationSummary[] = []
): CrmSection | undefined {
  return getCrmSections(locations).find((section) => section.slug === slug);
}

export function isCrmSectionSlug(slug: string): boolean {
  return crmSectionSlugs.includes(slug);
}
