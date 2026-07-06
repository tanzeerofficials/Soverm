import Skeleton from './Skeleton.jsx'

function AccountCardSkeleton() {
  return (
    <article className="rounded-xl border border-border-default bg-surface p-4 sm:p-5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-1 h-4 w-32" />
      <Skeleton className="mt-2 h-5 w-16 rounded-full" />
      <Skeleton className="mt-4 h-8 w-28" />
    </article>
  )
}

export default AccountCardSkeleton
