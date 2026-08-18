'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { track } from '@vercel/analytics'
import { IoBarbellOutline, IoPeopleOutline, IoCheckmarkCircle } from 'react-icons/io5'
import { claimWaitlistSpot, type WaitlistState } from '@/actions/waitlist'
import { fadeUp, ctaHover, ctaTap } from '@/lib/motion'

// ENTRY-06 — the client half of conversion measurement. The event name is a stable
// literal and the payload carries exactly one property: the chosen audience. Never
// the email address, the founder rank, or any other value — the point-of-collection
// notice tells visitors their address is used to run the offer, not to feed an
// analytics endpoint, and the rank is the one fact the whole non-disclosure design
// (Phase 1 D-03/D-04) exists to protect.
const WAITLIST_SIGNUP_EVENT = 'waitlist_signup'

type Role = 'athlete' | 'coach'

// Phase 5 plan 05-04 (T-05-09, D-01) — the contract the `/coachs` redirect links
// must satisfy. Exported so those links (and their tests) read the parameter name
// and accepted value from here rather than a retyped literal — a mismatch here
// fails silently: the link works, the page loads, and the picker is unanswered.
export const WAITLIST_ROLE_PARAM = 'role'
export const WAITLIST_ROLE_ATHLETE: Role = 'athlete'
export const WAITLIST_ROLE_COACH: Role = 'coach'

type Props = {
  locale: string
  pickerAthlete: string
  pickerCoach: string
  emailLabel: string
  emailPlaceholder: string
  submitLabel: string
  submitPendingLabel: string
  successFounder: string
  successGeneric: string
  errorGeneric: string
  errorInvalidEmail: string
  errorRateLimited: string
  consentLabel: string
  collectionNotice: string
}

const initialState: WaitlistState = { status: 'idle', isFounder: false, founderRank: null, message: '', code: null }

// The invalid-form and server-error codes deliberately fall through to the generic
// sentence — this plan only renders a code-specific sentence for the two failure
// modes with a visitor-actionable fix (invalid_email, rate_limited).
function errorSentenceFor(code: WaitlistState['code'], props: Props): string {
  if (code === 'invalid_email') return props.errorInvalidEmail
  if (code === 'rate_limited') return props.errorRateLimited
  return props.errorGeneric
}

// D-08 / WAIT-05 — reading the ?role= hint here, inside the client subtree, is what lets
// the page stay statically prerendered (WAIT-08). The parent wraps this component in a
// <Suspense> boundary specifically because useSearchParams() requires one.
function usePreselectedRole(): Role | null {
  const searchParams = useSearchParams()
  const raw = searchParams.get(WAITLIST_ROLE_PARAM)
  return raw === WAITLIST_ROLE_ATHLETE || raw === WAITLIST_ROLE_COACH ? raw : null
}

// ENTRY-06 — campaign parameters on the landing URL, forwarded as hidden inputs so
// claimWaitlistSpot can pass them through to claim_waitlist_signup unchanged.
function useUtmParams(): { utmSource: string; utmCampaign: string } {
  const searchParams = useSearchParams()
  return {
    utmSource: searchParams.get('utm_source') ?? '',
    utmCampaign: searchParams.get('utm_campaign') ?? '',
  }
}

function cardClassName(selected: boolean) {
  const base = 'relative text-left rounded-2xl p-6 min-h-[44px]'
  return selected
    ? `${base} border-2 border-primary bg-primary/5`
    : `${base} bg-white border border-border`
}

