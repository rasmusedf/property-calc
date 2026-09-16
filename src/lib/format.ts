const SUFFIXES: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  b: 1e9,
  t: 1e12,
  q: 1e15,
}

export function parseNumber(input: string): number {
  const raw = input.trim().toLowerCase().replace(/[$,_\s]/g, '')
  if (!raw || raw === '-') return 0

  const suffix = raw.slice(-1)
  const multiplier = SUFFIXES[suffix] ?? 1
  const body = multiplier === 1 ? raw : raw.slice(0, -1)
  const value = Number(body.replace(/,/g, ''))
  if (!Number.isFinite(value)) return 0
  return Math.max(0, value * multiplier)
}

export function formatMoney(value: number, compact = false): string {
  if (!Number.isFinite(value)) return '—'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  if (compact) {
    const tiers: [number, string][] = [
      [1e15, 'Q'],
      [1e12, 'T'],
      [1e9, 'B'],
      [1e6, 'M'],
      [1e3, 'K'],
    ]
    for (const [size, suffix] of tiers) {
      if (abs >= size) {
        const scaled = abs / size
        const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2
        return `${sign}$${scaled.toFixed(digits)}${suffix}`
      }
    }
  }

  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`
}

export function formatRoi(roi: number): string {
  if (!Number.isFinite(roi)) return '—'
  if (roi >= 1) return `${roi.toFixed(2)}%`
  if (roi >= 0.01) return `${roi.toFixed(3)}%`
  return `${roi.toFixed(5)}%`
}

export function formatTurns(turns: number): string {
  if (turns < 0) return '—'
  return Math.ceil(turns).toLocaleString('en-US')
}

export function formatLevel(level: number): string {
  return Math.max(1, Math.floor(level)).toLocaleString('en-US')
}

export function parseLevel(input: string): number {
  const value = Math.floor(parseNumber(input))
  return Math.min(99999, Math.max(1, value || 1))
}

export function formatDuration(turns: number, minutesPerTurn: number): string {
  if (turns < 0) return '—'
  if (turns === 0) return 'Ready'
  const totalMinutes = Math.ceil(turns) * minutesPerTurn
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  return days > 0 ? `${days}d ${clock}` : clock
}

export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return 'Ready'
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds <= 0) return 'Ready'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function rankColor(rank: number | null, total: number): string {
  if (rank === null || total <= 1) return 'transparent'
  const t = (rank - 1) / (total - 1)
  const hue = 152 - t * 132
  const sat = 68 - t * 10
  const light = 46
  return `hsl(${hue} ${sat}% ${light}%)`
}
