'use client';

import Link from 'next/link';
import { useRfq } from './RfqProvider';

export function RfqDrawer() {
  const { items, isOpen, closeDrawer, removeItem, updateItem, count } = useRfq();

  return (
    <div
      className={`fixed inset-0 z-40 ${isOpen ? '' : 'pointer-events-none'}`}
      aria-hidden={!isOpen}
    >
      {/* scrim */}
      <div
        onClick={closeDrawer}
        className={`absolute inset-0 bg-petroleum-ink/40 transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {/* panel */}
      <aside
        role="dialog"
        aria-label="Request for quote"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-paper shadow-2xl transition-transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-paper-line px-5 py-4">
          <div>
            <p className="eyebrow">Request for quote</p>
            <h2 className="font-display text-xl">{count} item{count === 1 ? '' : 's'}</h2>
          </div>
          <button onClick={closeDrawer} className="btn-ghost px-3 py-1.5" aria-label="Close">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="mt-12 text-center">
              <p className="font-display text-lg text-petroleum">Your RFQ is empty</p>
              <p className="mt-2 text-sm text-petroleum-300">
                Add parts from any product page to build a request. No pricing is shown — our
                team responds with a quote.
              </p>
              <Link href="/products/" onClick={closeDrawer} className="btn-ghost mt-5">
                Browse the catalog
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.partNumber} className="panel p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="part-plate">{item.partNumber}</span>
                      <p className="mt-1.5 truncate text-sm text-petroleum">{item.productName}</p>
                    </div>
                    <button
                      onClick={() => removeItem(item.partNumber)}
                      className="text-xs text-petroleum-300 underline hover:text-safety"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 flex items-end gap-3">
                    <label className="w-20">
                      <span className="field-label">Qty</span>
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.partNumber, {
                            quantity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="field"
                      />
                    </label>
                    <label className="flex-1">
                      <span className="field-label">Required by</span>
                      <input
                        type="date"
                        value={item.requiredBy ?? ''}
                        onChange={(e) =>
                          updateItem(item.partNumber, { requiredBy: e.target.value || null })
                        }
                        className="field"
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-paper-line px-5 py-4">
            <Link href="/rfq/" onClick={closeDrawer} className="btn-primary w-full">
              Review &amp; submit RFQ
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
