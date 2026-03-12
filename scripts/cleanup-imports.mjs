import fs from 'fs';
import path from 'path';

const directories = ['app/api', 'lib'];
const fileExts = ['.js', '.jsx', '.ts', '.tsx'];

const mapping = {
    // Admin category
    "@/models/Vendor": "@/models/Admin",
    "@/models/Project": "@/models/Admin",
    "@/models/PurchaseOrder": "@/models/Admin",
    "@/models/RateCard": "@/models/Admin",
    "@/models/Delegation": "@/models/Admin",
    "@/models/AuditTrail": "@/models/Admin",

    // Internal category
    "@/models/Otp": "@/models/Internal",
    "@/models/DocumentUpload": "@/models/Internal",
    "@/models/Notification": "@/models/Internal",
    "@/models/Message": "@/models/Internal",
    "@/models/Annexure": "@/models/Internal",

    // Users category
    "@/models/User": "@/models/Users"
};

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

            for (const [oldPath, newPath] of Object.entries(mapping)) {
                // Handle both single and double quotes
                const oldPathSingle = `'${oldPath}'`;
                const oldPathDouble = `"${oldPath}"`;
                const newPathSingle = `'${newPath}'`;
                const newPathDouble = `"${newPath}"`;

                if (content.includes(oldPathSingle)) {
                    content = content.split(oldPathSingle).join(newPathSingle);
                    changed = true;
                }
                if (content.includes(oldPathDouble)) {
                    content = content.split(oldPathDouble).join(newPathDouble);
                    changed = true;
                }
            }

            if (changed) {
                console.log(`Updated imports in: ${fullPath}`);
                fs.writeFileSync(fullPath, content, 'utf8');
            }
        }
    }
}

console.log('🚀 Starting legacy import cleanup...');
directories.forEach(processDirectory);
console.log('✅ Legacy import cleanup completed!');
