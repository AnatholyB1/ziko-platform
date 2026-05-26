// vocalReducer.ts — Pure state machine for the vocal feedback feature.
// No React import needed — this is a plain function.

export type VocalState =
  | { status: 'idle' }
  | { status: 'recording'; startedAt: number }
  | { status: 'transcribing'; blob: Blob; mimeType: string }
  | { status: 'review'; transcript: string }
  | { status: 'error'; blob: Blob; mimeType: string; message: string };

export type VocalAction =
  | { type: 'START_RECORDING' }
  | { type: 'STOP_RECORDING'; blob: Blob; mimeType: string }
  | { type: 'TRANSCRIPTION_SUCCESS'; transcript: string }
  | { type: 'TRANSCRIPTION_ERROR'; message: string }
  | { type: 'RETRY' }
  | { type: 'RELAUNCH' }
  | { type: 'VALIDATE' };

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
      if (state.status !== 'error' && state.status !== 'review') return state;
      return { status: 'idle' };
    }

    case 'VALIDATE': {
      if (state.status !== 'review') return state;
      return { status: 'idle' };
    }

    default:
      return state;
  }
}
