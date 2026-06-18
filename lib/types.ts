// ─────────────────────────────────────────────────────────────────────────
// ASTSPARES data model
//
// Single source of truth: Firestore. The committed data/*.json files are a
// build-time snapshot used for static generation (see lib/catalog.ts).
//
// Canonical part number: AST-<CODE>-#### (e.g. AST-RS-1001). <CODE> is the
// family code carried by the product's TOP-LEVEL category. The part number is
// the product's Firestore doc ID, its URL slug stem, and the join key.
// ─────────────────────────────────────────────────────────────────────────

/** Family/category code used as the AST-<CODE>-#### prefix. Free text now
 *  (admins can add new families), e.g. "RS", "FA", "PV". */
export type ProductFamily = string;

export interface Category {
  /** Globally-unique, path-derived id: ancestor slugs + own slug joined by
   *  "--". Top level == its own slug. e.g. "rim-seals", "rim-seals--primary". */
  id: string;
  /** URL segment at this node's own level, e.g. "primary". Unique among siblings. */
  slug: string;
  name: string;
  blurb: string;
  /** Parent category id, or null for a top-level family. */
  parentId: string | null;
  /** Top-level only: the AST part-number family code (e.g. "RS"). Inherited by
   *  descendants for display/prefix purposes. */
  code?: string;
  /** Sort order among siblings. */
  order: number;
  updatedAt?: number;
}

export interface SpecRow {
  label: string;
  value: string;
}

export interface ProductDoc {
  /** AST-RS-1001 — also the Firestore doc ID. */
  partNumber: string;
  /** SEO slug, e.g. "primary-rim-seal-mechanical-shoe-ast-rs-1001" */
  slug: string;
  productName: string;
  /** Id of the category node this product hangs under (a leaf, usually). */
  categoryId: string;
  /** Denormalised top-level family code for badges/prefix (e.g. "RS"). */
  family: ProductFamily;
  manufacturer: string;
  description: string;
  features: string[];
  specs: SpecRow[];
  compatibleEquipment: string[];
  leadTimeWeeks: number;
  status: 'Active' | 'Inactive';
  /** Cloudinary (or any) image URLs. First entry is the primary thumbnail. */
  images: string[];
  datasheets: { label: string; url: string }[];
  /** Customer-specific SAP codes / aliases — searchable, not shown publicly. */
  tags?: string[];
  /** URL to a product catalogue PDF (e.g. hosted on Cloudinary). */
  cataloguePdfUrl?: string;
  /** e.g. "Germany". Shown on the product page. */
  countryOfOrigin?: string;
  /** Fulfilling entity / warehouse / partner. Shown on the product page. */
  fulfilledBy?: string;
  /** Denormalised stock summary for catalog badges. */
  inStock: boolean;
  updatedAt?: number;
}

