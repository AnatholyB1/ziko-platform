'use client'

interface LegendDotProps {
  color: string;
  label: string;
}

export function LegendDot({ color, label }: LegendDotProps) {
  return (
    <span className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[13px] font-medium text-muted truncate max-w-[120px]">{label}</span>
    </span>
  );
}
