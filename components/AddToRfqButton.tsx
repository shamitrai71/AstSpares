'use client';

import { useState } from 'react';
import { useRfq } from './RfqProvider';

export function AddToRfqButton({
  partNumber,
  productName,
}: {
  partNumber: string;
  productName: string;
}) {
  const { addItem } = useRfq();
  const [qty, setQty] = useState(1);

  return (
    <div className="flex items-stretch gap-2">
      <div className="flex items-center rounded-tag border border-paper-line bg-white">
        <button
          onClick={() => setQty((q) => Math.max(1, q - 1))}
          className="px-3 py-2 text-petroleum-300 hover:text-petroleum"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="w-14 border-x border-paper-line bg-transparent py-2 text-center font-mono text-sm focus:outline-none"
          aria-label="Quantity"
        />
        <button
          onClick={() => setQty((q) => q + 1)}
          className="px-3 py-2 text-petroleum-300 hover:text-petroleum"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
      <button
        onClick={() => addItem({ partNumber, productName, quantity: qty })}
        className="btn-primary flex-1"
      >
        Add to RFQ
      </button>
    </div>
  );
}
