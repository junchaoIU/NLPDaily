import { useState, useEffect, useCallback } from 'react'
import type { Article, ArticlesData } from './types'
import ArticleCard from './components/ArticleCard'
import SearchBar from './components/SearchBar'
import LoadingSkeleton from './components/LoadingSkeleton'

type Language = 'en' | 'cn'
type Theme = 'light' | 'dark'

interface DateIndex {
  dates: string[]
  latest: string
  updatedAt: string
}

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return 'light'
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" /><path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" /><path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
    </svg>
  )
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
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
  const [language, setLanguage] = useState<Language>('en')
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

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

      const indexRes = await fetch(`${base}data/index.json`)
      if (indexRes.ok) {
        const indexData: DateIndex = await indexRes.json()
        setAvailableDates(indexData.dates)
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
          (a.titleCn || '').toLowerCase().includes(q) ||
          (a.abstractCn || '').toLowerCase().includes(q) ||
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

  const DateSelector = () => {
    if (availableDates.length <= 1) return null

    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-parchment-muted">选择日期:</span>
        <select
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none transition-colors focus:border-amber-gold/50 dark:border-ink-lighter/50 dark:bg-ink-light dark:text-parchment"
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
    <div className="min-h-screen bg-white dark:bg-ink">
      {/* Hero Header */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md dark:border-ink-lighter/30 dark:bg-ink/80">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-amber-gold sm:text-3xl">
                学术助手
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-parchment-muted">
                arxiv NLP 每日速递
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <DateSelector />
              {/* 主题切换 */}
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="rounded-full border border-gray-200 bg-white p-1.5 text-gray-600 transition-colors hover:bg-gray-100 dark:border-ink-lighter/50 dark:bg-ink-light dark:text-parchment-muted dark:hover:text-parchment"
                title={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
              >
                {theme === 'light' ? (
                  <MoonIcon className="h-4 w-4" />
                ) : (
                  <SunIcon className="h-4 w-4" />
                )}
              </button>
              {/* 语言切换 */}
              <div className="flex items-center rounded-full border border-gray-200 bg-white p-0.5 dark:border-ink-lighter/50 dark:bg-ink-light">
                <button
                  onClick={() => setLanguage('en')}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    language === 'en'
                      ? 'bg-amber-gold text-ink'
                      : 'text-gray-500 hover:text-gray-900 dark:text-parchment-muted dark:hover:text-parchment'
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('cn')}
                  className={`rounded-full px-3 py-1 text-xs transition-colors ${
                    language === 'cn'
                      ? 'bg-amber-gold text-ink'
                      : 'text-gray-500 hover:text-gray-900 dark:text-parchment-muted dark:hover:text-parchment'
                  }`}
                >
                  中文
                </button>
              </div>
              <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500 dark:border-ink-lighter/50 dark:bg-ink-light dark:text-parchment-muted">
                {today}
              </span>
              {fetchedAt && (
                <span className="text-xs text-gray-400 dark:text-parchment-muted">
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
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-wine/30 dark:bg-wine/10">
            <p className="text-sm text-gray-700 dark:text-parchment">{error}</p>
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
            <p className="text-sm text-gray-500 dark:text-parchment-muted">
              共 <span className="font-semibold text-gray-900 dark:text-parchment">{filtered.length}</span> 篇文章
              {currentDate && (
                <span className="ml-2 text-gray-400 dark:text-parchment-muted/60">
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
              <p className="text-gray-400 dark:text-parchment-muted">没有找到匹配的文章</p>
            </div>
          ) : (
            filtered.map((article) => (
              <ArticleCard key={article.id} article={article} language={language} />
            ))
          )}
        </div>
      </main>
    </div>
  )
}

export default App
