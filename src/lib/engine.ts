import { isPropertyUnlocked, propertyUnlockLevel } from '../data/cities.ts'
import { getCharacter } from './characters.ts'
import { formatDuration } from './format.ts'
import type {
  ComputedProperty,
  PlayerState,
  PropertyDef,
  ShoppingLine,
  ShoppingList,
  Totals,
} from './types.ts'

export const PACK_QTY = 10
export const RECOMMENDED_QTY = PACK_QTY

export function nextUnitCost(initialCost: number, owned: number): number {
  return (initialCost * owned) / 10 + initialCost
}

export function computeProperty(
  def: PropertyDef,
  owned: number,
  unlocked: boolean,
  incomePerTurn: number,
  liquid: number,
  minutesPerTurn: number,
): Omit<ComputedProperty, 'rank'> {
  const currentCost = nextUnitCost(def.initialCost, owned)
  const totalIncome = def.income * owned
  const roi = currentCost > 0 ? (def.income / currentCost) * 100 : 0
  const paybackTurns = def.income > 0 ? Math.ceil(currentCost / def.income) : Number.POSITIVE_INFINITY
  const recommendedQty = RECOMMENDED_QTY
  const recommendedCost = currentCost * recommendedQty
  const shortfall = recommendedCost - liquid

  let turnsLeft = 0
  if (shortfall > 0) {
    turnsLeft = incomePerTurn < 1 ? -1 : Math.ceil(shortfall / incomePerTurn)
  }

  return {
    ...def,
    owned,
    unlocked,
    unlockLevel: propertyUnlockLevel(def),
    totalIncome,
    currentCost,
    roi,
    paybackTurns,
    recommendedQty,
    recommendedCost,
    turnsLeft,
    timeLeftLabel: formatDuration(turnsLeft, minutesPerTurn),
    affordable: unlocked && liquid >= currentCost,
  }
}

export function compareProperties(
  a: Pick<ComputedProperty, 'roi' | 'paybackTurns' | 'currentCost'>,
  b: Pick<ComputedProperty, 'roi' | 'paybackTurns' | 'currentCost'>,
  strategy: PlayerState['strategy'],
): number {
  if (strategy === 'payback') {
    if (a.paybackTurns !== b.paybackTurns) return a.paybackTurns - b.paybackTurns
    return a.currentCost - b.currentCost
  }

  if (a.roi !== b.roi) return b.roi - a.roi
  return a.currentCost - b.currentCost
}

export function computeAll(
  catalog: PropertyDef[],
  state: PlayerState,
): { rows: ComputedProperty[]; totals: Totals; recommendation: ComputedProperty | null } {
  const character = getCharacter(state.characterId)
  const liquid = state.cash + state.bank

  const grossIncome = catalog.reduce((sum, def) => {
    const owned = state.owned[String(def.id)] ?? 0
    return sum + def.income * owned
  }, 0)

  const otherPerTurn = state.otherIncome / character.turnsPerDay
  const incomePerTurn = grossIncome - state.upkeep + otherPerTurn

  const totals: Totals = {
    incomePerTurn,
    turnsPerDay: character.turnsPerDay,
    dailyIncome: incomePerTurn * character.turnsPerDay,
    weeklyIncome: incomePerTurn * character.turnsPerDay * 7,
    liquid,
  }

  const rows: ComputedProperty[] = catalog.map((def) => {
    const key = String(def.id)
    const owned = state.owned[key] ?? 0
    const unlocked = isPropertyUnlocked(def, state.level)
    return {
      ...computeProperty(
        def,
        owned,
        unlocked,
        incomePerTurn,
        liquid,
        character.minutesPerTurn,
      ),
      rank: null,
    }
  })

  const ranked = rows
    .filter((row) => row.unlocked)
    .sort((a, b) => compareProperties(a, b, state.strategy))

  ranked.forEach((row, index) => {
    row.rank = index + 1
  })

  return {
    rows,
    totals,
    recommendation: ranked[0] ?? null,
  }
}

const SHOPPING_SWITCH_CAP = 300
const SHOPPING_PACK_CAP = 2000

function snapshotRows(
  catalog: PropertyDef[],
  owned: Record<string, number>,
  level: number,
  strategy: PlayerState['strategy'],
): ComputedProperty[] {
  const rows: ComputedProperty[] = catalog.map((def) => {
    const key = String(def.id)
    const unlocked = isPropertyUnlocked(def, level)
    return {
      ...computeProperty(def, owned[key] ?? 0, unlocked, 0, 0, 48),
      rank: null,
    }
  })

  rows
    .filter((row) => row.unlocked)
    .sort((a, b) => compareProperties(a, b, strategy))
    .forEach((row, index) => {
      row.rank = index + 1
    })

  return rows
}

function packAffordable(row: ComputedProperty, budget: number): boolean {
  return row.currentCost > 0 && row.currentCost * PACK_QTY <= budget
}

function rankSnapshot(
  catalog: PropertyDef[],
  owned: Record<string, number>,
  level: number,
  strategy: PlayerState['strategy'],
): ComputedProperty[] {
  return snapshotRows(catalog, owned, level, strategy)
    .filter((row) => row.unlocked)
    .sort((a, b) => compareProperties(a, b, strategy))
}

