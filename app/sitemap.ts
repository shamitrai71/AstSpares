import type { MetadataRoute } from 'next';
import { getAllCategoryPaths, getAllProducts } from '@/lib/catalog';

const BASE = 'https://astspares.com';

// Static export pre-renders this once at build time into sitemap.xml.
// Deliberately excludes /admin/, /account/ and /rfq/ — those are app/utility
// surfaces, not content pages search engines should index. Spares are
// included even though they're intentionally left off category browse and
// broad search, so they stay fully discoverable to crawlers regardless.
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/home/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/products/`, changeFrequency: 'weekly', priority: 0.9 },
  ];

  for (const path of getAllCategoryPaths()) {
    entries.push({
      url: `${BASE}/products/${path.join('/')}/`,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  for (const p of getAllProducts()) {
    entries.push({
      url: `${BASE}/product/${p.slug}/`,
      lastModified: p.updatedAt ? new Date(p.updatedAt) : undefined,
      changeFrequency: 'weekly',
      priority: p.kind === 'spare' ? 0.5 : 0.8,
    });
  }

  return entries;
}
