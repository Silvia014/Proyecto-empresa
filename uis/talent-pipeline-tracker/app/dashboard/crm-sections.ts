export type LocationSummary = {
  id: number | string;
  name: string;
};

type SectionMetric = {
  label: string;
  value: string;
};

type SectionRecord = {
  name: string;
  meta: string;
  status: string;
};

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

const baseSections = [
  {
    slug: "suppliers",
    title: "Suppliers",
    route: "/dashboard/suppliers",
    navLabel: "Vendor control",
    description: "Contracts, rates and approval queue.",
    panelTitle: "Supplier operations overview",
    panelDescription:
      "Track preferred partners, pending negotiations and service stability from a single entry point.",
    ctaLabel: "Open suppliers workspace",
    metrics: [
      { label: "Active suppliers", value: "24" },
      { label: "Pending approvals", value: "5" },
      { label: "Price alerts", value: "3" },
    ],
    recordsTitle: "Priority supplier follow-up",
    records: [
      {
        name: "Carnes del Caribe",
        meta: "Contract renewal due in 4 days",
        status: "Review terms",
      },
      {
        name: "Finca Verde Produce",
        meta: "2 delivery incidents this week",
        status: "Check quality",
      },
      {
        name: "Pacifica Seafood",
        meta: "New rate proposal uploaded",
        status: "Approve quote",
      },
    ],
  },
  {
    slug: "locations",
    title: "Locations",
    route: "/dashboard/locations",
    navLabel: "Store map",
    description: "Operational status across all restaurants.",
    panelTitle: "Location performance snapshot",
    panelDescription:
      "See which units are active, which teams need support and how each restaurant is progressing today.",
    ctaLabel: "Open locations workspace",
    metrics: [
      { label: "Active locations", value: "0" },
      { label: "New openings", value: "2" },
      { label: "Manager alerts", value: "1" },
    ],
    recordsTitle: "Current location list",
    records: [],
  },
  {
    slug: "customers",
    title: "Customers",
    route: "/dashboard/customers",
    navLabel: "Relationship desk",
    description: "Segments, VIPs and pending follow-ups.",
    panelTitle: "Customer relationship center",
    panelDescription:
      "Keep a clear view of loyal guests, recovery cases and new high-value opportunities.",
    ctaLabel: "Open customers workspace",
    metrics: [
      { label: "CRM records", value: "1,280" },
      { label: "VIP guests", value: "87" },
      { label: "Follow-ups today", value: "42" },
    ],
    recordsTitle: "Customer actions for today",
    records: [
      {
        name: "Andrea Gómez",
        meta: "Birthday dining campaign ready",
        status: "Send offer",
      },
      {
        name: "Mesa Corporate",
        meta: "Requested event menu pricing",
        status: "Call back",
      },
      {
        name: "Luis Herrera",
        meta: "Low satisfaction score on last order",
        status: "Recover account",
      },
    ],
  },
  {
    slug: "orders",
    title: "Orders",
    route: "/dashboard/orders",
    navLabel: "Service flow",
    description: "Live service queue and fulfillment health.",
    panelTitle: "Order management pulse",
    panelDescription:
      "Watch incoming demand, delayed tickets and delivery friction before it impacts service quality.",
    ctaLabel: "Open orders workspace",
    metrics: [
      { label: "Open orders", value: "214" },
      { label: "Orders today", value: "91" },
      { label: "Delayed", value: "12" },
    ],
    recordsTitle: "Orders needing attention",
    records: [
      {
        name: "Order 10384",
        meta: "Pickup delayed by 14 minutes",
        status: "Expedite",
      },
      {
        name: "Order 10391",
        meta: "Payment verified, kitchen unassigned",
        status: "Assign station",
      },
      {
        name: "Order 10397",
        meta: "Driver changed twice",
        status: "Review route",
      },
    ],
  },
  {
    slug: "inventory",
    title: "Inventory",
    route: "/dashboard/inventory",
    navLabel: "Stock room",
    description: "Low stock, transfers and critical items.",
    panelTitle: "Inventory risk monitor",
    panelDescription:
      "Detect product shortages early and coordinate transfers before they affect menu availability.",
    ctaLabel: "Open inventory workspace",
    metrics: [
      { label: "Low stock items", value: "64" },
      { label: "Critical shortages", value: "18" },
      { label: "Transfers pending", value: "7" },
    ],
    recordsTitle: "Inventory priorities",
    records: [
      {
        name: "Rib glaze",
        meta: "2 locations below safety stock",
        status: "Replenish",
      },
      {
        name: "Burger buns",
        meta: "Transfer requested from Central",
        status: "Approve move",
      },
      {
        name: "Brisket cut",
        meta: "Supplier ETA updated to tomorrow",
        status: "Adjust menu",
      },
    ],
  },
  {
    slug: "brasapuntos",
    title: "Brasapuntos",
    route: "/dashboard/brasapuntos",
    navLabel: "Loyalty engine",
    description: "Points activity, redemptions and campaigns.",
    panelTitle: "Brasapuntos loyalty activity",
    panelDescription:
      "Measure campaign traction, member engagement and point redemption behavior in one place.",
    ctaLabel: "Open Brasapuntos workspace",
    metrics: [
      { label: "Members active", value: "3,406" },
      { label: "Redeemed today", value: "126" },
      { label: "Campaigns live", value: "4" },
    ],
    recordsTitle: "Loyalty opportunities",
    records: [
      {
        name: "Weekend Combo Bonus",
        meta: "Engagement up 18% vs last week",
        status: "Extend campaign",
      },
      {
        name: "Tier upgrade batch",
        meta: "39 members ready for review",
        status: "Promote members",
      },
      {
        name: "Dormant members",
        meta: "82 accounts inactive for 60 days",
        status: "Reactivation push",
      },
    ],
  },
  {
    slug: "profile",
    title: "Profile",
    route: "/profile",
    navLabel: "My account",
    description: "Personal settings and CRM access details.",
    panelTitle: "Profile and permissions",
    panelDescription:
      "Review your personal information and keep your CRM access settings updated.",
    ctaLabel: "Open profile",
    metrics: [
      { label: "Profile status", value: "Active" },
      { label: "Role", value: "Staff" },
      { label: "Security", value: "Healthy" },
    ],
    recordsTitle: "Profile reminders",
    records: [
      {
        name: "Password hygiene",
        meta: "Review your access credentials monthly",
        status: "Recommended",
      },
      {
        name: "Contact details",
        meta: "Keep phone and address updated",
        status: "Check profile",
      },
      {
        name: "Access rights",
        meta: "Confirm your assigned CRM role",
        status: "Review access",
      },
    ],
  },
] satisfies CrmSection[];

export const crmSectionSlugs = baseSections.map((section) => section.slug);

export function getCrmSections(locations: LocationSummary[] = []): CrmSection[] {
  return baseSections.map((section) => {
    if (section.slug !== "locations") {
      return section;
    }

    const records = locations.length
      ? locations.map((location) => ({
          name: location.name,
          meta: "Location synced with CRM",
          status: "Active",
        }))
      : [
          {
            name: "No locations available yet",
            meta: "Create or sync locations to populate this module",
            status: "Pending setup",
          },
        ];

    return {
      ...section,
      metrics: section.metrics.map((metric, index) =>
        index === 0
          ? { ...metric, value: String(locations.length) }
          : metric
      ),
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