import { localDate, localTime } from '../../../core/time.js';

export const TZ = 'Asia/Singapore';
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function today() {
  return localDate(new Date().toISOString(), TZ);
}

export function hourNow() {
  return Number(localTime(new Date().toISOString(), TZ).slice(0, 2));
}

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function dateLabel(date) {
  const [, m, d] = date.split('-').map(Number);
  return `${m}月${d}日`;
}

export function weekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  return WEEK[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
