import assert from 'node:assert';
import { getPostInfoFromUrl, REPLY_IN_THREAD } from './posts.js';

export function validateAccount(request, env) {
  assert(request.account, 'JSON must contain "account" field');
  const account = request.account;
  const identifierKey = `BLUESKY_IDENTIFIER_${account}`;
  const passwordKey = `BLUESKY_APP_PASSWORD_${account}`;
  assert(env[identifierKey], `Must provide ${identifierKey} in the environment variable.`);
  assert(env[passwordKey], `Must provide ${passwordKey} in the environment variable.`);
  return {
    identifier: env[identifierKey],
    password: env[passwordKey]
  };
}

/**
 * Validate the request based on the action requested.
 */
export function validateRequest(request) {
  switch(request.action) {
    case 'post': {
      assert(typeof request.richText === 'string', 'JSON must contain "richText" string field');
      assert(
        request.richText.length > 0 && request.richText.length <= 300,
        '"richText" field cannot be longer than 300 chars');
      break;
    };
    case 'repost': {
      assert(typeof request.repostURL === 'string', 'JSON must contain "repostURL" string field');
      break;
    }
    case 'quote-post': {
      assert(typeof request.richText === 'string', 'JSON must contain "richText" string field');
      assert(
        request.richText.length > 0 && request.richText.length <= 300,
        '"richText" field cannot be longer than 300 chars');
      assert(typeof request.repostURL === 'string', 'JSON must contain "repostURL" string field');
      break;
    }
    case 'reply': {
      assert(typeof request.richText === 'string', 'JSON must contain "richText" string field');
      assert(
        request.richText.length > 0 && request.richText.length <= 300,
        '"richText" field cannot be longer than 300 chars');
      assert(typeof request.replyURL === 'string', 'JSON must contain "replyURL" string field');
      break;
    }
    default:
      assert.fail('Unknown action ' + request.action);
  }
}

/**
 * @param {import('@atproto/api').AtpAgent} agent
 * @param {object} request
 * @param {string} fieldName
 */
async function validatePostURLInRequest(agent, request, fieldName) {
  if (request.replyURL === REPLY_IN_THREAD) return request.replyInfo;
  let result;
  try {
    result = await getPostInfoFromUrl(agent, request[fieldName]);
  } finally {
    if (!result) {
      console.error(`Invalid "${fieldName}" field, ${request[fieldName]}`);
    }
  }
  return result;
}

/**
 * Validate the post URLs in the request and extend them into { uri, cid } pairs
 * if necessary.
 * @param {import('@atproto/api').AtpAgent} agent 
 * @param {object} request
 */
export async function validateAndExtendRequestReferences(agent, request) {
  switch(request.action) {
    case 'repost':
    case 'quote-post': {
      const info = await validatePostURLInRequest(agent, request, 'repostURL');
      request.repostInfo = info;
      break;
    }
    case 'reply': {
      const info = await validatePostURLInRequest(agent, request, 'replyURL');
      request.replyInfo = info;
      break;
    }
    default:
      break;
  }
}
