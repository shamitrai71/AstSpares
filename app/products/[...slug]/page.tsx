import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getAllCategoryPaths,
  getCategoryByPath,
  getCategoryPath,
  getCategoryCode,
  getChildCategories,
  getProductsInCategory,
} from '@/lib/catalog';
import { ProductCard } from '@/components/ProductCard';

export function generateStaticParams() {
  return getAllCategoryPaths().map((path) => ({ slug: path }));
}

export function generateMetadata({ params }: { params: { slug: string[] } }): Metadata {
  const category = getCategoryByPath(params.slug);
  if (!category) return { title: 'Not found' };
  return { title: category.name, description: category.blurb };
}

export default function CategoryPage({ params }: { params: { slug: string[] } }) {
  const category = getCategoryByPath(params.slug);
  if (!category) notFound();

  const path = getCategoryPath(category);
  const code = getCategoryCode(category);
  const children = getChildCategories(category.id);
  const products = getProductsInCategory(category.id);

  return (
    <div className="shell py-12">
      {/* breadcrumb built from the slug path */}
      <nav className="mb-6 text-sm text-petroleum-300">
        <Link href="/products/" className="hover:text-safety">All parts</Link>
        {path.map((slug, i) => {
          const href = `/products/${path.slice(0, i + 1).join('/')}/`;
          const last = i === path.length - 1;
          return (
            <span key={href}>
              <span className="mx-2">/</span>
              {last ? (
                <span className="text-petroleum">{category.name}</span>
              ) : (
                <Link href={href} className="hover:text-safety capitalize">{slug.replace(/-/g, ' ')}</Link>
              )}
            </span>
          );
        })}
      </nav>

      {code && <p className="eyebrow text-safety-600">AST-{code}</p>}
      <h1 className="mt-2 font-display text-4xl">{category.name}</h1>
      <p className="mt-2 max-w-2xl text-petroleum-300">{category.blurb}</p>

      {/* sub-categories, if any */}
      {children.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          {children.map((c) => (
            <Link
              key={c.id}
              href={`/products/${[...path, c.slug].join('/')}/`}
              className="rounded-tag border border-paper-line bg-paper-200/60 px-3 py-1.5 text-sm text-petroleum hover:border-petroleum/30"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {/* products in this node and everything beneath it */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCard key={p.partNumber} product={p} />
        ))}
      </div>
      {products.length === 0 && (
        <p className="mt-10 text-sm text-petroleum-300">No parts listed here yet.</p>
      )}
    </div>
  );
}
