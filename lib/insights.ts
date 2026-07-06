// Pure aggregation for the admin Insights view. All inputs are already-fetched
// collections; this file does no I/O so the maths stays testable and the page
// stays about presentation.
import type {
  ProductDoc,
  Category,
  RfqDoc,
  RfqStatus,
  PurchaseOrder,
  Vendor,
  VendorOffering,
  Company,
} from './types';
import { companyTypeLabel } from './company';

export type InsightsInput = {
  products: ProductDoc[];
  categories: Category[];
  rfqs: RfqDoc[];
  pos: PurchaseOrder[];
  vendors: Vendor[];
  offerings: VendorOffering[];
  companies: Company[];
};

const RFQ_STATUSES: RfqStatus[] = ['Pending', 'Quoted', 'Negotiating', 'Won', 'Lost'];

function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export function computeInsights(input: InsightsInput) {
  const { products, categories, rfqs, pos, vendors, offerings, companies } = input;

  const equipment = products.filter((p) => p.kind !== 'spare');
  const spares = products.filter((p) => p.kind === 'spare');
  const active = equipment.filter((p) => p.status === 'Active');

  // ── Catalog health ──────────────────────────────────────────────────────
  const byStatus = {
    Active: equipment.filter((p) => p.status === 'Active').length,
    Inactive: equipment.filter((p) => p.status === 'Inactive').length,
    Archived: equipment.filter((p) => p.status === 'Archived').length,
  };

  const families = categories.filter((c) => c.parentId === null && c.code);
  const populatedCodes = new Set(active.map((p) => p.family).filter(Boolean));
  const emptyFamilies = families.filter((f) => !populatedCodes.has(f.code!));

  const sourcedItems = new Set(offerings.map((o) => o.itemPartNumber));
  const dataQuality = {
    total: active.length,
    missingImage: active.filter((p) => (p.images?.length ?? 0) === 0),
    missingSpecs: active.filter((p) => (p.specs?.length ?? 0) === 0),
    missingDatasheet: active.filter((p) => (p.datasheets?.length ?? 0) === 0),
    missingUom: active.filter((p) => !p.uom),
    unsourced: active.filter((p) => !sourcedItems.has(p.partNumber)),
  };

  // ── Demand (RFQs) ───────────────────────────────────────────────────────
  const rfqByStatus = Object.fromEntries(
    RFQ_STATUSES.map((s) => [s, rfqs.filter((r) => r.status === s).length]),
  ) as Record<RfqStatus, number>;
  const rfqByChannel = {
    online: rfqs.filter((r) => r.channel === 'online').length,
    offline: rfqs.filter((r) => r.channel === 'offline').length,
  };
  const decided = rfqByStatus.Won + rfqByStatus.Lost;
  const winRate = decided ? rfqByStatus.Won / decided : 0;
  const quoteRate = rfqs.length ? (rfqs.length - rfqByStatus.Pending) / rfqs.length : 0;

  const months = lastMonths(6);
  const rfqsByMonth = months.map((m) => ({
    month: m,
    count: rfqs.filter((r) => monthKey(r.createdAt) === m).length,
  }));

  // Top requested parts (aggregate RFQ line items)
  const partAgg = new Map<string, { partNumber: string; name: string; qty: number; rfqs: number }>();
  for (const r of rfqs) {
    const seen = new Set<string>();
    for (const it of r.items ?? []) {
      const key = it.partNumber || it.productName;
      const cur = partAgg.get(key) ?? { partNumber: it.partNumber, name: it.productName, qty: 0, rfqs: 0 };
      cur.qty += it.quantity ?? 0;
      if (!seen.has(key)) { cur.rfqs += 1; seen.add(key); }
      partAgg.set(key, cur);
    }
  }
  const topParts = [...partAgg.values()].sort((a, b) => b.rfqs - a.rfqs || b.qty - a.qty).slice(0, 10);

  // RFQs by company type
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const typeAgg = new Map<string, number>();
  for (const r of rfqs) {
    const c = r.companyId ? companyById.get(r.companyId) : undefined;
    const label = companyTypeLabel(c?.type);
    typeAgg.set(label, (typeAgg.get(label) ?? 0) + 1);
  }
  const rfqsByType = [...typeAgg.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

  // ── Conversion & value (POs) ────────────────────────────────────────────
  const livePos = pos.filter((p) => p.status !== 'cancelled');
  const valueByCurrency = new Map<string, number>();
  for (const p of livePos) {
    valueByCurrency.set(p.currency, (valueByCurrency.get(p.currency) ?? 0) + (p.total ?? 0));
  }
  const rfqsWithPo = rfqs.filter((r) => r.poNumber).length;
  const conversionRate = rfqs.length ? rfqsWithPo / rfqs.length : 0;
  const poByStatus = {
    issued: pos.filter((p) => p.status === 'issued').length,
    acknowledged: pos.filter((p) => p.status === 'acknowledged').length,
    fulfilled: pos.filter((p) => p.status === 'fulfilled').length,
    closed: pos.filter((p) => p.status === 'closed').length,
    cancelled: pos.filter((p) => p.status === 'cancelled').length,
  };

  // ── Sourcing (vendors/offerings) ────────────────────────────────────────
  const byItem = new Map<string, VendorOffering[]>();
  for (const o of offerings) {
    const arr = byItem.get(o.itemPartNumber) ?? [];
    arr.push(o);
    byItem.set(o.itemPartNumber, arr);
  }
  let singleSourced = 0;
  let multiSourced = 0;
  const preferredNotCheapest: { partNumber: string; preferred: number; cheapest: number; currency: string }[] = [];
  for (const p of active) {
    const offs = byItem.get(p.partNumber) ?? [];
    if (offs.length === 1) singleSourced += 1;
    if (offs.length >= 2) {
      multiSourced += 1;
      const pref = offs.find((o) => o.isPreferred);
      if (pref) {
        // Compare only within the preferred offering's currency.
        const sameCcy = offs.filter((o) => o.currency === pref.currency);
        const cheapest = Math.min(...sameCcy.map((o) => o.cost));
        if (pref.cost > cheapest) {
          preferredNotCheapest.push({ partNumber: p.partNumber, preferred: pref.cost, cheapest, currency: pref.currency });
        }
      }
    }
  }

  return {
    catalog: {
      equipmentTotal: equipment.length,
      sparesTotal: spares.length,
      byStatus,
      families: { total: families.length, populated: families.length - emptyFamilies.length, empty: emptyFamilies },
      dataQuality,
    },
    demand: {
      total: rfqs.length,
      byStatus: rfqByStatus,
      byChannel: rfqByChannel,
      winRate,
      quoteRate,
      byMonth: rfqsByMonth,
      topParts,
      byType: rfqsByType,
    },
    conversion: {
      poCount: pos.length,
      poByStatus,
      valueByCurrency: [...valueByCurrency.entries()].map(([currency, total]) => ({ currency, total })),
      rfqsWithPo,
      conversionRate,
    },
    sourcing: {
      vendorCount: vendors.length,
      offeringCount: offerings.length,
      unsourced: dataQuality.unsourced.length,
      singleSourced,
      multiSourced,
      preferredNotCheapest,
    },
  };
}

export type Insights = ReturnType<typeof computeInsights>;
