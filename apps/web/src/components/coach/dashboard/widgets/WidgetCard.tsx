'use client'

import React from 'react'
import { SkeletonBlock } from '@/components/coach/skeletons'

interface WidgetCardProps {
  title: string
  period?: string
  isLoading?: boolean
  error?: string | null
  children: React.ReactNode
}

export function WidgetCard({ title, period, isLoading, error, children }: WidgetCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-text">{title}</span>
        {period && (
          <span className="text-xs text-muted bg-[#F7F6F3] px-2 py-0.5 rounded-full">
            {period}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {isLoading ? (
          <SkeletonBlock className="w-full h-full" />
        ) : error ? (
          <p className="text-sm text-muted text-center pt-8">{error}</p>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
