import { useEffect, useId, useRef, useState } from 'react'
import { CHARACTERS, getCharacter } from './lib/characters.ts'
import type { CharacterId } from './lib/types.ts'

export function CharacterSelect({
  value,
  onChange,
}: {
  value: CharacterId
  onChange: (id: CharacterId) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = getCharacter(value)

  useEffect(() => {
    if (!open) return

    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="field character-field" ref={rootRef}>
      <span>Character</span>
      <button
        type="button"
        className="character-trigger"
        aria-label={`Character, ${selected.shortLabel}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="character-copy">
          <strong>{selected.shortLabel}</strong>
        </span>
        <Chevron open={open} />
      </button>
      {open ? (
        <ul className="character-menu" id={listId} role="listbox">
          {CHARACTERS.map((character) => {
            const active = character.id === value
            return (
              <li key={character.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`character-option${active ? ' is-on' : ''}`}
                  aria-label={`${character.label}, ${character.hint}`}
                  onClick={() => {
                    onChange(character.id)
                    setOpen(false)
                  }}
                >
                  <CharacterIcon src={character.icon} />
                  <span className="character-copy">
                    <strong>{character.shortLabel}</strong>
                    <em>{character.hint}</em>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function CharacterIcon({ src }: { src: string }) {
  return (
    <span className="char-icon char-icon-lg" aria-hidden="true">
      <img src={src} alt="" width={191} height={222} />
    </span>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={`character-chevron${open ? ' is-open' : ''}`} viewBox="0 0 16 16" width="14" height="14">
      <path
        d="M4.2 6.2 8 10l3.8-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
