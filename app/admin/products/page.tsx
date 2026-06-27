'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  listProducts,
  upsertProduct,
  deleteProduct,
  listCategories,
  listSpares,
  mintSpareNumber,
} from '@/lib/db';
import type { Category, ProductDoc, SpecRow } from '@/lib/types';
import { optimizeCloudinaryUrl } from '@/lib/images';

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
  kind: 'equipment',
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
  tags: [],
  cataloguePdfUrl: '',
  countryOfOrigin: '',
  fulfilledBy: '',
  inStock: false,
});

/** A blank spare that inherits its parent equipment's category + family. */
const blankSpare = (parent: ProductDoc): ProductDoc => ({
  ...blankProduct(),
  kind: 'spare',
  parentEquipmentId: parent.partNumber,
  categoryId: parent.categoryId,
  family: parent.family,
  manufacturer: '',
});

/** Normalises the array/text fields shared by equipment and spares on save. */
function cleanFields(p: ProductDoc) {
  return {
    features: p.features.map((f) => f.trim()).filter(Boolean),
    compatibleEquipment: p.compatibleEquipment.map((f) => f.trim()).filter(Boolean),
    images: p.images.map((f) => optimizeCloudinaryUrl(f)).filter(Boolean),
    specs: p.specs.filter((s) => s.label.trim() || s.value.trim()),
    datasheets: p.datasheets.filter((d) => d.url.trim()),
    tags: (p.tags ?? []).map((t) => t.trim()).filter(Boolean),
    cataloguePdfUrl: (p.cataloguePdfUrl ?? '').trim(),
    countryOfOrigin: (p.countryOfOrigin ?? '').trim(),
    fulfilledBy: (p.fulfilledBy ?? '').trim(),
  };
}

