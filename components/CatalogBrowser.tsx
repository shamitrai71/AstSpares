'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Category, ProductDoc } from '@/lib/types';
import { ProductCard } from './ProductCard';

interface FlatCat extends Category {
  depth: number;
}

/** Depth-first ordered list with depth, built from the flat parentId list. */
function orderTree(categories: Category[]): FlatCat[] {
  const byParent = new Map<string | null, Category[]>();
  for (const c of categories) {
    const arr = byParent.get(c.parentId) ?? [];
    arr.push(c);
    byParent.set(c.parentId, arr);
  }
  for (const arr of byParent.values()) arr.sort((a, b) => a.order - b.order);
  const out: FlatCat[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const c of byParent.get(parentId) ?? []) {
      out.push({ ...c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function descendantIds(categories: Category[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of categories) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        added = true;
      }
    }
  }
  return ids;
}

export function CatalogBrowser({
  products,
  categories,
  manufacturers,
}: {
  products: ProductDoc[];
  categories: Category[];
  manufacturers: string[];
}) {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const [cat, setCat] = useState<string>('');
  const [mfr, setMfr] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState(false);

  const tree = useMemo(() => orderTree(categories), [categories]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const catSet = cat ? descendantIds(categories, cat) : null;
    return products.filter((p) => {
      if (catSet && !catSet.has(p.categoryId)) return false;
      if (mfr && p.manufacturer !== mfr) return false;
      if (inStockOnly && !p.inStock) return false;
      if (!term) return true;
      const haystack = [
        p.partNumber,
        p.productName,
        p.description,
        p.manufacturer,
        ...p.compatibleEquipment,
        ...p.specs.map((s) => `${s.label} ${s.value}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [products, categories, q, cat, mfr, inStockOnly]);

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
      {/* filters */}
      <aside className="space-y-6">
        <div>
          <label className="field-label" htmlFor="catalog-search">Search</label>
          <input
            id="catalog-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Part no., keyword, spec…"
            className="field font-mono"
          />
        </div>

        <fieldset>
          <legend className="field-label">Category</legend>
          <div className="space-y-1">
            <FilterRadio label="All categories" checked={cat === ''} onChange={() => setCat('')} />
            {tree.map((c) => (
              <FilterRadio
                key={c.id}
                label={c.name}
                depth={c.depth}
                checked={cat === c.id}
                onChange={() => setCat(c.id)}
              />
            ))}
          </div>
        </fieldset>

        <div>
          <label className="field-label" htmlFor="mfr">Manufacturer</label>
          <select id="mfr" value={mfr} onChange={(e) => setMfr(e.target.value)} className="field">
            <option value="">All</option>
            {manufacturers.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-petroleum">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="accent-safety"
          />
          In stock only
        </label>
      </aside>

      {/* results */}
      <div>
        <p className="mb-4 font-mono text-xs uppercase tracking-eyebrow text-petroleum-300">
          {results.length} part{results.length === 1 ? '' : 's'}
        </p>
        {results.length === 0 ? (
          <div className="panel p-10 text-center">
            <p className="font-display text-xl text-petroleum">No parts match those filters</p>
            <p className="mt-2 text-sm text-petroleum-300">
              Try a part-number stem like “AST-FA” or clear a filter. Can’t find it? Submit an
              RFQ with the spec and we’ll source it.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((p) => (
              <ProductCard key={p.partNumber} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterRadio({
  label,
  checked,
  onChange,
  depth = 0,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  depth?: number;
}) {
  return (
    <label
      className="flex cursor-pointer items-center gap-2 text-sm text-petroleum"
      style={{ paddingLeft: `${depth * 14}px` }}
    >
      <input type="radio" name="cat" checked={checked} onChange={onChange} className="accent-safety" />
      <span className={depth > 0 ? 'text-petroleum-300' : ''}>{label}</span>
    </label>
  );
}
