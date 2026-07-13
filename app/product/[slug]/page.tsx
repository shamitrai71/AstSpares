import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getAllProducts,
  getSparesFor,
  getProduct,
  getProductByPartNumber,
  getCategoryById,
  getCategoryPath,
} from '@/lib/catalog';
import { SpecTable } from '@/components/SpecTable';
import { AddToRfqButton } from '@/components/AddToRfqButton';

export function generateStaticParams() {
  return getAllProducts().map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const product = getProduct(params.slug);
  if (!product) return { title: 'Not found' };
  return {
    title: `${product.productName} (${product.partNumber})`,
    description: product.description.slice(0, 155),
  };
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const product = getProduct(params.slug);
  if (!product) notFound();

  const category = getCategoryById(product.categoryId);
  const path = category ? getCategoryPath(category) : [];
  const primaryImage = product.images?.[0];
  const spares = getSparesFor(product.partNumber);
  const parent =
    product.kind === 'spare' && product.parentEquipmentId
      ? getProductByPartNumber(product.parentEquipmentId)
      : undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.productName,
    sku: product.partNumber,
    mpn: product.partNumber,
    brand: { '@type': 'Brand', name: product.fulfilledBy || 'ASTSPARES' },
    description: product.description,
    category: category?.name,
    ...(primaryImage ? { image: product.images } : {}),
  };

  return (
    <div className="shell py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="mb-6 text-sm text-petroleum-300">
        <Link href="/products/" className="hover:text-safety">All parts</Link>
        {category &&
          path.map((slug, i) => {
            const href = `/products/${path.slice(0, i + 1).join('/')}/`;
            return (
              <span key={href}>
                <span className="mx-2">/</span>
                <Link href={href} className="hover:text-safety capitalize">
                  {slug.replace(/-/g, ' ')}
                </Link>
              </span>
            );
          })}
        <span className="mx-2">/</span>
        <span className="font-mono text-petroleum">{product.partNumber}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* media */}
        <div>
          {primaryImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryImage}
              alt={product.productName}
              className="aspect-[4/3] w-full rounded-panel border border-paper-line object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-panel border border-dashed border-paper-line bg-paper-200/60">
              <span className="font-mono text-xs uppercase tracking-eyebrow text-petroleum-300">
                Image / drawing — {product.family}
              </span>
            </div>
          )}

          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {product.images.slice(1, 5).map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="h-16 w-16 rounded-tag border border-paper-line object-cover"
                />
              ))}
            </div>
          )}

          {product.datasheets.length > 0 && (
            <div className="mt-4 space-y-2">
              {product.datasheets.map((d) => (
                <a key={d.url} href={d.url} className="btn-ghost w-full justify-start">
                  ↓ {d.label}
                </a>
              ))}
            </div>
          )}

          {product.cataloguePdfUrl && (
            <a href={product.cataloguePdfUrl} className="btn-ghost mt-3 w-full justify-start">
              ↓ Product catalogue (PDF)
            </a>
          )}
        </div>

        {/* detail */}
        <div>
          <span className="part-plate text-base">{product.partNumber}</span>
          <h1 className="mt-3 font-display text-4xl leading-tight">{product.productName}</h1>

          {product.kind === 'spare' && parent && (
            <p className="mt-2 text-sm text-petroleum-300">
              Spare / component of{' '}
              <Link href={`/product/${parent.slug}`} className="text-safety-600 underline">
                {parent.partNumber} — {parent.productName}
              </Link>
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-petroleum-300">
            <span className="flex items-center gap-1.5">
              <span className={`stock-dot ${product.inStock ? 'bg-emerald-600' : 'bg-petroleum-300'}`} />
              {product.inStock ? 'In stock' : 'Made to order'}
            </span>
            <span>Lead time ≈ {product.leadTimeWeeks} weeks</span>
            {product.uom && <span>Unit: {product.uom}</span>}
            {product.countryOfOrigin && <span>Origin: {product.countryOfOrigin}</span>}
            {product.fulfilledBy && <span>Fulfilled by {product.fulfilledBy}</span>}
          </div>

          <p className="mt-5 text-petroleum-ink/90">{product.description}</p>

          {product.features.length > 0 && (
            <ul className="mt-5 space-y-2">
              {product.features.map((f) => (
                <li key={f} className="flex gap-2.5 text-sm text-petroleum-ink/90">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-[1px] bg-safety" />
                  {f}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-7">
            <AddToRfqButton partNumber={product.partNumber} productName={product.productName} uom={product.uom} />
            <p className="mt-2 text-xs text-petroleum-300">
              Pricing on request — add to your RFQ and submit for a quote and confirmed lead time.
            </p>
          </div>
        </div>
      </div>

      {/* specs + compatibility */}
      <div className="mt-14 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 font-display text-2xl">Technical specifications</h2>
          <div className="panel overflow-hidden">
            <SpecTable specs={product.specs} />
          </div>
        </div>
        <div>
          <h2 className="mb-4 font-display text-2xl">Compatible equipment</h2>
          <div className="flex flex-wrap gap-2">
            {product.compatibleEquipment.map((e) => (
              <span key={e} className="rounded-tag border border-paper-line bg-paper-200/60 px-3 py-1.5 text-sm text-petroleum">
                {e}
              </span>
            ))}
          </div>
        </div>
      </div>

      {spares.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-4 font-display text-2xl">Spares &amp; components</h2>
          <p className="mb-5 max-w-2xl text-sm text-petroleum-300">
            Individual bill-of-materials parts for this assembly. Add any to your RFQ for a quote and lead time.
          </p>
          <div className="divide-y divide-paper-line border-y border-paper-line">
            {spares.map((s) => (
              <div key={s.partNumber} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <Link href={`/product/${s.slug}`} className="group min-w-0">
                  <span className="font-mono text-xs text-safety-600">{s.partNumber}</span>
                  <span className="ml-3 text-petroleum group-hover:underline">{s.productName}</span>
                  {s.uom && <span className="ml-2 font-mono text-xs text-petroleum-300">/ {s.uom}</span>}
                </Link>
                <div className="w-full sm:w-auto sm:min-w-[300px]">
                  <AddToRfqButton partNumber={s.partNumber} productName={s.productName} uom={s.uom} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
