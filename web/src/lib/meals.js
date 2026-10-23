import { localTime } from '../../../core/time.js';
import { TZ } from './time.js';

export function nameOf(users, uid) {
  return users.find((u) => u.uid === uid)?.name ?? '有人';
}

// 「小明提 · 小红做」, or 「小红自己做」 when one person did both. takerFirst flips the order for recipe details.
export function cookLine(r, users, takerFirst = false) {
  const asker = nameOf(users, r.userUid);
  const taker = nameOf(users, r.takerUid);
  if (r.userUid === r.takerUid) return `${taker}自己做`;
  return takerFirst ? `${taker}做 · ${asker}提` : `${asker}提 · ${taker}做`;
}

export function doneAt(r) {
  return localTime(r.updatedIso, TZ);
}

export function doneRequests(requests) {
  return requests.filter((r) => r.status === 'done').sort((a, b) => b.updatedIso.localeCompare(a.updatedIso));
}
