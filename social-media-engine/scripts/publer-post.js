#!/usr/bin/env node
/**
 * Publer Post — Schedules approved posts to Instagram + Facebook via Publer API
 * Usage: node publer-post.js <image-path> <caption> <hashtags> <brand>
 * 
 * Requires: PUBLER_API_KEY in ~/.openclaw/.env
 * Publer account IDs configured below once connected
 */

const fs = require('fs');
const path = require('path');

// Load API key
const envPath = path.join(process.env.HOME, '.openclaw', '.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const PUBLER_API_KEY = envContent.match(/PUBLER_API_KEY=(.+)/)?.[1]?.trim() || process.env.PUBLER_API_KEY;

// TODO: Fill in after Publer account created + connected
const PUBLER_WORKSPACE_ID = envContent.match(/PUBLER_WORKSPACE_ID=(.+)/)?.[1]?.trim() || process.env.PUBLER_WORKSPACE_ID;
const ACCOUNT_IDS = {
  timberline: {
    instagram: envContent.match(/PUBLER_IG_ACCOUNT_ID=(.+)/)?.[1]?.trim() || '69bac86a6605c08d808cbab0',
    facebook: envContent.match(/PUBLER_FB_ACCOUNT_ID=(.+)/)?.[1]?.trim() || '69bac69bdfe1c0a7cdcb6e58'
  },
  kyro: {
    instagram: 'KYRO_IG_ACCOUNT_ID',
    facebook: 'KYRO_FB_ACCOUNT_ID'
  }
};

async function schedulePost(imagePath, caption, hashtags, brand) {
  if (!PUBLER_API_KEY || PUBLER_API_KEY === 'YOUR_KEY_HERE') {
    console.log('⚠️  Publer API key not configured yet.');
    console.log('   Add PUBLER_API_KEY=your_key to ~/.openclaw/.env');
    console.log('   Get key from: publer.io → Settings → API');
    return;
  }

  const fullCaption = `${caption}\n\n${hashtags}`;
  const accounts = ACCOUNT_IDS[brand] || ACCOUNT_IDS.timberline;

  // Upload media to Publer
  const formData = new FormData();
  formData.append('file', new Blob([fs.readFileSync(imagePath)]), path.basename(imagePath));

  const uploadRes = await fetch('https://app.publer.com/api/v1/media', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer-API ${PUBLER_API_KEY}`,
      'Publer-Workspace-Id': PUBLER_WORKSPACE_ID
    },
    body: formData
  });
  const uploadData = await uploadRes.json();
  const mediaId = uploadData.id;

  // Schedule to Instagram
  const basePost = {
    text: fullCaption,
    media_ids: [mediaId],
    post_type: 'feed',
    state: 'scheduled'
  };

  const headers = {
    'Authorization': `Bearer-API ${PUBLER_API_KEY}`,
    'Publer-Workspace-Id': PUBLER_WORKSPACE_ID,
    'Content-Type': 'application/json'
  };

  const igRes = await fetch('https://app.publer.com/api/v1/posts/schedule/publish', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...basePost, account_id: accounts.instagram })
  });
  const igData = await igRes.json();
  console.log('✅ Instagram posted:', igData.id || JSON.stringify(igData));

  const fbRes = await fetch('https://app.publer.com/api/v1/posts/schedule/publish', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...basePost, account_id: accounts.facebook })
  });
  const fbData = await fbRes.json();
  console.log('✅ Facebook posted:', fbData.id || JSON.stringify(fbData));

  return { instagram: igData.id, facebook: fbData.id };
}

const [,, imagePath, caption, hashtags, brand = 'timberline'] = process.argv;
if (!imagePath) {
  console.error('Usage: node publer-post.js <image-path> "<caption>" "<hashtags>" <brand>');
  process.exit(1);
}

schedulePost(imagePath, caption, hashtags, brand)
  .then(() => console.log('Done'))
  .catch(e => { console.error(e); process.exit(1); });
