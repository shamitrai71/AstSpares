import type { CompanyType } from './types';

/** Company classifications, in display order ("Others" last). The `code` is the
 *  master L1 category slug (shared cross-app join vocabulary); the `label` stays
 *  ASTSPARES-friendly. `trader`/`agent` are local codes — commercial roles with
 *  no master L1 home (that distinction lives in VendorType). */
export const COMPANY_TYPE_OPTIONS: { code: CompanyType; label: string }[] = [
  { code: 'storage-terminals', label: 'Storage Terminals' },
  { code: 'process-industries', label: 'Process Industries' },
  { code: 'natural-resources-and-upstream', label: 'Natural Resources & Upstream' },
  { code: 'engineering-and-construction', label: 'Engineering & Construction' },
  { code: 'logistics-and-transportation', label: 'Logistics & Transportation' },
  { code: 'asset-integrity-and-inspection', label: 'Asset Integrity & Inspection' },
  { code: 'professional-services', label: 'Professional Services' },
  { code: 'trader', label: 'Trader' },
  { code: 'agent', label: 'Agent' },
  { code: 'other', label: 'Other' },
];

export const DEFAULT_COMPANY_TYPE: CompanyType = 'process-industries';

/** Old ASTSPARES codes → master L1 slugs. Lets legacy records display the right
 *  label before their stored `type` is migrated, and documents the mapping.
 *  Also the exact remap a data migration should apply to `company.type`. */
export const LEGACY_COMPANY_TYPE_ALIAS: Record<string, CompanyType> = {
  refinery: 'process-industries',
  epc: 'engineering-and-construction',
  terminal: 'storage-terminals',
  port: 'logistics-and-transportation',
  inspection: 'asset-integrity-and-inspection',
  consultant: 'professional-services',
};

/** Resolve any stored value (legacy or current) to its current master-slug code. */
export function normalizeCompanyType(t?: string | null): string {
  if (!t) return '';
  return LEGACY_COMPANY_TYPE_ALIAS[t] ?? t;
}

/** Readable label for a stored type code. Resolves legacy codes first, then falls
 *  back to the raw value (so any unmapped legacy record still displays) or an em dash. */
export function companyTypeLabel(t?: string | null): string {
  const code = normalizeCompanyType(t);
  return COMPANY_TYPE_OPTIONS.find((o) => o.code === code)?.label ?? (t || '—');
}
