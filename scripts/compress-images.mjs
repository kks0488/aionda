import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

const imagesDir = 'apps/web/public/images/posts';

async function compressImages() {
  const files = await readdir(imagesDir);
  const jpegFiles = files.filter(f => f.endsWith('.jpeg') || f.endsWith('.jpg'));

  console.log(`Found ${jpegFiles.length} images to compress...`);

  let totalBefore = 0;
  let totalAfter = 0;

  for (const file of jpegFiles) {
    const filePath = join(imagesDir, file);
    const statBefore = await stat(filePath);
    totalBefore += statBefore.size;

    try {
      const buffer = await sharp(filePath)
        .jpeg({ quality: 75, mozjpeg: true })
        .toBuffer();

      await sharp(buffer).toFile(filePath);

      const statAfter = await stat(filePath);
      totalAfter += statAfter.size;

      const saved = ((statBefore.size - statAfter.size) / statBefore.size * 100).toFixed(1);
      console.log(`✓ ${file}: ${(statBefore.size/1024/1024).toFixed(2)}MB → ${(statAfter.size/1024/1024).toFixed(2)}MB (-${saved}%)`);
    } catch (e) {
      console.log(`✗ ${file}: ${e.message}`);
      totalAfter += statBefore.size;
    }
  }

  console.log(`\nTotal: ${(totalBefore/1024/1024).toFixed(1)}MB → ${(totalAfter/1024/1024).toFixed(1)}MB`);
  console.log(`Saved: ${((totalBefore-totalAfter)/1024/1024).toFixed(1)}MB (${((totalBefore-totalAfter)/totalBefore*100).toFixed(1)}%)`);
}

compressImages();
