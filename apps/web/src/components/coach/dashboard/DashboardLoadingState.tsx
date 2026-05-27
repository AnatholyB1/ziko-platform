import { WidgetCard } from './widgets/WidgetCard'

export function DashboardLoadingState() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="min-h-[200px]">
        <WidgetCard title="Loading..." isLoading={true}>
          {null}
        </WidgetCard>
      </div>
      <div className="min-h-[200px]">
        <WidgetCard title="Loading..." isLoading={true}>
          {null}
        </WidgetCard>
      </div>
      <div className="min-h-[200px]">
        <WidgetCard title="Loading..." isLoading={true}>
          {null}
        </WidgetCard>
      </div>
      <div className="min-h-[200px]">
        <WidgetCard title="Loading..." isLoading={true}>
          {null}
        </WidgetCard>
      </div>
    </div>
  )
}
