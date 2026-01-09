export interface PostListItem {
  id: string;
  title: string;
  category: string;
  author: string;
  date: string;
  views: number;
  likes: number;
  comments: number;
}

export interface RawPost extends PostListItem {
  content: string;
  contentText: string;
  images: ImageRef[];
  url: string;
  crawledAt: string;
}

export interface ImageRef {
  url: string;
  localPath?: string;
  alt?: string;
}

export interface CrawlOptions {
  pages?: number;
  category?: string;
  delay?: number;
}
