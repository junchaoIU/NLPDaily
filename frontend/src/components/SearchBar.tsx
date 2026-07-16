interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  categories: string[]
  selectedCategory: string
  onCategoryChange: (value: string) => void
}

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

export default function SearchBar({
  value,
  onChange,
  categories,
  selectedCategory,
  onCategoryChange,
}: SearchBarProps) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-muted" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="搜索标题、作者、摘要..."
          className="w-full rounded-lg border border-ink-lighter/50 bg-ink-light py-2.5 pl-10 pr-10 text-sm text-parchment placeholder-parchment-muted outline-none transition-colors focus:border-amber-gold/50 focus:ring-1 focus:ring-amber-gold/30"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-parchment-muted hover:text-parchment"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onCategoryChange('all')}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              selectedCategory === 'all'
                ? 'bg-amber-gold text-ink'
                : 'border border-ink-lighter/30 bg-ink-light text-parchment-muted hover:text-parchment'
            }`}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`rounded-full px-3 py-1 text-xs transition-colors ${
                selectedCategory === cat
                  ? 'bg-amber-gold text-ink'
                  : 'border border-ink-lighter/30 bg-ink-light text-parchment-muted hover:text-parchment'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
