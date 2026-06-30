import Skeleton from './Skeleton.jsx'

function InsightCardSkeleton() {
  return (
    <article className="rounded-xl border border-[#1E2D45] border-l-4 border-l-[#8B5CF6] bg-[#111827] p-6">
      <div className="flex items-center justify-between gap-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-24" />
      </div>

      <Skeleton className="mb-4 mt-4 h-8 w-3/4 max-w-md" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="rounded-lg bg-[#1A2236] p-4">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="mt-2 h-6 w-16" />
            <Skeleton className="mt-2 h-2.5 w-20" />
          </div>
        ))}
      </div>

      <Skeleton className="mt-4 h-4 w-36" />
    </article>
  )
}

export default InsightCardSkeleton
