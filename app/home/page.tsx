import Link from 'next/link';
import { getTopLevelCategories, getAllProducts } from '@/lib/catalog';
import { getSiteConfig } from '@/lib/site';
import { ProductCard } from '@/components/ProductCard';

export default function HomePage() {
  const categories = getTopLevelCategories();
  const featured = getAllProducts().slice(0, 3);
  const site = getSiteConfig();

  return (
    <>
      {/* Hero — the thesis: a part number is the unit of work here. */}
      <section className="relative overflow-hidden border-b border-paper-line bg-petroleum text-paper">
        <div className="shell grid gap-10 py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow text-safety-200">{site.heroEyebrow}</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] text-paper sm:text-6xl">
              {site.heroHeadline}
              {site.heroHeadlineAccent && (
                <>
                  <br />
                  <span className="text-safety">{site.heroHeadlineAccent}</span>
                </>
              )}
            </h1>
            <p className="mt-5 max-w-xl text-paper/75">{site.heroDescription}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products/" className="btn-primary">Browse the catalog</Link>
              <Link href="/products/?q=AST-RS" className="btn-ghost border-paper/30 text-paper hover:bg-petroleum-700">
                Search by part stem
              </Link>
            </div>
          </div>

          {/* hero image when set, otherwise the signature part-plate motif */}
          {site.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={site.heroImageUrl}
              alt=""
              className="aspect-[4/3] w-full justify-self-end rounded-panel border border-paper/15 object-cover"
            />
          ) : (
            <div className="hidden justify-self-end lg:block">
              <div className="space-y-3 rounded-panel border border-paper/15 bg-petroleum-700/60 p-6 font-mono text-sm">
                {['AST-RS-1001', 'AST-FA-2010', 'AST-PV-3010', 'AST-HS-4002', 'AST-GK-5006'].map((pn) => (
                  <div key={pn} className="flex items-center gap-3">
                    <span className="h-3 w-1 rounded-[1px] bg-safety" />
                    <span className="text-paper">{pn}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Categories */}
      <section className="shell py-16">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl">Browse by family</h2>
          <Link href="/products/" className="text-sm text-safety-600 hover:underline">All parts →</Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/products/${c.slug}/`}
              className="panel group flex flex-col justify-between p-5 transition-colors hover:border-petroleum/30"
            >
              <div>
                <span className="font-mono text-[11px] uppercase tracking-eyebrow text-safety-600">
                  AST-{c.code}
                </span>
                <h3 className="mt-1 font-display text-2xl group-hover:text-safety-600">{c.name}</h3>
                <p className="mt-2 text-sm text-petroleum-300">{c.blurb}</p>
              </div>
              <span className="mt-4 text-sm font-medium text-petroleum">View family →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="shell pb-8">
        <h2 className="font-display text-3xl">In the catalog</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <ProductCard key={p.partNumber} product={p} />
          ))}
        </div>
      </section>
    </>
  );
}
