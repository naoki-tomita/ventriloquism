# ventriloquism

Frontend e2e testing library.
Puppeteer wrapper.

# Examples

```ts
import { launch, Text } from "ventriloquism";

async function main() {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.goto("https://www.google.com/");
    await (await page.$("a")).shouldEqual(Text, "About google")
    await (await page.$("input")).type("foo");
    await (await page.$$lazy(".UUbT9 ul li")).shouldHaveCount(8)
  } finally {
    browser.close();
  }
}

main();
```
