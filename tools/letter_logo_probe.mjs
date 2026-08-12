// Letter-logo renderer gate (Aug 2026): generated schools use only deterministic
// abbreviation marks while uploaded images remain supported.
import { generateWorld } from '../js/engine/world.js';
import { renderCrest } from '../js/utils.js';
let fails=0; const check=(ok,label,detail='')=>{if(!ok)fails++;console.log(`${ok?'✅':'❌'} ${label}${detail?` — ${detail}`:''}`);};
const schools=generateWorld().schools;
const marks=schools.map(s=>renderCrest(s,40));
const styles=new Set(marks.map(mark=>mark.match(/data-crest-style="(\d+)"/)?.[1]));
const frames=new Set(marks.map(mark=>mark.match(/data-crest-frame="(\d+)"/)?.[1]));
const expected=s=>String(s.abbr||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);
check(marks.every((mark,i)=>mark.includes(`data-letter-mark="${expected(schools[i])}"`)), 'every generated school mark uses its abbreviation');
check(styles.size===8, 'all eight letter treatments appear', [...styles].sort().join(','));
check(frames.size===5, 'all five clean frame shapes appear', [...frames].sort().join(','));
check(marks.every(mark=>!/<image\b/.test(mark) && !/crest-(?:cat|wolf|bear|bird|snake|mascot)/.test(mark)), 'generated marks contain no mascot sprites or images');
check(marks.every(mark=>/aria-label="[^"]+ letter logo"/.test(mark)), 'every mark has an accessible letter-logo label');
check(renderCrest(schools[0],40)===renderCrest(schools[0],40), 'same school renders deterministically');
const remapped={...schools[0],id:'exhibition-disposable-id'};
check(renderCrest(schools[0],40)===renderCrest(remapped,40), 'Play Now id remapping does not change a saved team mark');
const resized=renderCrest(schools[1],24);
check(/width="24" height="24" viewBox="0 0 64 64"/.test(resized), 'small navigation mark keeps the fixed viewBox');
const upload={...schools[2],crestImg:'data:image/png;base64,AAAA'};
const custom=renderCrest(upload,44);
check(custom.includes('<image ') && custom.includes(upload.crestImg), 'uploaded team logos remain supported');
const fallback=renderCrest({name:'No Abbreviation College',colors:['bad','also-bad']},40);
check(fallback.includes('data-letter-mark="NA"') && fallback.includes('#315cc7') && fallback.includes('#f4f0d8'), 'legacy/malformed schools receive safe letters and colors');
console.log(fails?`\nFAIL — ${fails} letter-logo check(s)`:'\nLETTER-LOGO RENDERER GATE PASS');
process.exit(fails?1:0);