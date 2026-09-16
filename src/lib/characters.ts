import type { Character } from './types.ts'

function icon(file: string): string {
  return `${import.meta.env.BASE_URL}characters/${file}`
}

export const CHARACTERS: Character[] = [
  {
    id: 'tycoon',
    label: 'Tycoon',
    shortLabel: 'Tycoon',
    hint: '30 turns / day',
    icon: icon('tycoon.png'),
    turnsPerDay: 30,
    minutesPerTurn: 48,
  },
  {
    id: 'bulletproof',
    label: 'All others',
    shortLabel: 'All others',
    hint: '24 turns / day',
    icon: icon('all-others.png'),
    turnsPerDay: 24,
    minutesPerTurn: 60,
  },
  {
    id: 'insomniac',
    label: 'Insomniac',
    shortLabel: 'Insomniac',
    hint: '34.3 turns / day',
    icon: icon('insomniac.png'),
    turnsPerDay: 34.28571429,
    minutesPerTurn: 42,
  },
  {
    id: 'kingpin',
    label: 'Kingpin / Enforcer',
    shortLabel: 'Kingpin',
    hint: '36 turns / day',
    icon: icon('kingpin.png'),
    turnsPerDay: 36,
    minutesPerTurn: 40,
  },
  {
    id: 'agent',
    label: 'Double Agent / Knuckle Duster',
    shortLabel: 'Double Agent',
    hint: '37.9 turns / day',
    icon: icon('agent.png'),
    turnsPerDay: 37.89473684,
    minutesPerTurn: 38,
  },
  {
    id: 'elite',
    label: 'Slicer / Sniper / Mastermind / Infiltrator',
    shortLabel: 'Elite',
    hint: '40 turns / day',
    icon: icon('elite.png'),
    turnsPerDay: 40,
    minutesPerTurn: 36,
  },
]

export function getCharacter(id: Character['id']): Character {
  return CHARACTERS.find((item) => item.id === id) ?? CHARACTERS[0]
}
