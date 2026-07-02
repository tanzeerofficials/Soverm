import Skeleton from './Skeleton.jsx'

function HistoryTimelineSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-lg border border-[#1E2D45] border-l-4 border-l-[#4B5563] bg-[#111827] px-4 py-3"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-3 w-20 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

export default HistoryTimelineSkeleton
