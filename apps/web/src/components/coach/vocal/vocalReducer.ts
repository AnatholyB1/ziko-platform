// vocalReducer.ts — Pure state machine for the vocal feedback feature.
// No React import needed — this is a plain function.

export type CardSection = 'context' | 'strengths' | 'corrections' | 'next_steps';

export type TagKey = 'force' | 'technique' | 'mental' | 'cardio' | 'recuperation';

export interface StructuredCard {
  context: string;
  strengths: string;
  corrections: string;
  next_steps: string;
  tags: TagKey[];
}

export type VocalState =
  | { status: 'idle' }
  | { status: 'recording'; startedAt: number }
  | { status: 'transcribing'; blob: Blob; mimeType: string }
  | { status: 'review'; transcript: string }
  | { status: 'error'; blob: Blob; mimeType: string; message: string }
  | { status: 'structuring'; transcript: string }
  | { status: 'card-ready'; card: StructuredCard; editedCard: StructuredCard }
  | { status: 'card-editing'; card: StructuredCard; editedCard: StructuredCard; activeSection: CardSection }
  | { status: 'card-saving'; card: StructuredCard; editedCard: StructuredCard }
  | { status: 'card-saved' }
  | { status: 'structuring-error'; transcript: string; message: string };

export type VocalAction =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING'; blob: Blob; mimeType: string }
  | { type: 'TRANSCRIPTION_SUCCESS'; transcript: string }
  | { type: 'TRANSCRIPTION_ERROR'; message: string }
  | { type: 'RETRY' }
  | { type: 'RELAUNCH' }
  | { type: 'VALIDATE' }
  | { type: 'STRUCTURE_SUCCESS'; card: StructuredCard }
  | { type: 'STRUCTURE_ERROR'; message: string }
  | { type: 'SECTION_EDIT'; section: CardSection; value: string }
  | { type: 'TAG_TOGGLE'; tag: TagKey }
  | { type: 'START_SAVING' }
  | { type: 'SAVE_COMPLETE' }
  | { type: 'SAVE_ERROR' }
  | { type: 'RESET' }
  | { type: 'RETRY_STRUCTURE' };

export function vocalReducer(state: VocalState, action: VocalAction): VocalState {
  switch (action.type) {
    case 'START_RECORDING': {
      if (state.status !== 'idle') return state;
      return { status: 'recording', startedAt: Date.now() };
    }

    case 'STOP_RECORDING': {
      if (state.status !== 'recording') return state;
      return { status: 'transcribing', blob: action.blob, mimeType: action.mimeType };
    }

    case 'TRANSCRIPTION_SUCCESS': {
      if (state.status !== 'transcribing') return state;
      return { status: 'review', transcript: action.transcript };
    }

    case 'TRANSCRIPTION_ERROR': {
      if (state.status !== 'transcribing') return state;
      return {
        status: 'error',
        blob: state.blob,
        mimeType: state.mimeType,
        message: action.message,
      };
    }

    case 'RETRY': {
      if (state.status !== 'error') return state;
      return { status: 'transcribing', blob: state.blob, mimeType: state.mimeType };
    }

    case 'RELAUNCH': {
      if (state.status !== 'error' && state.status !== 'review' && state.status !== 'structuring-error') return state;
      return { status: 'idle' };
    }

    case 'VALIDATE': {
      if (state.status !== 'review') return state;
      return { status: 'structuring', transcript: state.transcript };
    }

    case 'STRUCTURE_SUCCESS': {
      if (state.status !== 'structuring') return state;
      return { status: 'card-ready', card: action.card, editedCard: action.card };
    }

    case 'STRUCTURE_ERROR': {
      if (state.status !== 'structuring') return state;
      return { status: 'structuring-error', transcript: state.transcript, message: action.message };
    }

    case 'SECTION_EDIT': {
      if (state.status !== 'card-ready' && state.status !== 'card-editing') return state;
      return {
        ...state,
        editedCard: { ...state.editedCard, [action.section]: action.value },
      };
    }

    case 'TAG_TOGGLE': {
      if (state.status !== 'card-ready' && state.status !== 'card-editing') return state;
      const tags = state.editedCard.tags.includes(action.tag)
        ? state.editedCard.tags.filter((t) => t !== action.tag)
        : [...state.editedCard.tags, action.tag];
      return {
        ...state,
        editedCard: { ...state.editedCard, tags },
      };
    }

    case 'START_SAVING': {
      if (state.status !== 'card-ready' && state.status !== 'card-editing') return state;
      return { status: 'card-saving', card: state.card, editedCard: state.editedCard };
    }

    case 'SAVE_COMPLETE': {
      if (state.status !== 'card-saving') return state;
      return { status: 'card-saved' };
    }

    case 'SAVE_ERROR': {
      if (state.status !== 'card-saving') return state;
      return { status: 'card-ready', card: state.card, editedCard: state.editedCard };
    }

    case 'RESET': {
      return { status: 'idle' };
    }

    case 'RETRY_STRUCTURE': {
      if (state.status !== 'structuring-error') return state;
      return { status: 'structuring', transcript: state.transcript };
    }

    default:
      return state;
  }
}
