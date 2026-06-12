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
  country?: string;
}

export interface RfqDoc {
  rfqNo: string;
  contact: RfqContact;
  items: RfqItem[];
  message?: string;
  status: RfqStatus;
  createdAt: number;
  notifiedAt?: number;
}
