// Indian GST state codes (per CBIC) and GSTIN parsing. A GSTIN's first two
// digits are the state code of the party's registration — this is the same
// code tax authorities use, so it's a more reliable source for IGST vs
// CGST+SGST determination than a free-text region/state name field.

export const GST_STATE_CODES: { code: string; name: string }[] = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra and Nagar Haveli and Daman and Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
];

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Extracts + validates the 2-digit state code from a GSTIN. Returns null if
 *  the GSTIN is missing, malformed, or its state code isn't recognised. */
export function stateCodeFromGstin(gstin?: string): string | null {
  const g = (gstin ?? '').trim().toUpperCase();
  if (!GSTIN_RE.test(g)) return null;
  const code = g.slice(0, 2);
  return GST_STATE_CODES.some((s) => s.code === code) ? code : null;
}

export function stateNameForCode(code?: string | null): string | undefined {
  return GST_STATE_CODES.find((s) => s.code === code)?.name;
}

/** Best-effort state-name → code lookup, for the free-text region fallback
 *  when no GSTIN is on file. Exact, case-insensitive name match only. */
export function stateCodeFromName(name?: string): string | null {
  const n = (name ?? '').trim().toLowerCase();
  if (!n) return null;
  return GST_STATE_CODES.find((s) => s.name.toLowerCase() === n)?.code ?? null;
}
