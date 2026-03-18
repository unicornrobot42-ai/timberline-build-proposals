#!/usr/bin/env node
/**
 * Caption Generator — Timberline Build Co + Kyro Digital
 * Uses OpenAI GPT-4o vision to generate captions + hashtags from images
 * Usage: node caption-generator.js <image-path-or-url> <brand>
 * Brand: "timberline" or "kyro"
 */

const fs = require('fs');
const path = require('path');

const imagePath = process.argv[2];
const brand = (process.argv[3] || 'timberline').toLowerCase();

if (!imagePath) {
  console.error('Usage: node caption-generator.js <image-path-or-url> <timberline|kyro>');
  process.exit(1);
}

// Load API key
const envPath = path.join(process.env.HOME, '.openclaw', '.env');
const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const apiKey = envContent.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim() || process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('OPENAI_API_KEY not found');
  process.exit(1);
}

const BRAND_PROMPTS = {
  timberline: {
    name: 'Timberline Build Co',
    location: 'Orange County, CA',
    tone: 'real, casual, confident — sounds like a GC who actually knows what he\'s doing and doesn\'t need to oversell it',
    cta: 'Call/text 949-229-1692',
    hashtags_base: '#TimberlineBuildCo #OrangeCountyContractor #OCRemodel #SouthOC #HomeRemodel #KitchenRemodel #BathroomRemodel #GeneralContractor #LicensedContractor #HomeImprovement #DanaPoint #SanClemente #LagunaBeach #MissionViejo #LagunaNiguel',
    voice: `Write like a real dude from OC who does beautiful remodels and is genuinely proud of his work. NOT a marketing person. NOT corporate. Think: text from a buddy who happens to be a great contractor.

The caption should NOT describe the design or materials in detail. Lead with ONE angle per post — and rotate through ALL of these, never repeating the same angle twice in a row:

ANGLE BANK (pick one, vary every post):
1. The specific trade skill shown — what's hard about this work that most people don't know
2. The neighborhood/location — local credibility, "we work in your area"
3. The client outcome — what changed for the homeowner, what problem got solved
4. Timeline / speed — how fast it got done, no dragging feet
5. The designer angle — every job has a designer, that's rare and it shows
6. The craft — what makes this particular work good, specific to what's in the photo
7. The before story — what condition the space was in (without showing it), the challenge
8. Fair OC pricing — but ONLY if not used in the last 2 posts
9. Communication — but ONLY if not used in the last 2 posts
10. A question or challenge directed at the homeowner — "still living with that old tile?"

Use the image as context to pick the most relevant angle. Use the image as a backdrop, not the subject. 

Examples of the RIGHT tone — copy this energy exactly:
- "Most contractors go quiet the second you sign. We don't. You'll hear from us before you ever have to ask. 949-229-1692 if you want that kind of job."
- "We bring a designer in on every project. Not as an add-on — just how we do it. Makes a difference. 949-229-1692."
- "Finished on schedule. In OC that feels like a miracle but it shouldn't. Call or text 949-229-1692."
- "Fair pricing in OC exists, you just gotta know where to look. 949-229-1692."
- "Before the tile went in we had the whole thing drawn out with our designer. That's why it looks like it does. 949-229-1692 if you want the same."

Bad examples — NEVER write like this:
- "This stunning bathroom transformation..."
- "Another gorgeous project complete!"
- "We take pride in delivering exceptional results..."
- "Dream kitchen? We make it happen."
- "You know what's crazy?"

Keep it 2-3 sentences. Lowercase is fine. Sounds like a text, not a press release.`
  },
  kyro: {
    name: 'Kyro Digital',
    location: 'Orange County, CA',
    tone: 'modern, bold, results-driven',
    cta: 'Link in bio',
    hashtags_base: '#KyroDigital #DigitalMarketing #OrangeCounty',
    voice: 'Modern, bold, confident. Speaks to business owners and entrepreneurs.'
  }
};

const brandConfig = BRAND_PROMPTS[brand] || BRAND_PROMPTS.timberline;

async function generateCaption() {
  let imageContent;

  if (imagePath.startsWith('http')) {
    imageContent = { type: 'image_url', image_url: { url: imagePath, detail: 'high' } };
  } else {
    const imageData = fs.readFileSync(imagePath);
    const base64 = imageData.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
    imageContent = { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } };
  }

  const prompt = `You are writing an Instagram/Facebook caption for ${brandConfig.name} in ${brandConfig.location}.

VOICE + TONE: ${brandConfig.voice}

The image is the visual. Your job is NOT to describe it — the viewer can see it. Your job is to say something real about the COMPANY that makes someone want to call.

REQUIREMENTS:
- 2-3 sentences MAX
- Do NOT start with "We" — find a more natural opener
- Do NOT describe the design, materials, colors, or finishes
- Do NOT describe the "before" state — no "this was a mess," "the kitchen was outdated," "the garage was cluttered" — that plants the wrong image in people's heads even when showing the after
- Do NOT use phrases like "stunning," "gorgeous," "beautiful transformation," "dream kitchen," or any generic remodel-speak
- DO sound like an actual person, not a brand account
- Lead with ONE thing that sets Timberline apart: clear communication, fair OC pricing, fast timelines, or working with a designer on every job
- End with the phone number naturally: ${brandConfig.cta}
- 1 emoji max, only if it actually fits — no hammers, sparkles, or house emojis

Then write "HASHTAGS:" followed by 12-15 tags.
Use these plus 3-5 specific to the job type shown: ${brandConfig.hashtags_base}

Format:
CAPTION:
[caption text]

HASHTAGS:
[hashtags]`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          imageContent,
          { type: 'text', text: prompt }
        ]
      }],
      max_tokens: 500
    })
  });

  const data = await response.json();
  if (data.error) {
    console.error('OpenAI error:', data.error.message);
    process.exit(1);
  }

  const result = data.choices[0].message.content;
  console.log(result);

  // Also output as JSON for pipeline use
  const captionMatch = result.match(/CAPTION:\n([\s\S]*?)\n\nHASHTAGS:/);
  const hashtagsMatch = result.match(/HASHTAGS:\n([\s\S]*)/);

  const output = {
    brand,
    caption: captionMatch?.[1]?.trim() || result,
    hashtags: hashtagsMatch?.[1]?.trim() || '',
    full_post: `${captionMatch?.[1]?.trim() || result}\n\n${hashtagsMatch?.[1]?.trim() || ''}`,
    generated_at: new Date().toISOString()
  };

  fs.writeFileSync('/tmp/last-caption.json', JSON.stringify(output, null, 2));
}

generateCaption().catch(e => { console.error(e); process.exit(1); });
