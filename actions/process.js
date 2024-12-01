import fs from 'node:fs';
import assert from 'node:assert';
import process from 'node:process';
import path from 'node:path';
import { login } from './lib/login.js';
import { post } from './lib/posts.js';
import { validateAccount, validateRequest, validateAndExtendRequestReferences } from './lib/validator.js';

// This script takes a path to a JSON with the pattern $base_path/new/$any_name.json,
// where $any_name can be anything, and then performs the action specified in it.
// If the action succeeds, it moves the JSON file to
// $base_path/processed/$YYYY-$MM-$DD-$ID.json, where $ID is an incremental number
// starting from 0 based on the number of existing JSONs processed on the same date
// and already in the processed directory.

assert(process.argv[2], `Usage: node process.js $base_path/new/$any_name.json`);
const { agent, request, requestFilePath } = await import('./login-and-validate.js');

let result;
switch(request.action) {
  case 'post': {
    console.log(`Posting...`, request.richText);
    result = await post(agent, request);
    break;
  };
  case 'repost': {
    console.log('Reposting...', request.repostURL);
    assert(request.repostInfo);  // Extended by validateAndExtendRequestReferences.
    result = await agent.repost(request.repostInfo.uri, request.repostInfo.cid);
    break;
  }
  case 'quote-post': {
    console.log(`Quote posting...`, request.repostURL, request.richText);
    result = await post(agent, request);
    break;
  }
  case 'reply': {
    console.log(`Replying...`, request.replyURL, request.richText);
    result = await post(agent, request);
    break;
  }
  default:
    assert.fail('Unknown action ' + request.action);
}

console.log('Result', result);
// Extend the result to be written to the processed JSON file.
request.result = result;

const date = (new Date()).toISOString().split('T')[0];

const processedDir = path.join(requestFilePath, '..', '..', 'processed');
// Make sure the processed directory exists.
if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

// Find all processed files for the current date to generate the next incremental ID.
const filesForDate = fs.readdirSync(processedDir).filter(
  (file) => file.startsWith(date) && file.endsWith('.json')
);
const nextId = filesForDate.length;

// Construct the new file path as $base_path/processed/YYYY-MM-DD-ID.json
const newFileName = `${date}-${nextId}.json`;
const newFilePath = path.join(processedDir, newFileName);

console.log('Writing..', requestFilePath);
fs.writeFileSync(requestFilePath, JSON.stringify(request, null, 2), 'utf8');

console.log(`Moving..${requestFilePath} -> ${newFilePath}`);
fs.renameSync(requestFilePath, newFilePath);

console.log(`Processed and moved file: ${requestFilePath} -> ${newFilePath}`);
