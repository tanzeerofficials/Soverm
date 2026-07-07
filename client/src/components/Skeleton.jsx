/*
 * SKELETON
 *
 * Pulsing placeholder block for loading states. Size and shape via className
 * so composite skeletons can match real content without layout shift.
 */

function Skeleton({ className = '' }) {
  return (
    <div
      className={`animate-pulse rounded bg-surface-elevated ${className}`}
      aria-hidden="true"
    />
  )
}

export default Skeleton
