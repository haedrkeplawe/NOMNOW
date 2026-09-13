// scripts/check-messages.js  —  الاستخدام: node scripts/check-messages.js
//
// يمشي على كل ملفات .js بالمشروع (عدا node_modules/img/.git/scripts)،
// ولكل مرجع m.x.y تابع لـ getMessages(req)... أو getSocketMessages(socket)...
// يتحقق إنه المفتاح موجود فعلياً بـ utils/messages.js بالثلاث لغات (en/ar/de).
//
// معيار النجاح: missing=0
// يُفضَّل إبقاؤه بخط CI (قبل أي دمج/نشر) لمنع تكرار مشكلة المفاتيح
// المفقودة يلي بترجع { message: undefined } بصمت.

const path = require("path"), fs = require("fs");
const B = path.join(__dirname, "..");
const { getMessages, getSocketMessages } = require(path.join(B, "utils/messages.js"));

const files = [];
const skip = ["node_modules", "img", ".git", "scripts"];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) { if (!skip.includes(e.name)) walk(p); }
  else if (e.name.endsWith(".js")) files.push(p);
});
walk(B);

const get = (o, p) => p.reduce((a, k) => (a == null ? undefined : a[k]), o);
const missing = new Set();
let checked = 0;

for (const lang of ["en", "ar", "de"]) {
  const root = getMessages({ headers: { "accept-language": lang } });
  const srt = getSocketMessages({ handshake: { query: { lang } } });
  for (const f of files) {
    const s = fs.readFileSync(f, "utf8");
    const bases = [];
    for (const m of new Set([...s.matchAll(/getMessages\(req\)((?:\.[a-zA-Z]+)*)\s*;/g)].map((x) => x[1])))
      bases.push([root, m.split(".").filter(Boolean)]);
    for (const m of new Set([...s.matchAll(/getSocketMessages\(socket\)((?:\.[a-zA-Z]+)*)\s*;/g)].map((x) => x[1])))
      bases.push([srt, m.split(".").filter(Boolean)]);
    if (!bases.length) continue;
    for (const mm of s.matchAll(/\bm\.([a-zA-Z]+)\.([a-zA-Z0-9_]+)(?:\.([a-zA-Z0-9_]+))?/g)) {
      const parts = [mm[1], mm[2], mm[3]].filter(Boolean);
      if (parts[parts.length - 1] === "replace") parts.pop();
      if (parts.length < 2) continue;
      checked++;
      const ok = bases.some(([r, bb]) => {
        for (let c = parts.length; c >= 2; c--)
          if (typeof get(r, [...bb, ...parts.slice(0, c)]) === "string") return true;
        return false;
      });
      if (!ok) missing.add(`${lang}  ${path.relative(B, f)}  ::  m.${parts.join(".")}`);
    }
  }
}

console.log(`refs=${checked}  missing=${missing.size}`);
[...missing].sort().forEach((x) => console.log("  " + x));
process.exit(missing.size ? 1 : 0);
