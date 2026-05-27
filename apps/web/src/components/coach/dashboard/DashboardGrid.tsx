'use client'

import 'react-grid-layout/css/styles.css'

import { useState, useEffect } from 'react'
import GridLayout from 'react-grid-layout'
import type { Layout, LayoutItem } from 'react-grid-layout'
import { createBrowserClient } from '@supabase/ssr'
import type { Widget } from '@/types/dashboard'
import { WidgetRenderer } from './WidgetRenderer'

interface Props {
  widgets: Widget[]
  clientId: string
  isEditMode: boolean
  onLayoutSaved?: (widgets: Widget[]) => void
}

export function DashboardGrid({ widgets, clientId, isEditMode, onLayoutSaved }: Props) {
  const [localWidgets, setLocalWidgets] = useState(widgets)

  useEffect(() => {
    setLocalWidgets(widgets)
  }, [widgets])

  const layout: LayoutItem[] = localWidgets.map(w => ({
    i: w.id,
    x: w.gridPos.x,
    y: w.gridPos.y,
    w: w.gridPos.w,
    h: w.gridPos.h,
  }))

  const handleLayoutChange = async (newLayout: Layout) => {
    const updated = localWidgets.map(w => {
      const pos = newLayout.find(l => l.i === w.id)
      if (!pos) return w
      return { ...w, gridPos: { x: pos.x, y: pos.y, w: pos.w, h: pos.h } }
    })
    setLocalWidgets(updated)

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_KEY!,
      )
      const { data: { session } } = await supabase.auth.getSession()
      const jwt = session?.access_token ?? ''
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/coach/dashboards/${clientId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        credentials: 'include',
        body: JSON.stringify({ widgets: updated }),
      })
      onLayoutSaved?.(updated)
    } catch (err) {
      console.error('[DashboardGrid] layout save failed:', err)
    }
  }

  return (
    <GridLayout
      className="layout"
      layout={layout}
      width={1200}
      gridConfig={{
        cols: 12,
        rowHeight: 80,
        margin: [16, 16],
        containerPadding: [0, 0],
      }}
      dragConfig={{ enabled: isEditMode }}
      resizeConfig={{ enabled: isEditMode }}
      onLayoutChange={isEditMode ? handleLayoutChange : undefined}
    >
      {localWidgets.map(w => (
        <div key={w.id}>
          <WidgetRenderer widget={w} clientId={clientId} />
        </div>
      ))}
    </GridLayout>
  )
}
