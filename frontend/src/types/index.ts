export interface Author {
  name: string;
  affiliation?: string;
}

export interface Article {
  id: string;
  title: string;
  authors: Author[];
  abstract: string;
  categories: string[];
  published: string;
  updated: string;
  absUrl: string;
  pdfUrl: string;
  comment?: string;
  titleCn?: string;
  abstractCn?: string;
}

export interface ArticlesData {
  articles: Article[];
  fetchedAt: string;
  count: number;
  date?: string;
  isFallback?: boolean;
}

export interface TrendTopic {
  term: string;
  terms?: string[];
  total: number;
  weekly: number[];
}

export interface TrendsData {
  generatedAt: string;
  weeks: string[];
  weeklyPaperCounts: number[];
  topics: TrendTopic[];
}

export interface ReportPaper {
  id: string;
  title: string;
  titleCn?: string;
  absUrl: string;
}

export interface TermCount {
  term: string;
  count: number;
}

export interface BurstTerm {
  term: string;
  count: number;
  baselineCount: number;
  lift: number;
  score: number;
}

export interface ReportCluster {
  terms: string[];
  size: number;
  representatives: ReportPaper[];
}

export interface WeeklyReport {
  week: string;
  generatedAt: string;
  paperCount: number;
  topTerms: TermCount[];
  topPhrases: TermCount[];
  bursts: BurstTerm[];
  clusters: ReportCluster[];
}

export interface ReportIndex {
  generatedAt: string;
  weeks: string[];
}
