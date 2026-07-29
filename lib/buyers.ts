// Client-side helpers for the buyer/company/location master records.
// IDs (company, buyer) are minted by the mintSequence Cloud Function so the
// counters stay server-only; the documents themselves are written here under
// the firestore.rules that scope them to the owning buyer / admins.
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import { normalizeCompanyType } from './company';
import type { Buyer, Company, CompanyLocation, CompanyType } from './types';

/** Firestore rejects `undefined` field values — drop them before writing. */
function clean<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

async function mint(name: 'company' | 'buyer' | 'po'): Promise<string> {
  const fn = httpsCallable<{ name: string }, { id: string; seq: number }>(functions, 'mintSequence');
  const res = await fn({ name });
  return res.data.id;
}

// ── Buyer ──────────────────────────────────────────────────────────────────

export async function getBuyerByUid(uid: string): Promise<Buyer | null> {
  const snap = await getDocs(query(collection(db, 'buyers'), where('uid', '==', uid), limit(1)));
  return snap.empty ? null : (snap.docs[0].data() as Buyer);
}

export async function createBuyerProfile(input: {
  uid: string;
  email: string;
  name: string;
  phone?: string;
  dialCode?: string;
  country?: string;
  designation?: string;
  department?: string;
  companyId: string;
  companyName: string;
  locationId?: string;
  locationName?: string;
}): Promise<Buyer> {
  const id = await mint('buyer');
  const buyer: Buyer = clean({
    id,
    uid: input.uid,
    name: input.name.trim(),
    email: input.email,
    phone: input.phone?.trim() || undefined,
    dialCode: input.dialCode || undefined,
    country: input.country || undefined,
    designation: input.designation?.trim() || undefined,
    department: input.department?.trim() || undefined,
    companyId: input.companyId,
    companyName: input.companyName,
    locationId: input.locationId,
    locationName: input.locationName,
    channel: 'online',
    verified: false,
    createdBy: input.uid,
    createdAt: Date.now(),
  }) as Buyer;
  await setDoc(doc(db, 'buyers', id), buyer);
  return buyer;
}

/** Buyer self-service update of their own contact fields (rules-whitelisted). */
export async function updateBuyerProfile(
  buyerId: string,
  patch: Partial<Pick<Buyer, 'name' | 'phone' | 'dialCode' | 'country' | 'designation' | 'department'>>,
): Promise<void> {
  const data = clean({ ...patch, updatedAt: Date.now() }) as Record<string, unknown>;
  await updateDoc(doc(db, 'buyers', buyerId), data);
}

// ── Companies ────────────────────────────────────────────────────────────────

export async function listCompanies(): Promise<Company[]> {
  const snap = await getDocs(query(collection(db, 'companies'), orderBy('name')));
  return snap.docs.map((d) => d.data() as Company);
}

export async function createCompany(
  input: { name: string; type?: CompanyType; country?: string; defaultCurrency?: string },
  uid: string,
): Promise<Company> {
  const id = await mint('company');
  const company: Company = clean({
    id,
    name: input.name.trim(),
    type: input.type,
    country: input.country?.trim() || undefined,
    defaultCurrency: input.defaultCurrency || undefined,
    verified: false,
    createdBy: uid,
    createdAt: Date.now(),
  }) as Company;
  await setDoc(doc(db, 'companies', id), company);
  return company;
}

// ── Locations (a company's sites) ────────────────────────────────────────────

export async function listLocations(companyId: string): Promise<CompanyLocation[]> {
  const snap = await getDocs(
    query(collection(db, 'companies', companyId, 'locations'), orderBy('name')),
  );
  return snap.docs.map((d) => d.data() as CompanyLocation);
}

export async function createLocation(
  companyId: string,
  input: { name: string; city?: string; country?: string },
  uid: string,
): Promise<CompanyLocation> {
  const ref = doc(collection(db, 'companies', companyId, 'locations'));
  const location: CompanyLocation = clean({
    id: ref.id,
    companyId,
    name: input.name.trim(),
    city: input.city?.trim() || undefined,
    country: input.country?.trim() || undefined,
    createdBy: uid,
    createdAt: Date.now(),
  }) as CompanyLocation;
  await setDoc(ref, location);
  return location;
}

// ── Admin master-list helpers (used by the admin screens) ────────────────────

