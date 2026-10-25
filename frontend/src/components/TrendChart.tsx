import type { TrendTopic } from '../types'

export const CHART_COLORS = [
  '#d4a853', '#5b8def', '#4fb286', '#d4677a',
  '#9b7ede', '#e08b4e', '#4fb3c9', '#a3b18a',
  '#c98bb9', '#7f8c8d', '#b8574c', '#6a8caf',
  '#8fbf6b', '#c9a227', '#5ec2b7',
]

interface Props {
  weeks: string[]
  topics: TrendTopic[]
  selected: string[]
}

/** 纯 SVG 多主题折线图，无第三方图表依赖 */
function TrendChart({ weeks, topics, selected }: Props) {
  const W = 860
  const H = 320
  const pad = { left: 44, right: 16, top: 16, bottom: 40 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const visible = topics.filter((t) => selected.includes(t.term))
  const maxVal = Math.max(
    5,
    ...visible.flatMap((t) => t.weekly),
  )
  const yTicks = 4
  const x = (i: number) =>
    pad.left + (weeks.length <= 1 ? innerW / 2 : (i * innerW) / (weeks.length - 1))
  const y = (v: number) => pad.top + innerH - (v / maxVal) * innerH

  if (weeks.length === 0) return null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="主题趋势图">
      {/* 横向网格与 Y 轴刻度 */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const v = Math.round((maxVal / yTicks) * i)
        return (
          <g key={i}>
            <line
              x1={pad.left} x2={W - pad.right}
              y1={y(v)} y2={y(v)}
              className="stroke-gray-200 dark:stroke-ink-lighter/50"
              strokeWidth={1}
            />
            <text x={pad.left - 8} y={y(v) + 4} textAnchor="end"
              className="fill-gray-400 dark:fill-parchment-muted" fontSize={11}>
              {v}
            </text>
          </g>
        )
      })}
      {/* X 轴周标签 */}
      {weeks.map((w, i) => (
        <text key={w} x={x(i)} y={H - 14} textAnchor="middle"
          className="fill-gray-400 dark:fill-parchment-muted" fontSize={11}>
          {w.slice(5)}
        </text>
      ))}
      {/* 各主题折线 */}
      {visible.map((t) => {
        const color = CHART_COLORS[topics.indexOf(t) % CHART_COLORS.length]
        const points = t.weekly.map((v, i) => `${x(i)},${y(v)}`).join(' ')
        return (
          <g key={t.term}>
            <polyline points={points} fill="none" stroke={color}
              strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {t.weekly.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={color}>
                <title>{`${t.term} · ${weeks[i]}: ${v} 篇`}</title>
              </circle>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

export default TrendChart
