import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getAllProducts, getAllCategories, getManufacturers } from '@/lib/catalog';
import { CatalogBrowser } from '@/components/CatalogBrowser';

export const metadata: Metadata = {
  title: 'All parts',
  description:
    'Search the full ASTSPARES catalog of storage-tank spares by part number, specification, manufacturer and stock.',
};

export default function ProductsPage() {
  const products = getAllProducts();
  const categories = getAllCategories();
  const manufacturers = getManufacturers();

  return (
    <div className="shell py-12">
      <p className="eyebrow">Catalog</p>
      <h1 className="mt-2 font-display text-4xl">All parts</h1>
      <p className="mt-2 max-w-2xl text-petroleum-300">
        Filter by family, manufacturer or stock — or search across part numbers, descriptions and
        specifications. Every part is quoted on request.
      </p>

      <div className="mt-10">
        <Suspense fallback={<p className="text-sm text-petroleum-300">Loading catalog…</p>}>
          <CatalogBrowser products={products} categories={categories} manufacturers={manufacturers} />
        </Suspense>
      </div>
    </div>
  );
}
