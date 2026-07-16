export default function LoadingSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse dark:border-ink-lighter/20 dark:bg-ink-light/30">
      <div className="h-5 w-3/4 rounded bg-gray-200 dark:bg-ink-lighter/50" />
      <div className="mt-3 flex gap-1.5">
        <div className="h-5 w-16 rounded-full bg-gray-100 dark:bg-ink-lighter/30" />
        <div className="h-5 w-20 rounded-full bg-gray-100 dark:bg-ink-lighter/30" />
        <div className="h-5 w-14 rounded-full bg-gray-100 dark:bg-ink-lighter/30" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-gray-100 dark:bg-ink-lighter/20" />
        <div className="h-3 w-5/6 rounded bg-gray-100 dark:bg-ink-lighter/20" />
        <div className="h-3 w-4/5 rounded bg-gray-100 dark:bg-ink-lighter/20" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-ink-lighter/10">
        <div className="h-4 w-20 rounded bg-gray-100 dark:bg-ink-lighter/20" />
        <div className="h-4 w-16 rounded bg-gray-100 dark:bg-ink-lighter/20" />
      </div>
    </div>
  )
}
