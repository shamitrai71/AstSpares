import Link from 'next/link';
import { getSparesFor } from '@/lib/catalog';
import type { ProductDoc } from '@/lib/types';

export function ProductCard({ product }: { product: ProductDoc }) {
  // getSparesFor already filters to Active; a spare passed in here would
  // just resolve to 0, which is fine — the CTA simply doesn't render.
  const spareCount = getSparesFor(product.partNumber).length;

  return (
    <div className="panel group flex flex-col p-4 transition-colors hover:border-petroleum/30">
      <Link href={`/product/${product.slug}/`} className="flex flex-col">
        <div className="flex items-center justify-between">
          <span className="part-plate">{product.partNumber}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-petroleum-300">
            <span
              className={`stock-dot ${product.inStock ? 'bg-emerald-600' : 'bg-petroleum-300'}`}
            />
            {product.inStock ? 'In stock' : `Lead ${product.leadTimeWeeks}w`}
          </span>
        </div>

        {/* image well — Cloudinary thumbnail, or a placeholder */}
        {product.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0]}
            alt={product.productName}
            className="my-4 aspect-[4/3] w-full rounded-tag border border-paper-line object-cover"
          />
        ) : (
          <div className="my-4 flex aspect-[4/3] items-center justify-center rounded-tag border border-dashed border-paper-line bg-paper-200/60">
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-petroleum-300">
              {product.family}
            </span>
          </div>
        )}

        <h3 className="font-display text-lg leading-snug text-petroleum group-hover:text-safety-600">
          {product.productName}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm text-petroleum-300">{product.description}</p>
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href={`/product/${product.slug}/`} className="inline-flex items-center gap-1 text-sm font-medium text-safety-600 hover:underline">
          View &amp; add to RFQ →
        </Link>
        {spareCount > 0 && (
          <Link
            href={`/product/${product.slug}/#spares`}
            className="inline-flex items-center gap-1 rounded-full border border-paper-line bg-paper-200/60 px-2.5 py-1 text-xs font-medium text-petroleum-300 hover:border-safety-600/40 hover:text-safety-600"
          >
            {spareCount} {spareCount === 1 ? 'Spare' : 'Spares'} →
          </Link>
        )}
      </div>
    </div>
  );
}
