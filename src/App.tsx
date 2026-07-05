import { useState, useEffect, useCallback } from 'react'
import type { Article, ArticlesData } from './types'
import ArticleCard from './components/ArticleCard'
import SearchBar from './components/SearchBar'
import LoadingSkeleton from './components/LoadingSkeleton'

interface DateIndex {
  dates: string[]
  latest: string
  updatedAt: string
}

function App() {
  const [articles, setArticles] = useState<Article[]>([])
  const [filtered, setFiltered] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')

  // 加载指定日期的数据
  const loadDateData = useCallback(async (date: string) => {
    setLoading(true)
    setError(null)
    try {
      const base = import.meta.env.BASE_URL
      const res = await fetch(`${base}data/articles-${date}.json`)
      if (!res.ok) throw new Error(`无法加载 ${date} 的数据`)
      const data: ArticlesData & { date?: string } = await res.json()
      setArticles(data.articles)
      setFiltered(data.articles)
      setFetchedAt(data.fetchedAt)
      setCurrentDate(data.date || date)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
      setArticles([])
      setFiltered([])
    } finally {
      setLoading(false)
    }
  }, [])
  // 加载索引并初始化
  const initData = useCallback(async () => {
    setLoading(true)
    try {
      // 先尝试加载 latest 文件（包含回退数据）
      const base = import.meta.env.BASE_URL
      const latestRes = await fetch(`${base}data/articles-latest.json`)
      if (latestRes.ok) {
        const data: ArticlesData & { isFallback?: boolean } = await latestRes.json()
        setArticles(data.articles)
        setFiltered(data.articles)
        setFetchedAt(data.fetchedAt)
        setCurrentDate(data.date || '')
        setSelectedDate(data.date || '')
      }

      // 加载索引获取日期列表
      const indexRes = await fetch(`${base}data/index.json`)
      if (indexRes.ok) {
        const indexData: DateIndex = await indexRes.json()
        setAvailableDates(indexData.dates)
        // 如果 latest 没加载成功，用索引的最新日期
        if (!latestRes.ok && indexData.latest) {
          setSelectedDate(indexData.latest)
          await loadDateData(indexData.latest)
        }
      }

      if (!latestRes.ok && !indexRes.ok) {
        throw new Error('没有可用的数据')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化失败')
    } finally {
      setLoading(false)
    }
  }, [loadDateData])

  useEffect(() => {
    initData()
  }, [initData])

  // 当选择日期变化时加载对应数据
  useEffect(() => {
    if (selectedDate && selectedDate !== currentDate) {
      loadDateData(selectedDate)
    }
  }, [selectedDate, currentDate, loadDateData])

  useEffect(() => {
    let result = [...articles]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.abstract.toLowerCase().includes(q) ||
          a.authors.some((au) => au.name.toLowerCase().includes(q))
      )
    }

    if (selectedCategory !== 'all') {
      result = result.filter((a) => a.categories.includes(selectedCategory))
    }

    setFiltered(result)
  }, [searchQuery, selectedCategory, articles])

  const categories = Array.from(
    new Set(articles.flatMap((a) => a.categories))
  ).sort()

  const today = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  // 日期选择器
  const DateSelector = () => {
    if (availableDates.length <= 1) return null

    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-parchment-muted">选择日期:</span>
        <select
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-ink-lighter/50 bg-ink-light px-3 py-1.5 text-sm text-parchment outline-none transition-colors focus:border-amber-gold/50"
        >
          {availableDates.map((date) => (
            <option key={date} value={date}>
              {date}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ink">
      {/* Hero Header */}
      <header className="sticky top-0 z-50 border-b border-ink-lighter/30 bg-ink/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-amber-gold sm:text-3xl">
                学术助手
              </h1>
              <p className="mt-1 text-sm text-parchment-muted">
                arxiv NLP 每日速递
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <DateSelector />
              <span className="rounded-full border border-ink-lighter/50 bg-ink-light px-3 py-1 text-xs text-parchment-muted">
                {today}
              </span>
              {fetchedAt && (
                <span className="text-xs text-parchment-muted">
                  更新于 {new Date(fetchedAt).toLocaleString('zh-CN')}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Search & Filter */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      </div>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 rounded-lg border border-wine/30 bg-wine/10 p-4 text-center">
            <p className="text-sm text-parchment">{error}</p>
            <button
              onClick={() => initData()}
              className="mt-2 text-sm text-amber-gold underline underline-offset-2 hover:text-amber-gold-light"
            >
              重试
            </button>
          </div>
        )}

        {!error && !loading && (
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-parchment-muted">
              共 <span className="font-semibold text-parchment">{filtered.length}</span> 篇文章
              {currentDate && (
                <span className="ml-2 text-parchment-muted/60">
                  · {currentDate}
                </span>
              )}
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <LoadingSkeleton key={i} />
            ))
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <p className="text-parchment-muted">没有找到匹配的文章</p>
            </div>
          ) : (
            filtered.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))
          )}
        </div>
      </main>
    </div>
  )
}

export default App
