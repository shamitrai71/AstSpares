// ─────────────────────────────────────────────────────────────────────────
// Build-time reader for editable site content (hero + footer).
//
// Reads the committed snapshot (data/site.json) and merges it over
// SITE_DEFAULTS, so the site renders identically until something is edited in
// the admin. The admin writes to Firestore (site/landing); the publish build
// refreshes data/site.json via `npm run export:products`.
// ─────────────────────────────────────────────────────────────────────────
import siteJson from '@/data/site.json';
import type { SiteConfig } from './types';

export const SITE_DEFAULTS: SiteConfig = {
  heroEyebrow: 'Storage-tank & terminal spares',
  heroHeadline: 'Find the part by its number.',
  heroHeadlineAccent: 'Request a quote, not a checkout.',
  heroDescription:
    'Rim seals, flame arrestors, PV valves, hoses and gaskets for floating-roof and fixed-roof tanks — searchable by part number, spec and compatible equipment. No public pricing: build an RFQ and our team responds with a quote and lead time.',
  heroImageUrl: '',
  footerTagline: 'Part-number catalog and RFQ platform for storage-tank and terminal spares.',
  footerColumns: [
    {
      title: 'Catalog',
      links: [
        { label: 'Rim Seals', href: '/products/rim-seals/' },
        { label: 'Flame Arrestors', href: '/products/flame-arrestors/' },
        { label: 'PV Valves', href: '/products/pv-valves/' },
        { label: 'Hoses', href: '/products/hoses/' },
        { label: 'Gaskets', href: '/products/gaskets/' },
      ],
    },
    {
      title: 'Procurement',
      links: [
        { label: 'All parts', href: '/products/' },
        { label: 'Your RFQ', href: '/rfq/' },
      ],
    },
  ],
  footerEmail: '',
  footerPhone: '',
};

export function getSiteConfig(): SiteConfig {
  const stored = siteJson as Partial<SiteConfig>;
  return {
    ...SITE_DEFAULTS,
    ...stored,
    // arrays/strings: keep the default when the stored value is missing or empty
    footerColumns:
      stored.footerColumns && stored.footerColumns.length > 0
        ? stored.footerColumns
        : SITE_DEFAULTS.footerColumns,
  };
}