export default function AdminProducts() {
  const [products, setProducts] = useState<ProductDoc[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState<{ product: ProductDoc; isNew: boolean; spareParent?: ProductDoc } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openBom, setOpenBom] = useState<string | null>(null);
  const [spares, setSpares] = useState<Record<string, ProductDoc[]>>({});

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

  // Equipment may only attach to a leaf category (one with no sub-categories).
  const leafIds = useMemo(() => {
    const hasChild = new Set(categories.map((c) => c.parentId).filter(Boolean) as string[]);
    return new Set(categories.filter((c) => !hasChild.has(c.id)).map((c) => c.id));
  }, [categories]);

  // The main list shows equipment only; spares live under their parent.
  const equipment = useMemo(() => (products ?? []).filter((p) => p.kind !== 'spare'), [products]);

  const loadSpares = async (parentId: string) => {
    const s = await listSpares(parentId);
    setSpares((m) => ({ ...m, [parentId]: s }));
  };
  const toggleBom = (parentId: string) => {
    setOpenBom((cur) => (cur === parentId ? null : parentId));
    if (!spares[parentId]) loadSpares(parentId).catch(() => {});
  };

  const startNew = () => {
    setError('');
    setDraft({ product: blankProduct(), isNew: true });
  };
  const startEdit = (p: ProductDoc) => {
    setError('');
    setDraft({ product: { ...p }, isNew: false });
  };
  const startNewSpare = (parent: ProductDoc) => {
    setError('');
    setDraft({ product: blankSpare(parent), isNew: true, spareParent: parent });
  };
  const startEditSpare = (sp: ProductDoc, parent: ProductDoc) => {
    setError('');
    setDraft({ product: { ...sp }, isNew: false, spareParent: parent });
  };
  const removeSpare = async (sp: ProductDoc) => {
    if (!confirm(`Delete spare ${sp.partNumber} — ${sp.productName}?`)) return;
    setBusy(true);
    try {
      await deleteProduct(sp.partNumber);
      if (sp.parentEquipmentId) await loadSpares(sp.parentEquipmentId);
    } finally {
      setBusy(false);
    }
  };

  const setField = <K extends keyof ProductDoc>(key: K, value: ProductDoc[K]) => {
    setDraft((d) => (d ? { ...d, product: { ...d.product, [key]: value } } : d));
  };

  const save = async () => {
    if (!draft) return;
    const p = draft.product;
    const parent = draft.spareParent;

    if (!p.productName.trim()) {
      setError('Product name is required.');
      return;
    }

    // Equipment-only checks; spares inherit category + family from the parent
    // and have their number minted automatically.
    if (!parent) {
      const pn = p.partNumber.trim().toUpperCase();
      if (!/^AST-[A-Z0-9]+-\d+$/.test(pn)) {
        setError('Part number must look like AST-RS-00001 (AST-<code>-<number>).');
        return;
      }
      if (!p.categoryId) {
        setError('Pick a category.');
        return;
      }
      if (!leafIds.has(p.categoryId)) {
        setError('Equipment must sit on a leaf category (one with no sub-categories).');
        return;
      }
    }

    setBusy(true);
    setError('');
    try {
      if (parent) {
        // ── Spare ──
        const partNumber = draft.isNew ? await mintSpareNumber(parent.partNumber) : p.partNumber;
        const slug = p.slug || `${slugify(p.productName)}-${partNumber.toLowerCase()}`;
        const record: ProductDoc = {
          ...p,
          kind: 'spare',
          parentEquipmentId: parent.partNumber,
          categoryId: parent.categoryId,
          family: parent.family,
          partNumber,
          slug,
          ...cleanFields(p),
        };
        await upsertProduct(record);
        await Promise.all([load(), loadSpares(parent.partNumber)]);
        setDraft(null);
        return;
      }

      // ── Equipment ──
      const partNumber = p.partNumber.trim().toUpperCase();
      const slug = p.slug || `${slugify(p.productName)}-${partNumber.toLowerCase()}`;
      if (draft.isNew && products?.some((x) => x.partNumber === partNumber)) {
        setError(`Part number ${partNumber} already exists.`);
        setBusy(false);
        return;
      }
      const record: ProductDoc = {
        ...p,
        kind: 'equipment',
        partNumber,
        slug,
        family: codeFor(categories, p.categoryId),
        ...cleanFields(p),
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
          <h1 className="font-display text-3xl">
            {draft.spareParent
              ? (draft.isNew ? `New spare · ${draft.spareParent.partNumber}` : `Edit ${p.partNumber}`)
              : (draft.isNew ? 'New product' : `Edit ${p.partNumber}`)}
          </h1>
          <button onClick={() => setDraft(null)} className="btn-ghost">Back to list</button>
        </div>

        <div className="mt-6 space-y-4">
          {draft.spareParent ? (
            <div className="rounded-tag border border-paper-line bg-paper-200 p-3">
              <span className="field-label">Spare of</span>
              <p className="mt-0.5 text-sm">
                <span className="font-mono">{draft.spareParent.partNumber}</span> — {draft.spareParent.productName}
              </p>
              <p className="mt-1 font-mono text-xs text-petroleum-300">
                {draft.isNew ? 'Number assigned on save (…-S###)' : p.partNumber}
              </p>
            </div>
          ) : (
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
                    <option key={c.id} value={c.id} disabled={!leafIds.has(c.id)}>
                      {'\u00A0'.repeat(c.depth * 2)}{c.name}{leafIds.has(c.id) ? '' : ' ›'}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-petroleum-300">
                  Only leaf categories (no sub-categories) can hold equipment.
                </span>
              </label>
              <label className="block">
                <span className="field-label">Part number * {!draft.isNew && '(locked)'}</span>
                <input
                  value={p.partNumber}
                  disabled={!draft.isNew}
                  onChange={(e) => setField('partNumber', e.target.value)}
                  placeholder="AST-RS-00001"
                  className="field font-mono disabled:opacity-60"
                />
              </label>
            </div>
          )}

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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Country of origin</span>
              <input value={p.countryOfOrigin ?? ''} onChange={(e) => setField('countryOfOrigin', e.target.value)} placeholder="e.g. Germany" className="field" />
            </label>
            <label className="block">
              <span className="field-label">Fulfilled by</span>
              <input value={p.fulfilledBy ?? ''} onChange={(e) => setField('fulfilledBy', e.target.value)} placeholder="e.g. ASTSPARES — Jebel Ali" className="field" />
            </label>
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
          <p className="-mt-2 text-xs text-petroleum-300">
            Paste raw Cloudinary URLs — on save they’re auto-optimized to 4:3, 1200px, modern format.
            URLs that already include a transformation are left as-is.
          </p>
          {p.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={optimizeCloudinaryUrl(p.images[0])} alt="" className="h-28 w-28 rounded-tag border border-paper-line object-cover" />
          )}

          <LinesField label="Features (one per line)" value={p.features} onChange={(v) => setField('features', v)} />
          <LinesField label="Compatible equipment (one per line)" value={p.compatibleEquipment} onChange={(v) => setField('compatibleEquipment', v)} />

          <label className="block">
            <span className="field-label">SAP codes / search tags (comma-separated)</span>
            <input
              value={(p.tags ?? []).join(', ')}
              onChange={(e) => setField('tags', e.target.value.split(','))}
              placeholder="e.g. 100023491, CUST-AB-77, OEM-5521"
              className="field font-mono text-xs"
            />
            <span className="mt-1 block text-xs text-petroleum-300">
              Customers can find this part by searching any of these codes. Not shown on the public page.
            </span>
          </label>

          <SpecsEditor specs={p.specs} onChange={(v) => setField('specs', v)} />
          <DatasheetsEditor sheets={p.datasheets} onChange={(v) => setField('datasheets', v)} />

          <label className="block">
            <span className="field-label">Catalogue PDF (URL)</span>
            <input
              value={p.cataloguePdfUrl ?? ''}
              onChange={(e) => setField('cataloguePdfUrl', e.target.value)}
              placeholder="https://…/catalogue.pdf"
              className="field font-mono text-xs"
            />
          </label>

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
          <p className="text-sm text-petroleum-300">{equipment.length} equipment</p>
          <button onClick={startNew} className="btn-primary">New product</button>
        </div>
      </div>
      <p className="mt-2 text-sm text-petroleum-300">Changes go live on the next publish.</p>

      {equipment.length === 0 ? (
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
              {equipment.map((p) => (
                <Fragment key={p.partNumber}>
                  <tr className="border-t border-paper-line">
                    <td className="py-2 font-mono">{p.partNumber}</td>
                    <td className="py-2">{p.productName}</td>
                    <td className="py-2 text-petroleum-300">{catName(p.categoryId)}</td>
                    <td className="py-2">
                      <input type="checkbox" checked={p.inStock} onChange={(e) => quickPatch(p, { inStock: e.target.checked })} className="accent-safety" />
                    </td>
                    <td className="py-2">
                      <input type="checkbox" checked={p.status === 'Active'} onChange={(e) => quickPatch(p, { status: e.target.checked ? 'Active' : 'Inactive' })} className="accent-safety" />
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <button onClick={() => toggleBom(p.partNumber)} className="text-xs text-petroleum-300 underline hover:text-petroleum">
                        {openBom === p.partNumber ? 'Hide spares' : 'Spares'}
                      </button>
                      <button onClick={() => startEdit(p)} className="ml-3 text-xs text-petroleum-300 underline hover:text-petroleum">Edit</button>
                      <button onClick={() => remove(p)} className="ml-3 text-xs text-petroleum-300 underline hover:text-safety">Delete</button>
                    </td>
                  </tr>
                  {openBom === p.partNumber && (
                    <tr className="border-t border-paper-line/60 bg-paper-200/60">
                      <td colSpan={6} className="p-4">
                        <div className="flex items-center justify-between">
                          <p className="field-label">Spares · {p.partNumber}</p>
                          <button onClick={() => startNewSpare(p)} className="btn-ghost px-3 py-1.5 text-sm">+ Add spare</button>
                        </div>
                        {spares[p.partNumber] === undefined ? (
                          <p className="mt-2 text-sm text-petroleum-300">Loading…</p>
                        ) : spares[p.partNumber].length === 0 ? (
                          <p className="mt-2 text-sm text-petroleum-300">No spares yet for this equipment.</p>
                        ) : (
                          <ul className="mt-2 divide-y divide-paper-line">
                            {spares[p.partNumber].map((sp) => (
                              <li key={sp.partNumber} className="flex items-center justify-between py-1.5">
                                <span className="text-sm">
                                  <span className="font-mono">{sp.partNumber}</span>
                                  <span className="ml-3 text-petroleum-300">{sp.productName}</span>
                                </span>
                                <span className="whitespace-nowrap">
                                  <button onClick={() => startEditSpare(sp, p)} className="text-xs text-petroleum-300 underline hover:text-petroleum">Edit</button>
                                  <button onClick={() => removeSpare(sp)} className="ml-3 text-xs text-petroleum-300 underline hover:text-safety">Delete</button>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
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
