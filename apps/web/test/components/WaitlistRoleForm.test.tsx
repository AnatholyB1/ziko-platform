// T-05-01 — pins WaitlistRoleForm's interaction contract: progressive disclosure (WAIT-02),
// single-field submission (WAIT-03), the D-08 coach pre-pick that never locks the picker,
// the LEGAL-06 consent gate rendering Phase 3's frozen copy verbatim, and the WAIT-05/06
// localized-success branching that never depends on whether a row was genuinely new.
//
// No @testing-library/jest-dom in this repo — assertions read plain DOM properties
// (`.disabled`, `.getAttribute(...)`, `.value`) rather than jest-dom matchers.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSearchParams } from 'next/navigation';
import { track } from '@vercel/analytics';
import { claimWaitlistSpot } from '@/actions/waitlist';
import { CONSENT_CHECKBOX_LABEL, COLLECTION_POINT_NOTICE } from '@/content/legal/founder-offer';
import { WaitlistRoleForm } from '@/components/marketing/WaitlistRoleForm';

vi.mock('next/navigation', () => ({
  useSearchParams: vi.fn(),
}));

vi.mock('@/actions/waitlist', () => ({
  claimWaitlistSpot: vi.fn(),
}));

// ENTRY-06 (T-05-12) — the tracking function is a spy so the conversion-event
// cases can assert exactly what is sent and exactly how many times.
vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

const mockedUseSearchParams = vi.mocked(useSearchParams);
const mockedClaimWaitlistSpot = vi.mocked(claimWaitlistSpot);
const mockedTrack = vi.mocked(track);

function setSearchParams(query = '') {
  mockedUseSearchParams.mockReturnValue(
    new URLSearchParams(query) as unknown as ReturnType<typeof useSearchParams>,
  );
}

const frProps = {
  locale: 'fr',
  pickerAthlete: 'Athlète',
  pickerCoach: 'Coach',
  emailLabel: 'Adresse e-mail',
  emailPlaceholder: 'votre@email.com',
  submitLabel: 'Réserver ma place',
  submitPendingLabel: 'Envoi…',
  successFounder: 'Vous êtes inscrit·e ! Vous êtes fondateur·rice n°{rank} sur 200.',
  successGeneric: 'Vous êtes inscrit·e ! Nous vous préviendrons dès le lancement.',
  errorGeneric: 'Une erreur est survenue. Merci de réessayer.',
  errorInvalidEmail: 'Cette adresse e-mail semble invalide ou temporaire. Merci d\'utiliser une adresse e-mail personnelle.',
  errorRateLimited: 'Trop de tentatives. Merci de réessayer dans quelques minutes.',
  consentLabel: CONSENT_CHECKBOX_LABEL.fr,
  collectionNotice: COLLECTION_POINT_NOTICE.fr,
};

const enProps = {
  ...frProps,
  locale: 'en',
  pickerAthlete: 'Athlete',
  pickerCoach: 'Coach',
  emailLabel: 'Email address',
  emailPlaceholder: 'you@email.com',
  submitLabel: 'Claim my spot',
  submitPendingLabel: 'Sending…',
  successFounder: "You're in! You're founder #{rank} of 200.",
  successGeneric: "You're in! We'll let you know as soon as we launch.",
  errorGeneric: 'Something went wrong. Please try again.',
  errorInvalidEmail: 'This email address looks invalid or temporary. Please use a personal email address.',
  errorRateLimited: 'Too many attempts. Please try again in a few minutes.',
  consentLabel: CONSENT_CHECKBOX_LABEL.en,
  collectionNotice: COLLECTION_POINT_NOTICE.en,
};

beforeEach(() => {
  vi.clearAllMocks();
  setSearchParams('');
  mockedClaimWaitlistSpot.mockResolvedValue({
    status: 'idle',
    isFounder: false,
    founderRank: null,
    message: '',
    code: null,
  });
});

