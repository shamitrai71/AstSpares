// ─────────────────────────────────────────────────────────────────────────
// Build-time catalog access (hierarchical categories).
//
// Reads the committed snapshot (data/*.json) for static generation. The
// category tree is flat-stored (each node has a parentId) and assembled here.
//
// Refresh the snapshot from Firestore before a deploy with
// `npm run export:products`.
// ─────────────────────────────────────────────────────────────────────────
import productsJson from '@/data/products.json';
import categoriesJson from '@/data/categories.json';
import type { Category, ProductDoc } from './types';

const products = productsJson as ProductDoc[];
const categories = categoriesJson as Category[];

const byId = new Map(categories.map((c) => [c.id, c]));

export interface CategoryNode extends Category {
  children: CategoryNode[];
  depth: number;
  /** Slug path from root to this node, e.g. ["rim-seals", "primary"]. */
  path: string[];
}

// ── Categories ────────────────────────────────────────────────────────────

export function getAllCategories(): Category[] {
  return [...categories].sort((a, b) => a.order - b.order);
}

export function getCategoryById(id: string): Category | undefined {
  return byId.get(id);
}

/** Walk from a node up to its root, returning slugs root-first. */
export function getCategoryPath(category: Category): string[] {
  const slugs: string[] = [];
  let cur: Category | undefined = category;
  while (cur) {
    slugs.unshift(cur.slug);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return slugs;
}

/** Resolve a URL slug path (e.g. ["rim-seals","primary"]) to a category. */
export function getCategoryByPath(slugs: string[]): Category | undefined {
  if (slugs.length === 0) return undefined;
  return categories.find((c) => {
    const p = getCategoryPath(c);
    return p.length === slugs.length && p.every((s, i) => s === slugs[i]);
  });
}

export function getTopLevelCategories(): Category[] {
  return getAllCategories().filter((c) => c.parentId === null);
}

export function getChildCategories(parentId: string | null): Category[] {
  return getAllCategories().filter((c) => c.parentId === parentId);
}

/** All descendant ids of a category (not including itself). */
export function getDescendantIds(categoryId: string): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    for (const c of categories) {
      if (c.parentId === id) {
        out.push(c.id);
        walk(c.id);
      }
    }
  };
  walk(categoryId);
  return out;
}

/** The family code carried by a node's top-level ancestor. */
export function getCategoryCode(category: Category): string | undefined {
  let cur: Category | undefined = category;
  while (cur) {
    if (cur.parentId === null) return cur.code;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return undefined;
}

/** Every category's slug path — for generateStaticParams. */
export function getAllCategoryPaths(): string[][] {
  return categories.map((c) => getCategoryPath(c));
}

// ── Products ────────────────────────────────────────────────────────────

export function getAllProducts(): ProductDoc[] {
  return products.filter((p) => p.status === 'Active');
}

/** Products directly in a category OR any of its descendants. */
export function getProductsInCategory(categoryId: string): ProductDoc[] {
  const ids = new Set([categoryId, ...getDescendantIds(categoryId)]);
  return getAllProducts().filter((p) => ids.has(p.categoryId));
}

export function getProduct(slug: string): ProductDoc | undefined {
  return products.find((p) => p.slug === slug);
}

export function getManufacturers(): string[] {
  return Array.from(new Set(getAllProducts().map((p) => p.manufacturer))).sort();
}
