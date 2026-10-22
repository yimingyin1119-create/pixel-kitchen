export function authenticate(state, token, nowIso) {
  if (!token) return null;
  const s = state.sessions.find((x) => x.uid === token);
  if (!s || s.expiresIso <= nowIso) return null;
  return state.users.find((u) => u.uid === s.userUid) ?? null;
}
