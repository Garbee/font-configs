#!/usr/bin/env node

/*
  Build a `<font name>.mobileconfig` profile from fonts in a given directory.
  This will scan all subfolders as well.

  Inputs:
    - --version=<version>: version string for identifiers/filename
    - --dir=<directory>: directory containing font files
    - --fontname=<fontname>: name to use in profile display and identifiers
  Output:
    - <font name>.mobileconfig
*/
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const args = process.argv.slice(2);

const versionArg = args.find((arg) => arg.startsWith('--version='));
if (!versionArg) {
  console.error('No version argument provided. Please specify a version with --version=<version>.');
  process.exit(1);
}
const version = versionArg.split('=')[1].trim();

const dirArg = args.find((arg) => arg.startsWith('--dir='));
if (!dirArg) {
  console.error('No directory argument provided. Please specify a directory with --dir=<directory>.');
  process.exit(1);
}
const fontDir = dirArg.split('=')[1].trim();

const fontNameArg = args.find((arg) => arg.startsWith('--fontname='));
if (!fontNameArg) {
  console.error('No fontname argument provided. Please specify a fontname with --fontname=<fontname>.');
  process.exit(1);
}
const fontName = fontNameArg.split('=')[1].trim();

if (!fs.existsSync(fontDir) || !fs.statSync(fontDir).isDirectory()) {
  console.error(`Font directory not found: ${fontDir}`);
  process.exit(1);
}

// Recursively find all .ttf and .otf files in fontDir and subfolders
function findFontFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(findFontFiles(filePath));
    } else if (/\.(ttf|otf)$/i.test(file)) {
      results.push(filePath);
    }
  }
  return results;
}

const fontFiles = findFontFiles(fontDir).sort();
if (!fontFiles.length) {
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

const payloadsXml = fontFiles
  .map((filePath) => {
    if (!fs.statSync(filePath).isFile()) return '';
    const fn = path.basename(filePath);
    const buf = fs.readFileSync(filePath);
    const stem = path.basename(fn, path.extname(fn));
    const data64 = buf.toString('base64');
    const wrapped = data64.replace(/(.{1,68})/g, '$1\n').trim();
    return `
      <dict>
        <key>Font</key>
        <data>
          ${wrapped}
        </data>
        <key>Name</key>
        <string>${esc(fn)}</string>
        <key>PayloadIdentifier</key>
        <string>me.garbee.font.${esc(stem)}</string>
        <key>PayloadType</key>
        <string>com.apple.font</string>
        <key>PayloadVersion</key>
        <integer>1</integer>
        <key>PayloadUUID</key>
        <string>${crypto.randomUUID()}</string>
      </dict>
    `;
  })
  .join('\n');

const displayName = `${fontName} Fonts ${version}`;
const identifier = `me.garbee.fonts.${fontName.toLowerCase().replaceAll(' ', '-')}.${version}`;

const profileXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
    <dict>
      <key>PayloadContent</key>
      <array>
        ${payloadsXml}
      </array>
      <key>PayloadDescription</key>
      <string>Installs ${fontName} fonts</string>
      <key>PayloadDisplayName</key>
      <string>${esc(displayName)}</string>
      <key>PayloadIdentifier</key>
      <string>${esc(identifier)}</string>
      <key>PayloadOrganization</key>
      <string>Jonathan Garbee</string>
      <key>PayloadType</key>
      <string>Configuration</string>
      <key>PayloadUUID</key>
      <string>${crypto.randomUUID()}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </plist>
`;

const outName = `${fontName}.mobileconfig`;
fs.writeFileSync(outName, profileXml, 'utf8');
