'use client';

import { useEffect, useMemo, useState } from 'react';
import { listCategories, upsertCategory, deleteCategory } from '@/lib/db';
import type { Category } from '@/lib/types';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

type Draft = {
  editingId: string | null; // null = creating
  name: string;
  slug: string;
  parentId: string | null;
  code: string;
  blurb: string;
  order: number;
};

const BLANK: Draft = { editingId: null, name: '', slug: '', parentId: null, code: '', blurb: '', order: 1 };

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => listCategories().then(setCategories).catch(() => setCategories([]));
  useEffect(() => {
    load();
  }, []);

  const tree = useMemo(() => (categories ? orderTree(categories) : []), [categories]);

  const startCreate = () => {
    setError('');
    setDraft({ ...BLANK, order: (categories?.length ?? 0) + 1 });
  };
  const startEdit = (c: Category) => {
    setError('');
    setDraft({
      editingId: c.id,
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
      code: c.code ?? '',
      blurb: c.blurb,
      order: c.order,
    });
  };

  const save = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    const slug = (draft.slug.trim() || slugify(name));
    if (!name || !slug) {
      setError('Name is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const id = draft.editingId
        ? draft.editingId // id is immutable on edit
        : draft.parentId
          ? `${draft.parentId}--${slug}`
          : slug;

      if (!draft.editingId && categories?.some((c) => c.id === id)) {
        setError(`A category with id "${id}" already exists. Choose a different name/slug.`);
        setBusy(false);
        return;
      }

      const record: Category = {
        id,
        slug,
        name,
        blurb: draft.blurb.trim(),
        parentId: draft.parentId,
        order: Number(draft.order) || 1,
        ...(draft.parentId === null && draft.code.trim()
          ? { code: draft.code.trim().toUpperCase() }
          : {}),
      };
      await upsertCategory(record);
      await load();
      setDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Category) => {
    const hasChildren = categories?.some((x) => x.parentId === c.id);
    if (hasChildren) {
      alert('This category has sub-categories. Delete or move them first.');
      return;
    }
    if (!confirm(`Delete "${c.name}"? Products still pointing at it will need reassigning.`)) return;
    setBusy(true);
    try {
      await deleteCategory(c.id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (categories === null) return <p className="text-petroleum-300">Loading categories…</p>;

  // parent options: any existing category (a node can nest under any other)
  const parentOptions = orderTree(categories);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Categories</h1>
        <button onClick={startCreate} className="btn-primary">New category</button>
      </div>
      <p className="mt-2 text-sm text-petroleum-300">
        Build the catalog tree. Top-level categories carry the part-number code (e.g. RS). Changes go
        live on the next publish.
      </p>

      {draft && (
        <div className="panel mt-6 p-5">
          <h2 className="mb-4 font-display text-xl">
            {draft.editingId ? `Edit — ${draft.editingId}` : 'New category'}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Name *</span>
              <input
                value={draft.name}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    name: e.target.value,
                    // auto-fill slug while creating only
                    slug: draft.editingId ? draft.slug : slugify(e.target.value),
                  })
                }
                className="field"
              />
            </label>
            <label className="block">
              <span className="field-label">Slug {draft.editingId && '(locked)'}</span>
              <input
                value={draft.slug}
                disabled={!!draft.editingId}
                onChange={(e) => setDraft({ ...draft, slug: slugify(e.target.value) })}
                className="field font-mono disabled:opacity-60"
              />
            </label>
            <label className="block">
              <span className="field-label">Parent {draft.editingId && '(locked)'}</span>
              <select
                value={draft.parentId ?? ''}
                disabled={!!draft.editingId}
                onChange={(e) => setDraft({ ...draft, parentId: e.target.value || null })}
                className="field disabled:opacity-60"
              >
                <option value="">— Top level —</option>
                {parentOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {'\u00A0'.repeat(c.depth * 2)}
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {draft.parentId === null && (
              <label className="block">
                <span className="field-label">Code (part-number prefix)</span>
                <input
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                  placeholder="e.g. RS"
                  className="field font-mono uppercase"
                />
              </label>
            )}
            <label className="block">
              <span className="field-label">Order</span>
              <input
                type="number"
                value={draft.order}
                onChange={(e) => setDraft({ ...draft, order: Number(e.target.value) })}
                className="field w-24"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="field-label">Blurb</span>
              <textarea
                rows={2}
                value={draft.blurb}
                onChange={(e) => setDraft({ ...draft, blurb: e.target.value })}
                className="field resize-none"
              />
            </label>
          </div>
          {error && <p className="mt-3 text-sm text-safety-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={save} disabled={busy} className="btn-primary">
              {busy ? 'Saving…' : 'Save category'}
            </button>
            <button onClick={() => setDraft(null)} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-6 divide-y divide-paper-line border-y border-paper-line">
        {tree.map((c) => (
          <div key={c.id} className="flex items-center gap-3 py-2.5" style={{ paddingLeft: `${c.depth * 20}px` }}>
            <span className="font-display text-lg text-petroleum">{c.name}</span>
            <span className="font-mono text-[11px] text-petroleum-300">/{c.slug}</span>
            {c.code && <span className="part-plate text-[11px]">AST-{c.code}</span>}
            <div className="ml-auto flex gap-3 text-xs">
              <button onClick={() => startEdit(c)} className="text-petroleum-300 underline hover:text-petroleum">Edit</button>
              <button onClick={() => remove(c)} className="text-petroleum-300 underline hover:text-safety">Delete</button>
            </div>
          </div>
        ))}
        {tree.length === 0 && <p className="py-6 text-sm text-petroleum-300">No categories yet.</p>}
      </div>
    </div>
  );
}
