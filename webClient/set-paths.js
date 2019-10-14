const fs = require('fs');
const path = require('path');

let MVD_DESKTOP_DIR_STRING;
if (process.env.MVD_DESKTOP_DIR) {
  console.log('MVD_DESKTOP_DIR found as ',process.env.MVD_DESKTOP_DIR);
  MVD_DESKTOP_DIR_STRING = process.env.MVD_DESKTOP_DIR.replace(/\\/g,'\\\\');
  try {
    let def = fs.readFileSync(path.join(process.env.MVD_DESKTOP_DIR, 'pluginDefinition.json'));
  } catch (e) {
    console.error(`Could not locate pluginDefinition within MVD_DESKTOP_DIR. Is MVD_DESKTOP_DIR a valid path?`);
    process.exit(1);
  }
}
let warnCount = 0;
try {
  let mode = fs.statSync('tsconfig.json').mode;
  let tsconfig = fs.readFileSync('tsconfig.json', 'utf8');
  if (typeof tsconfig == 'string') {
    let modified = tsconfig.replace(/\$MVD_DESKTOP_DIR/g, MVD_DESKTOP_DIR_STRING);
	fs.writeFileSync('tsconfig.json',modified,{encoding:'utf8', mode: mode, flag:'w'});
  }
} catch (e) {
  console.warn(`Skipping tsconfig.json due to e=`,e);
  warnCount++;
}
try {
  let mode = fs.statSync('tslint.json').mode;
  let tslint = fs.readFileSync('tslint.json', 'utf8');
  if (typeof tslint == 'string') {
	let modified = tslint.replace(/\$MVD_DESKTOP_DIR/g, MVD_DESKTOP_DIR_STRING);
	fs.writeFileSync('tslint.json',modified,{encoding:'utf8', mode: mode, flag:'w'});
  }
} catch (e) {
  console.warn(`Skipping tslint.json due to e=`,e);
  warnCount++;
}
console.log('Finished with '+warnCount+' warnings');
process.exit(warnCount);