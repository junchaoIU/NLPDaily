import { useEffect, useState } from 'react'
import type { TrendsData } from '../types'
import TrendChart, { CHART_COLORS } from './TrendChart'

/** 趋势雷达：热点主题逐周走势 + 各周论文量 + 主题明细 */
function TrendsView() {
  const [data, setData] = useState<TrendsData | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/analysis/trends.json`)
      .then((res) => {
        if (!res.ok) throw new Error('趋势数据尚未生成')
        return res.json()
      })
      .then((d: TrendsData) => {
        setData(d)
        setSelected(d.topics.slice(0, 5).map((t) => t.term))
      })
      .catch((e) => setError(e.message))
  }, [])

  if (error) {
    return <p className="py-20 text-center text-sm text-gray-400 dark:text-parchment-muted">{error}</p>
  }
  if (!data) {
    return <p className="py-20 text-center text-sm text-gray-400 dark:text-parchment-muted">加载趋势数据中…</p>
  }

  const toggle = (term: string) => {
    setSelected((prev) =>
      prev.includes(term) ? prev.filter((t) => t !== term) : [...prev, term],
    )
  }
  const maxCount = Math.max(...data.weeklyPaperCounts, 1)
  const lastIdx = data.weeks.length - 1

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-gray-100 bg-white p-4 dark:border-ink-lighter/30 dark:bg-ink-light sm:p-6">
        <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-parchment">
          热点主题逐周走势
        </h2>
        <p className="mt-1 text-xs text-gray-400 dark:text-parchment-muted">
          全量论文按语义聚为若干研究主题，跟踪各主题逐周论文量（点击主题可显示/隐藏曲线）
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.topics.map((t, i) => {
            const active = selected.includes(t.term)
            return (
              <button
                key={t.term}
                onClick={() => toggle(t.term)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  active
                    ? 'border-transparent text-ink'
                    : 'border-gray-200 text-gray-500 hover:text-gray-900 dark:border-ink-lighter/50 dark:text-parchment-muted dark:hover:text-parchment'
                }`}
                style={active ? { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] } : undefined}
              >
                {t.term}
              </button>
            )
          })}
        </div>
        <div className="mt-4">
          <TrendChart weeks={data.weeks} topics={data.topics} selected={selected} />
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4 dark:border-ink-lighter/30 dark:bg-ink-light sm:p-6">
        <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-parchment">
          各周论文量
        </h2>
        <div className="mt-4 flex items-end gap-1.5" style={{ height: 120 }}>
          {data.weeklyPaperCounts.map((count, i) => (
            <div key={data.weeks[i]} className="flex flex-1 flex-col items-center gap-1"
              title={`${data.weeks[i]}: ${count} 篇`}>
              <span className="text-[10px] text-gray-400 dark:text-parchment-muted">{count}</span>
              <div
                className="w-full rounded-t bg-amber-gold/70 transition-colors hover:bg-amber-gold"
                style={{ height: `${Math.max(2, (count / maxCount) * 80)}px` }}
              />
              <span className="text-[10px] text-gray-400 dark:text-parchment-muted">
                {data.weeks[i].slice(5)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-4 dark:border-ink-lighter/30 dark:bg-ink-light sm:p-6">
        <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-parchment">
          主题明细
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400 dark:border-ink-lighter/30 dark:text-parchment-muted">
                <th className="py-2 pr-4 font-medium">主题</th>
                <th className="py-2 pr-4 font-medium">累计篇数</th>
                <th className="py-2 pr-4 font-medium">{data.weeks[lastIdx]}（本周）</th>
                <th className="py-2 font-medium">较上周</th>
              </tr>
            </thead>
            <tbody>
              {data.topics.map((t) => {
                const cur = t.weekly[lastIdx] ?? 0
                const prev = t.weekly[lastIdx - 1] ?? 0
                const delta = cur - prev
                return (
                  <tr key={t.term} className="border-b border-gray-50 dark:border-ink-lighter/20">
                    <td className="py-2 pr-4 text-gray-900 dark:text-parchment">{t.term}</td>
                    <td className="py-2 pr-4 text-gray-500 dark:text-parchment-muted">{t.total}</td>
                    <td className="py-2 pr-4 text-gray-500 dark:text-parchment-muted">{cur}</td>
                    <td className={`py-2 ${delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : delta < 0 ? 'text-wine' : 'text-gray-400 dark:text-parchment-muted'}`}>
                      {delta > 0 ? `+${delta}` : delta}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default TrendsView
