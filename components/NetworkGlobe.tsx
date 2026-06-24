'use client';

// Client boundary for the category globe. The Three.js renderer touches
// `window`/`document`, so it must be loaded with ssr:false — only permitted
// inside a Client Component. The renderer (CategoryGlobe.jsx) lives in
// components/ and is lazy-imported here.

import dynamic from 'next/dynamic';
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

export default function NetworkGlobe({ categories }: { categories: GlobeFamily[] }) {
  const router = useRouter();
  return (
    <CategoryGlobe
      categories={categories}
      destinations={SHIPPING_DESTINATIONS}
      hub={{ name: 'Mumbai', lat: 19.07, lon: 72.87 }}
      mapSrc="/world.jpg"
      onCategoryClick={(c) => router.push(c.route)}
    />
  );
}
