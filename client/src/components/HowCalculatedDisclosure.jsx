/*
 * HOW CALCULATED DISCLOSURE
 *
 * Expandable plain-English rules for a financial metric.
 */

import { useState } from 'react'

function HowCalculatedDisclosure({ title = 'How we calculate this', items = [] }) {
  const [open, setOpen] = useState(false)

  if (!items.length) {
    return null
  }

  return (
    <div className="mt-3 text-left">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-xs font-medium text-fg-muted transition hover:text-fg"
        aria-expanded={open}
      >
        {open ? 'Hide details' : title}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-fg-subtle">
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default HowCalculatedDisclosure
