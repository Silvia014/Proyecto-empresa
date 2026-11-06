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
    slug: "orders", title: "Orders", route: "/dashboard/orders",
    navLabel: "Service flow", description: "Orders stored in the ERP.",
    panelTitle: "Order records", panelDescription: "Order information currently available in the ERP database.",
    ctaLabel: "Open orders workspace", recordsTitle: "Orders",
  },
  {
    slug: "reservations", title: "Online reservations", route: "/dashboard/reservations",
    navLabel: "Website bookings", description: "Reservations received from the public website.",
    panelTitle: "Online reservations", panelDescription: "Review booking requests submitted through the website.",
    ctaLabel: "Open reservations", recordsTitle: "Reservations",
  },
  {
    slug: "candidates", title: "Job applications", route: "/dashboard/candidates",
    navLabel: "Recruitment", description: "Applications and uploaded CVs from the website.",
    panelTitle: "Job applications", panelDescription: "Review candidate details and open uploaded CVs using a private, time-limited link.",
    ctaLabel: "Open applications", recordsTitle: "Applications",
  },
  {
    slug: "inventory", title: "Inventory", route: "/dashboard/inventory",
    navLabel: "Stock room", description: "Inventory records.",
    panelTitle: "Inventory records", panelDescription: "Inventory information currently available in the ERP database.",
    ctaLabel: "Open inventory workspace", recordsTitle: "Inventory items",
  },
  {
    slug: "brasapuntos", title: "Brasapuntos", route: "/dashboard/brasapuntos",
    navLabel: "Loyalty engine", description: "Members and customer website intake.",
    panelTitle: "Brasapuntos and website intake", panelDescription: "Recent records received from reservations, recruitment, loyalty registration, and online orders.",
    ctaLabel: "Open intake hub", recordsTitle: "Live records",
  },
  {
    slug: "profile", title: "Profile", route: "/profile",
    navLabel: "My account", description: "Your account settings.",
    panelTitle: "Profile and permissions", panelDescription: "Your staff account settings.",
    ctaLabel: "Open profile", recordsTitle: "Profile",
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
