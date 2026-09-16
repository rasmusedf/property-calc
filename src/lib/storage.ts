import { LCN_PROPERTIES } from '../data/lcn.ts'
import { CHARACTERS } from './characters.ts'
import { emptyHoldings } from './engine.ts'
import type { CharacterId, PlayerState, Strategy } from './types.ts'

const STORAGE_KEY = 'property-calc:lcn:v1'
const OWNED_LOCK_KEY = 'property-calc:lcn:owned-locked'
const THEME_KEY = 'property-calc:lcn:theme'
const WAIT_DEADLINE_KEY = 'property-calc:lcn:wait-deadline'
const MAX_WAIT_MS = 1000 * 60 * 60 * 24 * 365 * 5

export type WaitDeadline = {
  key: string
  at: number
}

export const MAX_SAVE_BYTES = 200_000
const MAX_MONEY = 1e18
const MAX_OWNED = 1_000_000_000

export type Theme = 'light' | 'dark'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function clampLevel(value: unknown): number {
  return Math.floor(clampNumber(value, 1, 1, 99999))
}

function clampMoney(value: unknown): number {
  return clampNumber(value, 0, 0, MAX_MONEY)
}

function asCharacterId(value: unknown): CharacterId {
  return CHARACTERS.some((item) => item.id === value)
    ? (value as CharacterId)
    : 'tycoon'
}

function asStrategy(value: unknown): Strategy {
  return value === 'payback' ? 'payback' : 'roi'
}

export function defaultState(): PlayerState {
  return {
    cash: 0,
    bank: 0,
    upkeep: 0,
    otherIncome: 0,
    level: 1,
    characterId: 'tycoon',
    strategy: 'roi',
    ...emptyHoldings(LCN_PROPERTIES),
  }
}

function hydrateOwned(value: unknown, fallback: Record<string, number>): Record<string, number> {
  const owned = { ...fallback }
  if (!isRecord(value)) return owned
  for (const key of Object.keys(fallback)) {
    if (!Object.hasOwn(value, key)) continue
    owned[key] = Math.floor(clampNumber(value[key], 0, 0, MAX_OWNED))
  }
  return owned
}

function hydrateState(parsed: unknown): PlayerState {
  const fallback = defaultState()
  if (!isRecord(parsed)) return fallback
  return {
    cash: clampMoney(parsed.cash),
    bank: clampMoney(parsed.bank),
    upkeep: clampMoney(parsed.upkeep),
    otherIncome: clampMoney(parsed.otherIncome),
    level: clampLevel(parsed.level),
    characterId: asCharacterId(parsed.characterId),
    strategy: asStrategy(parsed.strategy),
    owned: hydrateOwned(parsed.owned, fallback.owned),
  }
}

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLocal(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function loadState(): PlayerState {
  const raw = readLocal(STORAGE_KEY)
  if (!raw || raw.length > MAX_SAVE_BYTES) return defaultState()
  try {
    return hydrateState(JSON.parse(raw))
  } catch {
    return defaultState()
  }
}

export function saveState(state: PlayerState): boolean {
  const raw = JSON.stringify(state)
  if (raw.length > MAX_SAVE_BYTES) return false
  return writeLocal(STORAGE_KEY, raw)
}

export function exportState(state: PlayerState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'property-calc-lcn.json'
  link.rel = 'noopener'
  link.click()
  URL.revokeObjectURL(url)
}

export function parseImportedState(text: string): PlayerState {
  if (typeof text !== 'string' || text.length > MAX_SAVE_BYTES) {
    throw new Error('Save file is too large')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Save file is not valid JSON')
  }
  return hydrateState(parsed)
}

export function loadOwnedLocked(): boolean {
  return readLocal(OWNED_LOCK_KEY) === '1'
}

export function saveOwnedLocked(locked: boolean): boolean {
  return writeLocal(OWNED_LOCK_KEY, locked ? '1' : '0')
}

export function loadTheme(): Theme {
  const saved = readLocal(THEME_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {
    /* ignore */
  }
  return 'light'
}

export function saveTheme(theme: Theme): boolean {
  document.documentElement.dataset.theme = theme
  return writeLocal(THEME_KEY, theme)
}

export function loadWaitDeadline(): WaitDeadline | null {
  const raw = readLocal(WAIT_DEADLINE_KEY)
  if (!raw || raw.length > 500) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    if (typeof parsed.key !== 'string' || parsed.key.length === 0 || parsed.key.length > 200) {
      return null
    }
    if (typeof parsed.at !== 'number' || !Number.isFinite(parsed.at)) return null
    if (parsed.at > Date.now() + MAX_WAIT_MS || parsed.at < Date.now() - 60_000) return null
    return { key: parsed.key, at: parsed.at }
  } catch {
    return null
  }
}

export function saveWaitDeadline(value: WaitDeadline | null): boolean {
  if (value == null) {
    try {
      localStorage.removeItem(WAIT_DEADLINE_KEY)
      return true
    } catch {
      return false
    }
  }
  return writeLocal(
    WAIT_DEADLINE_KEY,
    JSON.stringify({
      key: value.key.slice(0, 200),
      at: Math.min(value.at, Date.now() + MAX_WAIT_MS),
    }),
  )
}
