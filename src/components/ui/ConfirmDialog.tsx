'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Button, buttonClasses, type ButtonVariant } from './Button'
import { Icon, type IconName } from './Icon'
import { SubmitButton } from '@/components/form/SubmitButton'

/**
 * The destructive-action guard: a trigger button that opens a modal explaining
 * the consequences, with the real submit inside. Replaces the old
 * `data-modal-open` + `data-confirm` pair with one component.
 */
export function ConfirmDialog({
  title,
  triggerLabel,
  triggerIcon = 'trash',
  triggerVariant = 'danger',
  triggerClassName = '',
  confirmLabel = 'Yes, continue',
  confirmVariant = 'danger',
  pendingText = 'Deleting…',
  action,
  hiddenFields,
  children,
}: {
  title: string
  triggerLabel: string
  triggerIcon?: IconName
  triggerVariant?: ButtonVariant
  triggerClassName?: string
  confirmLabel?: string
  confirmVariant?: ButtonVariant
  pendingText?: string
  /** The server action the confirm button submits to. */
  action: (formData: FormData) => void | Promise<void>
  hiddenFields?: Record<string, string>
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', onKey)
    document.body.classList.add('overflow-hidden')

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('overflow-hidden')
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses(triggerVariant, 'md', triggerClassName)}
      >
        <Icon name={triggerIcon} className="h-4 w-4" />
        <span>{triggerLabel}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          onClick={(event) => {
            // Clicking the backdrop (but not the panel) dismisses the dialog.
            if (event.target === event.currentTarget) setOpen(false)
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-raised">
            <header className="flex items-start justify-between gap-4 border-b border-navy-100 px-5 py-4">
              <h2 id="confirm-title" className="text-base font-semibold text-navy-900">
                {title}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-m-1 rounded p-1 text-navy-400 transition hover:bg-navy-100 hover:text-navy-700"
              >
                <Icon name="close" className="h-5 w-5" />
              </button>
            </header>

            <div className="px-5 py-4 text-sm text-slate-600">{children}</div>

            <footer className="flex flex-wrap justify-end gap-2 border-t border-navy-100 bg-navy-50/60 px-5 py-3">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>

              <form action={action}>
                {Object.entries(hiddenFields ?? {}).map(([key, value]) => (
                  <input key={key} type="hidden" name={key} value={value} />
                ))}
                <SubmitButton variant={confirmVariant} icon={triggerIcon} pendingText={pendingText}>
                  {confirmLabel}
                </SubmitButton>
              </form>
            </footer>
          </div>
        </div>
      )}
    </>
  )
}
