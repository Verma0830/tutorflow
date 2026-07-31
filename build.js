const fs = require('fs');
const path = require('path');

const filesToCopy = [
  'index.html',
  'app.js',
  'app.css',
  'manifest.json',
  'sw.js',
  'students.json',
  'icon-192.png',
  'icon-512.png'
];

const destDir = path.join(__dirname, 'www');

// Create www directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir);
}

// Copy files
filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(destDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to www/`);
  } else {
    console.warn(`Warning: source file ${file} does not exist.`);
  }
});
console.log('Build completed successfully!');
