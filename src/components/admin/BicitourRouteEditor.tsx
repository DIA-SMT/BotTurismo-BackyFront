'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Plus, Sparkles, Trash2, X } from 'lucide-react'
import {
  bicitourQuestionCategoryLabels,
  type BicitourQuestion,
  type BicitourQuestionCategory,
  type BicitourQuestionProposal,
  type BicitourRoute,
  type BicitourStop,
} from '@/lib/bicitour'

const BicitourMap = dynamic(() => import('@/components/bicitour/BicitourMap'), { ssr: false })

// Editor de un recorrido: metadatos, traza en el mapa, paradas ordenables con
// su contenido histórico y las preguntas de cada una. El contenido histórico
// real lo carga el equipo de turismo: el editor no inventa nada.

type MapMode = 'stop' | 'path'

interface StopDraft {
  title: string
  description: string
  funFacts: string
  imageUrls: string
  audioUrl: string
  hint: string
  hintEnabled: boolean
  radiusM: string
}

const emptyQuestionForm = {
  type: 'multiple_choice' as 'multiple_choice' | 'true_false',
  prompt: '',
  options: ['', '', ''],
  correctKey: 'a',
  explanation: '',
  points: '100',
  category: 'historica' as BicitourQuestionCategory,
}

interface AiForm {
  count: string
  difficulty: 'facil' | 'intermedia' | 'dificil'
  type: 'multiple_choice' | 'true_false' | 'mixta'
  category: BicitourQuestionCategory
}

const defaultAiForm: AiForm = { count: '3', difficulty: 'intermedia', type: 'mixta', category: 'historica' }

interface ProposalDraft {
  prompt: string
  explanation: string
  optionLabels: string[]
  correctKey: string
}

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f']

