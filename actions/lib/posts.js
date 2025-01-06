import AtpAgent, { RichText } from "@atproto/api";
import assert from 'node:assert';

export const REPLY_IN_THREAD = Symbol('Reply in thread');

// URL format:
// 1. https://bsky.app/profile/${handle}/post/${postId}
// 2. https://bsky.app/profile/${did}/post/${postId}
// TODO(joyeecheung): consider supporting base other than bsky.app.
const kURLPattern = /https:\/\/bsky\.app\/profile\/(.+)\/post\/(.+)/;

/**
 * @param {string} url 
 */
export function validatePostURL(url) {
  const match = url.match(kURLPattern);
  assert(match, `Post URL ${url} does not match the expected pattern`);

  return {
    handle: match[1],
    postId: match[2],
    isDid: match[1].startsWith('did:')
  };
}

/**
 * @param {AtpAgent} agent 
 * @param {string} postUrl
 */
export async function getPostInfoFromUrl(agent, postUrl) {
  const { handle, postId, isDid } = validatePostURL(postUrl);
  let did;
  if (isDid) {
    did = handle;
  } else {
    const profile = await agent.resolveHandle({ handle });
    did = profile.data.did;
  }

  const postView = await agent.getPost({ repo: did, rkey: postId });
  const cid = postView.cid;

  const uri = `at://${did}/app.bsky.feed.post/${postId}`;
  return { uri, cid };
}

// URI format: at://${did}/app.bsky.feed.post/${postId}
const kURIPattern = /at:\/\/(.*)+\/app\.bsky\.feed\.post\/(.*)+/
export function validatePostURI(uri) {
  const match = uri.match(kURIPattern);
  assert(match, `Post URI ${uri} does not match the expected pattern`);

  return {
    did: match[1],
    postId: match[2]
  };
}

/**
 * @param {AtpAgent} agent
 * @param {string} uri
 */
export async function getPostURLFromURI(agent, uri) {
  const { did, postId } = validatePostURI(uri);
  const profile = await agent.getProfile({ actor: did });
  const handle = profile.data.handle;

  return `https://bsky.app/profile/${handle}/post/${postId}`;
}

/**
 * @param {AtpAgent} agent
 * @param {object} request
 */
export async function post(agent, request) {
  // TODO(joyeecheung): support images and embeds.
  // TODO(joyeecheung): When Bluesky supports markdown or snippets, we should ideally
  // read a relative path in the request containing those contents instead of reading from
  // strings in a JSON.
  const rt = new RichText({ text: request.richText });

  await rt.detectFacets(agent); // automatically detects mentions and links

  const record = {
    $type: 'app.bsky.feed.post',
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
  };

  // https://docs.bsky.app/docs/tutorials/creating-a-post#quote-posts
  if (request.repostURL) {
    if (!request.repostInfo) {
      request.repostInfo = await getPostInfoFromUrl(agent, request.repostURL);
    }
    record.embed = {
      $type: 'app.bsky.embed.record',
      record: request.repostInfo
    };
  } else if (request.replyURL) {
    if (!request.replyInfo) {
      request.replyInfo = await getPostInfoFromUrl(agent, request.replyURL);
    }
    record.reply = {
      root: request.rootInfo || request.replyInfo,
      parent: request.replyInfo,
    };
  }

  return agent.post(record);
}
