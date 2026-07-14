import fs from 'fs';
import path from 'path';

const srcDir = path.join(process.cwd(), 'dist', 'client');
const destDir = path.join(process.cwd(), 'dist');

if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(destDir, file);
    fs.renameSync(srcPath, destPath);
  }
  fs.rmdirSync(srcDir);
  console.log('Moved dist/client contents to dist/');
}
