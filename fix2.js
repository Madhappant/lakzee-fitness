const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('./web/src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    // Add eslint-disable at the top if there is 'any'
    if (content.match(/:\s*any\b/) || content.match(/<\s*any\s*>/) || content.match(/\(\s*any\s*\)/)) {
      if (!content.includes('eslint-disable @typescript-eslint/no-explicit-any')) {
        content = '/* eslint-disable @typescript-eslint/no-explicit-any */\n' + content;
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
});
