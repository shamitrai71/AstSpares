'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  listProducts,
  upsertProduct,
  deleteProduct,
  listCategories,
} from '@/lib/db';
import type { Category, ProductDoc, SpecRow } from '@/lib/types';

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

interface FlatCat extends Category {
  depth: number;
}
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

/** Family code of a category's top-level ancestor. */
function codeFor(categories: Category[], categoryId: string): string {
  const byId = new Map(categories.map((c) => [c.id, c]));
  let cur = byId.get(categoryId);
  while (cur) {
    if (cur.parentId === null) return cur.code ?? '';
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return '';
}

const blankProduct = (): ProductDoc => ({
  partNumber: '',
  slug: '',
  productName: '',
  categoryId: '',
  family: '',
  manufacturer: 'ASTSPARES',
  description: '',
  features: [],
  specs: [],
  compatibleEquipment: [],
  leadTimeWeeks: 6,
  status: 'Active',
  images: [],
  datasheets: [],
  inStock: false,
});

export default function AdminProducts() {
  const [products, setProducts] = useState<ProductDoc[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState<{ product: ProductDoc; isNew: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const [p, c] = await Promise.all([listProducts(), listCategories()]);
    setProducts(p);
    setCategories(c);
  };
  useEffect(() => {
    load().catch(() => setProducts([]));
  }, []);

  const tree = useMemo(() => orderTree(categories), [categories]);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? id;

  const startNew = () => {
    setError('');
    setDraft({ product: blankProduct(), isNew: true });
  };
  const startEdit = (p: ProductDoc) => {
    setError('');
    setDraft({ product: { ...p }, isNew: false });
  };

  const setField = <K extends keyof ProductDoc>(key: K, value: ProductDoc[K]) => {
    setDraft((d) => (d ? { ...d, product: { ...d.product, [key]: value } } : d));
  };

  const save = async () => {
    if (!draft) return;
    const p = draft.product;
    const partNumber = p.partNumber.trim().toUpperCase();
    if (!/^AST-[A-Z0-9]+-\d+$/.test(partNumber)) {
      setError('Part number must look like AST-RS-1001 (AST-<code>-<number>).');
      return;
    }
    if (!p.productName.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!p.categoryId) {
      setError('Pick a category.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const slug = draft.isNew
        ? `${slugify(p.productName)}-${partNumber.toLowerCase()}`
        : p.slug || `${slugify(p.productName)}-${partNumber.toLowerCase()}`;

      if (draft.isNew && products?.some((x) => x.partNumber === partNumber)) {
        setError(`Part number ${partNumber} already exists.`);
        setBusy(false);
        return;
      }

      const record: ProductDoc = {
        ...p,
        partNumber,
        slug,
        family: codeFor(categories, p.categoryId),
        features: p.features.map((f) => f.trim()).filter(Boolean),
        compatibleEquipment: p.compatibleEquipment.map((f) => f.trim()).filter(Boolean),
        images: p.images.map((f) => f.trim()).filter(Boolean),
        specs: p.specs.filter((s) => s.label.trim() || s.value.trim()),
        datasheets: p.datasheets.filter((d) => d.url.trim()),
      };
      await upsertProduct(record);
      await load();
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: ProductDoc) => {
    if (!confirm(`Delete ${p.partNumber} — ${p.productName}?`)) return;
    setBusy(true);
    try {
      await deleteProduct(p.partNumber);
      await load();
    } finally {
      setBusy(false);
    }
  };

  // quick inline patch from the list (stock / status)
  const quickPatch = async (p: ProductDoc, change: Partial<ProductDoc>) => {
    await upsertProduct({ ...p, ...change });
    setProducts((prev) => prev?.map((x) => (x.partNumber === p.partNumber ? { ...x, ...change } : x)) ?? null);
  };

  if (products === null) return <p className="text-petroleum-300">Loading products…</p>;

  if (draft) {
    const p = draft.product;
    return (
      <div className="max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl">{draft.isNew ? 'New product' : `Edit ${p.partNumber}`}</h1>
          <button onClick={() => setDraft(null)} className="btn-ghost">Back to list</button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Category *</span>
              <select
                value={p.categoryId}
                onChange={(e) => {
                  const categoryId = e.target.value;
                  const code = codeFor(categories, categoryId);
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          product: {
                            ...d.product,
                            categoryId,
                            partNumber:
                              d.isNew && !d.product.partNumber ? `AST-${code}-` : d.product.partNumber,
                          },
                        }
                      : d,
                  );
                }}
                className="field"
              >
                <option value="">— Select —</option>
                {tree.map((c) => (
                  <option key={c.id} value={c.id}>
                    {'\u00A0'.repeat(c.depth * 2)}{c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Part number * {!draft.isNew && '(locked)'}</span>
              <input
                value={p.partNumber}
                disabled={!draft.isNew}
                onChange={(e) => setField('partNumber', e.target.value)}
                placeholder="AST-RS-1010"
                className="field font-mono disabled:opacity-60"
              />
            </label>
          </div>

          <label className="block">
            <span className="field-label">Product name *</span>
            <input value={p.productName} onChange={(e) => setField('productName', e.target.value)} className="field" />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="field-label">Manufacturer</span>
              <input value={p.manufacturer} onChange={(e) => setField('manufacturer', e.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="field-label">Lead time (weeks)</span>
              <input type="number" min={0} value={p.leadTimeWeeks} onChange={(e) => setField('leadTimeWeeks', Number(e.target.value))} className="field" />
            </label>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm text-petroleum">
                <input type="checkbox" checked={p.inStock} onChange={(e) => setField('inStock', e.target.checked)} className="accent-safety" />
                In stock
              </label>
              <label className="flex items-center gap-2 text-sm text-petroleum">
                <input type="checkbox" checked={p.status === 'Active'} onChange={(e) => setField('status', e.target.checked ? 'Active' : 'Inactive')} className="accent-safety" />
                Active
              </label>
            </div>
          </div>

          <label className="block">
            <span className="field-label">Description</span>
            <textarea rows={3} value={p.description} onChange={(e) => setField('description', e.target.value)} className="field resize-none" />
          </label>

          <LinesField
            label="Image URLs (Cloudinary — one per line, first is the thumbnail)"
            value={p.images}
            onChange={(v) => setField('images', v)}
            mono
          />
          {p.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.images[0].trim()} alt="" className="h-28 w-28 rounded-tag border border-paper-line object-cover" />
          )}

          <LinesField label="Features (one per line)" value={p.features} onChange={(v) => setField('features', v)} />
          <LinesField label="Compatible equipment (one per line)" value={p.compatibleEquipment} onChange={(v) => setField('compatibleEquipment', v)} />

          <SpecsEditor specs={p.specs} onChange={(v) => setField('specs', v)} />
          <DatasheetsEditor sheets={p.datasheets} onChange={(v) => setField('datasheets', v)} />

          {error && <p className="text-sm text-safety-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={busy} className="btn-primary">{busy ? 'Saving…' : 'Save product'}</button>
            <button onClick={() => setDraft(null)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Products</h1>
        <div className="flex items-center gap-4">
          <p className="text-sm text-petroleum-300">{products.length} parts</p>
          <button onClick={startNew} className="btn-primary">New product</button>
        </div>
      </div>
      <p className="mt-2 text-sm text-petroleum-300">Changes go live on the next publish.</p>

      {products.length === 0 ? (
        <p className="mt-6 text-petroleum-300">No products yet. Add one, or run the seed.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left font-mono text-[11px] uppercase tracking-eyebrow text-petroleum-300">
                <th className="py-2">Part</th>
                <th className="py-2">Name</th>
                <th className="py-2">Category</th>
                <th className="py-2">In stock</th>
                <th className="py-2">Active</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.partNumber} className="border-t border-paper-line">
                  <td className="py-2 font-mono">{p.partNumber}</td>
                  <td className="py-2">{p.productName}</td>
                  <td className="py-2 text-petroleum-300">{catName(p.categoryId)}</td>
                  <td className="py-2">
                    <input type="checkbox" checked={p.inStock} onChange={(e) => quickPatch(p, { inStock: e.target.checked })} className="accent-safety" />
                  </td>
                  <td className="py-2">
                    <input type="checkbox" checked={p.status === 'Active'} onChange={(e) => quickPatch(p, { status: e.target.checked ? 'Active' : 'Inactive' })} className="accent-safety" />
                  </td>
                  <td className="py-2 text-right">
                    <button onClick={() => startEdit(p)} className="text-xs text-petroleum-300 underline hover:text-petroleum">Edit</button>
                    <button onClick={() => remove(p)} className="ml-3 text-xs text-petroleum-300 underline hover:text-safety">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LinesField({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <textarea
        rows={3}
        value={value.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n'))}
        className={`field resize-none ${mono ? 'font-mono text-xs' : ''}`}
      />
    </label>
  );
}

function SpecsEditor({ specs, onChange }: { specs: SpecRow[]; onChange: (v: SpecRow[]) => void }) {
  return (
    <div>
      <span className="field-label">Specifications</span>
      <div className="space-y-2">
        {specs.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={s.label}
              placeholder="Label"
              onChange={(e) => onChange(specs.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              className="field w-2/5"
            />
            <input
              value={s.value}
              placeholder="Value"
              onChange={(e) => onChange(specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
              className="field flex-1"
            />
            <button onClick={() => onChange(specs.filter((_, j) => j !== i))} className="btn-ghost px-3" aria-label="Remove">×</button>
          </div>
        ))}
      </div>
      <button onClick={() => onChange([...specs, { label: '', value: '' }])} className="btn-ghost mt-2 px-3 py-1.5 text-sm">+ Add spec</button>
    </div>
  );
}

function DatasheetsEditor({
  sheets,
  onChange,
}: {
  sheets: { label: string; url: string }[];
  onChange: (v: { label: string; url: string }[]) => void;
}) {
  return (
    <div>
      <span className="field-label">Datasheets</span>
      <div className="space-y-2">
        {sheets.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={s.label}
              placeholder="Label"
              onChange={(e) => onChange(sheets.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              className="field w-2/5"
            />
            <input
              value={s.url}
              placeholder="https://…"
              onChange={(e) => onChange(sheets.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              className="field flex-1 font-mono text-xs"
            />
            <button onClick={() => onChange(sheets.filter((_, j) => j !== i))} className="btn-ghost px-3" aria-label="Remove">×</button>
          </div>
        ))}
      </div>
      <button onClick={() => onChange([...sheets, { label: '', url: '' }])} className="btn-ghost mt-2 px-3 py-1.5 text-sm">+ Add datasheet</button>
    </div>
  );
}