export default function BicitourRouteEditor({ routeId }: { routeId: number }) {
  const [route, setRoute] = useState<BicitourRoute | null>(null)
  const [stops, setStops] = useState<BicitourStop[]>([])
  const [questions, setQuestions] = useState<BicitourQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mapMode, setMapMode] = useState<MapMode>('stop')
  const [pathDraft, setPathDraft] = useState<[number, number][]>([])
  const [expandedStopId, setExpandedStopId] = useState<number | null>(null)
  const [stopDrafts, setStopDrafts] = useState<Record<number, StopDraft>>({})
  const [questionForms, setQuestionForms] = useState<Record<number, typeof emptyQuestionForm>>({})
  const [proposals, setProposals] = useState<BicitourQuestionProposal[]>([])
  const [aiConfigured, setAiConfigured] = useState(true)
  const [aiForms, setAiForms] = useState<Record<number, AiForm>>({})
  const [generatingAi, setGeneratingAi] = useState<number | null>(null)
  const [proposalDrafts, setProposalDrafts] = useState<Record<number, ProposalDraft>>({})
  const [suggestingHint, setSuggestingHint] = useState<number | null>(null)
  // Alta de parada desde el mapa: el punto clickeado queda marcado (ámbar) y
  // se completa el nombre en una tarjeta flotante, sin prompt() del navegador.
  const [pendingStop, setPendingStop] = useState<{ lat: number; lng: number } | null>(null)
  const [pendingStopName, setPendingStopName] = useState('')
  const [creatingStop, setCreatingStop] = useState(false)

  const fetchDetail = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/bicitour/routes/${routeId}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo cargar el recorrido.')
      setRoute(payload.data.route)
      setStops(payload.data.stops)
      setQuestions(payload.data.questions)
      setProposals(payload.data.proposals || [])
      setAiConfigured(payload.data.aiConfigured !== false)
      setPathDraft(payload.data.route.path || [])
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo cargar el recorrido.')
    } finally {
      setLoading(false)
    }
  }, [routeId])

  useEffect(() => {
    fetchDetail()
  }, [fetchDetail])

  const patchRoute = async (payload: Record<string, unknown>, message = 'Guardado.') => {
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/bicitour/routes/${routeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo guardar.')
      setRoute(result.data)
      setFeedback(message)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar.')
    } finally {
      setBusy(false)
    }
  }

  const handleMapClick = (lat: number, lng: number) => {
    if (mapMode === 'path') {
      setPathDraft((current) => [...current, [lat, lng]])
      return
    }
    // El punto queda marcado en el mapa y se pide el nombre en la tarjeta.
    setPendingStop({ lat, lng })
    setPendingStopName('')
  }

  const createPendingStop = async () => {
    if (!pendingStop || pendingStopName.trim().length < 2) return
    setCreatingStop(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/admin/bicitour/stops', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId, title: pendingStopName.trim(), lat: pendingStop.lat, lng: pendingStop.lng }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo crear la parada.')
      setPendingStop(null)
      setPendingStopName('')
      await fetchDetail()
      setExpandedStopId(payload.data.id)
      setFeedback(`Parada "${payload.data.title}" creada y marcada en el mapa.`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear la parada.')
    } finally {
      setCreatingStop(false)
    }
  }

  const draftFor = (stop: BicitourStop): StopDraft =>
    stopDrafts[stop.id] || {
      title: stop.title,
      description: stop.description || '',
      funFacts: (stop.fun_facts || []).join('\n'),
      imageUrls: (stop.image_urls || []).join('\n'),
      audioUrl: stop.audio_url || '',
      hint: stop.hint || '',
      hintEnabled: stop.hint_enabled !== false,
      radiusM: String(stop.radius_m),
    }

  const saveStop = async (stop: BicitourStop) => {
    const draft = draftFor(stop)
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/bicitour/stops/${stop.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          funFacts: draft.funFacts.split('\n').map((line) => line.trim()).filter(Boolean),
          imageUrls: draft.imageUrls.split('\n').map((line) => line.trim()).filter(Boolean),
          audioUrl: draft.audioUrl,
          hint: draft.hint,
          hintEnabled: draft.hintEnabled,
          radiusM: Number(draft.radiusM) || 60,
          isDraft: false,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo guardar la parada.')
      setFeedback('Parada guardada.')
      await fetchDetail()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar la parada.')
    } finally {
      setBusy(false)
    }
  }

  const moveStop = async (stop: BicitourStop, direction: -1 | 1) => {
    const ordered = [...stops].sort((a, b) => a.position - b.position)
    const index = ordered.findIndex((item) => item.id === stop.id)
    const other = ordered[index + direction]
    if (!other) return
    setBusy(true)
    try {
      await Promise.all([
        fetch(`/api/admin/bicitour/stops/${stop.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: other.position }),
        }),
        fetch(`/api/admin/bicitour/stops/${other.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: stop.position }),
        }),
      ])
      await fetchDetail()
    } finally {
      setBusy(false)
    }
  }

  const deleteStop = async (stop: BicitourStop) => {
    if (!window.confirm(`¿Eliminar la parada "${stop.title}" y sus preguntas?`)) return
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/bicitour/stops/${stop.id}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo eliminar.')
      await fetchDetail()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo eliminar.')
    } finally {
      setBusy(false)
    }
  }

  const addQuestion = async (stop: BicitourStop) => {
    const form = questionForms[stop.id] || emptyQuestionForm
    setBusy(true)
    setFeedback(null)
    try {
      const options =
        form.type === 'true_false'
          ? undefined
          : form.options
              .map((label, index) => ({ key: OPTION_KEYS[index], label: label.trim() }))
              .filter((option) => option.label)
      const response = await fetch('/api/admin/bicitour/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stopId: stop.id,
          type: form.type,
          prompt: form.prompt,
          options,
          correctKey: form.correctKey,
          explanation: form.explanation,
          points: Number(form.points) || 100,
          category: form.category,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo crear la pregunta.')
      setQuestionForms((current) => ({ ...current, [stop.id]: { ...emptyQuestionForm, options: ['', '', ''] } }))
      setFeedback('Pregunta agregada.')
      await fetchDetail()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo crear la pregunta.')
    } finally {
      setBusy(false)
    }
  }

  // ── Asistente de contenido con IA ──

  const generateProposals = async (stop: BicitourStop, overrideForm?: AiForm) => {
    const form = overrideForm || aiForms[stop.id] || defaultAiForm
    setGeneratingAi(stop.id)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/bicitour/stops/${stop.id}/ai-proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: Number(form.count) || 3,
          difficulty: form.difficulty,
          type: form.type,
          category: form.category,
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudieron generar propuestas.')
      setFeedback(`El asistente generó ${payload.data.length} propuesta${payload.data.length === 1 ? '' : 's'}. Revisalas y aprobá las que sirvan.`)
      await fetchDetail()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudieron generar propuestas.')
    } finally {
      setGeneratingAi(null)
    }
  }

  const proposalDraftFor = (proposal: BicitourQuestionProposal): ProposalDraft =>
    proposalDrafts[proposal.id] || {
      prompt: proposal.prompt,
      explanation: proposal.explanation || '',
      optionLabels: proposal.options.map((option) => option.label),
      correctKey: proposal.correct_key,
    }

  const decideProposal = async (proposal: BicitourQuestionProposal, action: 'approve' | 'reject') => {
    setBusy(true)
    setFeedback(null)
    try {
      const draft = proposalDraftFor(proposal)
      const body =
        action === 'approve'
          ? {
              action,
              prompt: draft.prompt,
              explanation: draft.explanation,
              correctKey: draft.correctKey,
              options:
                proposal.type === 'true_false'
                  ? undefined
                  : proposal.options.map((option, index) => ({ key: option.key, label: draft.optionLabels[index] || option.label })),
            }
          : { action }
      const response = await fetch(`/api/admin/bicitour/proposals/${proposal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo decidir la propuesta.')
      setFeedback(action === 'approve' ? 'Pregunta aprobada y publicada en la parada.' : 'Propuesta descartada.')
      await fetchDetail()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo decidir la propuesta.')
    } finally {
      setBusy(false)
    }
  }

  const discardAllProposals = async (stopProposals: BicitourQuestionProposal[]) => {
    if (!window.confirm(`¿Descartar las ${stopProposals.length} propuestas pendientes de esta parada?`)) return
    setBusy(true)
    try {
      for (const proposal of stopProposals) {
        await fetch(`/api/admin/bicitour/proposals/${proposal.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reject' }),
        })
      }
      await fetchDetail()
    } finally {
      setBusy(false)
    }
  }

  const suggestHint = async (stop: BicitourStop) => {
    setSuggestingHint(stop.id)
    setFeedback(null)
    try {
      const response = await fetch(`/api/admin/bicitour/stops/${stop.id}/ai-hint`, { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo sugerir una pista.')
      const draft = draftFor(stop)
      setStopDrafts((current) => ({ ...current, [stop.id]: { ...draft, hint: payload.data.hint } }))
      setFeedback('Pista sugerida: revisala, editala si hace falta y guardá la parada para aprobarla.')
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo sugerir una pista.')
    } finally {
      setSuggestingHint(null)
    }
  }

  const deleteQuestion = async (question: BicitourQuestion) => {
    if (!window.confirm('¿Eliminar esta pregunta?')) return
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/bicitour/questions/${question.id}`, { method: 'DELETE' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'No se pudo eliminar.')
      await fetchDetail()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo eliminar.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="table-container" style={{ padding: 18 }}>
        <div className="loading-state">
          <div className="spinner" /> Cargando recorrido…
        </div>
      </div>
    )
  }

  if (!route) {
    return (
      <div className="table-container" style={{ padding: 18 }}>
        <p className="td-muted">{feedback || 'Recorrido no encontrado.'}</p>
        <Link className="btn btn-secondary" href="/admin/bicitour" style={{ display: 'inline-flex', marginTop: 10 }}>
          ← Volver
        </Link>
      </div>
    )
  }

  const orderedStops = [...stops].sort((a, b) => a.position - b.position)

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="flex items-center gap-2" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Link className="btn btn-secondary" href="/admin/bicitour">
          ← Recorridos
        </Link>
        <div className="flex items-center gap-2">
          <select
            className="select"
            value={route.status}
            onChange={(event) => patchRoute({ status: event.target.value }, 'Estado actualizado.')}
            disabled={busy}
          >
            <option value="draft">Borrador</option>
            <option value="published">Publicado</option>
            <option value="archived">Archivado</option>
          </select>
          <select
            className="select"
            value={route.mode}
            onChange={(event) => patchRoute({ mode: event.target.value }, 'Modalidad actualizada.')}
            disabled={busy}
          >
            <option value="individual">Individual</option>
            <option value="teams">Por equipos</option>
            <option value="mixed">Mixta (equipo opcional)</option>
          </select>
        </div>
      </div>

      {feedback ? (
        <div className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--info)' }}>
          {feedback}
        </div>
      ) : null}

      <div className="table-container" style={{ padding: 14, display: 'grid', gap: 10 }}>
        <input
          className="input"
          defaultValue={route.title}
          maxLength={120}
          onBlur={(event) => event.target.value !== route.title && patchRoute({ title: event.target.value }, 'Título guardado.')}
        />
        <textarea
          className="input"
          style={{ minHeight: 70, padding: 10 }}
          placeholder="Descripción del recorrido (visible para el equipo)"
          defaultValue={route.description || ''}
          onBlur={(event) => (event.target.value || '') !== (route.description || '') && patchRoute({ description: event.target.value }, 'Descripción guardada.')}
        />
      </div>

      <div className="table-container" style={{ padding: 14 }}>
        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
          <strong style={{ fontSize: 14 }}>Mapa</strong>
          <button className={mapMode === 'stop' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ height: 34, padding: '0 12px', fontSize: 13 }} onClick={() => setMapMode('stop')}>
            📍 Clic = nueva parada
          </button>
          <button className={mapMode === 'path' ? 'btn btn-primary' : 'btn btn-secondary'} style={{ height: 34, padding: '0 12px', fontSize: 13 }} onClick={() => setMapMode('path')}>
            ✏️ Clic = dibujar traza
          </button>
          {mapMode === 'path' ? (
            <>
              <button className="btn btn-secondary" style={{ height: 34, padding: '0 12px', fontSize: 13 }} onClick={() => setPathDraft((current) => current.slice(0, -1))}>
                Deshacer punto
              </button>
              <button className="btn btn-secondary" style={{ height: 34, padding: '0 12px', fontSize: 13 }} onClick={() => setPathDraft([])}>
                Borrar traza
              </button>
              <button className="btn btn-primary" style={{ height: 34, padding: '0 12px', fontSize: 13 }} onClick={() => patchRoute({ path: pathDraft }, 'Traza guardada.')} disabled={busy}>
                Guardar traza ({pathDraft.length} puntos)
              </button>
            </>
          ) : null}
        </div>
        <div style={{ position: 'relative' }}>
          <BicitourMap
            stops={orderedStops.map((stop) => ({
              id: stop.id,
              position: stop.position,
              title: stop.title,
              status: stop.is_draft ? 'skipped' : 'locked',
              lat: stop.lat,
              lng: stop.lng,
            }))}
            path={pathDraft}
            draftMarker={pendingStop ? [pendingStop.lat, pendingStop.lng] : null}
            onMapClick={handleMapClick}
            height={360}
          />
          {pendingStop ? (
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1100,
                width: 'min(340px, calc(100% - 24px))',
                background: '#fff',
                border: '2px solid #f59e0b',
                borderRadius: 12,
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)',
                padding: 12,
                display: 'grid',
                gap: 8,
              }}
            >
              <strong style={{ fontSize: 13 }}>📍 Nueva parada en este punto</strong>
              <input
                className="input"
                autoFocus
                placeholder="Nombre o número de la parada"
                maxLength={140}
                value={pendingStopName}
                onChange={(event) => setPendingStopName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') createPendingStop()
                  if (event.key === 'Escape') setPendingStop(null)
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, height: 38 }}
                  onClick={createPendingStop}
                  disabled={creatingStop || pendingStopName.trim().length < 2}
                >
                  {creatingStop ? 'Creando…' : 'Crear parada'}
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ height: 38 }}
                  onClick={() => setPendingStop(null)}
                  disabled={creatingStop}
                >
                  Cancelar
                </button>
              </div>
              <span className="td-muted" style={{ fontSize: 11 }}>
                Podés volver a hacer clic en el mapa para reubicar el punto.
              </span>
            </div>
          ) : null}
        </div>
        <p className="td-muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
          Las paradas grises claras son borradores creados en vivo por un guía: revisá su contenido y guardalas para publicarlas.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {orderedStops.map((stop, index) => {
          const stopQuestions = questions.filter((question) => question.stop_id === stop.id)
          const stopProposals = proposals.filter((proposal) => proposal.stop_id === stop.id)
          const expanded = expandedStopId === stop.id
          const draft = draftFor(stop)
          const form = questionForms[stop.id] || emptyQuestionForm
          const aiForm = aiForms[stop.id] || defaultAiForm
          return (
            <div key={stop.id} className="table-container" style={{ padding: 14 }}>
              <div className="flex items-center gap-2" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <strong>
                  {stop.position}. {stop.title}
                  {stop.is_draft ? (
                    <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#b45309', marginLeft: 8 }}>
                      Borrador (creada en vivo)
                    </span>
                  ) : null}
                  <span className="td-muted" style={{ fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                    {stopQuestions.length} pregunta{stopQuestions.length === 1 ? '' : 's'}
                  </span>
                </strong>
                <div className="flex items-center gap-2">
                  <button className="btn btn-secondary" style={{ height: 32, padding: '0 8px' }} onClick={() => moveStop(stop, -1)} disabled={busy || index === 0}>
                    <ArrowUp size={13} />
                  </button>
                  <button className="btn btn-secondary" style={{ height: 32, padding: '0 8px' }} onClick={() => moveStop(stop, 1)} disabled={busy || index === orderedStops.length - 1}>
                    <ArrowDown size={13} />
                  </button>
                  <button className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 13 }} onClick={() => setExpandedStopId(expanded ? null : stop.id)}>
                    {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Editar
                  </button>
                  <button className="btn btn-secondary" style={{ height: 32, padding: '0 8px', color: '#ef4444' }} onClick={() => deleteStop(stop)} disabled={busy}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {expanded ? (
                <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                  <input
                    className="input"
                    value={draft.title}
                    maxLength={140}
                    onChange={(event) => setStopDrafts((current) => ({ ...current, [stop.id]: { ...draft, title: event.target.value } }))}
                  />
                  <textarea
                    className="input"
                    style={{ minHeight: 90, padding: 10 }}
                    placeholder="Explicación histórica (la ven los participantes cuando el guía abre la parada)"
                    value={draft.description}
                    onChange={(event) => setStopDrafts((current) => ({ ...current, [stop.id]: { ...draft, description: event.target.value } }))}
                  />
                  <textarea
                    className="input"
                    style={{ minHeight: 60, padding: 10 }}
                    placeholder={'Datos curiosos (uno por línea)'}
                    value={draft.funFacts}
                    onChange={(event) => setStopDrafts((current) => ({ ...current, [stop.id]: { ...draft, funFacts: event.target.value } }))}
                  />
                  <textarea
                    className="input"
                    style={{ minHeight: 60, padding: 10 }}
                    placeholder={'URLs de imágenes (una por línea)'}
                    value={draft.imageUrls}
                    onChange={(event) => setStopDrafts((current) => ({ ...current, [stop.id]: { ...draft, imageUrls: event.target.value } }))}
                  />
                  <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                    <input
                      className="input"
                      style={{ flex: '1 1 240px' }}
                      placeholder="URL de audio opcional"
                      value={draft.audioUrl}
                      onChange={(event) => setStopDrafts((current) => ({ ...current, [stop.id]: { ...draft, audioUrl: event.target.value } }))}
                    />
                    <label className="td-muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      Radio aviso (m)
                      <input
                        className="input"
                        type="number"
                        min={10}
                        max={1000}
                        style={{ width: 90 }}
                        value={draft.radiusM}
                        onChange={(event) => setStopDrafts((current) => ({ ...current, [stop.id]: { ...draft, radiusM: event.target.value } }))}
                      />
                    </label>
                  </div>

                  {/* ── Pista para descubrir esta parada ── */}
                  <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
                    <div className="flex items-center gap-2" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 13 }}>🧭 Pista para descubrir esta parada</strong>
                      <div className="flex items-center gap-2">
                        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                          <input
                            type="checkbox"
                            checked={draft.hintEnabled}
                            onChange={(event) =>
                              setStopDrafts((current) => ({ ...current, [stop.id]: { ...draft, hintEnabled: event.target.checked } }))
                            }
                          />
                          Pista activa
                        </label>
                        <button
                          className="btn btn-secondary"
                          style={{ height: 32, padding: '0 10px', fontSize: 12 }}
                          onClick={() => suggestHint(stop)}
                          disabled={suggestingHint === stop.id || !aiConfigured}
                          title={aiConfigured ? 'La sugerencia requiere tu aprobación: se guarda recién cuando guardás la parada' : 'IA no configurada'}
                        >
                          <Sparkles size={12} /> {suggestingHint === stop.id ? 'Sugiriendo…' : 'Sugerir con IA'}
                        </button>
                      </div>
                    </div>
                    <input
                      className="input"
                      placeholder="Ej: En el próximo destino, una declaración cambió para siempre la historia del país."
                      maxLength={200}
                      value={draft.hint}
                      onChange={(event) => setStopDrafts((current) => ({ ...current, [stop.id]: { ...draft, hint: event.target.value } }))}
                    />
                    <p className="td-muted" style={{ margin: 0, fontSize: 12 }}>
                      La pista anticipa el lugar sin nombrarlo y pertenece a esta parada: se muestra en modo pedaleo mientras el
                      grupo viene en camino, aunque cambies el orden del recorrido.
                    </p>
                    {draft.hintEnabled && draft.hint.trim() ? (
                      <div style={{ background: '#fff8e8', border: '1px solid #f0dfae', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#7a5b12' }}>
                        <strong>Vista previa (participante):</strong> 🧭 Próximo destino — {draft.hint.trim()}
                      </div>
                    ) : (
                      <p className="td-muted" style={{ margin: 0, fontSize: 12, fontStyle: 'italic' }}>
                        {draft.hintEnabled ? 'Sin pista cargada: el participante verá solo el progreso normal.' : 'Pista desactivada: el participante verá solo el progreso normal.'}
                      </p>
                    )}
                  </div>

                  <button className="btn btn-primary" style={{ justifySelf: 'start' }} onClick={() => saveStop(stop)} disabled={busy}>
                    Guardar parada
                  </button>

                  <div style={{ borderTop: '1px solid rgba(148,163,184,0.25)', paddingTop: 12 }}>
                    <strong style={{ fontSize: 14 }}>Preguntas</strong>
                    {stopQuestions.map((question) => (
                      <div key={question.id} className="flex items-center gap-2" style={{ marginTop: 8, flexWrap: 'wrap', background: 'rgba(148,163,184,0.08)', borderRadius: 8, padding: '8px 10px' }}>
                        <span style={{ flex: '1 1 auto', minWidth: 200 }}>
                          {question.origin === 'ai' ? (
                            <span className="badge" style={{ background: 'rgba(139,92,246,0.15)', color: '#7c3aed', marginRight: 6, fontSize: 11 }}>
                              🤖 IA
                            </span>
                          ) : null}
                          {question.category && question.category !== 'historica' ? (
                            <span className="badge" style={{ background: 'rgba(18,111,245,0.1)', color: '#126ff5', marginRight: 6, fontSize: 11 }}>
                              {bicitourQuestionCategoryLabels[question.category] || question.category}
                            </span>
                          ) : null}
                          {question.type === 'true_false' ? 'V/F' : 'Opciones'} · {question.prompt}
                          <span className="td-muted" style={{ marginLeft: 6, fontSize: 12 }}>
                            (correcta: {question.options.find((option) => option.key === question.correct_key)?.label || question.correct_key} · {question.points} pts)
                          </span>
                        </span>
                        <button className="btn btn-secondary" style={{ height: 30, padding: '0 8px', color: '#ef4444' }} onClick={() => deleteQuestion(question)} disabled={busy}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}

                    <div style={{ display: 'grid', gap: 8, marginTop: 12, background: 'rgba(18,111,245,0.05)', borderRadius: 10, padding: 12 }}>
                      <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                        <select
                          className="select"
                          value={form.type}
                          onChange={(event) =>
                            setQuestionForms((current) => ({
                              ...current,
                              [stop.id]: { ...form, type: event.target.value as 'multiple_choice' | 'true_false', correctKey: event.target.value === 'true_false' ? 'true' : 'a' },
                            }))
                          }
                        >
                          <option value="multiple_choice">Opción múltiple</option>
                          <option value="true_false">Verdadero / Falso</option>
                        </select>
                        <select
                          className="select"
                          title="Categoría"
                          value={form.category}
                          onChange={(event) =>
                            setQuestionForms((current) => ({
                              ...current,
                              [stop.id]: { ...form, category: event.target.value as BicitourQuestionCategory },
                            }))
                          }
                        >
                          {Object.entries(bicitourQuestionCategoryLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={1000}
                          style={{ width: 100 }}
                          title="Puntos"
                          value={form.points}
                          onChange={(event) => setQuestionForms((current) => ({ ...current, [stop.id]: { ...form, points: event.target.value } }))}
                        />
                      </div>
                      <input
                        className="input"
                        placeholder="Pregunta o desafío"
                        value={form.prompt}
                        maxLength={500}
                        onChange={(event) => setQuestionForms((current) => ({ ...current, [stop.id]: { ...form, prompt: event.target.value } }))}
                      />
                      {form.type === 'multiple_choice' ? (
                        <>
                          {form.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${stop.id}`}
                                checked={form.correctKey === OPTION_KEYS[optionIndex]}
                                onChange={() => setQuestionForms((current) => ({ ...current, [stop.id]: { ...form, correctKey: OPTION_KEYS[optionIndex] } }))}
                                title="Marcar como correcta"
                              />
                              <input
                                className="input"
                                style={{ flex: 1 }}
                                placeholder={`Opción ${OPTION_KEYS[optionIndex].toUpperCase()}`}
                                value={option}
                                maxLength={300}
                                onChange={(event) =>
                                  setQuestionForms((current) => ({
                                    ...current,
                                    [stop.id]: { ...form, options: form.options.map((item, i) => (i === optionIndex ? event.target.value : item)) },
                                  }))
                                }
                              />
                            </div>
                          ))}
                          {form.options.length < 6 ? (
                            <button className="btn btn-secondary" style={{ height: 32, justifySelf: 'start', padding: '0 10px', fontSize: 13 }} onClick={() => setQuestionForms((current) => ({ ...current, [stop.id]: { ...form, options: [...form.options, ''] } }))}>
                              <Plus size={12} /> Otra opción
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
                            <input type="radio" name={`correct-${stop.id}`} checked={form.correctKey === 'true'} onChange={() => setQuestionForms((current) => ({ ...current, [stop.id]: { ...form, correctKey: 'true' } }))} />
                            Verdadero es correcta
                          </label>
                          <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
                            <input type="radio" name={`correct-${stop.id}`} checked={form.correctKey === 'false'} onChange={() => setQuestionForms((current) => ({ ...current, [stop.id]: { ...form, correctKey: 'false' } }))} />
                            Falso es correcta
                          </label>
                        </div>
                      )}
                      <input
                        className="input"
                        placeholder="Explicación educativa (se muestra al revelar la respuesta)"
                        value={form.explanation}
                        maxLength={500}
                        onChange={(event) => setQuestionForms((current) => ({ ...current, [stop.id]: { ...form, explanation: event.target.value } }))}
                      />
                      <button className="btn btn-primary" style={{ justifySelf: 'start' }} onClick={() => addQuestion(stop)} disabled={busy || form.prompt.trim().length < 5}>
                        <Plus size={14} /> Agregar pregunta
                      </button>
                    </div>

                    {/* ── Asistente de preguntas con IA ── */}
                    <div style={{ display: 'grid', gap: 10, marginTop: 14, background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.25)', borderRadius: 10, padding: 12 }}>
                      <strong style={{ fontSize: 14 }}>
                        <Sparkles size={14} style={{ verticalAlign: -2 }} /> Asistente de preguntas con IA
                      </strong>
                      <p className="td-muted" style={{ margin: 0, fontSize: 12 }}>
                        Genera propuestas usando SOLO el contenido histórico cargado en esta parada. Nada se publica sin tu
                        aprobación: cada propuesta queda como borrador editable.
                      </p>
                      {!aiConfigured ? (
                        <div className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#b45309' }}>
                          IA no configurada: falta OPENROUTER_API_KEY en el servidor.
                        </div>
                      ) : (
                        <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                          <label className="td-muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            Cantidad
                            <input
                              className="input"
                              type="number"
                              min={1}
                              max={5}
                              style={{ width: 70 }}
                              value={aiForm.count}
                              onChange={(event) => setAiForms((current) => ({ ...current, [stop.id]: { ...aiForm, count: event.target.value } }))}
                            />
                          </label>
                          <select className="select" value={aiForm.difficulty} onChange={(event) => setAiForms((current) => ({ ...current, [stop.id]: { ...aiForm, difficulty: event.target.value as AiForm['difficulty'] } }))}>
                            <option value="facil">Fácil</option>
                            <option value="intermedia">Intermedia</option>
                            <option value="dificil">Difícil</option>
                          </select>
                          <select className="select" value={aiForm.type} onChange={(event) => setAiForms((current) => ({ ...current, [stop.id]: { ...aiForm, type: event.target.value as AiForm['type'] } }))}>
                            <option value="mixta">Combinación</option>
                            <option value="multiple_choice">Opción múltiple</option>
                            <option value="true_false">Verdadero/Falso</option>
                          </select>
                          <select className="select" value={aiForm.category} onChange={(event) => setAiForms((current) => ({ ...current, [stop.id]: { ...aiForm, category: event.target.value as BicitourQuestionCategory } }))}>
                            {Object.entries(bicitourQuestionCategoryLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                          <button className="btn btn-primary" style={{ height: 36, padding: '0 14px', fontSize: 13 }} onClick={() => generateProposals(stop)} disabled={generatingAi === stop.id || busy}>
                            <Sparkles size={13} /> {generatingAi === stop.id ? 'Generando…' : 'Generar propuestas'}
                          </button>
                        </div>
                      )}

                      {stopProposals.length > 0 ? (
                        <>
                          <div className="flex items-center gap-2" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: 13 }}>
                              {stopProposals.length} propuesta{stopProposals.length === 1 ? '' : 's'} pendiente{stopProposals.length === 1 ? '' : 's'} de revisión
                            </strong>
                            <button className="btn btn-secondary" style={{ height: 32, padding: '0 10px', fontSize: 12, color: '#ef4444' }} onClick={() => discardAllProposals(stopProposals)} disabled={busy}>
                              Descartar todas
                            </button>
                          </div>
                          {stopProposals.map((proposal) => {
                            const proposalDraft = proposalDraftFor(proposal)
                            const updateDraft = (patch: Partial<ProposalDraft>) =>
                              setProposalDrafts((current) => ({ ...current, [proposal.id]: { ...proposalDraft, ...patch } }))
                            return (
                              <div key={proposal.id} style={{ background: '#fff', border: '1px solid rgba(139,92,246,0.35)', borderRadius: 10, padding: 12, display: 'grid', gap: 8 }}>
                                <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
                                  <span className="badge" style={{ background: 'rgba(139,92,246,0.15)', color: '#7c3aed', fontSize: 11 }}>
                                    🤖 Borrador IA
                                  </span>
                                  <span className="badge" style={{ background: 'rgba(18,111,245,0.1)', color: '#126ff5', fontSize: 11 }}>
                                    {bicitourQuestionCategoryLabels[proposal.category] || proposal.category}
                                  </span>
                                  <span className="badge" style={{ background: 'rgba(148,163,184,0.15)', color: '#64748b', fontSize: 11 }}>
                                    {proposal.difficulty}
                                  </span>
                                  <span className="badge" style={{ background: 'rgba(148,163,184,0.15)', color: '#64748b', fontSize: 11 }}>
                                    {proposal.type === 'true_false' ? 'V/F' : 'Opción múltiple'}
                                  </span>
                                </div>
                                {proposal.warning ? (
                                  <div className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#b45309', whiteSpace: 'normal', textAlign: 'left' }}>
                                    ⚠️ {proposal.warning}
                                  </div>
                                ) : null}
                                <input className="input" value={proposalDraft.prompt} maxLength={500} onChange={(event) => updateDraft({ prompt: event.target.value })} />
                                {proposal.type === 'true_false' ? (
                                  <div className="flex items-center gap-2">
                                    {proposal.options.map((option) => (
                                      <label key={option.key} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <input type="radio" checked={proposalDraft.correctKey === option.key} onChange={() => updateDraft({ correctKey: option.key })} />
                                        {option.label} {proposalDraft.correctKey === option.key ? '(correcta)' : ''}
                                      </label>
                                    ))}
                                  </div>
                                ) : (
                                  proposal.options.map((option, optionIndex) => (
                                    <div key={option.key} className="flex items-center gap-2">
                                      <input type="radio" title="Marcar como correcta" checked={proposalDraft.correctKey === option.key} onChange={() => updateDraft({ correctKey: option.key })} />
                                      <input
                                        className="input"
                                        style={{ flex: 1 }}
                                        value={proposalDraft.optionLabels[optionIndex] ?? option.label}
                                        maxLength={300}
                                        onChange={(event) =>
                                          updateDraft({
                                            optionLabels: proposal.options.map((item, i) =>
                                              i === optionIndex ? event.target.value : proposalDraft.optionLabels[i] ?? item.label,
                                            ),
                                          })
                                        }
                                      />
                                    </div>
                                  ))
                                )}
                                <input className="input" placeholder="Explicación educativa" value={proposalDraft.explanation} maxLength={600} onChange={(event) => updateDraft({ explanation: event.target.value })} />
                                {proposal.source_excerpt ? (
                                  <p className="td-muted" style={{ margin: 0, fontSize: 12, borderLeft: '3px solid rgba(139,92,246,0.4)', paddingLeft: 8 }}>
                                    Respaldo: “{proposal.source_excerpt}”
                                  </p>
                                ) : null}
                                <div className="flex items-center gap-2">
                                  <button className="btn btn-primary" style={{ height: 36, padding: '0 14px', fontSize: 13, background: '#10b981' }} onClick={() => decideProposal(proposal, 'approve')} disabled={busy}>
                                    <Check size={13} /> Aprobar y publicar
                                  </button>
                                  <button className="btn btn-secondary" style={{ height: 36, padding: '0 14px', fontSize: 13, color: '#ef4444' }} onClick={() => decideProposal(proposal, 'reject')} disabled={busy}>
                                    <X size={13} /> Rechazar
                                  </button>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ height: 36, padding: '0 12px', fontSize: 13 }}
                                    title="Rechaza esta propuesta y genera una nueva con la misma configuración"
                                    onClick={async () => {
                                      await decideProposal(proposal, 'reject')
                                      await generateProposals(stop, {
                                        count: '1',
                                        difficulty: proposal.difficulty,
                                        type: proposal.type,
                                        category: proposal.category,
                                      })
                                    }}
                                    disabled={busy || generatingAi === stop.id}
                                  >
                                    <Sparkles size={13} /> Regenerar
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
        {orderedStops.length === 0 ? (
          <div className="table-container" style={{ padding: 16 }}>
            <p className="td-muted" style={{ margin: 0 }}>
              Hacé clic en el mapa (modo “nueva parada”) para crear la primera parada del recorrido.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
