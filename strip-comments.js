import fs from 'fs';
import path from 'path';
import strip from 'strip-comments';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.next') && !file.includes('dist') && !file.includes('.git')) {
        results = results.concat(walk(file));
      }
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'apps')).concat(walk(path.join(__dirname, 'packages')));
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = strip(content);
  fs.writeFileSync(file, content);
});
console.log('Stripped comments from ' + files.length + ' files.');