export function WaitlistRoleForm(props: Props) {
  const preselected = usePreselectedRole()
  const { utmSource, utmCampaign } = useUtmParams()
  const [role, setRole] = useState<Role | null>(preselected)
  const [consent, setConsent] = useState(false)
  const [state, formAction, pending] = useActionState(claimWaitlistSpot, initialState)

  const canSubmit = role !== null && consent && !pending

  // Fires once per successful submission, on the transition into the success state —
  // guarded by a ref (in addition to the effect's own dependency array) so the
  // success panel's own re-renders never re-fire it, and a React 19 Strict Mode
  // double-invoke in development can't double-count a real signup either.
  const trackedRef = useRef(false)
  useEffect(() => {
    if (state.status === 'success' && role !== null && !trackedRef.current) {
      trackedRef.current = true
      track(WAITLIST_SIGNUP_EVENT, { audience: role })
    }
  }, [state.status, role])

  if (state.status === 'success') {
    const sentence = state.isFounder
      ? props.successFounder.replace('{rank}', String(state.founderRank))
      : props.successGeneric

    return (
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="rounded-lg bg-success-subtle border border-success/30 p-6"
      >
        <p className="text-success font-medium">{sentence}</p>
      </motion.div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          aria-pressed={role === 'athlete'}
          onClick={() => setRole('athlete')}
          className={cardClassName(role === 'athlete')}
        >
          <span className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <IoBarbellOutline size={24} className="text-primary" />
          </span>
          <span className="block text-lg font-bold text-text mt-3">{props.pickerAthlete}</span>
          {role === 'athlete' && (
            <IoCheckmarkCircle size={20} className="text-primary absolute top-3 right-3" />
          )}
        </button>

        <button
          type="button"
          aria-pressed={role === 'coach'}
          onClick={() => setRole('coach')}
          className={cardClassName(role === 'coach')}
        >
          <span className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <IoPeopleOutline size={24} className="text-primary" />
          </span>
          <span className="block text-lg font-bold text-text mt-3">{props.pickerCoach}</span>
          {role === 'coach' && (
            <IoCheckmarkCircle size={20} className="text-primary absolute top-3 right-3" />
          )}
        </button>
      </div>

      {role !== null && (
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mt-6">
          {/*
            Built and dispatched from the DOM form directly (rather than the plain
            `<form action={formAction}>` idiom `DeleteAccountForm.tsx` uses) so this
            component's tested behavior does not depend on the browser's native
            action-submission pathway — happy-dom's `SubmitEvent`/navigation handling
            for React 19 form actions is unreliable in this repo's test environment.
            `formAction` is the same `useActionState` dispatcher either way; only how
            its `FormData` argument is produced differs.
          */}
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              // useActionState's dispatcher must run inside a transition for `pending`
              // to update correctly — the native `<form action={formAction}>` pathway
              // does this implicitly; calling it from onSubmit does not.
              startTransition(() => {
                formAction(formData)
              })
            }}
            className="space-y-6"
          >
            <div>
              <label className="block text-sm font-medium text-text mb-1" htmlFor="email">
                {props.emailLabel}
              </label>
              <input
                id="email"
                type="email"
                name="email"
                required
                placeholder={props.emailPlaceholder}
                className="w-full rounded-lg border border-border px-4 py-3 text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <input type="hidden" name="audience" value={role} />
            <input type="hidden" name="locale" value={props.locale} />
            <input type="hidden" name="utm_source" value={utmSource} />
            <input type="hidden" name="utm_campaign" value={utmCampaign} />

            {/*
              Honeypot (T-05-D2/T-05-S2, T-05-A1) — off-screen rather than
              `display:none` so a screen reader would still (in principle) traverse
              it, but `aria-hidden` on the wrapper keeps assistive tech from ever
              announcing it, `tabIndex={-1}` keeps keyboard users from tabbing into
              it, and `autoComplete="off"` with no visible label gives a password
              manager nothing to match. A human never fills this in; a bot that
              fills every input on the page does.
            */}
            <div
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', top: 0, width: 1, height: 1, overflow: 'hidden' }}
            >
              <label htmlFor="website">Ne pas remplir</label>
              <input id="website" type="text" name="website" tabIndex={-1} autoComplete="off" />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-sm text-text">{props.consentLabel}</span>
            </label>

            <p className="max-w-lg text-sm text-muted">{props.collectionNotice}</p>

            {state.status === 'error' && (
              <p className="text-danger text-sm">{errorSentenceFor(state.code, props)}</p>
            )}

            <motion.div whileHover={ctaHover} whileTap={ctaTap} className="inline-block w-full">
              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full bg-primary text-white rounded-xl font-bold text-sm px-6 py-3 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 4px 20px rgba(255,92,26,0.30)' }}
              >
                {pending ? props.submitPendingLabel : props.submitLabel}
              </button>
            </motion.div>
          </form>
        </motion.div>
      )}
    </div>
  )
}
