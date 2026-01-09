import axios from 'axios';
import { parsePostList, parsePostDetail } from './parser.js';
import type { PostListItem, RawPost, CrawlOptions } from './types.js';

const BASE_URL = 'https://gall.dcinside.com';
const GALLERY_ID = 'thesingularity';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  Referer: 'https://gall.dcinside.com/',
};

export async function fetchPostList(
  options: CrawlOptions = {}
): Promise<PostListItem[]> {
  const { pages = 1, category, delay = 1000 } = options;
  const allPosts: PostListItem[] = [];

  for (let page = 1; page <= pages; page++) {
    let url = `${BASE_URL}/mgallery/board/lists?id=${GALLERY_ID}&page=${page}`;
    if (category) {
      url += `&search_head=${encodeURIComponent(category)}`;
    }

    try {
      await sleep(delay);
      const response = await axios.get(url, { headers, timeout: 10000 });
      const posts = parsePostList(response.data);
      allPosts.push(...posts);
      console.log(`Page ${page}: ${posts.length} posts found`);
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
    }
  }

  return allPosts;
}

export async function fetchPostDetail(
  postId: string,
  delay = 1000
): Promise<RawPost | null> {
  const url = `${BASE_URL}/mgallery/board/view/?id=${GALLERY_ID}&no=${postId}`;

  try {
    await sleep(delay);
    const response = await axios.get(url, { headers, timeout: 10000 });
    return parsePostDetail(response.data, postId, url);
  } catch (error) {
    console.error(`Error fetching post ${postId}:`, error);
    return null;
  }
}
