import fs from 'node:fs';
import process from 'node:process';
import path from 'node:path';
import { validateRequest } from './lib/validator';
import assert from 'node:assert';

const requestFilePath = path.resolve(process.argv[2]);
const request = JSON.parse(fs.readFileSync(requestFilePath, 'utf8'));

//Check the format of the request
validateRequest(request);


// URL format:
// 1. https://bsky.app/profile/${handle}/post/${postId}
// 2. https://bsky.app/profile/${did}/post/${postId}
// TODO(joyeecheung): consider supporting base other than bsky.app.
const kURLPattern = /https:\/\/bsky\.app\/profile\/(.+)\/post\/(.+)/;
let url;
if (request.action!='post'){
    switch(request.action) {
        case 'repost':
        case 'quote-post': {
          url=request.repostURL;
          break;
        }
        case 'reply': {
          url=request.replyURL;
          break;
        }
        default:
          break;
      }
    match_url = url.match(kURLPattern);
    assert(match_url, `Post URL ${url} does not match the expected pattern`);
}







// // URI format: at://${did}/app.bsky.feed.post/${postId}
// const kURIPattern = /at:\/\/(.*)+\/app\.bsky\.feed\.post\/(.*)+/

// const match_uri = uri.match(kURIPattern);
// assert(match_uri, `Post URI ${uri} does not match the expected pattern`);