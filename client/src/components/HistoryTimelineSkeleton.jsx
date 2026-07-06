import Skeleton from './Skeleton.jsx'

function HistoryTimelineSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-10" aria-hidden="true">
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-4 pl-8">
          {[0, 1, 2].map((index) => (
            <div key={index} className="relative">
              <Skeleton className="absolute left-0 top-7 h-3.5 w-3.5 rounded-full" />
              <div className="overflow-hidden rounded-xl border border-border-default border-l-4 border-l-ai bg-surface">
                <div className="border-b border-border-default bg-app/50 px-5 py-3">
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="p-5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-3 h-5 w-full max-w-lg" />
                  <div className="mt-4 flex gap-2">
                    <Skeleton className="h-7 w-28 rounded-lg" />
                    <Skeleton className="h-7 w-32 rounded-lg" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HistoryTimelineSkeleton
