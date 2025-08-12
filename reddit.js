import 'dotenv/config';

const { REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, USER_AGENT } = process.env;

async function getToken() {
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
      'Authorization': 'Basic ' + Buffer.from(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`).toString('base64')
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' })
  });
  return res.json(); // { access_token, ... }
}

async function main() {
  const { access_token } = await getToken();

  const res = await fetch('https://oauth.reddit.com/r/programming/new?limit=5', {
    headers: {
      'Authorization': `bearer ${access_token}`,
      'User-Agent': USER_AGENT
    }
  });

  const data = await res.json();
  for (const post of data.data.children) {
    console.log(`[${post.data.subreddit}] ${post.data.title} (${post.data.url})`);
  }
}

main().catch(console.error);
