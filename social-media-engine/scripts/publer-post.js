#!/usr/bin/env node
/**
 * Publer Post — Schedules posts to Instagram, Facebook, and GBP via Publer API
 * Usage: node publer-post.js <image-path> <caption> <scheduled-date> [brand] [platform]
 *   scheduled-date: ISO date e.g. 2026-03-19 (posts at 10am PDT)
 *   platform: instagram|facebook|google|all (default: all)
 *
 * Requires: PUBLER_API_KEY + PUBLER_WORKSPACE_ID in ~/.openclaw/.env
 *
 * API: POST /api/v1/posts/schedule
 * Payload: { bulk: { state, posts: [{ networks: { <network>: { type, text, media } }, accounts: [{ id, scheduled_at }] }] } }
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Load env
const envPath = path.join(process.env.HOME, '.openclaw', '.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const PUBLER_API_KEY = envContent.match(/PUBLER_API_KEY=(.+)/)?.[1]?.trim() || process.env.PUBLER_API_KEY;
const PUBLER_WORKSPACE_ID = envContent.match(/PUBLER_WORKSPACE_ID=(.+)/)?.[1]?.trim() || process.env.PUBLER_WORKSPACE_ID;

const ACCOUNT_IDS = {
  timberline: {
    instagram: envContent.match(/PUBLER_IG_ACCOUNT_ID=(.+)/)?.[1]?.trim() || '69bac86a6605c08d808cbab0',
    facebook:  envContent.match(/PUBLER_FB_ACCOUNT_ID=(.+)/)?.[1]?.trim() || '69bac69bdfe1c0a7cdcb6e58',
    google:    envContent.match(/PUBLER_GBP_ACCOUNT_ID=(.+)/)?.[1]?.trim() || '69bac6b8c554e9d34f8222b4'
  }
};

const NETWORK_MAP = {
  instagram: 'instagram',
  facebook: 'facebook',
  google: 'google'
};

async function uploadMedia(imagePath) {
  const formData = new FormData();
  formData.append('file', new Blob([fs.readFileSync(imagePath)]), path.basename(imagePath));

  const res = await fetch('https://app.publer.com/api/v1/media', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer-API ${PUBLER_API_KEY}`,
      'Publer-Workspace-Id': PUBLER_WORKSPACE_ID
    },
    body: formData
  });
  const data = await res.json();
  if (!data.id) throw new Error(`Media upload failed: ${JSON.stringify(data)}`);
  return data.id;
}

async function schedulePost(imagePath, caption, scheduledDate, brand = 'timberline', platform = 'all') {
  if (!PUBLER_API_KEY) throw new Error('PUBLER_API_KEY not set in ~/.openclaw/.env');

  const accounts = ACCOUNT_IDS[brand] || ACCOUNT_IDS.timberline;
  const platforms = platform === 'all' ? ['instagram', 'facebook', 'google'] : [platform];

  const mediaId = await uploadMedia(imagePath);
  console.log(`✅ Media uploaded: ${mediaId}`);

  const results = [];

  for (const plat of platforms) {
    const networkKey = NETWORK_MAP[plat];
    const accountId = accounts[plat];
    const scheduledAt = `${scheduledDate}T10:00:00-07:00`;

    const payload = {
      bulk: {
        state: 'scheduled',
        posts: [{
          networks: {
            [networkKey]: {
              type: 'photo',
              text: caption,
              media: [{ id: mediaId, type: 'image' }]
            }
          },
          accounts: [{ id: accountId, scheduled_at: scheduledAt }]
        }]
      }
    };

    const res = await fetch('https://app.publer.com/api/v1/posts/schedule', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer-API ${PUBLER_API_KEY}`,
        'Publer-Workspace-Id': PUBLER_WORKSPACE_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.job_id) {
      console.log(`✅ ${plat} scheduled for ${scheduledDate}: job ${data.job_id}`);
      results.push({ platform: plat, job_id: data.job_id, scheduled_at: scheduledAt });
    } else {
      console.error(`❌ ${plat} failed: ${JSON.stringify(data)}`);
      results.push({ platform: plat, error: data });
    }
  }

  return results;
}

const [,, imagePath, caption, scheduledDate, brand = 'timberline', platform = 'all'] = process.argv;
if (!imagePath || !caption || !scheduledDate) {
  console.error('Usage: node publer-post.js <image-path> "<caption>" <YYYY-MM-DD> [brand] [platform]');
  console.error('  platform: instagram|facebook|google|all (default: all)');
  process.exit(1);
}

schedulePost(imagePath, caption, scheduledDate, brand, platform)
  .then(results => {
    console.log('\nScheduled:', results.length, 'posts');
    process.exit(0);
  })
  .catch(e => {
    console.error(e.message);
    process.exit(1);
  });
