import AtpAgent, { RichText } from "@atproto/api";

/**
 * @param {string} url 
 */
export function PostURL(url) {
  const kURLPattern = /https:\/\/bsky\.app\/profile\/(.+)\/post\/(.+)/;
  const match_url = url.match(kURLPattern);
  return {
    handle: match_url[1],
    postId: match_url[2],
    isDid: match_url[1].startsWith('did:')
  };
}

/**
 * @param {AtpAgent} agent 
 * @param {string} postUrl
 */
export async function getPostInfoFromUrl(agent, postUrl) {
  const { handle, postId, isDid } = PostURL(postUrl);
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


export function PostURI(uri) {
  const kURIPattern = /at:\/\/(.*)+\/app\.bsky\.feed\.post\/(.*)+/
  const match_uri = uri.match(kURIPattern);
  return {
    did: match_uri[1],
    postId: match_uri[2]
  };
}

/**
 * @param {AtpAgent} agent
 * @param {string} uri
 */
export async function getPostURLFromURI(agent, uri) {
  const { did, postId } = PostURI(uri);
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
      root: request.replyInfo,
      parent: request.replyInfo,
    };
  }

  return agent.post(record);
}
