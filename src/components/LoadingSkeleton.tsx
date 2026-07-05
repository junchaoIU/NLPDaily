export default function LoadingSkeleton() {
  return (
    <div className="rounded-xl border border-ink-lighter/20 bg-ink-light/30 p-5 animate-pulse">
      <div className="h-5 w-3/4 rounded bg-ink-lighter/50" />
      <div className="mt-3 flex gap-1.5">
        <div className="h-5 w-16 rounded-full bg-ink-lighter/30" />
        <div className="h-5 w-20 rounded-full bg-ink-lighter/30" />
        <div className="h-5 w-14 rounded-full bg-ink-lighter/30" />
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-full rounded bg-ink-lighter/20" />
        <div className="h-3 w-5/6 rounded bg-ink-lighter/20" />
        <div className="h-3 w-4/5 rounded bg-ink-lighter/20" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-ink-lighter/10 pt-3">
        <div className="h-4 w-20 rounded bg-ink-lighter/20" />
        <div className="h-4 w-16 rounded bg-ink-lighter/20" />
      </div>
    </div>
  )
}
