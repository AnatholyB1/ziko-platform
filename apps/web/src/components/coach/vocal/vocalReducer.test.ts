import { describe, it, expect } from 'vitest';
import { vocalReducer, StructuredCard, CardSection, TagKey } from './vocalReducer';

const mockBlob = new Blob(['audio'], { type: 'audio/webm' });
const mimeType = 'audio/webm';

const mockCard: StructuredCard = {
  context: 'ctx',
  strengths: 'str',
  corrections: 'cor',
  next_steps: 'ns',
  tags: [],
};

describe('vocalReducer state transitions', () => {
  it('idle → recording on START_RECORDING', () => {
    const next = vocalReducer({ status: 'idle' }, { type: 'START_RECORDING' });
    expect(next.status).toBe('recording');
  });

  it('recording → transcribing on STOP_RECORDING', () => {
    const next = vocalReducer(
      { status: 'recording', startedAt: Date.now() },
      { type: 'STOP_RECORDING', blob: mockBlob, mimeType }
    );
    expect(next.status).toBe('transcribing');
  });

  it('transcribing → review on TRANSCRIPTION_SUCCESS', () => {
    const next = vocalReducer(
      { status: 'transcribing', blob: mockBlob, mimeType },
      { type: 'TRANSCRIPTION_SUCCESS', transcript: 'Hello' }
    );
    expect(next.status).toBe('review');
  });

  it('transcribing → error on TRANSCRIPTION_ERROR', () => {
    const next = vocalReducer(
      { status: 'transcribing', blob: mockBlob, mimeType },
      { type: 'TRANSCRIPTION_ERROR', message: 'Network error' }
    );
    expect(next.status).toBe('error');
  });

  it('error → transcribing on RETRY', () => {
    const next = vocalReducer(
      { status: 'error', blob: mockBlob, mimeType, message: 'Network error' },
      { type: 'RETRY' }
    );
    expect(next.status).toBe('transcribing');
  });

  it('error → idle on RELAUNCH', () => {
    const next = vocalReducer(
      { status: 'error', blob: mockBlob, mimeType, message: 'Network error' },
      { type: 'RELAUNCH' }
    );
    expect(next.status).toBe('idle');
  });

  it('review → structuring on VALIDATE', () => {
    const next = vocalReducer(
      { status: 'review', transcript: 'Hello' },
      { type: 'VALIDATE' }
    );
    expect(next.status).toBe('structuring');
    expect((next as any).transcript).toBe('Hello');
  });

  it('structuring → card-ready on STRUCTURE_SUCCESS', () => {
    const next = vocalReducer(
      { status: 'structuring', transcript: 'Hello' },
      { type: 'STRUCTURE_SUCCESS', card: mockCard }
    );
    expect(next.status).toBe('card-ready');
    expect((next as any).card.context).toBe('ctx');
    expect((next as any).editedCard.context).toBe('ctx');
  });

  it('structuring → structuring-error on STRUCTURE_ERROR', () => {
    const next = vocalReducer(
      { status: 'structuring', transcript: 'Hello' },
      { type: 'STRUCTURE_ERROR', message: 'err msg' }
    );
    expect(next.status).toBe('structuring-error');
    expect((next as any).message).toBe('err msg');
    expect((next as any).transcript).toBe('Hello');
  });

  it('card-ready + SECTION_EDIT updates editedCard', () => {
    const next = vocalReducer(
      { status: 'card-ready', card: mockCard, editedCard: mockCard },
      { type: 'SECTION_EDIT', section: 'context' as CardSection, value: 'edited' }
    );
    expect(next.status).toBe('card-ready');
    expect((next as any).editedCard.context).toBe('edited');
    expect((next as any).card.context).toBe('ctx');
  });

  it('card-ready + TAG_TOGGLE adds absent tag', () => {
    const next = vocalReducer(
      { status: 'card-ready', card: mockCard, editedCard: mockCard },
      { type: 'TAG_TOGGLE', tag: 'force' as TagKey }
    );
    expect(next.status).toBe('card-ready');
    expect((next as any).editedCard.tags).toContain('force');
  });

  it('card-ready + TAG_TOGGLE removes present tag', () => {
    const cardWithTag: StructuredCard = { ...mockCard, tags: ['force' as TagKey] };
    const next = vocalReducer(
      { status: 'card-ready', card: cardWithTag, editedCard: cardWithTag },
      { type: 'TAG_TOGGLE', tag: 'force' as TagKey }
    );
    expect(next.status).toBe('card-ready');
    expect((next as any).editedCard.tags).not.toContain('force');
  });

  it('card-ready → card-saving on START_SAVING', () => {
    const next = vocalReducer(
      { status: 'card-ready', card: mockCard, editedCard: mockCard },
      { type: 'START_SAVING' }
    );
    expect(next.status).toBe('card-saving');
    expect((next as any).editedCard).toBeDefined();
  });

  it('card-saving → card-saved on SAVE_COMPLETE', () => {
    const next = vocalReducer(
      { status: 'card-saving', editedCard: mockCard },
      { type: 'SAVE_COMPLETE' }
    );
    expect(next.status).toBe('card-saved');
  });

  it('card-saved → idle on RESET', () => {
    const next = vocalReducer(
      { status: 'card-saved' },
      { type: 'RESET' }
    );
    expect(next.status).toBe('idle');
  });
});
