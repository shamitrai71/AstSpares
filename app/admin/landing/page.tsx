'use client';

import { useEffect, useState } from 'react';
import { getSiteConfigDoc, upsertSiteConfig } from '@/lib/db';
import { SITE_DEFAULTS } from '@/lib/site';
import type { FooterColumn, SiteConfig } from '@/lib/types';

export default function AdminLanding() {
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getSiteConfigDoc()
      .then((stored) => setConfig({ ...SITE_DEFAULTS, ...(stored ?? {}) }))
      .catch(() => setConfig({ ...SITE_DEFAULTS }));
  }, []);

  const set = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) => {
    setSaved(false);
    setConfig((c) => (c ? { ...c, [key]: value } : c));
  };

  const setColumns = (footerColumns: FooterColumn[]) => set('footerColumns', footerColumns);

  const save = async () => {
    if (!config) return;
    setBusy(true);
    setError('');
    try {
      await upsertSiteConfig({
        ...config,
        footerColumns: config.footerColumns
          .map((col) => ({
            title: col.title.trim(),
            links: col.links.filter((l) => l.label.trim() && l.href.trim()),
          }))
          .filter((col) => col.title || col.links.length > 0),
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!config) return <p className="text-petroleum-300">Loading…</p>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Landing &amp; footer</h1>
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
      <p className="mt-2 text-sm text-petroleum-300">
        Edits save to the database immediately and go live on the next publish (the build picks them up).
      </p>
      {saved && <p className="mt-2 text-sm text-emerald-600">Saved. Publish to push it live.</p>}
      {error && <p className="mt-2 text-sm text-safety-600">{error}</p>}

      {/* HERO */}
      <h2 className="mt-8 font-display text-xl">Hero</h2>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="field-label">Eyebrow (small line above the headline)</span>
          <input value={config.heroEyebrow} onChange={(e) => set('heroEyebrow', e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Headline</span>
          <input value={config.heroHeadline} onChange={(e) => set('heroHeadline', e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Accent line (shown in orange under the headline)</span>
          <input value={config.heroHeadlineAccent} onChange={(e) => set('heroHeadlineAccent', e.target.value)} className="field" />
        </label>
        <label className="block">
          <span className="field-label">Description</span>
          <textarea rows={3} value={config.heroDescription} onChange={(e) => set('heroDescription', e.target.value)} className="field resize-none" />
        </label>
        <label className="block">
          <span className="field-label">Hero image (Cloudinary URL — replaces the part-number plate when set)</span>
          <input value={config.heroImageUrl} onChange={(e) => set('heroImageUrl', e.target.value)} placeholder="https://…" className="field font-mono text-xs" />
        </label>
        {config.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={config.heroImageUrl.trim()} alt="" className="h-32 w-44 rounded-tag border border-paper-line object-cover" />
        )}
      </div>

      {/* FOOTER */}
      <h2 className="mt-10 font-display text-xl">Footer</h2>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="field-label">Tagline (under the ASTSPARES name)</span>
          <textarea rows={2} value={config.footerTagline} onChange={(e) => set('footerTagline', e.target.value)} className="field resize-none" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Contact email</span>
            <input value={config.footerEmail} onChange={(e) => set('footerEmail', e.target.value)} placeholder="sales@astspares.com" className="field" />
          </label>
          <label className="block">
            <span className="field-label">Contact phone</span>
            <input value={config.footerPhone} onChange={(e) => set('footerPhone', e.target.value)} placeholder="+971 …" className="field" />
          </label>
        </div>
      </div>

      <h3 className="mt-6 field-label">Footer columns</h3>
      <div className="mt-2 space-y-5">
        {config.footerColumns.map((col, ci) => (
          <div key={ci} className="panel p-4">
            <div className="flex items-center gap-2">
              <input
                value={col.title}
                placeholder="Column title"
                onChange={(e) => setColumns(config.footerColumns.map((c, i) => (i === ci ? { ...c, title: e.target.value } : c)))}
                className="field flex-1 font-medium"
              />
              <button
                onClick={() => setColumns(config.footerColumns.filter((_, i) => i !== ci))}
                className="btn-ghost px-3"
                aria-label="Remove column"
              >
                Remove
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {col.links.map((l, li) => (
                <div key={li} className="flex gap-2">
                  <input
                    value={l.label}
                    placeholder="Label"
                    onChange={(e) =>
                      setColumns(
                        config.footerColumns.map((c, i) =>
                          i === ci ? { ...c, links: c.links.map((x, j) => (j === li ? { ...x, label: e.target.value } : x)) } : c,
                        ),
                      )
                    }
                    className="field w-2/5"
                  />
                  <input
                    value={l.href}
                    placeholder="/products/ or https://…"
                    onChange={(e) =>
                      setColumns(
                        config.footerColumns.map((c, i) =>
                          i === ci ? { ...c, links: c.links.map((x, j) => (j === li ? { ...x, href: e.target.value } : x)) } : c,
                        ),
                      )
                    }
                    className="field flex-1 font-mono text-xs"
                  />
                  <button
                    onClick={() =>
                      setColumns(config.footerColumns.map((c, i) => (i === ci ? { ...c, links: c.links.filter((_, j) => j !== li) } : c)))
                    }
                    className="btn-ghost px-3"
                    aria-label="Remove link"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => setColumns(config.footerColumns.map((c, i) => (i === ci ? { ...c, links: [...c.links, { label: '', href: '' }] } : c)))}
                className="btn-ghost px-3 py-1.5 text-sm"
              >
                + Add link
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={() => setColumns([...config.footerColumns, { title: '', links: [] }])}
          className="btn-ghost px-3 py-1.5 text-sm"
        >
          + Add column
        </button>
      </div>

      <div className="mt-8">
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
