/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const execSync = require('child_process').execSync

const manifestPath = path.join(__dirname, 'manifest.json')
const updatesPath = path.join(__dirname, 'updates.json')
const xpiPath = path.join(__dirname, 'extension-hub.xpi')

// Read manifest.json to get current version
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
const currentVersion = manifest.version

// Bump last part of the version
const versionParts = currentVersion.split('.')
versionParts[versionParts.length - 1] =
  ~~versionParts[versionParts.length - 1] + 1
const newVersion = versionParts.join('.')

console.log(`Bumping version from ${currentVersion} to ${newVersion}`)

// Update manifest.json
manifest.version = newVersion
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

// Run web-ext build
execSync('npm run xpi', { stdio: 'inherit' })

// Calculate SHA256 hash
const xpiContent = fs.readFileSync(xpiPath)
const hash = crypto
  .createHash('sha256')
  .update(xpiContent)
  .digest('hex')

// Update updates.json
const updates = JSON.parse(fs.readFileSync(updatesPath, 'utf-8'))
const update = updates.addons['extensionHub@mozilla.org'].updates[0]
update.update_hash = `sha256:${hash}`
update.version = newVersion
fs.writeFileSync(updatesPath, JSON.stringify(updates, null, 2) + '\n')

console.log(`Updated updates.json with version ${newVersion} and hash ${hash}`)
