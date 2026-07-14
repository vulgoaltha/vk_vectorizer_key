const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./src');
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;
    
    // Replace imports
    const patterns = [
        { from: /@\/components\//g, to: '@/shared/components/' },
        { from: /@\/hooks\//g, to: '@/shared/hooks/' },
        { from: /@\/utils\//g, to: '@/shared/utils/' },
        { from: /@\/lib\//g, to: '@/shared/lib/' },
        { from: /@\/contexts\//g, to: '@/shared/contexts/' }
    ];
    
    patterns.forEach(p => {
        if (p.from.test(content)) {
            content = content.replace(p.from, p.to);
            changed = true;
        }
    });
    
    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated imports in', file);
    }
});
