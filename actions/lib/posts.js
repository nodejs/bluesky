import AtpAgent, { AppBskyFeedPost, BlobRef, RichText } from "@atproto/api";
import assert from 'node:assert';
import * as cheerio from 'cheerio';

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
 * TODO(joyeecheung): support 'imageFiles' field in JSON files.
 * @param {AtpAgent} agent
 * @param {ArrayBuffer} imgData
 * @returns {BlobRef}
 */
async function uploadImage(agent, imgData) {
  const res = await agent.uploadBlob(imgData, {
    encoding: 'image/jpeg'
  });
  return res.data.blob;
}

// https://docs.bsky.app/docs/advanced-guides/posts#website-card-embeds
async function fetchEmbedUrlCard(url) {
  console.log('Fetching embed card from', url);

  // The required fields for every embed card
  const card = {
    uri: url,
    title: '',
    description: '',
  };

  try {
    // Fetch the HTML
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Failed to fetch URL: ${resp.status} ${resp.statusText}`);
    }
    const html = await resp.text();
    const $ = cheerio.load(html);

    // Parse out the "og:title" and "og:description" HTML meta tags
    const titleTag = $('meta[property="og:title"]').attr('content');
    if (titleTag) {
      card.title = titleTag;
    }

    const descriptionTag = $('meta[property="og:description"]').attr('content');
    if (descriptionTag) {
      card.description = descriptionTag;
    }

    // If there is an "og:image" HTML meta tag, fetch and upload that image
    const imageTag = $('meta[property="og:image"]').attr('content');
    if (imageTag) {
      let imgURL = imageTag;

      // Naively turn a "relative" URL (just a path) into a full URL, if needed
      if (!imgURL.includes('://')) {
        imgURL = new URL(imgURL, url).href;
      }
      card.thumb = { $TO_BE_UPLOADED: imgURL };
    }

    return {
      $type: 'app.bsky.embed.external',
      external: card,
    };
  } catch (error) {
    console.error('Error generating embed URL card:', error.message);
    throw error;
  }
}

/**
 * @typedef ReplyRequest
 * @property {string} richText
 * @property {string} replyURL
 * @property {{cid: string, uri: string}?} replyInfo
 */

/**
 * @typedef PostRequest
 * @property {string} richText
 */

/**
 * @typedef QuotePostRequest
 * @property {string} richText
 * @property {string} repostURL
 * @property {{cid: string, uri: string}?} repostInfo
 */

/**
 * It should be possible to invoked this method on the same request at least twice -
 * once to populate the facets and the embed without uploading any files if shouldUploadImage
 * is false, and then again uploading files if shouldUploadImage is true.
 * @param {AtpAgent} agent
 * @param {ReplyRequest|PostRequest|QuotePostRequest} request
 * @param {boolean} shouldUploadImage
 * @returns {AppBskyFeedPost.Record}
 */
export async function populateRecord(agent, request, shouldUploadImage = false) {
  console.log(`Generating record, shouldUploadImage = ${shouldUploadImage}, request = `, request);

  if (request.repostURL && !request.repostInfo) {
    request.repostInfo = await getPostInfoFromUrl(agent, request.repostURL);
  }
  if (request.replyURL && request.replyURL !== REPLY_IN_THREAD && !request.replyInfo) {
    request.replyInfo = await getPostInfoFromUrl(agent, request.replyURL);
  }

  if (request.richText && !request.record) {
    // TODO(joyeecheung): When Bluesky supports markdown or snippets, we should render the text
    // as markdown.
    const rt = new RichText({ text: request.richText });

    await rt.detectFacets(agent); // automatically detects mentions and links
  
    const record = {
      $type: 'app.bsky.feed.post',
      text: rt.text,
      facets: rt.facets,
      createdAt: new Date().toISOString(),
    };
  
    // https://docs.bsky.app/docs/tutorials/creating-a-post#quote-posts
    if (request.repostInfo) {
      record.embed = {
        $type: 'app.bsky.embed.record',
        record: request.repostInfo
      };
    }
    updateReplyRecord(request, record);

    // If there is already another embed, don't generate the card embed.
    if (!record.embed) {
      // Find the first URL, match until the first whitespace or punctuation.
      const urlMatch = request.richText.match(/https?:\/\/[^\s\]\[\"\'\<\>]+/);
      if (urlMatch !== null) {
        const url = urlMatch[0];
        const card = await fetchEmbedUrlCard(url);
        record.embed = card;
      }
    }
    request.record = record;
  }

  if (shouldUploadImage && request.record?.embed?.external?.thumb?.$TO_BE_UPLOADED) {
    const card = request.record.embed.external;
    const imgURL = card.thumb.$TO_BE_UPLOADED;
    try {
      console.log('Fetching image', imgURL);
      const imgResp = await fetch(imgURL);
      if (!imgResp.ok) {
        throw new Error(`Failed to fetch image ${imgURL}: ${imgResp.status} ${imgResp.statusText}`);
      }
      const imgData = await imgResp.arrayBuffer();
      console.log('Uploading image', imgURL, 'size = ', imgData.byteLength);
      card.thumb = await uploadImage(agent, imgData);
    } catch (e) {
      // If image upload fails, post the embed card without the image, at worst we see a
      // link card without an image which is not a big deal.
      console.log(`Failed to fetch or upload image ${imgURL}`, e);
    }
  }

  console.log('Generated record');
  console.dir(request.record, { depth: 3 });

  return request;
}

function updateReplyRecord(request, record) {
  if (request.replyInfo) {
    record.reply = {
      root: request.rootInfo || request.replyInfo,
      parent: request.replyInfo,
    };
  }
  return request;
}

export function maybeUpdateReplyInThread(request, previousPostInfo, rootPostInfo) {
  if (request.replyURL === REPLY_IN_THREAD) {
    request.replyInfo = previousPostInfo;
    request.rootInfo = rootPostInfo;
    updateReplyRecord(request, request.record);
    console.log('Updated reply in thread', request);
  }
}

// If the request contains rich text with thematic breaks, it will split the request into multiple
// requests.
export function maybeSplitRequests(request) {
  if (request.action === 'repost') {  // reposts are always single posts.
    return [request];
  }
  if (!request.richText) {
    return [request];
  }
  const thread = request.richText.split(/^\s*(?:[-*_]\s*){2,}\s*$/m)
    .map((text) => text.trim())
    .filter((text) => text.length > 0);

  if (thread.length === 1) {
    return [request];
  }

  return thread.map((richText, i) => ({
      ...request,
      ...(i === 0 ? undefined : {
        action: 'reply',  // Posts other than the first one are replies.
        replyURL: REPLY_IN_THREAD,
      }),
      richText,
  }));
}

/**
 * @param {AtpAgent} agent
 * @param {object} request
 */
export async function post(agent, request) {
  const { record } = await populateRecord(agent, request, true);
  return agent.post(record);
}
