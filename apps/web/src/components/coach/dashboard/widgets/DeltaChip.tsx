'use client'

interface DeltaChipProps {
  delta: number;
  unit?: string;
}

export function DeltaChip({ delta, unit }: DeltaChipProps) {
  const isPositive = delta > 0;
  const isNeutral = delta === 0;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
      isNeutral
        ? 'bg-[#F0EFE9] text-[#6B6963]'
        : isPositive
        ? 'bg-[#DCFCE7] text-[#15803D]'
        : 'bg-[#FEE2E2] text-[#B91C1C]'
    }`}>
      {isPositive ? '+' : ''}{delta}{unit ? ` ${unit}` : ''}
    </span>
  );
}
