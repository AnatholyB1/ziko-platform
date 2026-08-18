'use client'

// Phase 5 plan 05-03 (T-05-07) — the counter widget's whole discipline is what it
// refuses to compute. Both booleans (`shouldDisplay`, `isFull`) and the `remaining`
// number arrive already decided by get_waitlist_founder_status() via
// /api/waitlist/count; this component never compares, offsets, or infers a verdict
// of its own (FOND-06). One fetch per mount, nothing that fetches again (FOND-04).
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { IoCheckmarkDoneOutline } from 'react-icons/io5'
import { fadeIn } from '@/lib/motion'

type CounterResponse = {
  shouldDisplay: boolean
  remaining: number | null
  isFull: boolean
}

type Props = {
  staticOfferSentence: string
  remainingTemplate: string
  completeHeading: string
  completeBody: string
}

const BADGE_BASE = 'inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full border'
const LIVE_BADGE_CLASSES = `${BADGE_BASE} bg-primary/10 text-primary border-primary/20`
const COMPLETE_BADGE_CLASSES = `${BADGE_BASE} bg-surface-alt text-muted border-border`

function isValidResponse(body: unknown): body is CounterResponse {
  if (typeof body !== 'object' || body === null) return false
  const candidate = body as Record<string, unknown>
  return (
    typeof candidate.shouldDisplay === 'boolean' &&
    typeof candidate.isFull === 'boolean' &&
    (candidate.remaining === null || typeof candidate.remaining === 'number')
  )
}

export function WaitlistCounterClient({
  staticOfferSentence,
  remainingTemplate,
  completeHeading,
  completeBody,
}: Props) {
  const [status, setStatus] = useState<CounterResponse | null>(null)

  useEffect(() => {
    let cancelled = false

    // Plain fetch, no init options — the response's own Cache-Control header
    // governs caching (a `next: { revalidate }` fetch option is a server-side
    // extension, silently ignored in the browser). One call, no interval, no
    // focus/visibility listener, no retry — FOND-04 is true by construction.
    fetch('/api/waitlist/count')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('non-ok'))))
      .then((body: unknown) => {
        if (cancelled) return
        if (isValidResponse(body)) {
          setStatus(body)
        } else {
          setStatus({ shouldDisplay: false, remaining: null, isFull: false })
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ shouldDisplay: false, remaining: null, isFull: false })
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (status === null) {
    return (
      <motion.span
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className={`${LIVE_BADGE_CLASSES} animate-pulse`}
        aria-hidden="true"
      >
        <span className="inline-block w-24 h-4 rounded bg-primary/30" />
      </motion.span>
    )
  }

  // The full verdict wins even when the display verdict is also true — D-10's
  // distinct completion state is checked before the live count, never a same-shape
  // badge holding the digit zero.
  if (status.isFull) {
    return (
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="flex flex-col items-center gap-4">
        <span className={COMPLETE_BADGE_CLASSES}>
          <IoCheckmarkDoneOutline className="text-muted" aria-hidden="true" />
          {completeHeading}
        </span>
        <div className="bg-white border border-border rounded-xl p-4 max-w-md text-center">
          <p className="text-base text-text">{completeBody}</p>
        </div>
      </motion.div>
    )
  }

  if (status.shouldDisplay && typeof status.remaining === 'number') {
    const text = remainingTemplate.replace('{remaining}', String(status.remaining))
    return (
      <motion.span variants={fadeIn} initial="hidden" animate="visible" className={LIVE_BADGE_CLASSES}>
        {text}
      </motion.span>
    )
  }

  return (
    <motion.span variants={fadeIn} initial="hidden" animate="visible" className={LIVE_BADGE_CLASSES}>
      {staticOfferSentence}
    </motion.span>
  )
}
