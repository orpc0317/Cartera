import { Input } from '@/components/ui/input'

export function ViewField({ label, value }: { label: string; value?: string | null | number; locked?: boolean }) {
  return (
    <div className="grid gap-1">
      <span className="font-semibold tracking-wider leading-none text-muted-foreground" style={{ fontSize: 'var(--ui-viewfield-label)' }}>{label}</span>
      <div className="flex items-center rounded-none bg-transparent border-0 border-b border-primary/50 px-2" style={{ height: 'var(--ui-field-height)' }}>
        <span className="block font-medium text-foreground" style={{ fontSize: 'var(--ui-viewfield-value)' }}>{value || ''}</span>
      </div>
    </div>
  )
}

export function LockedField({ label, value }: { label?: string; value?: string | null | number }) {
  return (
    <div className="grid gap-1">
      {label ? (
        <span className="font-semibold tracking-wider leading-none text-muted-foreground" style={{ fontSize: 'var(--ui-viewfield-label)' }}>{label}</span>
      ) : null}
      <Input variant="l-border" value={value == null ? '' : String(value)} disabled />
    </div>
  )
}
