import assert from 'node:assert';
import { getPostInfoFromUrl } from './posts.js';

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
      assert(request.richText, 'JSON must contain "richText" field');
      break;
    };
    case 'repost': {
      assert(request.repostURL, 'JSON must contain "repostURL" field');
      break;
    }
    case 'quote-post': {
      assert(request.richText, 'JSON must contain "richText" field');
      assert(request.repostURL, 'JSON must contain "repostURL" field');
      break;
    }
    case 'reply': {
      assert(request.richText, 'JSON must contain "richText" field');
      assert(request.replyURL, 'JSON must contain "replyURL" field');
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
