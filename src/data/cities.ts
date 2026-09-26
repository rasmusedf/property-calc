import { LCN_PROPERTIES } from './lcn.ts'

/** First property / travel unlock for each city. Later buildings add the city step. */
export const CITY_UNLOCK_LEVELS: Record<string, number> = {
  'New York': 1,
  Chicago: 15,
  London: 55,
  'Las Vegas': 90,
  Moscow: 120,
  Dubai: 140,
  Shanghai: 190,
  Tokyo: 270,
  Tijuana: 360,
  Medellin: 420,
  Johannesburg: 700,
  Bangkok: 850,
  'Rio de Janeiro': 1000,
  'San Francisco': 1240,
  Palermo: 1300,
  Miami: 1600,
  Sydney: 1720,
  Havana: 2120,
  Paris: 2520,
  Dublin: 3070,
  Prague: 3470,
  Berlin: 4370,
  Madrid: 4920,
  Venice: 4970,
  Tangier: 5470,
  'Return to Paris': 5970,
  Istanbul: 6470,
  Seoul: 6970,
  Antarctica: 7470,
  'Moon Base': 7970,
  Victoria: 8470,
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

/** Extra levels between buildings in the same city. Default is +10. */
const CITY_PROPERTY_STEP: Record<string, number> = {
  Palermo: 50,
}

function propertyKey(property: { name: string; city: string }): string {
  return `${property.city}:${property.name}`
}

function propertyStep(city: string): number {
  return CITY_PROPERTY_STEP[city] ?? 10
}

const PROPERTY_UNLOCK_LEVELS = new Map<string, number>()

for (const city of CITY_ORDER) {
  const start = CITY_UNLOCK_LEVELS[city]
  const step = propertyStep(city)
  LCN_PROPERTIES.filter((property) => property.city === city).forEach((property, index) => {
    PROPERTY_UNLOCK_LEVELS.set(propertyKey(property), start + index * step)
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
