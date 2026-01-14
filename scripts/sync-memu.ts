/**
 * sync-memu.ts - 기존 포스트들을 memU에 동기화
 *
 * 사용법: pnpm sync-memu
 */

import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { saveAfterPublish, checkMemuHealth } from './lib/memu-client';

const POSTS_DIR = path.join(__dirname, '../apps/web/content/posts/ko');

async function syncPosts() {
  console.log('🔄 memU 동기화 시작...\n');

  // memU 상태 확인
  const isHealthy = await checkMemuHealth();
  if (!isHealthy) {
    console.error('❌ memU 서버가 실행 중이 아닙니다.');
    console.log('   memU 서버를 먼저 시작하세요: cd ~/projects/memu && docker compose up -d');
    process.exit(1);
  }

  // 포스트 파일 목록
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'));
  console.log(`📁 발견된 포스트: ${files.length}개\n`);

  let synced = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = path.join(POSTS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data, content: body } = matter(content);

    const title = data.title || file.replace('.mdx', '');
    const slug = data.slug || file.replace('.mdx', '');

    // 본문에서 첫 2000자 추출 (마크다운 헤더 제거)
    const cleanBody = body
      .replace(/^---[\s\S]*?---/, '') // frontmatter 제거
      .replace(/^#+\s.*/gm, '') // 헤더 제거
      .replace(/\n{3,}/g, '\n\n') // 여러 줄바꿈 정리
      .trim()
      .slice(0, 2000);

    try {
      const saved = await saveAfterPublish(title, cleanBody, slug);
      if (saved) {
        synced++;
        console.log(`✅ [${synced}/${files.length}] ${slug}`);
      } else {
        failed++;
        console.log(`⚠️ [${synced}/${files.length}] ${slug} - 저장 실패`);
      }
    } catch (error: any) {
      failed++;
      console.log(`❌ [${synced}/${files.length}] ${slug} - ${error.message}`);
    }

    // Rate limiting (memU 서버 부하 방지)
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log('\n========================================');
  console.log(`✅ 동기화 완료: ${synced}개`);
  console.log(`❌ 실패: ${failed}개`);
  console.log('========================================\n');
}

syncPosts().catch(console.error);
