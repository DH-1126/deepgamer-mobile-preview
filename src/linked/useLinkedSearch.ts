import { useEffect, useMemo, useState } from 'react'
import type { LinkedSearchProjection } from '../../../双端演示/src/contract'
import { getLinkedSearchProjection, searchRequestIssues } from '../../../双端演示/src/search-config'
import { getLinkedState, subscribeLinkedState, waitForLinkedState } from './linkedData'
import {
  buildLinkedSearchRequest,
  countLinkedSearchValues,
  applyLinkedSearchProjection,
  createLinkedSearchBaseline,
  describeLinkedSearchValue,
  getLinkedSearchConflict,
  removeLinkedSearchValue,
  type LinkedSearchBaseline,
  type LinkedSearchValues,
} from './linkedSearchModel'

function missingProjection(gameCode: string): LinkedSearchProjection {
  return {
    mode: 'MISSING', gameCode, gameId: null, versionId: null, versionNo: null, baseConfigVersionId: null, schemaHash: null, evidenceHash: '',
    coverage: { sourceActiveCount: 0, includedCount: 0, excludedCount: 0 }, fields: [], excludedFields: [], issues: ['正在同步筛选配置'],
  }
}

export function useLinkedSearch(gameCode: string, enabled = true) {
  const [state, setState] = useState(() => enabled ? getLinkedState() : null)
  useEffect(() => {
    if (!enabled) { setState(null); return }
    const sync = () => setState(getLinkedState())
    const unsubscribe = subscribeLinkedState(sync)
    void waitForLinkedState().then(setState).catch(sync)
    return unsubscribe
  }, [enabled])
  const currentProjection = useMemo(() => state ? getLinkedSearchProjection(state, gameCode) : missingProjection(gameCode), [gameCode, state])
  const [baseline, setBaseline] = useState<LinkedSearchBaseline>(() => createLinkedSearchBaseline(state?.sessionId ?? '', currentProjection))
  const [values, setValues] = useState<LinkedSearchValues>({})

  useEffect(() => {
    const next = applyLinkedSearchProjection(state?.sessionId ?? '', currentProjection)
    setValues(next.values)
    setBaseline(next.baseline)
    // A game switch intentionally drops only game-specific dynamic values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameCode])

  useEffect(() => {
    if (!state || countLinkedSearchValues(values) > 0) return
    setBaseline(createLinkedSearchBaseline(state.sessionId, currentProjection))
  }, [currentProjection, state, values])

  const projection = baseline.projection
  const built = useMemo(() => buildLinkedSearchRequest(projection, values), [projection, values])
  const requestIssues = useMemo(() => built.request ? searchRequestIssues(currentProjection, built.request) : [], [built.request, currentProjection])
  const conflict = state ? getLinkedSearchConflict(state.sessionId, currentProjection, baseline, values) : ''
  const chips = Object.entries(values).flatMap(([fieldId, value]) => {
    const described = describeLinkedSearchValue(projection, fieldId, value)
    return described ? [{ fieldId, ...described }] : []
  })

  return {
    state,
    projection,
    currentProjection,
    values,
    setValues,
    // Keep the pinned request during a version conflict. The shared matcher will
    // fail it closed against the latest projection, so stale conditions can never
    // silently turn into an unfiltered catalog before the user explicitly rebases.
    request: built.issues.length ? null : built.request,
    queryBlocked: Object.keys(values).length > 0 && built.issues.length > 0,
    issues: [...built.issues, ...requestIssues],
    conflict,
    chips,
    removeValue: (fieldId: string) => setValues((current) => removeLinkedSearchValue(current, fieldId)),
    applyLatest: () => {
      const next = applyLinkedSearchProjection(state?.sessionId ?? '', currentProjection)
      setValues(next.values)
      setBaseline(next.baseline)
    },
  }
}
