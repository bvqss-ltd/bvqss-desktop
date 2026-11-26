// Prepares one app for building: node scripts/prepare.mjs <tender|value|damage|hse> [version]
// Writes build/app.json (which site to open), build/icon.png (from assets/icon-<app>.svg) and build/builder.json.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const key = process.argv[2];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const cfgPath = path.join(root, 'apps', key + '.json');
if (!fs.existsSync(cfgPath)) { console.error('Usage: node scripts/prepare.mjs <tender|value|damage|hse> [version]'); process.exit(1); }
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = process.argv[3] || pkg.version;
if (process.argv[3]) { pkg.version = version; fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2) + '\n'); }

const out = path.join(root, 'build'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'app.json'), JSON.stringify(cfg, null, 2));
const svg = fs.readFileSync(path.join(root, 'assets', `icon-${key}.svg`));
await sharp(svg, { density: 1200 }).resize(1024, 1024).png().toFile(path.join(out, 'icon.png'));
// Mac icons sit inside a rounded square with a margin (Apple's grid); Windows uses the full square
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(svg, { density: 1200 }).resize(824, 824).png().toBuffer(), left: 100, top: 100 }]).png().toFile(path.join(out, 'icon-mac.png'));

const slug = cfg.productName.replace(/\s+/g, '-'); // BVQSS-Tender
const builder = {
  appId: cfg.appId,
  productName: cfg.productName,
  copyright: `Copyright © ${new Date().getFullYear()} BVQSS`,
  directories: { output: 'dist', buildResources: 'build' },
  files: ['src/**', 'build/app.json', 'build/icon.png', 'package.json'],
  extraMetadata: { name: 'bvqss-' + key, productName: cfg.productName, description: cfg.description, version },
  publish: [{ provider: 'github', owner: 'bvqss-ltd', repo: 'bvqss-desktop', channel: key, releaseType: 'release' }],
  generateUpdatesFilesForAllChannels: false,
  artifactName: `${slug}-\${version}-\${os}-\${arch}.\${ext}`,
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'build/icon.png', artifactName: `${slug}-Setup-\${version}.\${ext}` },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, createDesktopShortcut: 'always', createStartMenuShortcut: true, shortcutName: cfg.productName, uninstallDisplayName: cfg.productName, deleteAppDataOnUninstall: false },
  mac: {
    target: [{ target: 'dmg', arch: ['universal'] }, { target: 'zip', arch: ['universal'] }],
    icon: 'build/icon-mac.png', category: 'public.app-category.business', hardenedRuntime: true, gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist', entitlementsInherit: 'build/entitlements.mac.plist',
    extendInfo: { NSCameraUsageDescription: 'Take photos of properties and sites for your records.', NSLocationWhenInUseUsageDescription: 'Place a property on the map from where you are.', NSMicrophoneUsageDescription: 'Record video notes on site.' },
    notarize: !!process.env.APPLE_API_KEY,
  },
  // Lock down the Electron runtime so the installed app can't be repurposed to run other code
  electronFuses: {
    runAsNode: false,
    enableCookieEncryption: true,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: false,
  },
  dmg: { artifactName: `${slug}-\${version}-mac.\${ext}`, title: cfg.productName },
};
fs.writeFileSync(path.join(out, 'builder.json'), JSON.stringify(builder, null, 2));
fs.writeFileSync(path.join(out, 'entitlements.mac.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>com.apple.security.cs.allow-jit</key><true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
  <key>com.apple.security.device.camera</key><true/>
  <key>com.apple.security.device.audio-input</key><true/>
  <key>com.apple.security.personal-information.location</key><true/>
  <key>com.apple.security.network.client</key><true/>
</dict></plist>
`);
console.log(`Prepared ${cfg.productName} ${version}`);
