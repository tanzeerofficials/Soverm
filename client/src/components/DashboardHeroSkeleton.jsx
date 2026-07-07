import Skeleton from './Skeleton.jsx'

function DashboardHeroSkeleton() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border-default bg-gradient-to-b from-surface-deep/90 via-surface to-app px-6 py-10 sm:px-10 sm:py-12">
      <div className="relative text-center">
        <Skeleton className="mx-auto h-3 w-28" />
        <Skeleton className="mx-auto mt-4 h-14 w-56 sm:h-16 sm:w-72" />
        <Skeleton className="mx-auto mt-4 h-3 w-40" />
        <div className="mx-auto mt-6 inline-flex gap-1 rounded-full border border-border-default p-1">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-7 w-10 rounded-full" />
          ))}
        </div>
        <div className="mx-auto mt-6 max-w-sm">
          <Skeleton className="h-[5.5rem] w-full rounded-xl" />
        </div>
        <Skeleton className="mx-auto mt-6 h-44 w-full max-w-xl rounded-xl" />
      </div>
    </section>
  )
}

export default DashboardHeroSkeleton
