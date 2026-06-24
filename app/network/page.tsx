import type { Metadata } from 'next';
import { getTopLevelCategories } from '@/lib/catalog';
import NetworkGlobe, { type GlobeFamily } from '@/components/NetworkGlobe';

export const metadata: Metadata = {
  title: 'Service network — ASTSPARES',
  description:
    'Explore ASTSPARES product families and our Mumbai-hub shipping network on an interactive 3D globe.',
};

// Build-time bake: the same top-level categories the catalog uses, so the globe
// and the pages its tiles link to are always in sync and refresh together on
// the next Publish. New families appear automatically after a rebuild.
export default function NetworkPage() {
  const categories: GlobeFamily[] = getTopLevelCategories().map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    code: c.code,
    blurb: c.blurb,
    route: `/products/${c.id.replace(/--/g, '/')}/`,
  }));

  return <NetworkGlobe categories={categories} />;
}
