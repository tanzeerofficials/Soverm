import Skeleton from './Skeleton.jsx'

function DashboardHeroSkeleton() {
  return (
    <section className="text-center">
      <Skeleton className="mx-auto h-3 w-28" />
      <Skeleton className="mx-auto mt-3 h-14 w-56 sm:h-16 sm:w-64" />
      <div className="mt-5 mb-2 flex justify-center gap-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-7 w-10 rounded-full" />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-44" />
      </div>
    </section>
  )
}

export default DashboardHeroSkeleton
