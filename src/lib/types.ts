export type PropertyDef = {
  id: number
  name: string
  city: string
  initialCost: number
  income: number
  investableDefault: boolean
}

export type CharacterId =
  | 'tycoon'
  | 'bulletproof'
  | 'insomniac'
  | 'kingpin'
  | 'agent'
  | 'elite'

export type Strategy = 'roi' | 'payback'

export type Character = {
  id: CharacterId
  label: string
  shortLabel: string
  hint: string
  icon: string
  turnsPerDay: number
  minutesPerTurn: number
}

export type PlayerState = {
  cash: number
  bank: number
  upkeep: number
  otherIncome: number
  level: number
  characterId: CharacterId
  strategy: Strategy
  owned: Record<string, number>
}

export type ComputedProperty = PropertyDef & {
  owned: number
  unlocked: boolean
  unlockLevel: number
  totalIncome: number
  currentCost: number
  roi: number
  paybackTurns: number
  recommendedQty: number
  recommendedCost: number
  turnsLeft: number
  timeLeftLabel: string
  affordable: boolean
  rank: number | null
}

export type Totals = {
  incomePerTurn: number
  turnsPerDay: number
  dailyIncome: number
  weeklyIncome: number
  liquid: number
}

export type ShoppingLine = {
  id: number
  name: string
  city: string
  qty: number
  ownedBefore: number
  ownedAfter: number
  unitCost: number
  cost: number
}

export type ShoppingTarget = {
  id: number
  name: string
  city: string
  qty: number
  cost: number
  shortfall: number
}

export type ShoppingList = {
  lines: ShoppingLine[]
  totalQty: number
  totalCost: number
  leftover: number
  stoppedAtCap: boolean
  nextTarget: ShoppingTarget | null
}
