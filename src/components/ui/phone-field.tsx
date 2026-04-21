import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'
import { Input } from './input'

export const PHONE_COUNTRIES: { iso: string; code: string; name: string }[] = [
  { iso: 'AR', code: '54',  name: 'Argentina' },
  { iso: 'BO', code: '591', name: 'Bolivia' },
  { iso: 'BR', code: '55',  name: 'Brasil' },
  { iso: 'CA', code: '1',   name: 'Canadá' },
  { iso: 'CL', code: '56',  name: 'Chile' },
  { iso: 'CO', code: '57',  name: 'Colombia' },
  { iso: 'CR', code: '506', name: 'Costa Rica' },
  { iso: 'CU', code: '53',  name: 'Cuba' },
  { iso: 'DE', code: '49',  name: 'Alemania' },
  { iso: 'DO', code: '1',   name: 'Rep. Dominicana' },
  { iso: 'EC', code: '593', name: 'Ecuador' },
  { iso: 'ES', code: '34',  name: 'España' },
  { iso: 'FR', code: '33',  name: 'Francia' },
  { iso: 'GB', code: '44',  name: 'Reino Unido' },
  { iso: 'GT', code: '502', name: 'Guatemala' },
  { iso: 'HN', code: '504', name: 'Honduras' },
  { iso: 'IT', code: '39',  name: 'Italia' },
  { iso: 'MX', code: '52',  name: 'México' },
  { iso: 'NI', code: '505', name: 'Nicaragua' },
  { iso: 'PA', code: '507', name: 'Panamá' },
  { iso: 'PE', code: '51',  name: 'Perú' },
  { iso: 'PT', code: '351', name: 'Portugal' },
  { iso: 'PY', code: '595', name: 'Paraguay' },
  { iso: 'SV', code: '503', name: 'El Salvador' },
  { iso: 'US', code: '1',   name: 'Estados Unidos' },
  { iso: 'UY', code: '598', name: 'Uruguay' },
  { iso: 'VE', code: '58',  name: 'Venezuela' },
]

export const DIAL_CODES: Record<string, string> = Object.fromEntries(PHONE_COUNTRIES.map((c) => [c.iso, c.code]))

export function splitPhone(value: string): { iso: string; local: string } {
  if (!value.startsWith('+')) return { iso: '', local: value }
  const sorted = PHONE_COUNTRIES.slice().sort((a, b) => b.code.length - a.code.length)
  for (const c of sorted) {
    if (value.startsWith('+' + c.code)) {
      return { iso: c.iso, local: value.slice(1 + c.code.length) }
    }
  }
  return { iso: '', local: value }
}

export function PhoneField({
  iso, local, onIsoChange, onLocalChange, placeholder,
}: {
  iso: string; local: string
  onIsoChange: (iso: string) => void; onLocalChange: (local: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex gap-2">
      <Select value={iso} onValueChange={(v: string | null) => onIsoChange(v ?? '')}>
        <SelectTrigger className="w-[110px] shrink-0 px-2">
          <SelectValue placeholder="País">
            {(v: string) => v && DIAL_CODES[v] ? (
              <span className="flex items-center gap-1">
                <img src={`https://flagcdn.com/w20/${v.toLowerCase()}.png`} alt={v} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                <span>+{DIAL_CODES[v]}</span>
              </span>
            ) : <span className="text-muted-foreground text-xs">País</span>}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PHONE_COUNTRIES.map((c) => (
            <SelectItem key={c.iso} value={c.iso}>
              <span className="flex items-center gap-2">
                <img src={`https://flagcdn.com/w20/${c.iso.toLowerCase()}.png`} alt={c.iso} width={20} height={14} className="object-cover rounded-sm shrink-0" />
                +{c.code} — {c.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input className="flex-1" value={local} onChange={(e) => onLocalChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}
