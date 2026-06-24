import type { Metadata } from 'next';
import { getTopLevelCategories } from '@/lib/catalog';
import NetworkGlobe, { type GlobeFamily } from '@/components/NetworkGlobe';

export const metadata: Metadata = {
  title: 'Service network — ASTSPARES',
  description:
    'Explore ASTSPARES product families and our Mumbai-hub shipping network on an interactive 3D globe.',
};

// Pinned tile colour + glyph per family code, so tiles are deliberate and stay
// stable regardless of how many families exist or their order. Add an entry
// when you add a family; anything unmapped falls back to the renderer's palette
// and name-inferred glyph. Colours are from the renderer's own palette.
const FAMILY_STYLE: Record<string, { color: string; glyph: string }> = {
  RS: { color: '#2A7F8E', glyph: 'seal' }, // Rim Seals — teal
  FA: { color: '#B23A48', glyph: 'grid' }, // Flame Arrestors — red
  PV: { color: '#6B8F3A', glyph: 'vent' }, // P/V Valves — green
  HS: { color: '#5B8AC0', glyph: 'tube' }, // Hoses — blue
  GK: { color: '#C7A06A', glyph: 'ring' }, // Gaskets — tan
};

// Build-time bake: the same top-level categories the catalog uses, so the globe
// and the pages its tiles link to stay in sync and refresh together on Publish.
export default function NetworkPage() {
  const categories: GlobeFamily[] = getTopLevelCategories().map((c) => {
    const style = c.code ? FAMILY_STYLE[c.code] : undefined;
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      code: c.code,
      blurb: c.blurb,
      route: `/products/${c.id.replace(/--/g, '/')}/`,
      ...(style ?? {}),
    };
  });

  return <NetworkGlobe categories={categories} />;
}