export interface Inventory {
  partNumber: string;
  qtyAvailable: number;
  qtyReserved: number;
  minimumStock: number;
  location: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Buyer / Company / Location master records
//
// channel marks how the record entered the system:
//   'online'  — a signed-in buyer using the site
//   'offline' — an order the admin entered from outside the RFQ flow
// This flag drives both visibility (offline = admin-only) and analytics.
// IDs are minted atomically by the mintSequence Cloud Function:
//   Company  AST-CO-#####   Buyer  AST-BUY-#####   PO  AST-PO-<year>-#####
// ─────────────────────────────────────────────────────────────────────────

export type Channel = 'online' | 'offline';

export type CompanyType = 'operator' | 'epc' | 'oem' | 'inspector' | 'other';

export interface Company {
  /** AST-CO-00001 — also the Firestore doc ID. */
  id: string;
  name: string;
  type?: CompanyType;
  country?: string;
  /** ISO 4217 code (e.g. 'USD'). Quotes and POs default to this. */
  defaultCurrency?: string;
  /** Admin-confirmed vs buyer-added. New buyer-created companies start false. */
  verified: boolean;
  createdBy?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface CompanyLocation {
  /** Firestore auto-id (scoped under its company). */
  id: string;
  companyId: string;
  /** Site / terminal name, e.g. "Jamnagar Terminal". */
  name: string;
  city?: string;
  country?: string;
  createdBy?: string;
  createdAt: number;
}

export interface Buyer {
  /** AST-BUY-00001 — also the Firestore doc ID. */
  id: string;
  /** Firebase Auth uid for online buyers; null for admin-created offline buyers. */
  uid: string | null;
  name: string;
  email: string;
  phone?: string;
  /** Phone country code, E.164 style, e.g. '+91'. Pairs with `phone`. */
  dialCode?: string;
  country?: string;
  designation?: string;
  department?: string;
  companyId: string;
  /** Denormalised for display, the RFQ contact line, and analytics rollups. */
  companyName: string;
  locationId?: string;
  locationName?: string;
  channel: Channel;
  /** Admin-confirmed. */
  verified: boolean;
  createdBy?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface RfqItem {
  partNumber: string;
  productName: string;
  quantity: number;
  /** ISO date string (yyyy-mm-dd) or null. */
  requiredBy: string | null;
  note?: string;
}

export type RfqStatus = 'Pending' | 'Quoted' | 'Won' | 'Lost';

export interface RfqContact {
  name: string;
  company: string;
  email: string;
  phone?: string;
  dialCode?: string;
  country?: string;
  designation?: string;
  department?: string;
}

export interface RfqDoc {
  rfqNo: string;
  /** 'online' (buyer-submitted) or 'offline' (admin-entered). */
  channel: Channel;
  /** Online only: the submitting buyer's auth uid (drives buyer read access). */
  buyerUid?: string | null;
  /** Links the RFQ to the buyer/company/location master records. */
  buyerId?: string;
  companyId?: string;
  locationId?: string;
  contact: RfqContact;
  items: RfqItem[];
  message?: string;
  status: RfqStatus;
  createdAt: number;
  notifiedAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Editable site content (homepage hero + footer). Stored in Firestore at
// site/landing, snapshotted to data/site.json for the static build. Unset
// fields fall back to SITE_DEFAULTS in lib/site.ts.
// ─────────────────────────────────────────────────────────────────────────

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export interface SiteConfig {
  heroEyebrow: string;
  heroHeadline: string;
  heroHeadlineAccent: string;
  heroDescription: string;
  /** Cloudinary image URL. When set, replaces the part-number plate in the hero. */
  heroImageUrl: string;
  footerTagline: string;
  footerColumns: FooterColumn[];
  footerEmail: string;
  footerPhone: string;
  updatedAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────
// Purchase Orders
//
// A PO is a document (uploaded to private Storage) plus structured data the
// admin enters manually. `channel` distinguishes orders that came through the
// site ('online') from those the admin entered from outside it ('offline').
// poNumber is system-minted (AST-PO-<year>-#####); buyerPoNumber is theirs.
// ─────────────────────────────────────────────────────────────────────────

export type PoStatus = 'issued' | 'acknowledged' | 'fulfilled' | 'closed' | 'cancelled';

export interface PoLineItem {
  partNumber?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  /** Doc ID === poNumber. */
  poNumber: string;
  buyerPoNumber?: string;
  channel: Channel;
  /** The linked RFQ (online, or the admin-created offline RFQ). */
  rfqNo?: string;
  /** Online only — lets the owning buyer read their PO. */
  buyerUid?: string | null;
  buyerId?: string;
  companyId?: string;
  companyName?: string;
  locationId?: string;
  contact?: RfqContact;
  currency: string;
  lineItems: PoLineItem[];
  subtotal: number;
  total: number;
  orderDate?: string;
  requiredDate?: string;
  deliveryTerms?: string;
  paymentTerms?: string;
  documentUrl?: string;
  documentPath?: string;
  uploadedBy?: 'buyer' | 'admin';
  status: PoStatus;
  notes?: string;
  enteredByUid: string;
  createdAt: number;
  updatedAt?: number;
}
