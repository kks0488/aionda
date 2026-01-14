import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { extractClaims, verifyClaimLegacy as verifyClaim, generateVerificationSummary } from './lib/deepseek.js';
import {
  formatVerificationHeader,
  formatSourcesOutput,
  getSystemMode,
  filterValidSources,
  type VerifiedSource,
  type SearchStrategy,
  SourceTier,
} from './lib/search-mode.js';

config({ path: '.env.local' });

const SELECTED_DIR = './data/selected';
const VERIFIED_DIR = './data/verified';

interface SelectedPost {
  id: string;
  title: string;
  contentText: string;
  [key: string]: unknown;
}

interface Claim {
  id: string;
  text: string;
  type: string;
  entities?: string[];
  verified: boolean;
  confidence: number;
  notes: string;
  correctedText?: string;
  sources: VerifiedSource[];
  strategy: SearchStrategy;
}

interface VerificationReport {
  postId: string;
  verifiedAt: string;
  systemMode: 'online' | 'offline';
  header: string;
  claims: Claim[];
  summary: {
    totalClaims: number;
    verifiedClaims: number;
    overallScore: number;
    sourceTierDistribution: {
      S: number;
      A: number;
      B: number;
      C: number;
    };
  };
  allSources: VerifiedSource[];
  recommendation: string;
  verificationSummary: string;
}

