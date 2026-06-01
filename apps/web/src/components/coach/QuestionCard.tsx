'use client';

import { useState, useRef } from 'react';
import {
  IoChevronUpOutline,
  IoChevronDownOutline,
  IoEllipsisHorizontal,
  IoTrashOutline,
  IoAddOutline,
} from 'react-icons/io5';
import { gsap } from 'gsap';
import type { FormQuestion, QuestionType } from './FormStatusBadge';

// ─── Type chip labels ──────────────────────────────────────────────────────────

const TYPE_LABELS: Record<QuestionType, string> = {
  text: 'Texte libre',
  scale: 'Échelle 1-10',
  yes_no: 'Oui / Non',
  choice: 'Choix unique',
};

// ─── Props ─────────────────────────────────────────────────────────────────────

interface QuestionCardProps {
  question: FormQuestion;
  index: number;
  total: number;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onSave: (updated: FormQuestion) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

// ─── QuestionCard ──────────────────────────────────────────────────────────────

export default function QuestionCard({
  question,
  index,
  total,
  isExpanded,
  onExpand,
  onCollapse,
  onSave,
  onDelete,
  onMoveUp,
  onMoveDown,
}: QuestionCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Draft state for expanded editor
  const [draft, setDraft] = useState<FormQuestion>(question);

  // Sync draft when question prop changes (e.g. after save from parent)
  // We reset draft when card is newly expanded
  function handleExpand() {
    setDraft(question);
    setMenuOpen(false);
    setShowDeleteConfirm(false);
    onExpand();
  }

  // ─── Choice helpers ──────────────────────────────────────────────────────────

  function updateChoice(i: number, v: string) {
    const choices = [...(draft.choices ?? [])];
    choices[i] = v;
    setDraft({ ...draft, choices });
  }

  function removeChoice(i: number) {
    const choices = (draft.choices ?? []).filter((_, idx) => idx !== i);
    setDraft({ ...draft, choices });
  }

  function addChoice() {
    const choices = [...(draft.choices ?? []), ''];
    setDraft({ ...draft, choices });
  }

  // ─── Type change handler ─────────────────────────────────────────────────────

  function handleTypeChange(newType: QuestionType) {
    setDraft({
      ...draft,
      type: newType,
      choices: newType === 'choice' ? ['', ''] : undefined,
    });
  }

  // ─── Save validation ─────────────────────────────────────────────────────────

  const canSave =
    draft.label.trim() !== '' &&
    (draft.type !== 'choice' || (draft.choices?.length ?? 0) >= 2);

  // ─── Delete with GSAP animation ──────────────────────────────────────────────

  function handleConfirmDelete() {
    if (!cardRef.current) { onDelete(); return; }
    gsap.to(cardRef.current, {
      opacity: 0,
      height: 0,
      marginBottom: 0,
      duration: 0.15,
      ease: 'power2.in',
      onComplete: onDelete,
    });
  }

  // ─── Expanded card ──────────────────────────────────────────────────────────

  if (isExpanded) {
    return (
      <div
        ref={cardRef}
        className="question-card bg-white border-2 border-primary rounded-xl p-4 mb-3 flex flex-col gap-4"
      >
        {/* Row 1 — Type dropdown */}
        <div>
          <label className="text-xs font-bold text-muted mb-1 block">Type</label>
          <select
            value={draft.type}
            onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
            className="rounded-xl border border-border px-4 py-3 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          >
            <option value="text">Texte libre</option>
            <option value="scale">Échelle 1-10</option>
            <option value="yes_no">Oui / Non</option>
            <option value="choice">Choix unique</option>
          </select>
        </div>

        {/* Row 2 — Label textarea */}
        <div>
          <label className="text-xs font-bold text-muted mb-1 block">Question</label>
          <textarea
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            rows={2}
            className="rounded-xl border border-border px-4 py-3 text-sm resize-none w-full focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>

        {/* Row 3 — ChoiceEditor (only for 'choice' type) */}
        {draft.type === 'choice' && (
          <div>
            <p className="text-xs font-bold text-muted mb-2">Réponses possibles</p>
            {draft.choices?.map((choice, ci) => (
              <div key={ci} className="flex items-center gap-2 mb-2">
                <input
                  value={choice}
                  onChange={(e) => updateChoice(ci, e.target.value)}
                  className="flex-1 rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => removeChoice(ci)}
                  className="text-muted hover:text-destructive"
                >
                  <IoTrashOutline size={16} />
                </button>
              </div>
            ))}
            {(draft.choices?.length ?? 0) < 2 && (
              <p className="text-xs text-destructive mt-1">Minimum 2 réponses requises</p>
            )}
            <button
              type="button"
              onClick={addChoice}
              className="text-primary text-sm font-bold flex items-center gap-1 mt-1 hover:opacity-70"
            >
              <IoAddOutline size={14} /> + Ajouter une réponse
            </button>
          </div>
        )}

        {/* Row 4 — Save/Cancel */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCollapse}
            className="border border-border bg-white text-text rounded-xl px-4 py-2 text-sm font-bold"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              if (canSave) {
                onSave(draft);
                onCollapse();
              }
            }}
            disabled={!canSave}
            className={`bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold ${!canSave ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Enregistrer
          </button>
        </div>
      </div>
    );
  }

  // ─── Collapsed card ─────────────────────────────────────────────────────────

  return (
    <div
      ref={cardRef}
      className="question-card bg-white border border-border rounded-xl p-4 mb-3 flex items-center gap-3 cursor-pointer hover:shadow-md transition-shadow duration-200"
      onClick={handleExpand}
    >
      {/* Type chip */}
      <span className="bg-[#F0EFE9] text-[#6B6963] text-xs font-bold rounded px-2 py-0.5 shrink-0">
        {TYPE_LABELS[question.type]}
      </span>

      {/* Question label */}
      <span className="text-sm text-text font-bold flex-1 truncate">
        {question.label || <em className="text-muted not-italic font-normal">Question sans titre</em>}
      </span>

      {/* Action row — stops card click propagation */}
      <div
        className="flex items-center gap-1 ml-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        {showDeleteConfirm ? (
          /* Inline delete confirmation */
          <>
            <span className="text-sm font-bold text-text mr-2 whitespace-nowrap">
              Supprimer cette question ?
            </span>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="text-xs font-bold text-destructive hover:bg-[#FEE2E2] rounded-lg px-2 py-1 whitespace-nowrap"
            >
              Oui, supprimer
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="text-xs text-muted px-2 py-1"
            >
              Annuler
            </button>
          </>
        ) : (
          <>
            {/* Move up */}
            <button
              type="button"
              aria-label="Déplacer vers le haut"
              disabled={index === 0}
              onClick={onMoveUp}
              className="text-muted hover:text-text disabled:opacity-30 disabled:cursor-default p-1"
            >
              <IoChevronUpOutline size={18} />
            </button>

            {/* Move down */}
            <button
              type="button"
              aria-label="Déplacer vers le bas"
              disabled={index === total - 1}
              onClick={onMoveDown}
              className="text-muted hover:text-text disabled:opacity-30 disabled:cursor-default p-1"
            >
              <IoChevronDownOutline size={18} />
            </button>

            {/* Context menu */}
            <div className="relative">
              <button
                type="button"
                aria-label="Options"
                onClick={() => setMenuOpen((o) => !o)}
                className="text-muted hover:text-text p-1"
              >
                <IoEllipsisHorizontal size={18} />
              </button>
              {menuOpen && (
                <div className="absolute w-32 bg-white border border-border rounded-xl shadow-md z-10 py-1 top-full right-0">
                  <button
                    type="button"
                    onClick={() => { handleExpand(); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-[#F7F6F3] text-text"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(true); setMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-[#F7F6F3] text-destructive"
                  >
                    Supprimer
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
