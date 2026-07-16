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
