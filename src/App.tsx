import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  cityUnlockLevel,
  isCityUnlocked,
  nextPropertyUnlock,
  unlockedCityCount,
} from './data/cities.ts'
import { LCN_PROPERTIES } from './data/lcn.ts'
import { CharacterSelect } from './CharacterSelect.tsx'
import { getCharacter } from './lib/characters.ts'
import {
  applyShoppingLines,
  buildShoppingList,
  computeAll,
  revertShoppingLines,
} from './lib/engine.ts'
import {
  formatCountdown,
  formatLevel,
  formatMoney,
  formatRoi,
  formatTurns,
  parseLevel,
  parseNumber,
  rankColor,
} from './lib/format.ts'
import { groupByCity, uniqueCities } from './lib/group.ts'
import {
  defaultState,
  exportState,
  loadOwnedLocked,
  loadState,
  loadTheme,
  loadWaitDeadline,
  MAX_SAVE_BYTES,
  parseImportedState,
  saveOwnedLocked,
  saveState,
  saveTheme,
  saveWaitDeadline,
  type Theme,
} from './lib/storage.ts'
import type {
  ComputedProperty,
  PlayerState,
  ShoppingLine,
  ShoppingTarget,
  Strategy,
} from './lib/types.ts'

type SortKey =
  | 'city'
  | 'next'
  | 'name'
  | 'owned'
  | 'income'
  | 'total'
  | 'cost'
  | 'roi'
  | 'payback'
  | 'wait'

