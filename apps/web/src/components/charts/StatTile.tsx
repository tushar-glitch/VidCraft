/** One headline number. The value uses proportional figures (tabular ones look loose at this size). */
export function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="viz-root rounded-lg border p-4" style={{ background: 'var(--viz-surface)', borderColor: 'var(--viz-border)' }}>
      <div className="text-sm" style={{ color: 'var(--viz-ink-2)' }}>{label}</div>
      <div className="mt-1 text-3xl font-semibold" style={{ color: 'var(--viz-ink)' }}>{value}</div>
      {note && <div className="mt-1 text-xs" style={{ color: 'var(--viz-muted)' }}>{note}</div>}
    </div>
  );
}
