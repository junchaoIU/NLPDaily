import { useState } from 'react'
import type { Article } from '../types'

interface ArticleCardProps {
  article: Article
  language?: 'en' | 'cn'
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  )
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
    </svg>
  )
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
    </svg>
  )
}

export default function ArticleCard({ article, language = 'en' }: ArticleCardProps) {
  const [expanded, setExpanded] = useState(false)

  const isCn = language === 'cn' && (article.titleCn || article.abstractCn)
  const displayTitle = isCn && article.titleCn
    ? `${article.titleCn}（${article.title}）`
    : article.title
  const displayAbstract = isCn && article.abstractCn ? article.abstractCn : article.abstract

  return (
    <div className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:border-amber-gold/50 hover:shadow-md dark:border-ink-lighter/30 dark:bg-ink-light/50 dark:hover:border-amber-gold/30 dark:hover:bg-ink-light dark:hover:shadow-lg dark:hover:shadow-amber-gold/5">
      {/* Title */}
      <h3 className="font-display text-base font-semibold leading-snug text-gray-900 transition-colors group-hover:text-amber-gold sm:text-lg dark:text-parchment dark:group-hover:text-amber-gold">
        {displayTitle}
      </h3>

      {/* Authors */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {article.authors.slice(0, 5).map((author, idx) => (
          <span
            key={idx}
            className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-ink-lighter/50 dark:text-parchment-muted"
          >
            {author.name}
          </span>
        ))}
        {article.authors.length > 5 && (
          <span className="text-xs text-gray-500 dark:text-parchment-muted">
            +{article.authors.length - 5}
          </span>
        )}
      </div>

      {/* Abstract */}
      <div className="mt-3">
        <p
          className={`font-serif-body text-sm leading-relaxed text-gray-600 transition-all dark:text-parchment-muted/80 ${
            expanded ? '' : 'line-clamp-3'
          }`}
        >
          {displayAbstract}
        </p>
      </div>

      {/* Expand / Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 flex items-center gap-1 self-start text-xs text-amber-gold/70 transition-colors hover:text-amber-gold"
      >
        {expanded ? (
          <>
            <ChevronUpIcon className="h-3.5 w-3.5" />
            收起
          </>
        ) : (
          <>
            <ChevronDownIcon className="h-3.5 w-3.5" />
            展开摘要
          </>
        )}
      </button>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-ink-lighter/20">
        <div className="flex items-center gap-2">
          {article.categories.map((cat) => (
            <span
              key={cat}
              className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-gray-500 dark:border-ink-lighter/30 dark:text-parchment-muted"
            >
              {cat}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={article.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-amber-gold dark:text-parchment-muted dark:hover:text-amber-gold"
            title="PDF"
          >
            <FileTextIcon className="h-3.5 w-3.5" />
            PDF
          </a>
          <a
            href={article.absUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-amber-gold dark:text-parchment-muted dark:hover:text-amber-gold"
            title="arxiv"
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            arxiv
          </a>
        </div>
      </div>

      {/* Date */}
      <div className="mt-2 text-[10px] text-gray-400 dark:text-parchment-muted/50">
        {new Date(article.published).toLocaleDateString('zh-CN')}
        {article.comment && (
          <span className="ml-2">· {article.comment}</span>
        )}
      </div>
    </div>
  )
}