function mergeLinesByProperty(rawLines: ShoppingLine[]): ShoppingLine[] {
  const merged = new Map<number, ShoppingLine>()
  const order: number[] = []

  for (const line of rawLines) {
    const existing = merged.get(line.id)
    if (existing) {
      existing.qty += line.qty
      existing.cost += line.cost
      existing.ownedAfter = existing.ownedBefore + existing.qty
      existing.unitCost = existing.qty > 0 ? existing.cost / existing.qty : existing.unitCost
    } else {
      merged.set(line.id, { ...line })
      order.push(line.id)
    }
  }

  return order.map((id) => merged.get(id)!)
}

export function buildShoppingList(
  catalog: PropertyDef[],
  state: PlayerState,
): ShoppingList {
  const owned = { ...state.owned }
  let budget = state.cash + state.bank
  const rawLines: ShoppingLine[] = []
  let packsBought = 0
  let stoppedAtCap = false

  for (let step = 0; step < SHOPPING_SWITCH_CAP; step += 1) {
    const ranked = rankSnapshot(catalog, owned, state.level, state.strategy)
    const pick = ranked[0]
    if (!pick || !packAffordable(pick, budget)) break

    const runnerUp = ranked.find((row) => row.id !== pick.id)
    const key = String(pick.id)
    let qty = 0
    let cost = 0

    while (packsBought < SHOPPING_PACK_CAP) {
      const unitCost = nextUnitCost(pick.initialCost, owned[key] ?? 0)
      const packCost = unitCost * PACK_QTY
      if (packCost <= 0 || packCost > budget) break

      if (qty > 0 && runnerUp) {
        const current = {
          currentCost: unitCost,
          roi: unitCost > 0 ? (pick.income / unitCost) * 100 : 0,
          paybackTurns:
            pick.income > 0 ? Math.ceil(unitCost / pick.income) : Number.POSITIVE_INFINITY,
        }
        if (compareProperties(current, runnerUp, state.strategy) >= 0) break
      }

      owned[key] = (owned[key] ?? 0) + PACK_QTY
      budget -= packCost
      qty += PACK_QTY
      cost += packCost
      packsBought += 1
    }

    if (qty < PACK_QTY) break

    const ownedAfter = owned[key] ?? 0
    rawLines.push({
      id: pick.id,
      name: pick.name,
      city: pick.city,
      qty,
      ownedBefore: ownedAfter - qty,
      ownedAfter,
      unitCost: cost / qty,
      cost,
    })

    if (packsBought >= SHOPPING_PACK_CAP) {
      const leftoverBest = rankSnapshot(catalog, owned, state.level, state.strategy)[0]
      stoppedAtCap = Boolean(leftoverBest && packAffordable(leftoverBest, budget))
      break
    }
  }

  const catalogIndex = new Map(catalog.map((item, index) => [item.id, index]))
  const lines = mergeLinesByProperty(rawLines).sort(
    (a, b) => (catalogIndex.get(a.id) ?? 0) - (catalogIndex.get(b.id) ?? 0),
  )

  const afterRows = rankSnapshot(catalog, owned, state.level, state.strategy)
  const next = afterRows[0]
  const nextTarget = next
    ? {
        id: next.id,
        name: next.name,
        city: next.city,
        qty: next.recommendedQty,
        cost: next.recommendedCost,
        shortfall: Math.max(0, next.recommendedCost - budget),
      }
    : null

  return {
    lines,
    totalQty: lines.reduce((sum, line) => sum + line.qty, 0),
    totalCost: lines.reduce((sum, line) => sum + line.cost, 0),
    leftover: budget,
    stoppedAtCap,
    nextTarget,
  }
}

export function spendFromBooks(
  cash: number,
  bank: number,
  amount: number,
): { cash: number; bank: number } {
  const fromCash = Math.min(cash, amount)
  return {
    cash: cash - fromCash,
    bank: bank - (amount - fromCash),
  }
}

export function applyShoppingLines(state: PlayerState, lines: ShoppingLine[]): PlayerState {
  const owned = { ...state.owned }
  let cost = 0
  for (const line of lines) {
    const key = String(line.id)
    owned[key] = (owned[key] ?? 0) + line.qty
    cost += line.cost
  }
  return {
    ...state,
    owned,
    ...spendFromBooks(state.cash, state.bank, cost),
  }
}

export function revertShoppingLines(state: PlayerState, lines: ShoppingLine[]): PlayerState {
  const owned = { ...state.owned }
  let refund = 0
  for (const line of lines) {
    const key = String(line.id)
    owned[key] = Math.max(0, (owned[key] ?? 0) - line.qty)
    refund += line.cost
  }
  return {
    ...state,
    owned,
    cash: state.cash + refund,
  }
}

export function applyShoppingList(state: PlayerState, list: ShoppingList): PlayerState {
  return applyShoppingLines(state, list.lines)
}

export function emptyHoldings(catalog: PropertyDef[]): Pick<PlayerState, 'owned'> {
  const owned: Record<string, number> = {}
  for (const def of catalog) {
    owned[String(def.id)] = 0
  }
  return { owned }
}
