'use client';

import type { PurchaseOrder } from '@/lib/types';

function money(currency: string, n: number): string {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PoView({ po }: { po: PurchaseOrder }) {
  return (
    <div className="rounded-tag border border-petroleum/30 bg-paper-200 p-4">
      <div className="flex items-center justify-between">
        <span className="part-plate">{po.poNumber}</span>
        <span className="eyebrow text-petroleum-300">{po.status}</span>
      </div>
      {po.buyerPoNumber && (
        <p className="mt-1 text-xs text-petroleum-300">Your PO ref: {po.buyerPoNumber}</p>
      )}

      <table className="mt-3 w-full text-sm">
        <tbody>
          {po.lineItems.map((l, i) => (
            <tr key={i} className="border-t border-paper-line/60">
              <td className="py-1.5">
                {l.partNumber && <span className="font-mono text-xs text-petroleum-300">{l.partNumber} · </span>}
                {l.description}
              </td>
              <td className="py-1.5 text-right text-petroleum-300">{l.quantity} ×</td>
              <td className="py-1.5 text-right">{money(po.currency, l.unitPrice)}</td>
              <td className="py-1.5 text-right font-medium">{money(po.currency, l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex justify-between border-t border-paper-line pt-2">
        <span className="text-sm text-petroleum-300">Total</span>
        <span className="font-display text-lg">{money(po.currency, po.total)}</span>
      </div>

      <div className="mt-2 space-y-0.5 text-xs text-petroleum-300">
        {po.orderDate && <p>Order date: {po.orderDate}</p>}
        {po.requiredDate && <p>Required by: {po.requiredDate}</p>}
        {po.deliveryTerms && <p>Delivery: {po.deliveryTerms}</p>}
        {po.paymentTerms && <p>Payment: {po.paymentTerms}</p>}
        {po.notes && <p>{po.notes}</p>}
      </div>

      {po.documentUrl && (
        <a href={po.documentUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-safety-600 underline">
          ↓ PO document{po.uploadedBy ? ` (uploaded by ${po.uploadedBy})` : ''}
        </a>
      )}
    </div>
  );
}
