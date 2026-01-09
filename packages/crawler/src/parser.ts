import * as cheerio from 'cheerio';
import type { PostListItem, RawPost, ImageRef } from './types.js';

export function parsePostList(html: string): PostListItem[] {
  const $ = cheerio.load(html);
  const posts: PostListItem[] = [];

  $('tr.ub-content.us-post').each((_, element) => {
    const $row = $(element);

    // Skip notice posts
    if ($row.find('.icon_notice').length > 0) return;

    const id = $row.find('.gall_num').text().trim();
    if (!id || id === '공지') return;

    const $titleLink = $row.find('.gall_tit a').first();
    const categoryText = $titleLink.find('em.icon_txt').text();
    const category = categoryText.replace(/[\[\]]/g, '').trim();

    // Get title without category
    const fullTitle = $titleLink.text();
    const title = fullTitle.replace(categoryText, '').trim();

    const author =
      $row.find('.gall_writer .nickname').text().trim() ||
      $row.find('.gall_writer').attr('data-nick') ||
      'Anonymous';

    const date = $row.find('.gall_date').text().trim();
    const views = parseInt($row.find('.gall_count').text()) || 0;
    const likes = parseInt($row.find('.gall_recommend').text()) || 0;

    const commentsText = $row.find('.reply_numbox').text();
    const comments = parseInt(commentsText.replace(/[\[\]]/g, '')) || 0;

    if (id && title) {
      posts.push({
        id,
        title,
        category,
        author,
        date,
        views,
        likes,
        comments,
      });
    }
  });

  return posts;
}

export function parsePostDetail(
  html: string,
  postId: string,
  url: string
): RawPost {
  const $ = cheerio.load(html);

  const title = $('.title_subject').text().trim() || $('title').text().trim();
  const author =
    $('.gall_writer .nickname').first().text().trim() ||
    $('.gall_writer').first().attr('data-nick') ||
    'Anonymous';

  // Get date from gall_date
  const dateText = $('.gall_date').first().text().trim();
  const date = dateText || new Date().toISOString();

  // Get content
  const $content = $('.write_div');
  const content = $content.html() || '';
  const contentText = $content.text().trim();

  // Get images
  const images: ImageRef[] = [];
  $content.find('img').each((_, img) => {
    const src = $(img).attr('src');
    if (src && !src.includes('dccon')) {
      images.push({
        url: src.startsWith('//') ? `https:${src}` : src,
        alt: $(img).attr('alt') || undefined,
      });
    }
  });

  // Get metadata from list item if available
  const $listItem = $(`tr[data-no="${postId}"]`);
  const views = parseInt($listItem.find('.gall_count').text()) || 0;
  const likes = parseInt($listItem.find('.gall_recommend').text()) || 0;
  const comments =
    parseInt($listItem.find('.reply_numbox').text().replace(/[\[\]]/g, '')) ||
    0;
  const category =
    $listItem.find('.gall_tit em.icon_txt').text().replace(/[\[\]]/g, '').trim() ||
    '';

  return {
    id: postId,
    title,
    category,
    author,
    date,
    views,
    likes,
    comments,
    content,
    contentText,
    images,
    url,
    crawledAt: new Date().toISOString(),
  };
}
