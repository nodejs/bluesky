#!/usr/bin/env node
const [,,
  repo,
  branch,
  parentCommitSha,
  modifiedOrAddedFiles,
  deletedFiles,
  commit_title,
  commit_body,
] = process.argv;

console.log({
  repo,
  branch,
  parentCommitSha,
  commit_title,
  commit_body,
  modifiedOrAddedFiles,
  deletedFiles,
});

import { readFileSync } from 'node:fs';
import util from 'node:util';

const query = `
mutation ($repo: String! $branch: String!, $parentCommitSha: GitObjectID!, $changes: FileChanges!, $commit_title: String!, $commit_body: String) {
  createCommitOnBranch(input: {
    branch: {
      repositoryNameWithOwner: $repo,
      branchName: $branch
    },
    message: {
      headline: $commit_title,
      body: $commit_body
    },
    expectedHeadOid: $parentCommitSha,
    fileChanges: $changes
  }) {
    commit {
      url
    }
  }
}
`;
const response = await fetch(process.env.GITHUB_GRAPHQL_URL, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.GH_TOKEN}`,
  },
  body: JSON.stringify({
    query,
    variables: {
      repo,
      branch,
      parentCommitSha,
      commit_title,
      commit_body,
      changes: {
        additions: modifiedOrAddedFiles.split('\n').filter(Boolean)
          .map(path => ({ path, contents: readFileSync(path).toString('base64') })),
        deletions: deletedFiles.split('\n').filter(Boolean).map(path => ({ path })),
      }
    },
  })
});
if (!response.ok) {
  console.log({statusCode: response.status, statusText: response.statusText});
  process.exitCode ||= 1;
}
const data = await response.json();
if (data.errors?.length) {
  throw new Error('Endpoint returned an error', { cause: data });
}
console.log(util.inspect(data, { depth: Infinity }));
