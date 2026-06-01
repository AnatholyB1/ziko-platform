'use client';
import { useState, useCallback } from 'react';

export type PDFExportState = 'idle' | 'generating' | 'done' | 'error';

export function useExportPDF() {
  const [exportState, setExportState] = useState<PDFExportState>('idle');

  const exportPDF = useCallback(async (
    element: HTMLElement,
    filename: string
  ) => {
    if (exportState === 'generating') return;
    setExportState('generating');
    try {
      // SSR-safe dynamic imports — do NOT import at module level
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, {
        scale: 2,           // retina quality
        useCORS: true,
        ignoreElements: (el) => el.classList.contains('pdf-exclude'),
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pxWidth = canvas.width / 2;    // back to CSS pixels
      const pxHeight = canvas.height / 2;

      const pdf = new jsPDF({
        orientation: pxWidth > pxHeight ? 'landscape' : 'portrait',
        unit: 'px',
        format: [pxWidth, pxHeight],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, pxWidth, pxHeight);
      pdf.save(filename);

      setExportState('done');
      // Reset to idle after 2 seconds
      setTimeout(() => setExportState('idle'), 2000);
    } catch (err) {
      console.error('[useExportPDF] export failed:', err);
      setExportState('error');
    }
  }, [exportState]);

  return { exportPDF, exportState };
}
