const fs = require('fs');
const path = require('path');

// Paths
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const libVersionPath = path.join(__dirname, '..', 'lib', 'version.js');
const apiVersionPath = path.join(__dirname, '..', 'app', 'api', 'version', 'route.js');

// 1. Read package.json
const packageJson = require(packageJsonPath);
const currentVersion = packageJson.version;
const versionParts = currentVersion.split('.').map(Number);

// Increment patch version
versionParts[2] += 1;
const newVersion = versionParts.join('.');

console.log(`🚀 Bumping version: ${currentVersion} -> ${newVersion}`);

// 2. Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log('✅ Updated package.json');

// 3. Update lib/version.js
let libVersionContent = fs.readFileSync(libVersionPath, 'utf8');
const libRegex = /export const APP_VERSION = process\.env\.NEXT_PUBLIC_APP_VERSION \|\| '.*';/;
libVersionContent = libVersionContent.replace(libRegex, `export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '${newVersion}';`);
fs.writeFileSync(libVersionPath, libVersionContent);
console.log('✅ Updated lib/version.js');

// 4. Update app/api/version/route.js
let apiVersionContent = fs.readFileSync(apiVersionPath, 'utf8');
const apiRegex = /const APP_VERSION = process\.env\.NEXT_PUBLIC_APP_VERSION \|\| '.*';/;
apiVersionContent = apiVersionContent.replace(apiRegex, `const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '${newVersion}';`);
fs.writeFileSync(apiVersionPath, apiVersionContent);
console.log('✅ Updated app/api/version/route.js');

console.log(`\n🎉 Ready to deploy! Run: vercel --prod`);
