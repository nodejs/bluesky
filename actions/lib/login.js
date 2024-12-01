import { AtpAgent } from '@atproto/api';

// TODO(joyeecheung): implement OAuth
export async function login(account) {
  const agent = new AtpAgent({
    service: 'https://bsky.social'
  });

  await agent.login({
    identifier: account.identifier,
    password: account.password
  });

  return agent;
};
