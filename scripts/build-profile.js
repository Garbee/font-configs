/*
  Build a .mobileconfig profile from fonts in monaspace_release.
  Inputs:
    - env MONASPACE_VERSION: optional version string for identifiers/filename
  Output:
    - monaspace-fonts-<version>.mobileconfig (or monaspace-fonts.mobileconfig)
*/
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const version = (process.env.MONASPACE_VERSION || '').trim();
const fontDir = 'monaspace_release';

if (!fs.existsSync(fontDir) || !fs.statSync(fontDir).isDirectory()) {
  console.error(`Font directory not found: ${fontDir}`);
  process.exit(1);
}

const fonts = fs
  .readdirSync(fontDir)
  .filter((fn) => /\.(ttf|otf)$/i.test(fn))
  .sort();

if (!fonts.length) {
  console.error('No .ttf or .otf fonts found to include in the profile.');
  process.exit(2);
}

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const payloadsXml = fonts
  .map((fn) => {
    const filePath = path.join(fontDir, fn);
    if (!fs.statSync(filePath).isFile()) return '';
    const buf = fs.readFileSync(filePath);
    const stem = path.basename(fn, path.extname(fn));
    const data64 = buf.toString('base64');
    // Wrap base64 to reasonable line length for plist readability
    const wrapped = data64.replace(/(.{1,68})/g, '$1\n').trim();
    return (
      '        <dict>\n' +
      '          <key>Font</key>\n' +
      '          <data>\n' +
      wrapped +
      '\n          </data>\n' +
      '          <key>Name</key>\n' +
      `          <string>${esc(fn)}</string>\n` +
      '          <key>PayloadIdentifier</key>\n' +
      `          <string>me.garbee.monaspace.font.${esc(stem)}</string>\n` +
      '          <key>PayloadType</key>\n' +
      '          <string>com.apple.font</string>\n' +
      '          <key>PayloadUUID</key>\n' +
      `          <string>${crypto.randomUUID()}</string>\n` +
      '          <key>PayloadVersion</key>\n' +
      '          <integer>1</integer>\n' +
      '        </dict>'
    );
  })
  .join('\n');

const displayName = version ? `Monaspace Fonts ${version}` : 'Monaspace Fonts';
const identifier = version
  ? `me.garbee.monaspace.${version}`
  : 'me.garbee.monaspace';

const profileXml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
  '<plist version="1.0">\n' +
  '  <dict>\n' +
  '    <key>PayloadContent</key>\n' +
  '    <array>\n' +
  payloadsXml +
  '\n' +
  '    </array>\n' +
  '    <key>PayloadDescription</key>\n' +
  '    <string>Installs Monaspace variable fonts.</string>\n' +
  '    <key>PayloadDisplayName</key>\n' +
  `    <string>${esc(displayName)}</string>\n` +
  '    <key>PayloadIdentifier</key>\n' +
  `    <string>${esc(identifier)}</string>\n` +
  '    <key>PayloadOrganization</key>\n' +
  '    <string>Jonathan Garbee</string>\n' +
  '    <key>PayloadType</key>\n' +
  '    <string>Configuration</string>\n' +
  '    <key>PayloadUUID</key>\n' +
  `    <string>${crypto.randomUUID()}</string>\n` +
  '    <key>PayloadVersion</key>\n' +
  '    <integer>1</integer>\n' +
  '  </dict>\n' +
  '</plist>';

const outName = version
  ? `monaspace-fonts-${version}.mobileconfig`
  : 'monaspace-fonts.mobileconfig';
fs.writeFileSync(outName, profileXml, 'utf8');
