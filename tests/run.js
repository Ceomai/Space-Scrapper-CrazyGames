// Bütün testler: node tests/run.js [tam]
const { spawnSync } = require('child_process'); const path = require('path');
const full = process.argv[2] === 'tam';
const T = [['Akış, SDK olayları, reklamlar, kayıt, yerleşim', ['flow.js']], ['Denge botu (insan profili)', ['balance.js', full ? '4' : '1', '0.5']]];
let failed = 0;
for (const [name, args] of T) {
  const t0 = Date.now(), r = spawnSync(process.execPath, [path.join(__dirname, args[0]), ...args.slice(1)], { encoding: 'utf8', timeout: 40 * 60 * 1000 });
  const out = (r.stdout || '') + (r.stderr || ''), bad = r.status !== 0 || /✗|HATA/.test(out);
  if (bad) failed++;
  console.log(`${bad ? '✗' : '✓'} ${name} (${Math.round((Date.now() - t0) / 1000)} sn)`);
  console.log(out.split('\n').filter(l => /✗|HATA|ulaşılan|başarısız|geçti/.test(l)).map(l => '    ' + l).join('\n'));
}
console.log(failed ? `\n${failed} test başarısız.` : '\nBütün testler geçti.'); process.exit(failed ? 1 : 0);