export default function App() {
  const [state, setState] = useState<PlayerState>(loadState)
  const [query, setQuery] = useState('')
  const [city, setCity] = useState('all')
  const [hideLocked, setHideLocked] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [ownedLocked, setOwnedLocked] = useState(loadOwnedLocked)
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [done, setDone] = useState<ShoppingLine[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('city')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [flash, setFlash] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [highlightTick, setHighlightTick] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [waitDeadline, setWaitDeadline] = useState<number | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveState(state)
  }, [state])

  useEffect(() => {
    saveOwnedLocked(ownedLocked)
  }, [ownedLocked])

  useEffect(() => {
    saveTheme(theme)
  }, [theme])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 2400)
    return () => window.clearTimeout(timer)
  }, [flash])

  useEffect(() => {
    if (highlightId == null) return
    const row = document.getElementById(`property-${highlightId}`)
    const target = row?.querySelector('td') ?? row
    target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    const timer = window.setTimeout(() => setHighlightId(null), 1800)
    return () => window.clearTimeout(timer)
  }, [highlightId, highlightTick])

  const { rows, totals } = useMemo(
    () => computeAll(LCN_PROPERTIES, state),
    [state],
  )
  const baseState = useMemo(() => revertShoppingLines(state, done), [state, done])
  const shopping = useMemo(() => buildShoppingList(LCN_PROPERTIES, baseState), [baseState])
  const doneIds = useMemo(() => new Set(done.map((line) => line.id)), [done])
  const remaining = useMemo(
    () => shopping.lines.filter((line) => !doneIds.has(line.id)),
    [shopping.lines, doneIds],
  )
  const remainingById = useMemo(() => {
    const map: Record<number, ShoppingLine> = {}
    for (const line of remaining) map[line.id] = line
    return map
  }, [remaining])

  const cities = useMemo(() => uniqueCities(LCN_PROPERTIES), [])
  const unlockedCount = rows.filter((row) => row.unlocked).length
  const nextUnlock = nextPropertyUnlock(LCN_PROPERTIES, state.level)
  const citiesOpen = unlockedCityCount(state.level)

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (sortKey === 'next') {
        if (row.rank == null || row.rank > 3) return false
      } else {
        if (city !== 'all' && row.city !== city) return false
        if (hideLocked && city === 'all' && !row.unlocked && row.owned === 0) return false
      }
      if (!needle) return true
      return (
        row.name.toLowerCase().includes(needle) ||
        row.city.toLowerCase().includes(needle)
      )
    })
  }, [rows, query, city, hideLocked, sortKey])

  const sortedRows = useMemo(
    () => [...visible].sort((a, b) => compareRows(a, b, sortKey, sortDir)),
    [visible, sortKey, sortDir],
  )
  const groups = useMemo(() => groupByCity(sortedRows), [sortedRows])
  const grouped = sortKey === 'city'

  function patch(partial: Partial<PlayerState>) {
    setState((current) => ({ ...current, ...partial }))
  }

  function setOwned(id: number, owned: number) {
    setState((current) => ({
      ...current,
      owned: { ...current.owned, [String(id)]: Math.max(0, Math.floor(owned)) },
    }))
  }

  function buyLines(lines: ShoppingLine[]) {
    const fresh = lines.filter((line) => !doneIds.has(line.id))
    if (fresh.length === 0) return
    setState((current) => applyShoppingLines(current, fresh))
    setDone((current) => [...current, ...fresh])
    setFlash(
      fresh.length === 1
        ? `Marked ${fresh[0].qty} more ${fresh[0].name} as owned · ${fresh[0].ownedBefore} → ${fresh[0].ownedAfter}`
        : `Added ${fresh.reduce((sum, line) => sum + line.qty, 0)} units to Owned`,
    )
  }

  function undoLine(line: ShoppingLine) {
    if (!doneIds.has(line.id)) return
    setState((current) => revertShoppingLines(current, [line]))
    setDone((current) => current.filter((item) => item.id !== line.id))
    setFlash(`Undid ${line.qty} ${line.name}`)
  }

  function toggleLine(line: ShoppingLine) {
    if (doneIds.has(line.id)) undoLine(line)
    else buyLines([line])
  }

  function showProperty(id: number) {
    setHighlightId(id)
    setHighlightTick((tick) => tick + 1)
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(
      key === 'roi' || key === 'owned' || key === 'income' || key === 'total'
        ? 'desc'
        : 'asc',
    )
  }

  function handleImport(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_SAVE_BYTES) {
      setFlash('Save file is too large')
      return
    }
    void file.text()
      .then((text) => {
        setDone([])
        patch(parseImportedState(text))
        setFlash('Save imported')
      })
      .catch(() => {
        setFlash('Could not import that save')
      })
  }

  const remainingQty = remaining.reduce((sum, line) => sum + line.qty, 0)
  const remainingCost = remaining.reduce((sum, line) => sum + line.cost, 0)
  const doneCount = done.length
  const planCount = shopping.lines.length
  const character = getCharacter(state.characterId)
  const saveTarget = shopping.nextTarget
  const savingUp = planCount === 0 && saveTarget != null
  const afterBuy = useMemo(() => {
    if (remaining.length > 0) {
      return {
        totals: computeAll(LCN_PROPERTIES, applyShoppingLines(state, remaining)).totals,
        label: 'After cart',
      }
    }
    if (savingUp && saveTarget) {
      return {
        totals: computeAll(
          LCN_PROPERTIES,
          applyShoppingLines(state, [targetToLine(saveTarget, state)]),
        ).totals,
        label: 'If you buy',
      }
    }
    return null
  }, [remaining, savingUp, saveTarget, state])
  const dailyLift = afterBuy ? afterBuy.totals.dailyIncome - totals.dailyIncome : 0
  const nextWaitTurns =
    remainingQty > 0
      ? 0
      : savingUp && saveTarget && saveTarget.shortfall > 0
        ? totals.incomePerTurn < 1
          ? -1
          : Math.ceil(saveTarget.shortfall / totals.incomePerTurn)
        : null
  const waitKey =
    nextWaitTurns != null && nextWaitTurns > 0 && saveTarget
      ? `${saveTarget.id}:${nextWaitTurns}:${character.minutesPerTurn}:${Math.round(totals.incomePerTurn)}`
      : null
  const waitMs =
    waitKey != null && nextWaitTurns != null && nextWaitTurns > 0
      ? nextWaitTurns * character.minutesPerTurn * 60 * 1000
      : null

  useEffect(() => {
    if (waitKey == null || waitMs == null) {
      setWaitDeadline(null)
      saveWaitDeadline(null)
      return
    }
    const stored = loadWaitDeadline()
    if (stored?.key === waitKey) {
      setWaitDeadline(stored.at)
      return
    }
    const at = Date.now() + waitMs
    setWaitDeadline(at)
    saveWaitDeadline({ key: waitKey, at })
  }, [waitKey, waitMs])

  useEffect(() => {
    if (waitDeadline == null) return
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, 1000)
    const onVis = () => {
      if (!document.hidden) tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [waitDeadline])

  const waitLeftMs = waitDeadline != null ? waitDeadline - now : waitMs
  const waitLabel =
    remainingQty > 0
      ? 'Ready'
      : nextWaitTurns != null && nextWaitTurns > 0
        ? formatCountdown(waitLeftMs ?? 0)
        : nextWaitTurns === 0
          ? 'Ready'
          : nextWaitTurns === -1
            ? '—'
            : nextUnlock
              ? `Lv ${formatLevel(nextUnlock.level)}`
              : '—'
  const waitReady = waitLabel === 'Ready'

  return (
    <div className="app">
      <header className="nav">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
              <path
                d="M5 19V11.2L12 6l7 5.2V19H5z"
                stroke="currentColor"
                strokeWidth="1.7"
              />
              <path d="M10 19v-5h4v5" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </span>
          <div>
            <p className="eyebrow">Mob Wars · LCN</p>
            <h1>Property Calculator</h1>
          </div>
        </div>

        <div className="nav-end">
          <div className="nav-books">
            <LevelField
              value={state.level}
              onChange={(level) => patch({ level })}
            />
            <MoneyField
              label="Cash"
              value={state.cash}
              onChange={(cash) => patch({ cash })}
            />
            <MoneyField
              label="Bank"
              value={state.bank}
              onChange={(bank) => patch({ bank })}
            />
            <CharacterSelect
              value={state.characterId}
              onChange={(characterId) => patch({ characterId })}
            />
          </div>
          <div className="nav-actions">
            <button
              type="button"
              className="icon-btn"
              aria-pressed={theme === 'dark'}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
            >
              <ThemeGlyph dark={theme === 'dark'} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-pressed={settingsOpen}
              aria-label={settingsOpen ? 'Hide settings' : 'Show settings'}
              title="Settings"
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <SettingsGlyph />
            </button>
          </div>
        </div>
      </header>

      {settingsOpen && (
        <section className="panel settings">
          <div className="shopping-head">
            <div className="shopping-head-row">
              <h2>Settings</h2>
            </div>
            <p className="shopping-summary">
              Extra income, how packs are ranked, and save files.
            </p>
          </div>
          <div className="field-grid">
            <MoneyField
              label="Upkeep"
              value={state.upkeep}
              onChange={(upkeep) => patch({ upkeep })}
            />
            <MoneyField
              label="Other daily income"
              value={state.otherIncome}
              onChange={(otherIncome) => patch({ otherIncome })}
            />
          </div>
          <div className="settings-rank">
            <p className="save-up-label">Rank packs by</p>
            <div className="seg" role="group" aria-label="Shopping ranks by">
              <button
                type="button"
                className={state.strategy === 'roi' ? 'is-on' : ''}
                onClick={() => patch({ strategy: 'roi' satisfies Strategy })}
              >
                Best ROI
              </button>
              <button
                type="button"
                className={state.strategy === 'payback' ? 'is-on' : ''}
                onClick={() => patch({ strategy: 'payback' })}
              >
                Fastest payback
              </button>
            </div>
          </div>
          <div className="settings-actions">
            <button type="button" className="ghost" onClick={() => exportState(state)}>
              Export save
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => importRef.current?.click()}
            >
              Import save
            </button>
            <button
              type="button"
              className="ghost danger"
              onClick={() => {
                if (window.confirm('Reset all holdings and money?')) {
                  setDone([])
                  setState(defaultState())
                  setFlash('Save reset')
                }
              }}
            >
              Reset
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json"
              hidden
              onChange={(event) => {
                handleImport(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </div>
        </section>
      )}

      <dl className="kpis">
        <Kpi
          label="You make"
          value={formatMoney(totals.dailyIncome, true)}
          title={`${formatMoney(totals.dailyIncome)} / day`}
          caption={`${formatMoney(totals.incomePerTurn, true)} / turn · ${formatMoney(totals.weeklyIncome, true)} / week`}
        />
        <Kpi
          label="After this buy"
          value={
            afterBuy && dailyLift > 0
              ? formatMoney(afterBuy.totals.dailyIncome, true)
              : '—'
          }
          title={
            afterBuy && dailyLift > 0
              ? `${formatMoney(afterBuy.totals.dailyIncome)} / day`
              : 'No pack queued'
          }
          caption={afterBuy && dailyLift > 0 ? afterBuy.label : 'No pack queued'}
          tone={dailyLift > 0 ? 'up' : undefined}
          trend={
            dailyLift > 0
              ? {
                  dir: 'up',
                  text: `${formatSignedMoney(dailyLift)}${formatDeltaPct(dailyLift, totals.dailyIncome) ? ` · ${formatDeltaPct(dailyLift, totals.dailyIncome)}` : ''}`,
                  title: `${formatSignedMoney(dailyLift)} / day`,
                }
              : undefined
          }
        />
        <Kpi
          label={planCount > 0 ? 'Left after buying' : 'On hand'}
          value={formatMoney(shopping.leftover, true)}
          title={formatMoney(shopping.leftover)}
          caption={
            planCount > 0
              ? `${doneCount}/${planCount} checked off`
              : savingUp
                ? 'Not enough for a pack of 10'
                : 'Ready for a cart'
          }
          trend={
            remainingCost > 0
              ? {
                  dir: 'out',
                  text: `${formatSignedMoney(-remainingCost)} to spend`,
                  title: formatMoney(remainingCost),
                }
              : undefined
          }
        />
      </dl>

      <div className="workspace">
        <section
          className={`panel now${savingUp ? ' is-save' : planCount > 0 ? ' is-buy' : ' is-empty'}`}
        >
          <div className="shopping-head">
            <div className="shopping-head-row">
              <h2>{savingUp ? 'Save up' : planCount > 0 ? 'Buy now' : 'No cart'}</h2>
              {planCount > 0 ? (
                <span className="shopping-count">
                  {doneCount}/{planCount}
                </span>
              ) : null}
            </div>
            {planCount > 0 ? (
              <p className="shopping-summary">
                Check packs off as you buy them in game
                <span aria-hidden="true"> · </span>
                <strong>{remainingQty.toLocaleString('en-US')}</strong> left
              </p>
            ) : unlockedCount === 0 ? (
              <p className="shopping-summary">
                Raise your level to unlock properties.
              </p>
            ) : savingUp ? (
              <p className="shopping-summary">
                Next best pack of 10 you cannot afford yet.
              </p>
            ) : (
              <p className="shopping-summary">
                {totals.liquid > 0
                  ? 'Nothing unlocked is worth a pack of 10 right now.'
                  : 'Add cash or bank to build a cart.'}
              </p>
            )}
          </div>

          {savingUp ? (
            <SaveUpCard
              target={saveTarget}
              onProperty={showProperty}
              waitLabel={waitLabel}
              waitReady={waitReady}
              turns={nextWaitTurns}
              shortTitle={
                nextWaitTurns != null && nextWaitTurns > 0
                  ? `Estimated ${formatTurns(nextWaitTurns)} turns until you can buy ${saveTarget.name}`
                  : undefined
              }
            />
          ) : null}

          {planCount > 0 ? (
            <div
              className="progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={planCount}
              aria-valuenow={doneCount}
            >
              <span style={{ width: `${(doneCount / planCount) * 100}%` }} />
            </div>
          ) : null}

          {shopping.lines.length > 0 ? (
            <ol className="shopping-lines">
              {shopping.lines.map((line) => {
                const checked = doneIds.has(line.id)
                return (
                  <li key={line.id}>
                    <div className={`shopping-row${checked ? ' is-done' : ''}`}>
                      <label className="shopping-line">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleLine(line)}
                          aria-label={
                            checked
                              ? `Undo ${line.qty} ${line.name}`
                              : `Mark ${line.qty} more ${line.name} as bought, ${line.ownedBefore.toLocaleString('en-US')} to ${line.ownedAfter.toLocaleString('en-US')}`
                          }
                        />
                        <span className="shopping-body">
                          <strong>{line.name}</strong>
                          <span className="shopping-meta">
                            <span className="shopping-qty">
                              +{line.qty.toLocaleString('en-US')}
                            </span>
                            <span>{line.city}</span>
                            <span>
                              {line.ownedBefore.toLocaleString('en-US')} →{' '}
                              {line.ownedAfter.toLocaleString('en-US')}
                            </span>
                          </span>
                        </span>
                        <span
                          className={`shopping-price${checked ? ' is-hidden' : ''}`}
                          title={formatMoney(line.cost)}
                        >
                          {formatMoney(line.cost, true)}
                        </span>
                      </label>
                      {checked ? (
                        <button
                          type="button"
                          className="undo"
                          onClick={() => undoLine(line)}
                        >
                          Undo
                        </button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : null}

          {shopping.stoppedAtCap && (
            <p className="empty">
              List capped after {shopping.totalQty} units. Finish this cart,
              then generate the next one.
            </p>
          )}

          {planCount > 0 && shopping.nextTarget ? (
            <SaveUpCard
              target={shopping.nextTarget}
              onProperty={showProperty}
              compact
            />
          ) : null}
        </section>

        <section className="panel catalog">
          <div className="catalog-head">
            <div className="shopping-head">
              <div className="shopping-head-row">
                <h2>Holdings</h2>
                <span className="shopping-count">{visible.length}</span>
              </div>
              <p className="shopping-summary">
                {sortKey === 'next'
                  ? 'The next three packs ranked for you'
                  : `${citiesOpen} of ${cities.length} cities unlocked`}
                {sortKey !== 'next' && nextUnlock ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    {nextUnlock.name} unlocks at {formatLevel(nextUnlock.level)}
                  </>
                ) : null}
              </p>
            </div>
            <div className="seg" role="group" aria-label="Sort properties">
              <button
                type="button"
                className={sortKey === 'city' ? 'is-on' : ''}
                onClick={() => handleSort('city')}
              >
                City
              </button>
              <button
                type="button"
                className={sortKey === 'next' ? 'is-on' : ''}
                onClick={() => {
                  setSortKey('next')
                  setSortDir('asc')
                }}
              >
                Next 3
              </button>
              <button
                type="button"
                className={sortKey === 'roi' ? 'is-on' : ''}
                onClick={() => {
                  setSortKey('roi')
                  setSortDir('desc')
                }}
              >
                ROI
              </button>
              <button
                type="button"
                className={sortKey === 'payback' ? 'is-on' : ''}
                onClick={() => {
                  setSortKey('payback')
                  setSortDir('asc')
                }}
              >
                Payback
              </button>
            </div>
            <div className="toolbar">
              <input
                className="search"
                type="search"
                placeholder="Search properties or cities"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select value={city} onChange={(event) => setCity(event.target.value)}>
                <option value="all">All cities</option>
                {cities.map((name) => {
                  const unlock = cityUnlockLevel(name)
                  const open = state.level >= unlock
                  return (
                    <option key={name} value={name}>
                      {name}
                      {open ? '' : ` · lv ${formatLevel(unlock)}`}
                    </option>
                  )
                })}
              </select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={hideLocked}
                  onChange={(event) => setHideLocked(event.target.checked)}
                />
                Hide locked
              </label>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <SortButton
                      label="Property"
                      active={sortKey === 'name'}
                      dir={sortDir}
                      onClick={() => handleSort('name')}
                    />
                  </th>
                  <th className="num owned-col">
                    <button
                      type="button"
                      className={`owned-lock${ownedLocked ? ' is-locked' : ''}`}
                      aria-pressed={ownedLocked}
                      aria-label={
                        ownedLocked
                          ? 'Unlock Owned counts'
                          : 'Lock Owned counts'
                      }
                      title={
                        ownedLocked
                          ? 'Unlock Owned so you can edit counts'
                          : 'Lock Owned to keep in-game counts from being overwritten'
                      }
                      onClick={() => setOwnedLocked((locked) => !locked)}
                    >
                      <span>Owned</span>
                      <LockGlyph locked={ownedLocked} />
                    </button>
                  </th>
                  <th className="num">
                    <SortButton
                      label="Income"
                      active={sortKey === 'income'}
                      dir={sortDir}
                      onClick={() => handleSort('income')}
                    />
                  </th>
                  <th className="num">
                    <SortButton
                      label="Total"
                      active={sortKey === 'total'}
                      dir={sortDir}
                      onClick={() => handleSort('total')}
                    />
                  </th>
                  <th className="num">
                    <SortButton
                      label="Next cost"
                      active={sortKey === 'cost'}
                      dir={sortDir}
                      onClick={() => handleSort('cost')}
                    />
                  </th>
                  <th className="num">
                    <SortButton
                      label="ROI"
                      active={sortKey === 'roi'}
                      dir={sortDir}
                      onClick={() => handleSort('roi')}
                    />
                  </th>
                  <th className="num">
                    <SortButton
                      label="Payback"
                      active={sortKey === 'payback'}
                      dir={sortDir}
                      onClick={() => handleSort('payback')}
                    />
                  </th>
                  <th className="num">
                    <SortButton
                      label="Wait"
                      active={sortKey === 'wait'}
                      dir={sortDir}
                      onClick={() => handleSort('wait')}
                    />
                  </th>
                </tr>
              </thead>
              {grouped
                ? groups.map((group) => {
                    const cityOpen = isCityUnlocked(group.city, state.level)
                    const unlockAt = cityUnlockLevel(group.city)
                    return (
                      <tbody key={group.city}>
                        <tr className={cityOpen ? 'city-row' : 'city-row locked'}>
                          <td colSpan={8}>
                            <div className="city-head">
                              <span>{group.city}</span>
                              <em>
                                {cityOpen
                                  ? `${group.rows.length} ${group.rows.length === 1 ? 'property' : 'properties'}`
                                  : `Unlocks at ${formatLevel(unlockAt)}`}
                              </em>
                            </div>
                          </td>
                        </tr>
                        {group.rows.map((row) => (
                          <PropertyRow
                            key={row.id}
                            row={row}
                            unlockedCount={unlockedCount}
                            remaining={remainingById[row.id]}
                            ownedLocked={ownedLocked}
                            highlighted={highlightId === row.id}
                            onOwned={setOwned}
                          />
                        ))}
                      </tbody>
                    )
                  })
                : (
                    <tbody>
                      {sortedRows.map((row) => (
                        <PropertyRow
                          key={row.id}
                          row={row}
                          unlockedCount={unlockedCount}
                          remaining={remainingById[row.id]}
                          ownedLocked={ownedLocked}
                          highlighted={highlightId === row.id}
                          onOwned={setOwned}
                        />
                      ))}
                    </tbody>
                  )}
            </table>
          </div>
        </section>
      </div>

      {flash && <p className="toast">{flash}</p>}
    </div>
  )
}

function formatSignedMoney(value: number): string {
  if (value === 0) return formatMoney(0, true)
  return `${value > 0 ? '+' : '−'}${formatMoney(Math.abs(value), true)}`
}

function formatDeltaPct(part: number, whole: number): string | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole === 0) return null
  const pct = (part / Math.abs(whole)) * 100
  if (Math.abs(pct) < 0.05) return null
  const digits = Math.abs(pct) >= 10 ? 0 : 1
  const sign = pct > 0 ? '+' : '−'
  return `${sign}${Math.abs(pct).toFixed(digits)}%`
}

function targetToLine(target: ShoppingTarget, state: PlayerState): ShoppingLine {
  const ownedBefore = state.owned[String(target.id)] ?? 0
  return {
    id: target.id,
    name: target.name,
    city: target.city,
    qty: target.qty,
    ownedBefore,
    ownedAfter: ownedBefore + target.qty,
    unitCost: target.qty > 0 ? target.cost / target.qty : 0,
    cost: target.cost,
  }
}

function Kpi({
  label,
  value,
  title,
  caption,
  tone,
  trend,
}: {
  label: string
  value: string
  title?: string
  caption: string
  tone?: 'up' | 'down' | 'out'
  trend?: { dir: 'up' | 'down' | 'out'; text: string; title?: string }
}) {
  return (
    <div>
      <dt>{label}</dt>
      <div className="kpi-row">
        <dd className={tone ? `is-${tone}` : undefined} title={title}>
          {value}
        </dd>
        {trend ? (
          <Trend dir={trend.dir} title={trend.title}>
            {trend.text}
          </Trend>
        ) : null}
      </div>
      <p>{caption}</p>
    </div>
  )
}

function Trend({
  dir,
  title,
  children,
}: {
  dir: 'up' | 'down' | 'out'
  title?: string
  children: ReactNode
}) {
  return (
    <span className={`trend is-${dir}`} title={title}>
      <TrendGlyph up={dir === 'up'} />
      {children}
    </span>
  )
}

function TrendGlyph({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      {up ? (
        <path
          fill="currentColor"
          d="M4.2 11.3a.75.75 0 0 1 0-1.06L8.44 6h-2.2a.75.75 0 0 1 0-1.5H11a.75.75 0 0 1 .75.75v4.76a.75.75 0 0 1-1.5 0V7.56L5.26 11.3a.75.75 0 0 1-1.06 0Z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M4.2 4.7a.75.75 0 0 1 1.06 0L9.25 8.69V6.5a.75.75 0 0 1 1.5 0V11.25A.75.75 0 0 1 10 12H5.24a.75.75 0 0 1 0-1.5h2.2L4.2 5.76a.75.75 0 0 1 0-1.06Z"
        />
      )}
    </svg>
  )
}

function SaveUpCard({
  target,
  onProperty,
  compact = false,
  waitLabel,
  waitReady,
  turns,
  shortTitle,
}: {
  target: ShoppingTarget
  onProperty: (id: number) => void
  compact?: boolean
  waitLabel?: string
  waitReady?: boolean
  turns?: number | null
  shortTitle?: string
}) {
  if (compact) {
    return (
      <div className="save-up is-next">
        <p className="save-up-label">After this cart</p>
        <button
          type="button"
          className="property-link save-up-name"
          onClick={() => onProperty(target.id)}
        >
          {target.qty} × {target.name}
        </button>
        <p className="save-up-meta">
          {target.city}
          <span aria-hidden="true"> · </span>
          {formatMoney(target.cost, true)}
          {target.shortfall > 0 ? (
            <>
              <span aria-hidden="true"> · </span>
              {formatSignedMoney(-target.shortfall)} short
            </>
          ) : null}
        </p>
      </div>
    )
  }

  return (
    <div className="now-hero">
      <p className="now-kicker">{waitReady ? 'Ready to buy' : 'Time to afford'}</p>
      <p
        className="now-clock"
        title={shortTitle}
      >
        {waitLabel ?? '—'}
      </p>
      <p className="now-cap">
        {waitReady
          ? 'You can cover a pack of 10'
          : `Estimated${turns != null && turns > 0 ? ` · ${formatTurns(turns)} turns` : ''}`}
      </p>
      <button
        type="button"
        className="property-link save-up-name"
        onClick={() => onProperty(target.id)}
      >
        {target.name}
      </button>
      <p className="save-up-meta">
        {target.qty} × {target.city}
        <span aria-hidden="true"> · </span>
        {formatMoney(target.cost, true)}
        {target.shortfall > 0 ? (
          <>
            <span aria-hidden="true"> · </span>
            {formatSignedMoney(-target.shortfall)} short
          </>
        ) : null}
      </p>
    </div>
  )
}

function PropertyRow({
  row,
  unlockedCount,
  remaining,
  ownedLocked,
  highlighted,
  onOwned,
}: {
  row: ComputedProperty
  unlockedCount: number
  remaining?: ShoppingLine
  ownedLocked: boolean
  highlighted: boolean
  onOwned: (id: number, owned: number) => void
}) {
  return (
    <tr
      id={`property-${row.id}`}
      className={`${row.unlocked ? 'property' : 'property locked'}${highlighted ? ' is-target' : ''}`}
      style={{
        ['--rank' as string]: row.unlocked
          ? rankColor(row.rank, unlockedCount)
          : 'transparent',
      }}
    >
      <td>
        <div className="name">
          <strong>{row.name}</strong>
          <span className="name-meta">
            <span>{row.city}</span>
            {!row.unlocked ? (
              <span className="name-lock">Lv {formatLevel(row.unlockLevel)}</span>
            ) : null}
            {row.rank === 1 ? <span className="name-best">Best</span> : null}
            {row.rank && row.rank <= 3 && row.rank > 1 ? (
              <span>#{row.rank}</span>
            ) : null}
            {remaining ? (
              <span className="name-buy">+{remaining.qty.toLocaleString('en-US')}</span>
            ) : null}
          </span>
        </div>
      </td>
      <td className="num">
        <OwnedField
          value={row.owned}
          locked={ownedLocked}
          onChange={(owned) => onOwned(row.id, owned)}
        />
      </td>
      <td className="num" title={formatMoney(row.income)}>
        {formatMoney(row.income, true)}
      </td>
      <td className="num" title={formatMoney(row.totalIncome)}>
        {formatMoney(row.totalIncome, true)}
      </td>
      <td className="num" title={formatMoney(row.currentCost)}>
        {formatMoney(row.currentCost, true)}
      </td>
      <td
        className={`num roi${row.rank === 1 ? ' is-up' : row.rank && row.rank <= 3 ? ' is-hot' : ''}`}
      >
        {formatRoi(row.roi)}
      </td>
      <td className={`num${row.rank === 1 ? ' is-up' : ''}`}>
        {formatTurns(row.paybackTurns)}
      </td>
      <td
        className={`num wait${row.turnsLeft === 0 ? ' is-up' : row.turnsLeft > 200 ? ' is-down' : ''}`}
      >
        {row.timeLeftLabel}
      </td>
    </tr>
  )
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`th-sort${active ? ' is-on' : ''}`}
      onClick={onClick}
    >
      {label}
      {active ? <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span> : null}
    </button>
  )
}

function compareRows(
  a: ComputedProperty,
  b: ComputedProperty,
  key: SortKey,
  dir: 'asc' | 'desc',
): number {
  const sign = dir === 'asc' ? 1 : -1
  switch (key) {
    case 'name':
      return a.name.localeCompare(b.name) * sign
    case 'owned':
      return (a.owned - b.owned) * sign
    case 'income':
      return (a.income - b.income) * sign
    case 'total':
      return (a.totalIncome - b.totalIncome) * sign
    case 'cost':
      return (a.currentCost - b.currentCost) * sign
    case 'roi':
      return (a.roi - b.roi) * sign
    case 'payback':
      return (a.paybackTurns - b.paybackTurns) * sign
    case 'wait':
      return (a.turnsLeft - b.turnsLeft) * sign
    case 'next':
      return ((a.rank ?? 999) - (b.rank ?? 999)) * sign
    default:
      return 0
  }
}

function LevelField({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  return (
    <label className="field">
      <span>Level</span>
      <input
        inputMode="numeric"
        value={draft}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          setDraft(event.target.value)
          if (event.target.value.trim()) onChange(parseLevel(event.target.value))
        }}
        onBlur={() => {
          setFocused(false)
          onChange(parseLevel(draft))
        }}
      />
    </label>
  )
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(formatMoney(value, true))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(formatMoney(value, true))
  }, [value, focused])

  return (
    <label className="field">
      <span>{label}</span>
      <input
        inputMode="decimal"
        value={focused ? draft : formatMoney(value, true)}
        title={formatMoney(value)}
        onFocus={() => {
          setFocused(true)
          setDraft(value ? String(value) : '')
        }}
        onChange={(event) => {
          setDraft(event.target.value)
          onChange(parseNumber(event.target.value))
        }}
        onBlur={() => setFocused(false)}
      />
    </label>
  )
}

