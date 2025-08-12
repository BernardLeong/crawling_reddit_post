import 'dotenv/config';
import fs from 'node:fs';
import axios from 'axios';

const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, USER_AGENT } = process.env;

async function getToken() {
  const authString = Buffer.from(
    `${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`
  ).toString('base64');

  try {
    const res = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': USER_AGENT,
          Authorization: `Basic ${authString}`,
        },
      }
    );

    return res.data;
  } catch (err) {
    if (err.response) {
      throw new Error(err.response.data ? JSON.stringify(err.response.data) : err.response.statusText);
    }
    throw err;
  }
}

async function fetchListing(token, subreddit, after = null, limit = 100) {
  const url = new URL(`https://oauth.reddit.com/r/${subreddit}/new`);
  url.searchParams.set('limit', String(Math.min(limit, 100)));
  if (after) url.searchParams.set('after', after);

  try {
    const res = await axios.get(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': USER_AGENT,
      },
      validateStatus: () => true
    });

    if (res.status === 429) {
      const retry = Number(res.headers['retry-after'] || 1);
      await new Promise(r => setTimeout(r, (retry + 1) * 1000));
      return fetchListing(token, subreddit, after, limit);
    }

    if (res.status < 200 || res.status >= 300) {
      throw new Error(
        typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
      );
    }

    return res.data;
  } catch (err) {
    if (err.response) {
      throw new Error(
        typeof err.response.data === 'string'
          ? err.response.data
          : JSON.stringify(err.response.data)
      );
    }
    throw err;
  }
}

async function main({
  subreddit = 'cscareerquestions',
  pages = 10,
  out = 'out.ndjson',
} = {}) {
  const { access_token } = await getToken();
  console.log(await getToken())
  const outStream = fs.createWriteStream(out, { flags: 'a' });

  let after = null;
  let total = 0;

  try {
    for (let i = 0; i < pages; i++) {
      const data = await fetchListing(access_token, subreddit, after, 100);
      const children = data?.data?.children ?? [];
      if (children.length === 0) break;

      for (const c of children) {
        const p = c.data;
        const rec = {
          id: p.id,
          fullname: p.name,
          subreddit: p.subreddit,
          title: p.title,
          author: p.author,
          url: `https://www.reddit.com${p.permalink}`,
          created_utc: p.created_utc,
          score: p.score,
          num_comments: p.num_comments,
        };
        outStream.write(JSON.stringify(rec) + '\n');
        console.log(`[${rec.subreddit}] ${rec.title} (${rec.url})`);
        total++;
      }

      after = data?.data?.after ?? null;
      if (!after) break;
      await new Promise(r => setTimeout(r, 700));
    }
  } finally {
    outStream.end();
  }

  console.log(`\nFetched ${total} posts → ${out}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
