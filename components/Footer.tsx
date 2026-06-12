import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-paper-line bg-petroleum text-paper">
      <div className="shell grid gap-8 py-12 sm:grid-cols-3">
        <div>
          <p className="font-display text-2xl">ASTSPARES</p>
          <p className="mt-2 max-w-xs text-sm text-paper/70">
            Part-number catalog and RFQ platform for storage-tank and terminal spares.
          </p>
        </div>
        <div>
          <p className="eyebrow text-safety-200">Catalog</p>
          <ul className="mt-3 space-y-1.5 text-sm text-paper/80">
            <li><Link href="/products/rim-seals/" className="hover:text-safety">Rim Seals</Link></li>
            <li><Link href="/products/flame-arrestors/" className="hover:text-safety">Flame Arrestors</Link></li>
            <li><Link href="/products/pv-valves/" className="hover:text-safety">PV Valves</Link></li>
            <li><Link href="/products/hoses/" className="hover:text-safety">Hoses</Link></li>
            <li><Link href="/products/gaskets/" className="hover:text-safety">Gaskets</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-safety-200">Procurement</p>
          <ul className="mt-3 space-y-1.5 text-sm text-paper/80">
            <li><Link href="/products/" className="hover:text-safety">All parts</Link></li>
            <li><Link href="/rfq/" className="hover:text-safety">Your RFQ</Link></li>
          </ul>
        </div>
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