async function verifyPost(post: SelectedPost): Promise<VerificationReport> {
  const header = formatVerificationHeader();
  const systemMode = getSystemMode();

  console.log(`  ${header}`);
  console.log(`  📝 Extracting claims with SearchMode protocol...`);

  // Extract claims using Gemini with SearchMode
  const rawClaims = await extractClaims(post.contentText);
  console.log(`  📋 Found ${rawClaims.length} verifiable claims`);

  // Verify each claim with SearchMode
  const claims: Claim[] = [];
  const allSources: VerifiedSource[] = [];
  const tierCounts = { S: 0, A: 0, B: 0, C: 0 };

  // Parallel verification with concurrency limit
  const CONCURRENCY = 3;
  const results: any[] = [];
  
  for (let i = 0; i < rawClaims.length; i += CONCURRENCY) {
    const chunk = rawClaims.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(async (rawClaim) => {
      console.log(`  🔍 Verifying: "${rawClaim.text?.substring(0, 40)}..."`);
      const verification = await verifyClaim(rawClaim, post.contentText);
      return { rawClaim, verification };
    }));
    results.push(...chunkResults);
    // Brief pause between chunks
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  for (const { rawClaim, verification } of results) {
    // Filter valid sources (anti-hallucination)
    const validSources = filterValidSources(verification.sources);

    // Count source tiers
    for (const source of validSources) {
      tierCounts[source.tier]++;
      allSources.push(source);
    }

    const claim: Claim = {
      id: rawClaim.id || `claim_${claims.length + 1}`,
      text: rawClaim.text,
      type: rawClaim.type || 'general',
      entities: rawClaim.entities,
      verified: verification.verified,
      confidence: verification.confidence,
      notes: verification.notes,
      correctedText: verification.correctedText,
      sources: validSources,
      strategy: verification.strategy,
    };

    claims.push(claim);

    // Log verification result with tier info
    const tierIcon = validSources.length > 0
      ? validSources.map(s => s.icon).filter(Boolean).join('')
      : '❓';
    console.log(`    ${verification.verified ? '✅' : '❌'} Confidence: ${Math.round(verification.confidence * 100)}% ${tierIcon}`);

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Handle no claims case - STRICTER: low confidence for unverifiable content
  if (claims.length === 0) {
    claims.push({
      id: 'claim_1',
      text: 'General content',
      type: 'general',
      verified: false,  // Changed: unverifiable = not verified
      confidence: 0.3,  // Changed: low confidence for content without verifiable claims
      notes: 'No specific verifiable claims detected - content may be opinion/chat',
      sources: [],
      strategy: { keywords: [], focus: 'general', academicRequired: false, domainFilters: [] },
    });
    console.log('    ⚠️ No verifiable claims - marking as low confidence (0.3)');
  }

  // Calculate scores with SearchMode adjustments
  const verifiedCount = claims.filter((c) => c.verified).length;
  const avgConfidence =
    claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length;

  // Boost score for academic sources (Tier S)
  const academicBonus = tierCounts.S > 0 ? 0.1 : 0;
  const officialBonus = tierCounts.A > 0 ? 0.05 : 0;

  const overallScore = Math.min(
    1.0,
    (verifiedCount / claims.length) * 0.5 +
      avgConfidence * 0.35 +
      academicBonus +
      officialBonus
  );

  // Determine recommendation with stricter thresholds
  let recommendation: string;
  if (overallScore >= 0.8 && avgConfidence >= 0.9) {
    recommendation = 'publish';
  } else if (overallScore >= 0.6) {
    recommendation = 'publish_with_corrections';
  } else if (overallScore >= 0.4) {
    recommendation = 'needs_review';
  } else {
    recommendation = 'reject';
  }

  // Generate verification summary
  const verificationSummary = generateVerificationSummary(claims, overallScore);

  return {
    postId: post.id,
    verifiedAt: new Date().toISOString(),
    systemMode,
    header,
    claims,
    summary: {
      totalClaims: claims.length,
      verifiedClaims: verifiedCount,
      overallScore: Math.round(overallScore * 100) / 100,
      sourceTierDistribution: tierCounts,
    },
    allSources,
    recommendation,
    verificationSummary,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith('--id='));
  const targetId = idArg ? idArg.split('=')[1] : undefined;

  // Display SearchMode header
  console.log('\n' + '═'.repeat(60));
  console.log('  SearchMode Verification System');
  console.log('  Protocol: REALITY_SYNC_KERNEL_V4_GUARD');
  console.log('═'.repeat(60) + '\n');

  const header = formatVerificationHeader();
  console.log(header);
  console.log('');

  if (!existsSync(SELECTED_DIR)) {
    console.log('❌ No selected posts found. Run `pnpm select` first.');
    process.exit(1);
  }

  if (!existsSync(VERIFIED_DIR)) {
    mkdirSync(VERIFIED_DIR, { recursive: true });
  }

  // Get posts to verify
  let files = readdirSync(SELECTED_DIR).filter((f) => f.endsWith('.json'));

  if (targetId) {
    files = files.filter((f) => f.replace('.json', '') === targetId);
    if (files.length === 0) {
      console.log(`❌ Post ${targetId} not found in selected/`);
      process.exit(1);
    }
  }

  // Skip already verified
  const verifiedIds = new Set(
    existsSync(VERIFIED_DIR)
      ? readdirSync(VERIFIED_DIR)
          .filter((f) => f.endsWith('.json'))
          .map((f) => f.replace('.json', ''))
      : []
  );

  files = files.filter((f) => !verifiedIds.has(f.replace('.json', '')));

  if (files.length === 0) {
    console.log('✅ All selected posts have been verified.');
    process.exit(0);
  }

  console.log(`🔍 Verifying ${files.length} post(s) with SearchMode protocol...\n`);

  for (const file of files) {
    const postId = file.replace('.json', '');
    console.log(`📋 Post ${postId}:`);

    const post = JSON.parse(
      readFileSync(join(SELECTED_DIR, file), 'utf-8')
    ) as SelectedPost;

    try {
      const report = await verifyPost(post);

      // Merge post data with verification report
      const verifiedPost = {
        ...post,
        verification: report,
      };

      writeFileSync(
        join(VERIFIED_DIR, file),
        JSON.stringify(verifiedPost, null, 2)
      );

      // Display results
      console.log('');
      console.log('  ' + '─'.repeat(50));
      console.log(`  📊 Overall Score: ${Math.round(report.summary.overallScore * 100)}%`);
      console.log(`  📝 Claims: ${report.summary.verifiedClaims}/${report.summary.totalClaims} verified`);
      console.log(`  📌 Recommendation: ${report.recommendation.toUpperCase()}`);
      console.log('');
      console.log('  📚 Source Tier Distribution:');
      console.log(`     🏛️ Tier S (Academic): ${report.summary.sourceTierDistribution.S}`);
      console.log(`     🛡️ Tier A (Official): ${report.summary.sourceTierDistribution.A}`);
      console.log(`     ⚠️  Tier B (Caution): ${report.summary.sourceTierDistribution.B}`);
      console.log(`     Tier C (General): ${report.summary.sourceTierDistribution.C}`);
      console.log('  ' + '─'.repeat(50));

    } catch (error) {
      console.error(`  ❌ Error verifying post:`, error);
    }
    console.log('');
  }

  console.log('═'.repeat(60));
  console.log(`✨ Done! Verified posts saved to data/verified/`);
  console.log('Next step: Run `pnpm translate` to translate verified posts.');
  console.log('═'.repeat(60));
}

main().catch(console.error);
