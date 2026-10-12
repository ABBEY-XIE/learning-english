/** UI-facing strings, including transcripts and imported files, must pass through esc. */
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export const uid = () => crypto.randomUUID();
export const isUUID = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
export const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));
export function durationLabel(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return s < 60 ? `${s} 秒` : `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
}
export function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
export function dateKey(value = Date.now()) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export const dateLabel = value => new Date(value).toLocaleString('zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
export const extension = mime => String(mime).includes('mp4') ? 'm4a' : String(mime).includes('wav') ? 'wav' : String(mime).includes('mpeg') ? 'mp3' : 'webm';
export const wordCount = text => (String(text || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length;
export const boundedText = (v, length = 500) => typeof v === 'string' ? v.slice(0, length) : '';
export function nextDay(cycle) {
  return Array.from({length:30}, (_,i) => i+1).find(d => !(cycle?.completed || []).includes(d)) || 30;
}
export function summarize(records) {
  const rows = records.filter(r => !r.deleted);
  return { count: rows.length, seconds: rows.reduce((a,r) => a + (Number(r.duration) || 0),0), days: new Set(rows.map(r => dateKey(r.createdAt))).size, retakes: rows.filter(r=>r.parentId).length, assessed: rows.filter(r=>r.feedback).length };
}
export function feedbackScore(f) {
  if (!f?.eligible) return null;
  const values = [f.task_score, f.clarity_score, f.language_score];
  if (!values.every(v => Number.isInteger(v) && v >= 0 && v <= 5)) return null;
  return Math.round(values.reduce((a,b)=>a+b,0) / 15 * 100);
}
export function safeQuestion(q) {
  return { en: boundedText(q?.en, 600), zh: boundedText(q?.zh, 600), hint: boundedText(q?.hint, 600) };
}
export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export const icons = {
  home:'<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
  mic:'<rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
  map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
  chart:'<path d="M4 3v17h17M8 15V9m5 6V5m5 10v-4"/>',
  folder:'<path d="M3 7V4h7l2 3h9v13H3Z"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back:'<path d="M20 12H4m6-6-6 6 6 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  play:'<path d="m8 4 12 8-12 8Z"/>',
  stop:'<rect x="5" y="5" width="14" height="14" rx="2"/>',
  volume:'<path d="m11 4-6 5H2v6h3l6 5Zm5 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  cloud:'<path d="M6 18a5 5 0 1 1 1-10 6 6 0 0 1 11-1 5.5 5.5 0 0 1 0 11Z"/>',
  wifi:'<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0m-5 4h2"/>',
  plane:'<path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2"/>',
  cup:'<path d="M3 7h13v9a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Zm13 1h3a3 3 0 1 1 0 6h-3M5 2v2m5-2v2"/>',
  wave:'<path d="M2 14c4-8 8 8 12 0s8 0 8 0M2 20c4-8 8 8 12 0s8 0 8 0M3 7h5m6-4h6"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  bulb:'<path d="M8 17c0-3-3-4-3-8a7 7 0 0 1 14 0c0 4-3 5-3 8ZM9 21h6m-6-4v4m6-4v4"/>',
  repeat:'<path d="M4 7h14l-4-4m4 4-4 4M20 17H6l4 4m-4-4 4-4"/>',
  download:'<path d="M12 2v13m-5-5 5 5 5-5M3 16v5h18v-5"/>',
  trash:'<path d="M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  close:'<path d="m5 5 14 14M5 19 19 5"/>',
  book:'<path d="M12 5C8 2 4 2 2 3v17c3-2 6-1 10 1 4-2 7-3 10-1V3c-2-1-6-1-10 2Zm0 0v16"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 1 1 5 3l-2 2v2m0 3h.01"/>',
  user:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  plus:'<path d="M12 4v16M4 12h16"/>',
  shield:'<path d="m12 2 9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6Z"/><path d="m8 12 3 3 5-6"/>'
};
export const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.mic}</svg>`;
