import Skeleton from './Skeleton.jsx'

function InsightCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-xl border border-border-default border-l-4 border-l-ai bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border-default bg-app/50 px-5 py-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>

      <div className="p-5 sm:p-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-4 h-8 w-3/4 max-w-md" />

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="rounded-lg border border-border-default bg-app px-4 py-3"
            >
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="mt-2 h-6 w-16" />
              <Skeleton className="mt-2 h-2.5 w-20" />
            </div>
          ))}
        </div>

        <Skeleton className="mt-5 h-4 w-36" />
      </div>
    </article>
  )
}

export default InsightCardSkeleton
