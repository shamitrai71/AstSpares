// Inventory (admin-only). Locations are minted (AST-LOC-#####); stock is an
// append-only movement ledger — on-hand and reserved are always the running
// sum of movements, never an overwritten number. Quantity-only for now.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import type { StockLocation, StockMovement, StockItem, LocationType, MovementType } from './types';

function clean<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

async function mintLocationId(): Promise<string> {
  const fn = httpsCallable<{ name: string }, { id: string; seq: number }>(functions, 'mintSequence');
  return (await fn({ name: 'location' })).data.id;
}

// ── Locations ────────────────────────────────────────────────────────────
export async function listLocations(): Promise<StockLocation[]> {
  const snap = await getDocs(collection(db, 'stockLocations'));
  return snap.docs.map((d) => d.data() as StockLocation).sort((a, b) => a.id.localeCompare(b.id));
}

export async function createLocation(
  input: {
    name: string;
    type: LocationType;
    vendorId?: string;
    city?: string;
    region?: string;
    postalCode?: string;
  },
  uid: string,
): Promise<StockLocation> {
  const id = await mintLocationId();
  const loc = clean({
    id,
    name: input.name.trim(),
    type: input.type,
    vendorId: input.vendorId || undefined,
    city: input.city?.trim() || undefined,
    region: input.region?.trim() || undefined,
    postalCode: input.postalCode?.trim() || undefined,
    active: true,
    createdBy: uid,
    createdAt: Date.now(),
  }) as StockLocation;
  await setDoc(doc(db, 'stockLocations', id), loc);
  return loc;
}

export async function updateLocation(id: string, patch: Partial<StockLocation>): Promise<void> {
  await updateDoc(doc(db, 'stockLocations', id), clean({ ...patch }) as Record<string, unknown>);
}

export async function deleteLocation(id: string): Promise<void> {
  await deleteDoc(doc(db, 'stockLocations', id));
}

// ── Movements (append-only ledger) ───────────────────────────────────────
export async function listMovements(): Promise<StockMovement[]> {
  const snap = await getDocs(collection(db, 'stockMovements'));
  return snap.docs.map((d) => ({ ...(d.data() as StockMovement), id: d.id }));
}

export async function addMovement(input: {
  itemPartNumber: string;
  type: MovementType;
  qty: number;
  locationId: string;
  toLocationId?: string;
  note?: string;
  ref?: string;
  createdBy?: string;
}): Promise<void> {
  await addDoc(
    collection(db, 'stockMovements'),
    clean({ ...input, note: input.note?.trim() || undefined, createdAt: Date.now() }),
  );
}

// ── Reorder points ───────────────────────────────────────────────────────
export async function listStockItems(): Promise<StockItem[]> {
  const snap = await getDocs(collection(db, 'stockItems'));
  return snap.docs.map((d) => d.data() as StockItem);
}

export async function setReorderPoint(partNumber: string, reorderPoint: number | undefined): Promise<void> {
  await setDoc(
    doc(db, 'stockItems', partNumber),
    clean({ partNumber, reorderPoint, updatedAt: Date.now() }),
    { merge: true },
  );
}

// ── Level computation (pure) ─────────────────────────────────────────────
export type Levels = { onHand: number; reserved: number };

/** item → location → running {onHand, reserved}. */
export function computeLevels(movements: StockMovement[]): Map<string, Map<string, Levels>> {
  const out = new Map<string, Map<string, Levels>>();
  const bump = (item: string, loc: string, dOn: number, dRes: number) => {
    const byLoc = out.get(item) ?? new Map<string, Levels>();
    const cur = byLoc.get(loc) ?? { onHand: 0, reserved: 0 };
    cur.onHand += dOn;
    cur.reserved += dRes;
    byLoc.set(loc, cur);
    out.set(item, byLoc);
  };
  for (const m of movements) {
    switch (m.type) {
      case 'receipt': bump(m.itemPartNumber, m.locationId, m.qty, 0); break;
      case 'issue': bump(m.itemPartNumber, m.locationId, -m.qty, 0); break;
      case 'adjust': bump(m.itemPartNumber, m.locationId, m.qty, 0); break; // signed
      case 'transfer':
        bump(m.itemPartNumber, m.locationId, -m.qty, 0);
        if (m.toLocationId) bump(m.itemPartNumber, m.toLocationId, m.qty, 0);
        break;
      case 'reserve': bump(m.itemPartNumber, m.locationId, 0, m.qty); break;
      case 'release': bump(m.itemPartNumber, m.locationId, 0, -m.qty); break;
    }
  }
  return out;
}

/** Totals across a single item's locations. */
export function itemTotals(byLoc: Map<string, Levels> | undefined): Levels & { available: number } {
  let onHand = 0;
  let reserved = 0;
  if (byLoc) for (const v of byLoc.values()) { onHand += v.onHand; reserved += v.reserved; }
  return { onHand, reserved, available: onHand - reserved };
}
