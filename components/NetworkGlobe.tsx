'use client';

// Client boundary for the category globe. The Three.js renderer touches
// `window`/`document`, so it must be loaded with ssr:false — only permitted
// inside a Client Component. The renderer (CategoryGlobe.jsx) lives in
// components/ and is lazy-imported here.

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentType } from 'react';
import { SHIPPING_DESTINATIONS, type ShippingDestination } from '@/lib/network';

export interface GlobeFamily {
  id: string;
  slug: string;
  name: string;
  code?: string;
  blurb?: string;
  /** Pre-computed catalog route, e.g. "/products/rim-seals/". */
  route: string;
  /** Pinned tile colour (hex). Falls back to the renderer palette if absent. */
  color?: string;
  /** Pinned tile glyph. Inferred from the name if absent. */
  glyph?: string;
}

interface GlobeProps {
  categories: GlobeFamily[];
  destinations: ShippingDestination[];
  hub: { name: string; lat: number; lon: number };
  mapSrc: string;
  onCategoryClick: (c: GlobeFamily) => void;
}

// The renderer is untyped JSX; assert the prop contract it documents.
const CategoryGlobe = dynamic(() => import('@/components/CategoryGlobe'), {
  ssr: false,
}) as unknown as ComponentType<GlobeProps>;

export default function NetworkGlobe({
  categories,
  cta,
}: {
  categories: GlobeFamily[];
  cta?: { href: string; label: string };
}) {
  const router = useRouter();
  return (
    <>
      <CategoryGlobe
        categories={categories}
        destinations={SHIPPING_DESTINATIONS}
        hub={{ name: 'Mumbai', lat: 19.07, lon: 72.87 }}
        mapSrc="/world.jpg"
        onCategoryClick={(c) => router.push(c.route)}
      />
      {cta && (
        <Link
          href={cta.href}
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 74px)',
            transform: 'translateX(-50%)',
            zIndex: 30,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '13px 30px',
            borderRadius: 999,
            background: '#D65210',
            color: '#F4EEE3',
            fontFamily: 'ui-sans-serif,system-ui',
            fontWeight: 600,
            fontSize: 14,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,.4)',
          }}
        >
          {cta.label}
          <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>→</span>
        </Link>
      )}
    </>
  );
}
