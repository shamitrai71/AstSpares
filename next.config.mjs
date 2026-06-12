/** @type {import('next').NextConfig} */

// ASTSPARES ships as a fully static site (`output: 'export'`).
// Rationale: the catalog is the SEO lead-source and barely changes minute-to-minute,
// so we pre-render every product/category page at build time and serve plain files
// from Firebase Hosting. This avoids dragging Cloud Run back in for SSR — which is
// the asia-south1 domain-mapping friction we want to stay clear of.
//
// All freshness/interactivity (RFQ cart, admin, auth) runs client-side via the
// Firebase Web SDK. To publish catalog changes made in the admin panel, run
// `npm run deploy` (export:products -> build -> firebase deploy), or wire a
// Cloud Build trigger later for ISR-style rebuilds.

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    // Static export cannot use the Next image optimizer.
    unoptimized: true,
  },
  // Product slugs are the canonical URLs; keep them clean.
  reactStrictMode: true,
};

export default nextConfig;