describe('WaitlistRoleForm', () => {
  it('renders no email textbox before a role is picked (WAIT-02)', () => {
    render(<WaitlistRoleForm {...frProps} />);
    expect(screen.queryByLabelText(frProps.emailLabel)).toBeNull();
  });

  it('reveals exactly one email textbox after clicking the Athlète card (WAIT-02)', async () => {
    const user = userEvent.setup();
    render(<WaitlistRoleForm {...frProps} />);
    await user.click(screen.getByRole('button', { name: frProps.pickerAthlete }));
    expect(screen.getAllByLabelText(frProps.emailLabel)).toHaveLength(1);
  });

  it('exposes no second text/number/select input beyond the email field (WAIT-03)', async () => {
    const user = userEvent.setup();
    render(<WaitlistRoleForm {...frProps} />);
    await user.click(screen.getByRole('button', { name: frProps.pickerAthlete }));
    await screen.findByLabelText(frProps.emailLabel);

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });

  it('moves the selected state from Athlète to Coach and leaves exactly one email input (D-08 — picker never locks)', async () => {
    const user = userEvent.setup();
    render(<WaitlistRoleForm {...frProps} />);
    const athleteCard = screen.getByRole('button', { name: frProps.pickerAthlete });
    const coachCard = screen.getByRole('button', { name: frProps.pickerCoach });

    await user.click(athleteCard);
    expect(athleteCard.getAttribute('aria-pressed')).toBe('true');

    await user.click(coachCard);
    expect(coachCard.getAttribute('aria-pressed')).toBe('true');
    expect(athleteCard.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getAllByLabelText(frProps.emailLabel)).toHaveLength(1);
  });

  it('preselects the coach card and shows the email field when search params carry role=coach (D-08)', () => {
    setSearchParams('role=coach');
    render(<WaitlistRoleForm {...frProps} />);
    expect(screen.getByRole('button', { name: frProps.pickerCoach }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByLabelText(frProps.emailLabel)).not.toBeNull();
  });

  it('leaves the athlete card clickable after a coach pre-pick — the picker never locks (D-08)', async () => {
    setSearchParams('role=coach');
    const user = userEvent.setup();
    render(<WaitlistRoleForm {...frProps} />);
    const athleteCard = screen.getByRole('button', { name: frProps.pickerAthlete });
    await user.click(athleteCard);
    expect(athleteCard.getAttribute('aria-pressed')).toBe('true');
  });

  it('disables the submit control until consent is checked, then enables it with a role picked (LEGAL-06)', async () => {
    const user = userEvent.setup();
    render(<WaitlistRoleForm {...frProps} />);
    await user.click(screen.getByRole('button', { name: frProps.pickerAthlete }));

    const submitButton = screen.getByRole('button', { name: frProps.submitLabel }) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);

    await user.click(screen.getByRole('checkbox'));
    expect(submitButton.disabled).toBe(false);
  });

  it('renders the exact French CONSENT_CHECKBOX_LABEL and COLLECTION_POINT_NOTICE strings for locale="fr" (LEGAL-06/07)', async () => {
    const user = userEvent.setup();
    render(<WaitlistRoleForm {...frProps} />);
    await user.click(screen.getByRole('button', { name: frProps.pickerAthlete }));
    expect(screen.getByText(CONSENT_CHECKBOX_LABEL.fr)).not.toBeNull();
    expect(screen.getByText(COLLECTION_POINT_NOTICE.fr)).not.toBeNull();
  });

  it('renders the exact English CONSENT_CHECKBOX_LABEL and COLLECTION_POINT_NOTICE strings for locale="en" (LEGAL-06/07)', async () => {
    const user = userEvent.setup();
    render(<WaitlistRoleForm {...enProps} />);
    await user.click(screen.getByRole('button', { name: enProps.pickerAthlete }));
    expect(screen.getByText(CONSENT_CHECKBOX_LABEL.en)).not.toBeNull();
    expect(screen.getByText(COLLECTION_POINT_NOTICE.en)).not.toBeNull();
  });

  it('renders the localized founder sentence containing the rank when the action reports a genuine founder (WAIT-05)', async () => {
    mockedClaimWaitlistSpot.mockResolvedValueOnce({
      status: 'success',
      isFounder: true,
      founderRank: 7,
      message: 'Inscription confirmée.',
      code: null,
    });
    const user = userEvent.setup();
    render(<WaitlistRoleForm {...frProps} />);
    await user.click(screen.getByRole('button', { name: frProps.pickerAthlete }));
    await user.type(screen.getByLabelText(frProps.emailLabel), 'visitor@example.com');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: frProps.submitLabel }));

    const confirmation = await screen.findByText(/n°7/);
    expect(confirmation).not.toBeNull();
  });

  it('renders the localized generic sentence with no digit when the action reports no founder status (WAIT-06)', async () => {
    mockedClaimWaitlistSpot.mockResolvedValueOnce({
      status: 'success',
      isFounder: false,
      founderRank: null,
      message: 'Inscription confirmée.',
      code: null,
    });
    const user = userEvent.setup();
    render(<WaitlistRoleForm {...frProps} />);
    await user.click(screen.getByRole('button', { name: frProps.pickerAthlete }));
    await user.type(screen.getByLabelText(frProps.emailLabel), 'visitor@example.com');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: frProps.submitLabel }));

    const confirmation = await screen.findByText(frProps.successGeneric);
    expect(confirmation.textContent ?? '').not.toMatch(/\d/);
  });

  it('renders the byte-identical generic success sentence whether the row was genuinely new or a duplicate (WAIT-06)', async () => {
    mockedClaimWaitlistSpot.mockResolvedValueOnce({
      status: 'success',
      isFounder: false,
      founderRank: null,
      message: 'Inscription confirmée.',
      code: null,
    });
    const firstRun = userEvent.setup();
    const { unmount } = render(<WaitlistRoleForm {...frProps} />);
    await firstRun.click(screen.getByRole('button', { name: frProps.pickerAthlete }));
    await firstRun.type(screen.getByLabelText(frProps.emailLabel), 'new@example.com');
    await firstRun.click(screen.getByRole('checkbox'));
    await firstRun.click(screen.getByRole('button', { name: frProps.submitLabel }));
    const newSignupText = (await screen.findByText(frProps.successGeneric)).textContent;
    unmount();

    // Same isFounder:false/founderRank:null shape as a genuinely-new non-founder signup —
    // this is exactly what claimWaitlistSpot's D-03/D-04 filter collapses a duplicate to.
    mockedClaimWaitlistSpot.mockResolvedValueOnce({
      status: 'success',
      isFounder: false,
      founderRank: null,
      message: 'Inscription confirmée.',
      code: null,
    });
    const secondRun = userEvent.setup();
    render(<WaitlistRoleForm {...frProps} />);
    await secondRun.click(screen.getByRole('button', { name: frProps.pickerAthlete }));
    await secondRun.type(screen.getByLabelText(frProps.emailLabel), 'duplicate@example.com');
    await secondRun.click(screen.getByRole('checkbox'));
    await secondRun.click(screen.getByRole('button', { name: frProps.submitLabel }));
    const duplicateText = (await screen.findByText(frProps.successGeneric)).textContent;

    expect(duplicateText).toBe(newSignupText);
  });

  it("carries the picked role in the hidden audience input and the locale prop in the hidden locale input", async () => {
    const user = userEvent.setup();
    const { container } = render(<WaitlistRoleForm {...frProps} locale="fr" />);
    await user.click(screen.getByRole('button', { name: frProps.pickerCoach }));

    const audienceInput = container.querySelector('input[name="audience"]') as HTMLInputElement;
    const localeInput = container.querySelector('input[name="locale"]') as HTMLInputElement;
    expect(audienceInput.value).toBe('coach');
    expect(localeInput.value).toBe('fr');
  });

  describe('conversion event (T-05-12, ENTRY-06)', () => {
    it('calls the tracking spy exactly once when a submission resolves to a success state', async () => {
      mockedClaimWaitlistSpot.mockResolvedValueOnce({
        status: 'success',
        isFounder: false,
        founderRank: null,
        message: 'Inscription confirmée.',
        code: null,
      });
      const user = userEvent.setup();
      render(<WaitlistRoleForm {...frProps} />);
      await user.click(screen.getByRole('button', { name: frProps.pickerAthlete }));
      await user.type(screen.getByLabelText(frProps.emailLabel), 'visitor@example.com');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: frProps.submitLabel }));

      await screen.findByText(frProps.successGeneric);
      expect(mockedTrack).toHaveBeenCalledTimes(1);
    });

    it('uses a stable event-name literal and a payload whose key set is exactly one key, the chosen audience', async () => {
      mockedClaimWaitlistSpot.mockResolvedValueOnce({
        status: 'success',
        isFounder: false,
        founderRank: null,
        message: 'Inscription confirmée.',
        code: null,
      });
      const user = userEvent.setup();
      render(<WaitlistRoleForm {...frProps} />);
      await user.click(screen.getByRole('button', { name: frProps.pickerCoach }));
      await user.type(screen.getByLabelText(frProps.emailLabel), 'visitor@example.com');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: frProps.submitLabel }));

      await screen.findByText(frProps.successGeneric);
      const [eventName, payload] = mockedTrack.mock.calls[0];
      expect(eventName).toBe('waitlist_signup');
      // Key-set equality, not presence — a payload leaking the email address
      // beside the audience would still pass a `toHaveProperty` presence check.
      expect(Object.keys(payload ?? {}).sort()).toEqual(['audience']);
      expect(payload).toEqual({ audience: 'coach' });
    });

    it('does not re-fire the event on a re-render while already in the success state', async () => {
      mockedClaimWaitlistSpot.mockResolvedValueOnce({
        status: 'success',
        isFounder: false,
        founderRank: null,
        message: 'Inscription confirmée.',
        code: null,
      });
      const user = userEvent.setup();
      const { rerender } = render(<WaitlistRoleForm {...frProps} />);
      await user.click(screen.getByRole('button', { name: frProps.pickerAthlete }));
      await user.type(screen.getByLabelText(frProps.emailLabel), 'visitor@example.com');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: frProps.submitLabel }));
      await screen.findByText(frProps.successGeneric);

      expect(mockedTrack).toHaveBeenCalledTimes(1);
      rerender(<WaitlistRoleForm {...frProps} />);
      expect(mockedTrack).toHaveBeenCalledTimes(1);
    });

    it('never fires the event when a submission resolves to an error state', async () => {
      mockedClaimWaitlistSpot.mockResolvedValueOnce({
        status: 'error',
        isFounder: false,
        founderRank: null,
        message: '',
        code: 'server_error',
      });
      const user = userEvent.setup();
      render(<WaitlistRoleForm {...frProps} />);
      await user.click(screen.getByRole('button', { name: frProps.pickerAthlete }));
      await user.type(screen.getByLabelText(frProps.emailLabel), 'visitor@example.com');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: frProps.submitLabel }));

      await screen.findByText(frProps.errorGeneric);
      expect(mockedTrack).not.toHaveBeenCalled();
    });

    it('emits the same event and key set on the founder branch as on the generic branch — founder status never leaks', async () => {
      mockedClaimWaitlistSpot.mockResolvedValueOnce({
        status: 'success',
        isFounder: true,
        founderRank: 7,
        message: 'Inscription confirmée.',
        code: null,
      });
      const founderRun = userEvent.setup();
      const { unmount } = render(<WaitlistRoleForm {...frProps} />);
      await founderRun.click(screen.getByRole('button', { name: frProps.pickerAthlete }));
      await founderRun.type(screen.getByLabelText(frProps.emailLabel), 'founder@example.com');
      await founderRun.click(screen.getByRole('checkbox'));
      await founderRun.click(screen.getByRole('button', { name: frProps.submitLabel }));
      await screen.findByText(/n°7/);
      const founderPayload = mockedTrack.mock.calls[0][1];
      unmount();

      mockedClaimWaitlistSpot.mockResolvedValueOnce({
        status: 'success',
        isFounder: false,
        founderRank: null,
        message: 'Inscription confirmée.',
        code: null,
      });
      const genericRun = userEvent.setup();
      render(<WaitlistRoleForm {...frProps} />);
      await genericRun.click(screen.getByRole('button', { name: frProps.pickerAthlete }));
      await genericRun.type(screen.getByLabelText(frProps.emailLabel), 'generic@example.com');
      await genericRun.click(screen.getByRole('checkbox'));
      await genericRun.click(screen.getByRole('button', { name: frProps.submitLabel }));
      await screen.findByText(frProps.successGeneric);
      const genericPayload = mockedTrack.mock.calls[1][1];

      expect(Object.keys(founderPayload ?? {}).sort()).toEqual(['audience']);
      expect(Object.keys(genericPayload ?? {}).sort()).toEqual(['audience']);
      expect(founderPayload).toEqual(genericPayload);
      expect(mockedTrack.mock.calls[0][0]).toBe(mockedTrack.mock.calls[1][0]);
    });
  });
});
