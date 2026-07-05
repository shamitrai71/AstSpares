import type { CompanyType } from './types';

/** Company classifications, in display order ("Others" last). */
export const COMPANY_TYPE_OPTIONS: { code: CompanyType; label: string }[] = [
  { code: 'refinery', label: 'Refinery / Petchem' },
  { code: 'epc', label: 'EPC Contractor' },
  { code: 'terminal', label: 'Tank Terminal' },
  { code: 'port', label: 'Port' },
  { code: 'trader', label: 'Trader' },
  { code: 'agent', label: 'Agent' },
  { code: 'inspection', label: 'Inspection / TPI' },
  { code: 'consultant', label: 'Consultant' },
  { code: 'other', label: 'Others' },
];

export const DEFAULT_COMPANY_TYPE: CompanyType = 'refinery';

/** Readable label for a stored type code; falls back to the raw value (so
 *  legacy records like 'oem' still display) or an em dash when empty. */
export function companyTypeLabel(t?: string | null): string {
  return COMPANY_TYPE_OPTIONS.find((o) => o.code === t)?.label ?? (t || '—');
}
