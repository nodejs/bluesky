// This runs the actions on an actual account.
// It expects BLUESKY_APP_PASSWORD_$account and BLUESKY_IDENTIFIER_$account
// environment variables to be set.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import assert from 'node:assert';

const tmpdir = path.join(import.meta.dirname, '.tmp');
const newDir = path.join(tmpdir, 'new');
const processedDir = path.join(tmpdir, 'processed');
const processPath = path.join(import.meta.dirname, '..', 'process.js');

// Create the directory layout:
// - .tmp
//   - new
//   - processed

fs.mkdirSync(newDir, { recursive: true });
fs.mkdirSync(processedDir, { recursive: true });

function checkProcess(exec, args) {
  console.log('Running', exec, ...args);
  const child = spawnSync(exec, args);
  console.log('--- stderr ---');
  console.log(child.stderr.toString());
  console.log('--- stdout ---');
  console.log(child.stdout.toString());
  console.log(`--- status: ${child.status}, signal: ${child.signal} ---`);
  assert.strictEqual(child.status, 0);
  return child;
}

async function getURLFromLastResult(lastStdout) {
  lastStdout = lastStdout.toString();
  const postMatch = lastStdout.match(/Processed and moved file: (.*) -> (.*)/);
  assert(postMatch);
  const processed = loadJSON(postMatch[2]);
  assert(processed.result.uri);
  const uriParts = processed.result.uri.split('/');
  const postId = uriParts[uriParts.length - 1];
  const handle = process.env[`BLUESKY_IDENTIFIER_${processed.account}`];
  assert(handle);
  return `https://bsky.app/profile/${handle}/post/${postId}`;
}

function loadJSON(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

// TODO(joyeecheung): move the examples here?
const examplesDir = path.join(import.meta.dirname, 'examples', 'new');

// Test posting.
const postPath = path.join(newDir, 'post.json');
const postRequest = loadJSON(path.join(examplesDir, 'post.json.example'));
fs.writeFileSync(postPath, JSON.stringify(postRequest, null, 2), 'utf8');

console.log('--- Test posting ---');
console.log(postRequest);
const postChild = checkProcess(process.execPath, [ processPath, postPath ]);
const postURL = await getURLFromLastResult(postChild.stdout);
console.log(`Post URL`, postURL);

// Test quote posting the first post.
const quotePostPath = path.join(newDir, 'quote-post.json');
const quotePostRequest = loadJSON(path.join(examplesDir, 'quote-post.json.example'));
quotePostRequest.repostURL = postURL;
fs.writeFileSync(quotePostPath, JSON.stringify(quotePostRequest, null, 2), 'utf8');

console.log('--- Test quote posting the first post ---');
console.log(quotePostRequest);
const quotePostChild = checkProcess(process.execPath, [ processPath, quotePostPath ]);
const quotePostURL = await getURLFromLastResult(quotePostChild.stdout);
console.log(`Quote post URL`, quotePostURL);

// Test replying to the quote post.
const replyPath = path.join(newDir, 'reply.json');
const replyRequest = loadJSON(path.join(examplesDir, 'reply.json.example'));
replyRequest.replyURL = quotePostURL;
fs.writeFileSync(replyPath, JSON.stringify(replyRequest, null, 2), 'utf8');

console.log('--- Test replying to the quote post ---');
console.log(replyRequest);
const replyChild = checkProcess(process.execPath, [ processPath, replyPath ]);
const replyURL = await getURLFromLastResult(replyChild.stdout);
console.log(`Reply URL`, replyURL);

const repostPath = path.join(newDir, 'repost.json');
const repostRequest = loadJSON(path.join(examplesDir, 'repost.json.example'));
repostRequest.repostURL = replyURL;
fs.writeFileSync(repostPath, JSON.stringify(repostRequest, null, 2), 'utf8');

console.log('--- Test reposting the reply ---');
console.log(repostRequest);
checkProcess(process.execPath, [ processPath, repostPath ]);
// repost alone does not generate new URLs.

fs.rmSync(tmpdir, { recursive: true, force: true });
