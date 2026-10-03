// Copies static frontend assets (index.html, styles.css) into dist/public
// so they can be served by the Express server. Run automatically by `npm run build`.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'public');
const dest = path.join(__dirname, '..', 'dist', 'public');

fs.mkdirSync(dest, { recursive: true });

for (const entry of fs.readdirSync(src)) {
  const from = path.join(src, entry);
  const to = path.join(dest, entry);
  const stat = fs.statSync(from);
  if (stat.isFile()) {
    fs.copyFileSync(from, to);
    console.log(`copied ${entry}`);
  }
}