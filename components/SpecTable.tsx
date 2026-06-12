import type { SpecRow } from '@/lib/types';

export function SpecTable({ specs }: { specs: SpecRow[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {specs.map((row, i) => (
          <tr key={row.label} className={i % 2 ? 'bg-paper-200/40' : ''}>
            <th
              scope="row"
              className="w-2/5 border-b border-paper-line px-3 py-2.5 text-left font-mono text-[11px] uppercase tracking-eyebrow text-petroleum-300"
            >
              {row.label}
            </th>
            <td className="border-b border-paper-line px-3 py-2.5 text-petroleum-ink">
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
