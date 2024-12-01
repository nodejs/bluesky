export async function getFeedFor(agent, handle, limit) {
  const profile = await agent.resolveHandle({ handle });
  const did = profile.data.did;

  // TODO(joyeecheung): cursor?
  return agent.getAuthorFeed({
    actor: did,
    filter: 'posts_and_author_threads',
    limit: limit
  });
}
