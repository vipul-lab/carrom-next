'use client'

import { useEffect } from 'react'

/**
 * Opens the browser's print dialog once the report has painted. "Save as PDF"
 * there produces the downloadable document.
 */
export function PrintTrigger() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-navy-100 bg-navy-50 px-8 py-3">
      <p className="text-xs text-slate-500">
        Choose <strong className="text-navy-800">Save as PDF</strong> as the destination to download
        this report.
      </p>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-navy-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-navy-800"
      >
        Print / Save as PDF
      </button>
    </div>
  )
}
