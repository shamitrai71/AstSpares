'use client';

import { useEffect, useState } from 'react';
import { listProducts, listCategories, listRfqs } from '@/lib/db';
import { listPurchaseOrders } from '@/lib/orders';
import { listVendors, listAllOfferings } from '@/lib/vendors';
import { listCompanies } from '@/lib/buyers';
import { computeInsights, type Insights } from '@/lib/insights';

const nf = new Intl.NumberFormat('en-IN');
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function AdminInsights() {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      listProducts(),
      listCategories(),
      listRfqs(),
      listPurchaseOrders(),
      listVendors(),
      listAllOfferings(),
      listCompanies(),
    ])
      .then(([products, categories, rfqs, pos, vendors, offerings, companies]) => {
        setData(computeInsights({ products, categories, rfqs, pos, vendors, offerings, companies }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load insights.'));
  }, []);

  if (error) return <p className="text-safety-600">{error}</p>;
  if (!data) return <p className="text-petroleum-300">Crunching the numbers…</p>;

  const { catalog, demand, conversion, sourcing } = data;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl">Insights</h1>
        <p className="mt-1 text-sm text-petroleum-300">
          Live from the database (catalog, RFQs, purchase orders, sourcing). Includes archived
          records where relevant.
        </p>
      </div>

      {/* ── Demand & funnel ─────────────────────────────────────────── */}
      <Section title="Demand & funnel">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="RFQs" value={nf.format(demand.total)} />
          <Stat label="Quote rate" value={pct(demand.quoteRate)} hint="moved past Pending" />
          <Stat label="Win rate" value={pct(demand.winRate)} hint="Won ÷ (Won + Lost)" />
          <Stat label="RFQ → PO" value={pct(conversion.conversionRate)} hint={`${conversion.rfqsWithPo} with a PO`} />
        </div>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div>
            <p className="field-label mb-2">Pipeline</p>
            <Bars
              rows={(['Pending', 'Quoted', 'Negotiating', 'Won', 'Lost'] as const).map((s) => ({
                label: s,
                value: demand.byStatus[s],
                tone: s === 'Won' ? 'green' : s === 'Lost' ? 'muted' : 'orange',
              }))}
            />
            <p className="mt-3 text-xs text-petroleum-300">
              Channel: {demand.byChannel.online} online · {demand.byChannel.offline} offline
            </p>
          </div>
          <div>
            <p className="field-label mb-2">RFQs — last 6 months</p>
            <Bars rows={demand.byMonth.map((m) => ({ label: m.month.slice(2), value: m.count, tone: 'orange' }))} />
          </div>
        </div>
      </Section>

      {/* ── Top requested parts ─────────────────────────────────────── */}
      <Section title="What's in demand">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="field-label mb-2">Most-requested parts</p>
            {demand.topParts.length === 0 ? (
              <Empty>No RFQ line items yet.</Empty>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {demand.topParts.map((p) => (
                    <tr key={p.partNumber || p.name} className="border-t border-paper-line">
                      <td className="py-1.5 font-mono text-xs">{p.partNumber || '—'}</td>
                      <td className="py-1.5 text-petroleum-300">{p.name}</td>
                      <td className="py-1.5 text-right whitespace-nowrap">{p.rfqs} RFQ · {nf.format(p.qty)} qty</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div>
            <p className="field-label mb-2">RFQs by company type</p>
            {demand.byType.length === 0 ? <Empty>No RFQs yet.</Empty> : <Bars rows={demand.byType.map((t) => ({ label: t.label, value: t.count, tone: 'orange' }))} />}
          </div>
        </div>
      </Section>

      {/* ── Won business ────────────────────────────────────────────── */}
      <Section title="Won business (purchase orders)">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="POs issued" value={nf.format(conversion.poCount)} />
          {conversion.valueByCurrency.length === 0 ? (
            <Stat label="PO value" value="—" />
          ) : (
            conversion.valueByCurrency.map((v) => (
              <Stat key={v.currency} label={`PO value (${v.currency})`} value={nf.format(v.total)} />
            ))
          )}
        </div>
        <p className="mt-3 text-xs text-petroleum-300">
          Status: {Object.entries(conversion.poByStatus).filter(([, n]) => n).map(([s, n]) => `${n} ${s}`).join(' · ') || 'none'}
        </p>
      </Section>

      {/* ── Catalog coverage & data quality ─────────────────────────── */}
      <Section title="Catalog health">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Active equipment" value={nf.format(catalog.byStatus.Active)} hint={`${catalog.byStatus.Inactive} inactive · ${catalog.byStatus.Archived} archived`} />
          <Stat label="Spares" value={nf.format(catalog.sparesTotal)} />
          <Stat label="Families populated" value={`${catalog.families.populated}/${catalog.families.total}`} hint={catalog.families.empty.length ? `${catalog.families.empty.length} empty` : 'all green'} />
          <Stat label="Unsourced items" value={nf.format(sourcing.unsourced)} hint="no vendor offering" />
        </div>

        {catalog.families.empty.length > 0 && (
          <p className="mt-4 text-xs text-petroleum-300">
            <span className="text-safety-600">Empty families (orange on the globe):</span>{' '}
            {catalog.families.empty.map((f) => f.name).join(', ')}
          </p>
        )}

        <p className="field-label mb-2 mt-6">Data quality — Active items missing…</p>
        <Bars
          rows={[
            { label: 'Image', value: catalog.dataQuality.missingImage.length, tone: 'orange' },
            { label: 'Specs', value: catalog.dataQuality.missingSpecs.length, tone: 'orange' },
            { label: 'Datasheet', value: catalog.dataQuality.missingDatasheet.length, tone: 'muted' },
            { label: 'Unit of measure', value: catalog.dataQuality.missingUom.length, tone: 'orange' },
            { label: 'Vendor sourcing', value: catalog.dataQuality.unsourced.length, tone: 'orange' },
          ]}
          max={catalog.dataQuality.total}
        />
        <p className="mt-2 text-xs text-petroleum-300">out of {catalog.dataQuality.total} active items</p>
      </Section>

      {/* ── Sourcing risk ───────────────────────────────────────────── */}
      <Section title="Sourcing">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Vendors" value={nf.format(sourcing.vendorCount)} />
          <Stat label="Offerings" value={nf.format(sourcing.offeringCount)} />
          <Stat label="Single-sourced" value={nf.format(sourcing.singleSourced)} hint="supply risk" />
          <Stat label="Multi-sourced" value={nf.format(sourcing.multiSourced)} />
        </div>
        {sourcing.preferredNotCheapest.length > 0 && (
          <div className="mt-5">
            <p className="field-label mb-2">Preferred vendor isn’t the cheapest (margin to review)</p>
            <table className="w-full text-sm">
              <tbody>
                {sourcing.preferredNotCheapest.slice(0, 12).map((r) => (
                  <tr key={r.partNumber} className="border-t border-paper-line">
                    <td className="py-1.5 font-mono text-xs">{r.partNumber}</td>
                    <td className="py-1.5 text-right text-petroleum-300">
                      preferred {r.currency} {nf.format(r.preferred)} · cheapest {r.currency} {nf.format(r.cheapest)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Presentational helpers ─────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="panel mt-3 p-5">{children}</div>
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-tag border border-paper-line bg-paper-200/40 p-4">
      <p className="eyebrow text-petroleum-300">{label}</p>
      <p className="mt-1 font-display text-3xl leading-none text-petroleum">{value}</p>
      {hint && <p className="mt-1 text-xs text-petroleum-300">{hint}</p>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-petroleum-300">{children}</p>;
}

function Bars({ rows, max }: { rows: { label: string; value: number; tone?: 'green' | 'orange' | 'muted' }[]; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  const color = (t?: string) => (t === 'green' ? '#2FC75A' : t === 'muted' ? '#8A9AA0' : '#D65210');
  return (
    <div className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-xs text-petroleum-300">{r.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-paper-line/60">
            <div className="h-full rounded-full" style={{ width: `${(r.value / top) * 100}%`, background: color(r.tone), minWidth: r.value ? 6 : 0 }} />
          </div>
          <span className="w-10 shrink-0 text-right font-mono text-xs">{nf.format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
