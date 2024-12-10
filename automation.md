# Bluesky automation

## Directory structure

Scripts for the actions are under `./actions` folder.
Records of requested and performed actions are under `./records`.

```
- .github/workflows       # Contains workflows
    - process.yml         # Process merged requests
    - validate.yml        # Validate JSON requests added in PRs to catch early errors

- actions/       # scripts for the actions
    - lib/
    - test/
        - integration.js  # This can be run locally to test process.js on a test account
    - process.js  # a script that takes a path/to/new/name.json to perform actions
    - login-and-validate.js # part of process.js, can be run alone to validate a JSON

- records/
    - new/  # Where requests can be added in the form of JSON via pull requests.
            # It contains some existing examples with the name xxx.json.example
    - processed/  # Requests in the new folder will be moved here with information
                  # about the performed actions added. The file will be renamed
                  # to YYYY-MM-DD-ID.json, where ID is incremental index for files
                  # processed on that date.
```

## Perform actions with a pull request

Content automation is done in the form of adding new JSON files to `records/new`. To submit the request:

1. Open a pull request targeting the `main` branch to add a JSON file or multiple JSON files to `records/new/`.
     - Currently, the PR branch should be opened from the nodejs repository if you have write access to it, so that the PR gets full validation using the secrets in the repository. PRs from forks cannot get a full validation due to GitHub workflow restrictions.
     - The file name can be anything, as long as it ends with `.json`, though its better to give it a descriptive name like `repost.json`. The file will be renamed and moved to `records/processed` later so it doesn't matter how it is named during the draft phase.
     - For example, see https://github.com/nodejs/bluesky/pull/8
2. The JSON files must contain at least the two required fields:
   - `"account"`: a pre-configured account name, see [repository setup](#set-up-automation-in-a-repository) on account name configuration.
     currently the following accounts are supported:
       - `NODEJS_ORG`: for [nodejs.org](https://bsky.app/profile/nodejs.org) on Bluesky
   - `"action"`: Currently, the following actions are supported:
     - `"post"`: post new content specified by `"richText"`
     - `"repost"`: repost an existing post specified by `"repostURL"`
     - `"reply"`: reply to an existing post specified by `"replyURL"`, with content specified by `"richText"`
     - `"quote-post"`: quote an existing post specified by `"repostURL"`, with new content specified by `"richText"`
   - For other fields see the examples under [`records/new`](./records/new).
3. When the PR is opened, the [validate-json](./.github/workflows/validate.yml) workflow will run to make sure the JSON files are correctly filled. It will verify the URLs filled in the JSON files are valid.
4. When the PR is merged, the [process-json](./.github/workflows/process.yml) workflow will run to perform the requested actions, and when it's done, it will move the processed JSON files to `./records/processed` and renamed the file to `YYYY-MM-DD-ID.json` where ID is an incremental ID based on the number of files already processed on that date. It will also add in additional details of the performed actions (e.g. CID and URI of the posted post).
5. When the process workflow is complete (likely within a minute), you should see a commit from the GitHub bot in the main branch moving the JSON file.

## Set up automation in a repository

1. [Set up repository secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions#creating-secrets-for-a-repository) for accounts.
    1. For each account that the automation controls, give it a name (this will be used as part of the environment variables, so ideally it should just be a capitalized word), for example `NODEJS_ORG`.
    2. Go to https://bsky.app/settings/app-passwords and create an app password for that account
    3. Set up a repository secret `BLUESKY_APP_PASSWORD_$ACCOUNT` (e.g. `BLUESKY_APP_PASSWORD_NODEJS_ORG`) to be that app password.
2. Make sure that in the GitHub workflows where `BLUESKY_APP_PASSWORD_` and `BLUESKY_APP_PASSWORD_` environment variables are used to run scripts under the `actions/` folder, the account handle and the account app password are added in there. For example:

    ```yaml
          env:
            BLUESKY_IDENTIFIER_NODEJS_ORG: nodejs.org
            BLUESKY_APP_PASSWORD_NODEJS_ORG: ${{ secrets.BLUESKY_APP_PASSWORD_NODEJS_ORG }}
    ```

  There can be multiple accounts configured in the environment variables. The GitHub actions will process JSON files with an "account" field specifying which account they want to use to perform the action.

## Develop and run tests

```console
$ nvs add 22  # Or use nvm if you prefer
$ nvs use 22
$ corepack enable
$ cd actions
$ yarn install
```

There aren't a lot of tests right now. Though to run the test locally to perform a series actions on a live test account, you could do:

```
cd ./actions
node --env-file=./.env.bluesky test/integration.js
```

All files starting with .env are ignored in this repository, you could save the credentials there, like in the `.env.bluesky` used above, if the account is named `PIXEL`, it should have:

```
BLUESKY_IDENTIFIER_PIXEL=... # The Bluesky handle
BLUESKY_APP_PASSWORD_PIXEL=... # The app password
```
