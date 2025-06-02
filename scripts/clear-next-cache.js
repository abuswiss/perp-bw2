#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function deleteFolderRecursive(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
  }
}

console.log('🧹 Clearing Next.js cache...');

// Clear .next folder
const nextFolder = path.join(__dirname, '..', '.next');
if (fs.existsSync(nextFolder)) {
  deleteFolderRecursive(nextFolder);
  console.log('✅ Cleared .next folder');
} else {
  console.log('ℹ️  .next folder not found');
}

// Clear node_modules/.cache if it exists
const cacheFolder = path.join(__dirname, '..', 'node_modules', '.cache');
if (fs.existsSync(cacheFolder)) {
  deleteFolderRecursive(cacheFolder);
  console.log('✅ Cleared node_modules/.cache');
} else {
  console.log('ℹ️  node_modules/.cache not found');
}

console.log('🎉 Cache cleared! Run npm run dev to restart the development server.');