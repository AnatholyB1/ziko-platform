'use client';
import { useState, useRef, useEffect } from 'react';
import type { ProgramWeek, ProgramSession } from '@ziko/coach-sdk';

const DAY_LABELS = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export interface WeekAccordionProps {
  weeks: ProgramWeek[];
  activeSessionId: string | null;
  onSessionSelect: (sessionId: string) => void;
  onAddWeek: () => void;
  onAddSession: (weekNumber: number) => void;
  onDuplicateWeek: (weekNumber: number) => void;
  onDeleteWeek: (weekNumber: number) => void;
  onDuplicateSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

type ContextMenu =
  | { kind: 'week'; weekNumber: number }
  | { kind: 'session'; sessionId: string }
  | null;

export function WeekAccordion({
  weeks,
  activeSessionId,
  onSessionSelect,
  onAddWeek,
  onAddSession,
  onDuplicateWeek,
  onDeleteWeek,
  onDuplicateSession,
  onDeleteSession,
}: WeekAccordionProps) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(
    () => new Set(weeks.map((w) => w.week_number))
  );
  const [contextMenu, setContextMenu] = useState<ContextMenu>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    if (contextMenu) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  const toggleWeek = (weekNumber: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekNumber)) {
        next.delete(weekNumber);
      } else {
        next.add(weekNumber);
      }
      return next;
    });
  };

  const openWeekMenu = (e: React.MouseEvent, weekNumber: number) => {
    e.stopPropagation();
    setContextMenu({ kind: 'week', weekNumber });
  };

  const openSessionMenu = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setContextMenu({ kind: 'session', sessionId });
  };

  return (
    <div className="flex flex-col gap-2">
      {weeks.map((week) => {
        const isExpanded = expandedWeeks.has(week.week_number);
        return (
          <div key={week.week_number} className="rounded-xl border border-border overflow-visible">
            {/* Week header */}
            <div
              className="h-12 flex items-center px-4 bg-background rounded-xl cursor-pointer select-none"
              onClick={() => toggleWeek(week.week_number)}
            >
              {/* Chevron */}
              <span
                className={`mr-3 text-muted transition-transform duration-150 ${
                  isExpanded ? 'rotate-0' : '-rotate-90'
                }`}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 16 16">
                  <path
                    d="M4 6l4 4 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-sm font-bold text-text flex-1">
                Semaine {week.week_number}
                <span className="ml-2 text-xs font-normal text-muted">
                  {week.sessions.length} séance{week.sessions.length !== 1 ? 's' : ''}
                </span>
              </span>
              {/* Context menu trigger */}
              <div className="relative" ref={contextMenu?.kind === 'week' && contextMenu.weekNumber === week.week_number ? menuRef : undefined}>
                <button
                  type="button"
                  className="p-1 rounded-lg text-muted hover:text-text hover:bg-border/30 transition-colors"
                  onClick={(e) => openWeekMenu(e, week.week_number)}
                  aria-label={`Actions semaine ${week.week_number}`}
                >
                  <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <circle cx="8" cy="3" r="1.2" />
                    <circle cx="8" cy="8" r="1.2" />
                    <circle cx="8" cy="13" r="1.2" />
                  </svg>
                </button>
                {contextMenu?.kind === 'week' && contextMenu.weekNumber === week.week_number && (
                  <div className="absolute right-0 top-8 z-50 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[180px]">
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm text-text hover:bg-background"
                      onClick={() => {
                        onDuplicateWeek(week.week_number);
                        setContextMenu(null);
                      }}
                    >
                      Dupliquer la semaine
                    </button>
                    <button
                      type="button"
                      className="w-full text-left px-4 py-2.5 text-sm text-danger hover:bg-background"
                      onClick={() => {
                        onDeleteWeek(week.week_number);
                        setContextMenu(null);
                      }}
                    >
                      Supprimer la semaine
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Expanded sessions */}
            {isExpanded && (
              <div>
                {week.sessions.map((session) => {
                  const isActive = activeSessionId === session.session_id;
                  return (
                    <div
                      key={session.session_id}
                      className={`h-11 flex items-center gap-3 px-4 pl-8 border-b border-border hover:bg-background cursor-pointer ${
                        isActive
                          ? 'bg-primary/5 border-l-2 border-l-primary'
                          : ''
                      }`}
                      onClick={() => onSessionSelect(session.session_id)}
                    >
                      {/* Day chip */}
                      <span className="text-xs font-bold bg-background border border-border rounded-full px-2 py-0.5 text-muted shrink-0">
                        {DAY_LABELS[session.day_of_week] ?? '?'}
                      </span>
                      {/* Session name */}
                      <span className="text-sm font-normal text-text flex-1 truncate">
                        {session.session_name}
                      </span>
                      {/* Exercise count */}
                      <span className="text-xs text-muted shrink-0">
                        {session.exercises.length} exo{session.exercises.length !== 1 ? 's' : ''}
                      </span>
                      {/* Session context menu */}
                      <div
                        className="relative"
                        ref={
                          contextMenu?.kind === 'session' && contextMenu.sessionId === session.session_id
                            ? menuRef
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          className="p-1 rounded-lg text-muted hover:text-text hover:bg-border/30 transition-colors"
                          onClick={(e) => openSessionMenu(e, session.session_id)}
                          aria-label={`Actions ${session.session_name}`}
                        >
                          <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                            <circle cx="8" cy="3" r="1.2" />
                            <circle cx="8" cy="8" r="1.2" />
                            <circle cx="8" cy="13" r="1.2" />
                          </svg>
                        </button>
                        {contextMenu?.kind === 'session' && contextMenu.sessionId === session.session_id && (
                          <div className="absolute right-0 top-8 z-50 bg-white border border-border rounded-xl shadow-lg py-1 min-w-[180px]">
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2.5 text-sm text-text hover:bg-background"
                              onClick={() => {
                                onDuplicateSession(session.session_id);
                                setContextMenu(null);
                              }}
                            >
                              Dupliquer la séance
                            </button>
                            <button
                              type="button"
                              className="w-full text-left px-4 py-2.5 text-sm text-danger hover:bg-background"
                              onClick={() => {
                                onDeleteSession(session.session_id);
                                setContextMenu(null);
                              }}
                            >
                              Supprimer la séance
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Forward chevron */}
                      <svg
                        width="14"
                        height="14"
                        fill="none"
                        viewBox="0 0 16 16"
                        className="text-muted shrink-0"
                      >
                        <path
                          d="M6 4l4 4-4 4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  );
                })}
                {/* Add session */}
                <button
                  type="button"
                  className="w-full h-10 flex items-center gap-2 px-4 pl-8 text-sm text-primary hover:bg-primary/5 transition-colors"
                  onClick={() => onAddSession(week.week_number)}
                >
                  <span className="text-base leading-none">+</span>
                  Ajouter une séance
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add week button */}
      <button
        type="button"
        className="h-11 flex items-center gap-2 px-4 border border-dashed border-border rounded-xl text-sm text-muted hover:border-primary hover:text-primary cursor-pointer mt-1 transition-colors"
        onClick={onAddWeek}
      >
        <span className="text-base leading-none">+</span>
        Ajouter une semaine
      </button>
    </div>
  );
}
