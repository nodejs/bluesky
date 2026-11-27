#!/usr/bin/env node
import process from 'node:process';
import { login } from './lib/login.js';
import { validateAccount } from './lib/validator.js';
import { populateRecord } from './lib/posts.js';
import {
  requests,
  requestFilePath,
  richTextFile,
  request,
} from './validate-local.js';

const account = validateAccount(request, process.env);

const agent = await login(account);

await Promise.all(requests.map(req => populateRecord(agent, req, false)));

export { agent, requests, requestFilePath, richTextFile };
