'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { RfqItem } from '@/lib/types';

const STORAGE_KEY = 'astspares.rfq.v1';

interface RfqContextValue {
  items: RfqItem[];
  count: number;
  isOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addItem: (item: { partNumber: string; productName: string; quantity?: number }) => void;
  removeItem: (partNumber: string) => void;
  updateItem: (partNumber: string, patch: Partial<RfqItem>) => void;
  clear: () => void;
}

const RfqContext = createContext<RfqContextValue | null>(null);

export function RfqProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<RfqItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted cart once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  // Persist on change (after hydration to avoid clobbering with empty initial state).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage full / unavailable — non-fatal */
    }
  }, [items, hydrated]);

  const value = useMemo<RfqContextValue>(() => {
    const addItem: RfqContextValue['addItem'] = ({ partNumber, productName, quantity = 1 }) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.partNumber === partNumber);
        if (existing) {
          return prev.map((i) =>
            i.partNumber === partNumber ? { ...i, quantity: i.quantity + quantity } : i,
          );
        }
        return [...prev, { partNumber, productName, quantity, requiredBy: null }];
      });
      setIsOpen(true);
    };

    return {
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      isOpen,
      openDrawer: () => setIsOpen(true),
      closeDrawer: () => setIsOpen(false),
      addItem,
      removeItem: (partNumber) =>
        setItems((prev) => prev.filter((i) => i.partNumber !== partNumber)),
      updateItem: (partNumber, patch) =>
        setItems((prev) =>
          prev.map((i) => (i.partNumber === partNumber ? { ...i, ...patch } : i)),
        ),
      clear: () => setItems([]),
    };
  }, [items, isOpen]);

  return <RfqContext.Provider value={value}>{children}</RfqContext.Provider>;
}

export function useRfq(): RfqContextValue {
  const ctx = useContext(RfqContext);
  if (!ctx) throw new Error('useRfq must be used within <RfqProvider>');
  return ctx;
}