function OwnedField({
  value,
  locked,
  onChange,
}: {
  value: number
  locked: boolean
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(String(value))
  }, [value, focused])

  return (
    <input
      className={`owned${locked ? ' is-locked' : ''}`}
      inputMode="numeric"
      value={draft}
      readOnly={locked}
      aria-readonly={locked}
      title={locked ? 'Owned is locked. Unlock the column to edit.' : undefined}
      onFocus={() => {
        if (locked) return
        setFocused(true)
      }}
      onChange={(event) => {
        if (locked) return
        setDraft(event.target.value)
        onChange(parseNumber(event.target.value))
      }}
      onBlur={() => setFocused(false)}
    />
  )
}

function LockGlyph({ locked }: { locked: boolean }) {
  return (
    <svg
      className="lock-glyph"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-hidden="true"
    >
      <path
        d={
          locked
            ? 'M5 7V5.2A3 3 0 0 1 11 5.2V7h.8A1.2 1.2 0 0 1 13 8.2v5.6A1.2 1.2 0 0 1 11.8 15H4.2A1.2 1.2 0 0 1 3 13.8V8.2A1.2 1.2 0 0 1 4.2 7H5Zm1.3-1.8A1.7 1.7 0 0 1 9.7 5.2V7H6.3V5.2Z'
            : 'M5 7V5.2A3 3 0 0 1 11 5.2h-1.3A1.7 1.7 0 0 0 6.3 5.2V7H11.8A1.2 1.2 0 0 1 13 8.2v5.6A1.2 1.2 0 0 1 11.8 15H4.2A1.2 1.2 0 0 1 3 13.8V8.2A1.2 1.2 0 0 1 4.2 7H5Z'
        }
        fill="currentColor"
      />
    </svg>
  )
}

function SettingsGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.4 1.8h3.2l.3 1.5a5 5 0 0 1 1.2.7l1.5-.5 1.6 2.8-1.2 1c.1.3.1.6.1.9s0 .6-.1.9l1.2 1-1.6 2.8-1.5-.5a5 5 0 0 1-1.2.7l-.3 1.5H6.4l-.3-1.5a5 5 0 0 1-1.2-.7l-1.5.5L1.8 10l1.2-1a5 5 0 0 1-.1-.9c0-.3 0-.6.1-.9l-1.2-1 1.6-2.8 1.5.5a5 5 0 0 1 1.2-.7l.3-1.5ZM8 6.2A1.8 1.8 0 1 0 8 9.8 1.8 1.8 0 0 0 8 6.2Z"
      />
    </svg>
  )
}

function ThemeGlyph({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      {dark ? (
        <path
          fill="currentColor"
          d="M8 2.2a.8.8 0 0 1 .8-.8h.05A6.8 6.8 0 1 1 2.4 7.15a.8.8 0 0 1 1.02.78A4.8 4.8 0 0 0 8.8 12.7 4.8 4.8 0 0 0 8 3.2V2.2Z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M8 3.2a.8.8 0 0 1 .8.8v.8a.8.8 0 0 1-1.6 0V4a.8.8 0 0 1 .8-.8Zm0 7.2a2.4 2.4 0 1 1 0-4.8 2.4 2.4 0 0 1 0 4.8Zm5.2-3.2a.8.8 0 0 1-.8.8h-.8a.8.8 0 0 1 0-1.6H12.4a.8.8 0 0 1 .8.8ZM8 12a.8.8 0 0 1 .8.8v.8a.8.8 0 0 1-1.6 0v-.8A.8.8 0 0 1 8 12ZM3.6 8a.8.8 0 0 1-.8.8H2a.8.8 0 0 1 0-1.6h.8a.8.8 0 0 1 .8.8Zm8.05-4.45a.8.8 0 0 1 0 1.13l-.57.57a.8.8 0 1 1-1.13-1.13l.57-.57a.8.8 0 0 1 1.13 0ZM6.05 10.75a.8.8 0 0 1 0 1.13l-.57.57a.8.8 0 0 1-1.13-1.13l.57-.57a.8.8 0 0 1 1.13 0Zm5.7 1.7a.8.8 0 0 1-1.13 0l-.57-.57a.8.8 0 0 1 1.13-1.13l.57.57a.8.8 0 0 1 0 1.13ZM5.48 5.48a.8.8 0 0 1-1.13 0l-.57-.57A.8.8 0 0 1 4.9 3.78l.57.57a.8.8 0 0 1 0 1.13Z"
        />
      )}
    </svg>
  )
}
