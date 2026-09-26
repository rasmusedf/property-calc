import { LCN_PROPERTIES } from './lcn.ts'

/** In-game city unlock. The first building opens here; the rest fill the gap before the next city. */
export const CITY_UNLOCK_LEVELS: Record<string, number> = {
  'New York': 1,
  Chicago: 15,
  London: 55,
  'Las Vegas': 90,
  Moscow: 120,
  Dubai: 140,
  Shanghai: 190,
  Tokyo: 250,
  Tijuana: 300,
  Medellin: 400,
  Johannesburg: 500,
  Bangkok: 750,
  'Rio de Janeiro': 1000,
  'San Francisco': 1100,
  Palermo: 1300,
  Miami: 1500,
  Sydney: 1720,
  Havana: 2120,
  Paris: 2520,
  Dublin: 2970,
  Prague: 3470,
  Berlin: 3970,
  Madrid: 4470,
  Venice: 4970,
  Tangier: 5470,
  'Return to Paris': 5970,
  Istanbul: 6520,
  Seoul: 7070,
  Antarctica: 7620,
  'Moon Base': 8170,
  Victoria: 8670,
  'Exham Penitentiary': 9170,
  'Los Angeles': 9670,
  'Port Haven': 10170,
  'Kuala Lumpur': 10670,
  Cairo: 11170,
  'Mexico City': 11670,
  Auckland: 12170,
  'Washington DC': 12670,
  'Hong Kong': 13170,
  Amsterdam: 13670,
  'Saint Petersburg': 14170,
  Houston: 14670,
  Lagos: 15170,
  Warsaw: 15670,
  'Silicon Valley': 16170,
  'Atlantic City': 16670,
  Montreal: 17170,
  Mumbai: 17670,
}

export const CITY_ORDER = Object.keys(CITY_UNLOCK_LEVELS)

export function cityUnlockLevel(city: string): number {
  return CITY_UNLOCK_LEVELS[city] ?? 1
}

export function isCityUnlocked(city: string, level: number): boolean {
  return level >= cityUnlockLevel(city)
}

export function nextCityUnlock(level: number): { city: string; level: number } | null {
  for (const city of CITY_ORDER) {
    const unlock = CITY_UNLOCK_LEVELS[city]
    if (unlock > level) return { city, level: unlock }
  }
  return null
}

export function unlockedCityCount(level: number): number {
  return CITY_ORDER.filter((city) => CITY_UNLOCK_LEVELS[city] <= level).length
}

/** Caracas opens after Mumbai. It has no properties in the catalog yet. */
const LEVEL_AFTER_LAST_CITY = 18170

function propertyKey(property: { name: string; city: string }): string {
  return `${property.city}:${property.name}`
}

/** Spread a city's buildings across the levels before the next city opens. */
function propertyLevel(start: number, next: number, count: number, index: number): number {
  const gap = next - start
  if (count <= 1 || gap <= 0) return start
  if (gap % count === 0) return start + index * (gap / count)
  return Math.min(start + Math.ceil((index * gap) / count), next - 1)
}

const PROPERTY_UNLOCK_LEVELS = new Map<string, number>()

for (let i = 0; i < CITY_ORDER.length; i++) {
  const city = CITY_ORDER[i]
  const start = CITY_UNLOCK_LEVELS[city]
  const next =
    i + 1 < CITY_ORDER.length ? CITY_UNLOCK_LEVELS[CITY_ORDER[i + 1]] : LEVEL_AFTER_LAST_CITY
  const properties = LCN_PROPERTIES.filter((property) => property.city === city)
  properties.forEach((property, index) => {
    PROPERTY_UNLOCK_LEVELS.set(
      propertyKey(property),
      propertyLevel(start, next, properties.length, index),
    )
  })
}

export function propertyUnlockLevel(property: { name: string; city: string }): number {
  return PROPERTY_UNLOCK_LEVELS.get(propertyKey(property)) ?? cityUnlockLevel(property.city)
}

export function isPropertyUnlocked(
  property: { name: string; city: string },
  level: number,
): boolean {
  return level >= propertyUnlockLevel(property)
}

export function nextPropertyUnlock(
  catalog: { name: string; city: string }[],
  level: number,
): { name: string; city: string; level: number } | null {
  let next: { name: string; city: string; level: number } | null = null

  for (const property of catalog) {
    const unlock = propertyUnlockLevel(property)
    if (unlock <= level) continue
    if (
      !next ||
      unlock < next.level ||
      (unlock === next.level &&
        (property.city < next.city ||
          (property.city === next.city && property.name < next.name)))
    ) {
      next = { name: property.name, city: property.city, level: unlock }
    }
  }

  return next
}
