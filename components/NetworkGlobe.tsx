'use client';

// Client boundary for the category globe. The Three.js renderer touches
// `window`/`document`, so it must be loaded with ssr:false — which is only
// permitted inside a Client Component (this file), never a Server Component.
// The actual renderer (CategoryGlobe.jsx, from the globe design chat) is
// dropped into components/ and lazy-imported here.

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
}

interface GlobeProps {
  categories: GlobeFamily[];
  destinations: ShippingDestination[];
  onCategoryClick: (c: GlobeFamily) => void;
}

// The renderer is untyped JSX; assert the prop contract documented by it.
const CategoryGlobe = dynamic(() => import('@/components/CategoryGlobe'), {
  ssr: false,
}) as unknown as ComponentType<GlobeProps>;

export default function NetworkGlobe({ categories }: { categories: GlobeFamily[] }) {
  const router = useRouter();
  return (
    <CategoryGlobe
      categories={categories}
      destinations={SHIPPING_DESTINATIONS}
      onCategoryClick={(c) => router.push(c.route)}
    />
  );
}
