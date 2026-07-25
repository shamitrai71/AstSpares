import type { MetadataRoute } from 'next';

const BASE = 'https://astspares.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Admin is auth-gated already; this just keeps it out of search results.
      disallow: '/admin/',
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
