import type { ComputedProperty } from './types.ts'

export function uniqueCities(rows: { city: string }[]): string[] {
  const seen = new Set<string>()
  const cities: string[] = []
  for (const row of rows) {
    if (!seen.has(row.city)) {
      seen.add(row.city)
      cities.push(row.city)
    }
  }
  return cities
}

export function groupByCity(rows: ComputedProperty[]) {
  const groups: { city: string; rows: ComputedProperty[] }[] = []
  for (const row of rows) {
    const last = groups[groups.length - 1]
    if (last && last.city === row.city) last.rows.push(row)
    else groups.push({ city: row.city, rows: [row] })
  }
  return groups
}
