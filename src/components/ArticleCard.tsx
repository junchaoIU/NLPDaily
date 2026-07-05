import { useState } from 'react'
import type { Article } from '../types'

interface ArticleCardProps {
  article: Article
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function ChevronUpIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m18 15-6-6-6 6" />
    </svg>
  )
}

function FileTextIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  )
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
    </svg>
  )
}

export default function ArticleCard({ article }: ArticleCardProps) {
  const [expanded, setExpanded] = useState(false)

  const affiliations = article.authors
    .map((a) => a.affiliation)
    .filter(Boolean)

  const uniqueAffiliations = Array.from(new Set(affiliations))

  return (
    <div className="group relative flex flex-col rounded-xl border border-ink-lighter/30 bg-ink-light/50 p-5 transition-all duration-300 hover:border-amber-gold/30 hover:bg-ink-light hover:shadow-lg hover:shadow-amber-gold/5">
      {/* Title */}
      <h3 className="font-display text-base font-semibold leading-snug text-parchment transition-colors group-hover:text-amber-gold sm:text-lg">
        {article.title}
      </h3>

      {/* Authors */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {article.authors.slice(0, 5).map((author, idx) => (
          <span
            key={idx}
            className="inline-flex items-center rounded-full bg-ink-lighter/50 px-2 py-0.5 text-xs text-parchment-muted"
            title={author.affiliation}
          >
            {author.name}
          </span>
        ))}
        {article.authors.length > 5 && (
          <span className="text-xs text-parchment-muted">
            +{article.authors.length - 5}
          </span>
        )}
      </div>

      {/* Affiliations */}
      {uniqueAffiliations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {uniqueAffiliations.slice(0, 3).map((aff, idx) => (
            <span
              key={idx}
              className="text-xs text-parchment-muted/70"
            >
              {aff}
              {idx < Math.min(uniqueAffiliations.length, 3) - 1 && (
                <span className="mx-1">·</span>
              )}
            </span>
          ))}
          {uniqueAffiliations.length > 3 && (
            <span className="text-xs text-parchment-muted/50">
              +{uniqueAffiliations.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Abstract */}
      <div className="mt-3">
        <p
          className={`font-serif-body text-sm leading-relaxed text-parchment-muted/80 transition-all ${
            expanded ? '' : 'line-clamp-3'
          }`}
        >
          {article.abstract}
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
      <div className="mt-4 flex items-center justify-between border-t border-ink-lighter/20 pt-3">
        <div className="flex items-center gap-2">
          {article.categories.map((cat) => (
            <span
              key={cat}
              className="rounded border border-ink-lighter/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-parchment-muted"
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
            className="flex items-center gap-1 text-xs text-parchment-muted transition-colors hover:text-amber-gold"
            title="PDF"
          >
            <FileTextIcon className="h-3.5 w-3.5" />
            PDF
          </a>
          <a
            href={article.absUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-parchment-muted transition-colors hover:text-amber-gold"
            title="arxiv"
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            arxiv
          </a>
        </div>
      </div>

      {/* Date */}
      <div className="mt-2 text-[10px] text-parchment-muted/50">
        {new Date(article.published).toLocaleDateString('zh-CN')}
        {article.comment && (
          <span className="ml-2">· {article.comment}</span>
        )}
      </div>
    </div>
  )
}
