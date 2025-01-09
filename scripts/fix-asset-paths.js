import fs from 'fs';
import path from 'path';

function fixAssetPaths(directory) {
  const htmlFiles = fs.readdirSync(directory)
    .filter(file => file.endsWith('.html'));

  htmlFiles.forEach(file => {
    const filePath = path.join(directory, file);
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(
      /\/_next\//g, 
      'https://www.henryany.com/_next/'
    );
    fs.writeFileSync(filePath, content);
  });
}

fixAssetPaths('./out');