import { useEffect, useState } from 'react'
import type { ReportIndex, WeeklyReport } from '../types'

type Language = 'en' | 'cn'

/** 每周简报：热点术语、突现主题、主题聚类与代表论文 */
function ReportView({ language }: { language: Language }) {
  const [weeks, setWeeks] = useState<string[]>([])
  const [week, setWeek] = useState('')
  const [report, setReport] = useState<WeeklyReport | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/analysis/reports.json`)
      .then((res) => {
        if (!res.ok) throw new Error('周报数据尚未生成')
        return res.json()
      })
      .then((d: ReportIndex) => {
        setWeeks(d.weeks)
        if (d.weeks.length > 0) setWeek(d.weeks[0])
        else setError('暂无周报')
      })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!week) return
    setReport(null)
    fetch(`${import.meta.env.BASE_URL}data/analysis/report-${week}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`无法加载 ${week} 的周报`)
        return res.json()
      })
      .then(setReport)
      .catch((e) => setError(e.message))
  }, [week])

  if (error) {
    return <p className="py-20 text-center text-sm text-gray-400 dark:text-parchment-muted">{error}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-500 dark:text-parchment-muted">选择周:</label>
        <select
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition-colors focus:border-amber-gold/50 dark:border-ink-lighter/50 dark:bg-ink-light dark:text-parchment"
        >
          {weeks.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        {report && (
          <span className="text-sm text-gray-500 dark:text-parchment-muted">
            共 <span className="font-semibold text-gray-900 dark:text-parchment">{report.paperCount}</span> 篇论文
          </span>
        )}
      </div>

      {!report ? (
        <p className="py-20 text-center text-sm text-gray-400 dark:text-parchment-muted">加载周报中…</p>
      ) : (
        <>
          <section className="rounded-xl border border-gray-100 bg-white p-4 dark:border-ink-lighter/30 dark:bg-ink-light sm:p-6">
            <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-parchment">热点术语</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {report.topPhrases.map((t) => (
                <span key={t.term}
                  className="rounded-full border border-amber-gold/40 bg-amber-gold/10 px-3 py-1 text-xs text-gray-700 dark:text-parchment">
                  {t.term}
                  <span className="ml-1.5 text-amber-gold">{t.count}</span>
                </span>
              ))}
            </div>
          </section>

          {report.bursts.length > 0 && (
            <section className="rounded-xl border border-gray-100 bg-white p-4 dark:border-ink-lighter/30 dark:bg-ink-light sm:p-6">
              <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-parchment">突现主题</h2>
              <p className="mt-1 text-xs text-gray-400 dark:text-parchment-muted">
                本周占比相对前 4 周显著上升的主题，反映正在兴起的研究点
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-400 dark:border-ink-lighter/30 dark:text-parchment-muted">
                      <th className="py-2 pr-4 font-medium">主题</th>
                      <th className="py-2 pr-4 font-medium">本周篇数</th>
                      <th className="py-2 pr-4 font-medium">前4周累计</th>
                      <th className="py-2 font-medium">提升倍数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.bursts.map((b) => (
                      <tr key={b.term} className="border-b border-gray-50 dark:border-ink-lighter/20">
                        <td className="py-2 pr-4 text-gray-900 dark:text-parchment">{b.term}</td>
                        <td className="py-2 pr-4 text-gray-500 dark:text-parchment-muted">{b.count}</td>
                        <td className="py-2 pr-4 text-gray-500 dark:text-parchment-muted">{b.baselineCount}</td>
                        <td className="py-2 text-amber-gold">×{b.lift}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold text-gray-900 dark:text-parchment">
              本周主题地图
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {report.clusters.map((c, i) => (
                <div key={i}
                  className="rounded-xl border border-gray-100 bg-white p-4 dark:border-ink-lighter/30 dark:bg-ink-light">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-parchment">
                      {c.terms.slice(0, 4).join(' / ')}
                    </h3>
                    <span className="shrink-0 rounded-full bg-amber-gold/15 px-2 py-0.5 text-xs text-amber-gold">
                      {c.size} 篇
                    </span>
                  </div>
                  <ul className="mt-3 flex flex-col gap-2">
                    {c.representatives.map((p) => (
                      <li key={p.id}>
                        <a href={p.absUrl} target="_blank" rel="noreferrer"
                          className="text-sm leading-snug text-gray-600 transition-colors hover:text-amber-gold dark:text-parchment-muted dark:hover:text-amber-gold-light">
                          {language === 'cn' ? p.titleCn || p.title : p.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

export default ReportView
