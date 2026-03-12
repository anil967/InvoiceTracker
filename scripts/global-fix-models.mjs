import fs from 'fs';
import path from 'path';

const directories = ['app/api', 'lib'];
const fileExts = ['.js', '.jsx', '.ts', '.tsx'];

function processDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.next') {
                processDirectory(fullPath);
            }
        } else if (fileExts.includes(path.extname(file))) {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('.model.')) {
                console.log(`Fixing: ${fullPath}`);
                const newContent = content.replace(/\.model\./g, '.');
                fs.writeFileSync(fullPath, newContent, 'utf8');
            }
        }
    }
}

console.log('🚀 Starting global model access fix...');
directories.forEach(processDirectory);
console.log('✅ Global fix completed!');
