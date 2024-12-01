import fs from 'node:fs';
import process from 'node:process';
import path from 'node:path';
import { login } from './lib/login.js';
import { validateAccount, validateRequest, validateAndExtendRequestReferences } from './lib/validator.js';

// The JSON file must contains the following fields:
// - "account": a string field indicating the account to use to perform the action.
//              For it to work, this script expects BLUESKY_IDENTIFIER_$account and
//              BLUESKY_APP_PASSWORD_$account to be set in the environment variables.
// - "action": currently "post", "repost", "quote-post", "reply" are supported.

const requestFilePath = path.resolve(process.argv[2]);
const request = JSON.parse(fs.readFileSync(requestFilePath, 'utf8'));

// Validate the account field.
const account = validateAccount(request, process.env);
validateRequest(request);

// Authenticate.
const agent = await login(account);

// Validate and extend the post URLs in the request into { cid, uri } records.
await validateAndExtendRequestReferences(agent, request);

export { agent, request, requestFilePath };