export async function listAllBuyers(): Promise<Buyer[]> {
  const snap = await getDocs(query(collection(db, 'buyers'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => d.data() as Buyer);
}

export async function setCompanyVerified(id: string, verified: boolean): Promise<void> {
  await updateDoc(doc(db, 'companies', id), { verified, updatedAt: Date.now() });
}

// ── Admin master-list management ─────────────────────────────────────────────

export async function updateCompany(
  id: string,
  patch: Partial<Pick<Company, 'name' | 'type' | 'country' | 'defaultCurrency' | 'verified'>>,
): Promise<void> {
  await updateDoc(doc(db, 'companies', id), clean({ ...patch, updatedAt: Date.now() }));
}

/** One-shot migration: remap any company whose stored `type` is a legacy code
 *  (refinery/epc/terminal/port/inspection/consultant) to its master L1 slug.
 *  Idempotent and safe to re-run — companies already on a master slug, or on the
 *  local codes (trader/agent/other), or with no type, are left untouched. */
export async function migrateCompanyTypes(): Promise<{ scanned: number; migrated: number }> {
  const companies = await listCompanies();
  let migrated = 0;
  for (const c of companies) {
    const next = normalizeCompanyType(c.type);
    if (next && next !== c.type) {
      await updateCompany(c.id, { type: next as CompanyType });
      migrated++;
    }
  }
  return { scanned: companies.length, migrated };
}

export async function deleteCompany(id: string): Promise<void> {
  // Remove its locations first (client SDK can't delete a subcollection in one call).
  const locs = await listLocations(id);
  await Promise.all(locs.map((l) => deleteDoc(doc(db, 'companies', id, 'locations', l.id))));
  await deleteDoc(doc(db, 'companies', id));
}

export async function updateLocation(
  companyId: string,
  locationId: string,
  patch: Partial<Pick<CompanyLocation, 'name' | 'city' | 'country'>>,
): Promise<void> {
  await updateDoc(doc(db, 'companies', companyId, 'locations', locationId), clean({ ...patch }));
}

export async function deleteLocation(companyId: string, locationId: string): Promise<void> {
  await deleteDoc(doc(db, 'companies', companyId, 'locations', locationId));
}

export async function updateBuyer(buyerId: string, patch: Partial<Buyer>): Promise<void> {
  await updateDoc(doc(db, 'buyers', buyerId), clean({ ...patch, updatedAt: Date.now() }) as Record<string, unknown>);
}

/** Admin-create a buyer WITH sign-in credentials (email + initial password). */
export async function adminCreateBuyer(input: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  dialCode?: string;
  country?: string;
  designation?: string;
  department?: string;
  companyId: string;
  companyName: string;
}): Promise<{ id: string; uid: string }> {
  const fn = httpsCallable<typeof input, { id: string; uid: string }>(functions, 'adminCreateBuyer');
  return (await fn(input)).data;
}

/** Disable or re-enable a buyer's sign-in (number retained). */
export async function setBuyerDisabled(buyerId: string, disabled: boolean): Promise<void> {
  const fn = httpsCallable<{ buyerId: string; disabled: boolean }, { ok: boolean }>(functions, 'adminSetBuyerDisabled');
  await fn({ buyerId, disabled });
}

/** Delete a buyer and its sign-in account (the buyer number is never reused). */
export async function deleteBuyerAccount(buyerId: string): Promise<void> {
  const fn = httpsCallable<{ buyerId: string }, { ok: boolean }>(functions, 'adminDeleteBuyer');
  await fn({ buyerId });
}

/** Admin-created offline buyer (no auth uid, channel 'offline'). */
export async function createOfflineBuyer(input: {
  adminUid: string;
  name: string;
  email: string;
  phone?: string;
  dialCode?: string;
  country?: string;
  designation?: string;
  department?: string;
  companyId: string;
  companyName: string;
  locationId?: string;
  locationName?: string;
}): Promise<Buyer> {
  const id = await mint('buyer');
  const buyer: Buyer = clean({
    id,
    uid: null,
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || undefined,
    dialCode: input.dialCode || undefined,
    country: input.country || undefined,
    designation: input.designation?.trim() || undefined,
    department: input.department?.trim() || undefined,
    companyId: input.companyId,
    companyName: input.companyName,
    locationId: input.locationId,
    locationName: input.locationName,
    channel: 'offline',
    verified: true,
    createdBy: input.adminUid,
    createdAt: Date.now(),
  }) as Buyer;
  await setDoc(doc(db, 'buyers', id), buyer);
  return buyer;
}
