#!/usr/bin/env node
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { validateRequest } from './lib/validator.js';
import { maybeSplitRequests } from './lib/posts.js';

const requestFilePath = path.resolve(process.argv[2]);
const request = JSON.parse(fs.readFileSync(requestFilePath, 'utf8'));
let richTextFile;
if (Object.hasOwn(request, 'richTextFile')) {
  assert(!path.isAbsolute(request.richTextFile));
  richTextFile = path.resolve(path.dirname(requestFilePath), request.richTextFile);
  request.richText = fs.readFileSync(richTextFile, 'utf-8');
}

assert(request.account, 'JSON must contain "account" field');
assert(typeof request.account === 'string', '"account" field must be a string');

const requests = maybeSplitRequests(request);
requests.forEach(validateRequest);

export { requests, requestFilePath, richTextFile, request };
