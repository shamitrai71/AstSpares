// Client-side helpers for the buyer/company/location master records.
// IDs (company, buyer) are minted by the mintSequence Cloud Function so the
// counters stay server-only; the documents themselves are written here under
// the firestore.rules that scope them to the owning buyer / admins.
import {
  collection,
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
