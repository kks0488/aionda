import sharp from 'sharp';
import { readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';

const imagesDir = 'apps/web/public/images/posts';

async function convertPngToJpeg() {
  const files = await readdir(imagesDir);
  const pngFiles = files.filter(f => f.endsWith('.png'));

  console.log(`Found ${pngFiles.length} PNG files to convert...`);

  let totalBefore = 0;
  let totalAfter = 0;
  let converted = 0;

  for (const file of pngFiles) {
    const pngPath = join(imagesDir, file);
    const jpegPath = join(imagesDir, file.replace('.png', '.jpeg'));

    const statBefore = await stat(pngPath);
    totalBefore += statBefore.size;

    try {
      await sharp(pngPath)
        .jpeg({ quality: 75, mozjpeg: true })
        .toFile(jpegPath);

      const statAfter = await stat(jpegPath);
      totalAfter += statAfter.size;

      // Delete original PNG
      await unlink(pngPath);
      converted++;

      const saved = ((statBefore.size - statAfter.size) / statBefore.size * 100).toFixed(1);
      if (converted % 20 === 0) {
        console.log(`Converted ${converted}/${pngFiles.length}...`);
      }
    } catch (e) {
      console.log(`✗ ${file}: ${e.message}`);
      totalAfter += statBefore.size;
    }
  }

  console.log(`\nConverted ${converted} files`);
  console.log(`Total: ${(totalBefore/1024/1024).toFixed(1)}MB → ${(totalAfter/1024/1024).toFixed(1)}MB`);
  console.log(`Saved: ${((totalBefore-totalAfter)/1024/1024).toFixed(1)}MB (${((totalBefore-totalAfter)/totalBefore*100).toFixed(1)}%)`);
}

convertPngToJpeg();
