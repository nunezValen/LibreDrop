const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

const src = path.join(__dirname, '..', 'logo libredrop.png');
const outDir = path.join(__dirname, '..', 'build', 'icons');
const out = path.join(outDir, 'app.ico');

if (!fs.existsSync(src)) {
  console.error('Source PNG not found:', src);
  process.exit(2);
}

fs.mkdirSync(outDir, { recursive: true });

pngToIco(src)
  .then((buf) => fs.writeFileSync(out, buf))
  .then(() => console.log('Wrote icon:', out))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
