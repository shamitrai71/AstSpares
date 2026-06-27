import type { Metadata } from 'next';
import { getTopLevelCategories, getAllProducts } from '@/lib/catalog';
import NetworkGlobe, { type GlobeFamily } from '@/components/NetworkGlobe';

export const metadata: Metadata = {
  title: 'Service network — ASTSPARES',
  description:
    'Explore ASTSPARES product families and our Mumbai-hub shipping network on an interactive 3D globe.',
};

// Glyph per family for visual identity (unmapped families fall back to a
// name-inferred glyph in the renderer).
const FAMILY_GLYPH: Record<string, string> = {
  RS: 'seal',
  FA: 'grid',
  PV: 'vent',
  HS: 'tube',
  GK: 'ring',
};

// Tile colour reflects catalogue coverage at build time:
//   green  → the family already has products
//   orange → defined but not yet populated (RFQ orange)
const COLOR_POPULATED = '#2FC75A'; // green
const COLOR_EMPTY = '#E8742F'; // RFQ orange

// Build-time bake: the same top-level categories the catalog uses, so the globe
// and the pages its tiles link to stay in sync and refresh together on Publish.
// Coverage is computed from the product snapshot, so it updates on each build.
export default function NetworkPage() {
  const populated = new Set(getAllProducts().map((p) => p.family).filter(Boolean));

  const categories: GlobeFamily[] = getTopLevelCategories().map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    code: c.code,
    blurb: c.blurb,
    route: `/products/${c.id.replace(/--/g, '/')}/`,
    glyph: c.code ? FAMILY_GLYPH[c.code] : undefined,
    color: c.code && populated.has(c.code) ? COLOR_POPULATED : COLOR_EMPTY,
  }));

  return <NetworkGlobe categories={categories} />;
}
