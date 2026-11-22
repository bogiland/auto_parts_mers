import { chromium } from 'playwright';
const browser = await chromium.launch({channel:'chrome'});
try {
  const page = await browser.newPage({viewport:{width:1024,height:900}});
  const response = await page.goto('http://localhost:3000/',{waitUntil:'networkidle'});
  if (response.status() !== 200) throw new Error(`HTTP ${response.status()}`);
  for (const width of [1024,1280,1440]) {
    await page.setViewportSize({width,height:900});
    await page.waitForTimeout(500);
    const image = page.locator('.deal-product-image');
    if (width >= 1200) {
      const box = await image.boundingBox();
      if (!box || box.width > 140 || box.height > 140) throw new Error('Featured image exceeds 140px');
      await page.getByRole('button',{name:'Следующий товар недели',exact:true}).click();
    } else if (await image.isVisible()) throw new Error('Desktop card visible on tablet');
    await page.screenshot({path:`qa/shots/weekly-${width}.png`,fullPage:true});
    console.log(`${width}: layout and navigation OK`);
  }
} finally { await browser.close(); }
