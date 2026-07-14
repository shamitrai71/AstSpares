import Link from 'next/link';
import { getSiteConfig } from '@/lib/site';

export function Footer() {
  const site = getSiteConfig();

  return (
    <footer className="mt-24 border-t border-paper-line bg-petroleum text-paper">
      <div className="shell grid gap-8 py-12 sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 font-display text-2xl">
            <img src="/brand-icon.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
            ASTSPARES
          </p>
          <p className="mt-2 max-w-xs text-sm text-paper/70">{site.footerTagline}</p>
          {(site.footerEmail || site.footerPhone) && (
            <div className="mt-3 space-y-1 text-sm text-paper/80">
              {site.footerEmail && (
                <p>
                  <a href={`mailto:${site.footerEmail}`} className="hover:text-safety">{site.footerEmail}</a>
                </p>
              )}
              {site.footerPhone && <p className="font-mono">{site.footerPhone}</p>}
            </div>
          )}
        </div>

        {site.footerColumns.map((col) => (
          <div key={col.title}>
            <p className="eyebrow text-safety-200">{col.title}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-paper/80">
              {col.links.map((l) => (
                <li key={`${l.label}-${l.href}`}>
                  <Link href={l.href} className="hover:text-safety">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-paper/10">
        <div className="shell flex flex-col gap-1 py-4 text-xs text-paper/50 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} ASTSPARES. Pricing on request.</span>
          <span className="font-mono">Part numbers: AST-&lt;family&gt;-####</span>
        </div>
      </div>
    </footer>
  );
}
