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
            let content = fs.readFileSync(fullPath, 'utf8');
            let changed = false;

            // Fix { Users } named import from @/models/Users (which is default export)
            const oldImport1 = "import { Users } from '@/models/Users'";
            const newImport1 = "import Users from '@/models/Users'";
            const oldImport2 = 'import { Users } from "@/models/Users"';
            const newImport2 = 'import Users from "@/models/Users"';

            if (content.includes(oldImport1)) {
                content = content.replace(oldImport1, newImport1);
                changed = true;
            }
            if (content.includes(oldImport2)) {
                content = content.replace(oldImport2, newImport2);
                changed = true;
            }

            if (changed) {
                console.log(`Fixed Users import in: ${fullPath}`);
                fs.writeFileSync(fullPath, content, 'utf8');
            }
        }
    }
}

console.log('🚀 Fixing Users named imports...');
directories.forEach(processDirectory);
console.log('✅ Done!');
