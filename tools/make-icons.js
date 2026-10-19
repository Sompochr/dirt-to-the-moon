// Generates the app icons in icons/ from the game's own pixel art.
// Usage (from the repo folder):
//   python3 -m http.server 8080 &      # serve the game locally
//   node tools/make-icons.js           # needs the "playwright" package
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = path.join(__dirname, '..', 'icons');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8080/?debug', { waitUntil: 'load' });
  const icons = await page.evaluate(async () => {
    const { buildSprites, C, FRAME_ORIGIN, RIDER_PIVOT, RIDER_HIP } = await import('/src/sprites.js');
    const sp = buildSprites();

    // 64x64 base picture: night sky, the moon, a hill and the bike doing a wheelie.
    const base = document.createElement('canvas');
    base.width = base.height = 64;
    const g = base.getContext('2d');
    g.imageSmoothingEnabled = false;
    const sky = ['#1a1c2c', '#29366f', '#3b5dc9'];
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const t = (y / 64) * 2.2;
        let i = Math.floor(t);
        if (t - i > 0.6 && (x + y) % 2) i++;
        g.fillStyle = sky[Math.min(2, i)];
        g.fillRect(x, y, 1, 1);
      }
    }
    for (const [x, y] of [[6, 6], [14, 15], [3, 22], [20, 4], [11, 30]]) {
      g.fillStyle = C.white;
      g.fillRect(x, y, 1, 1);
    }
    g.drawImage(sp.moon, 28, 2);
    // Hill
    for (let x = 0; x < 64; x++) {
      const top = Math.round(50 - x * 0.12);
      g.fillStyle = '#8b5a3c';
      g.fillRect(x, top, 1, 64 - top);
      g.fillStyle = C.green;
      g.fillRect(x, top, 1, 2);
      g.fillStyle = C.lime;
      g.fillRect(x, top, 1, 1);
    }
    // Bike, rotated into a wheelie
    const bike = document.createElement('canvas');
    bike.width = bike.height = 80;
    const b = bike.getContext('2d');
    b.imageSmoothingEnabled = false;
    b.translate(40, 44);
    b.drawImage(sp.wheel, -8.5 - 14.5, -8.5 + 6);
    b.drawImage(sp.wheel, -8.5 + 15, -8.5 + 6);
    b.drawImage(sp.frame, -FRAME_ORIGIN.x, -FRAME_ORIGIN.y);
    b.translate(RIDER_HIP.x, RIDER_HIP.y);
    b.drawImage(sp.rider, -RIDER_PIVOT.x, -RIDER_PIVOT.y);
    g.save();
    g.translate(30, 34);
    g.rotate(-0.32);
    g.drawImage(bike, -40, -44);
    g.restore();

    const scaled = (size, scale, pad = 0, crop = 0) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      x.fillStyle = '#1a1c2c';
      x.fillRect(0, 0, size, size);
      x.drawImage(base, crop, crop, 64 - crop * 2, 64 - crop * 2, pad, pad, (64 - crop * 2) * scale, (64 - crop * 2) * scale);
      return c.toDataURL('image/png');
    };
    return {
      'icon-192.png': scaled(192, 3),
      'icon-512.png': scaled(512, 8),
      'icon-180.png': scaled(180, 3, 0, 2),
      'icon-maskable-512.png': scaled(512, 6, 64),
    };
  });
  for (const [name, url] of Object.entries(icons)) {
    fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote icons/' + name);
  }
  await browser.close();
})();
