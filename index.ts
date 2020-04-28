import {
  launch as orgLaunch,
  Browser as OrgBrowser,
  Page as OrgPage,
  ElementHandle as OrgElementHandle
} from "puppeteer";

export class UnmatchError implements Error {
  name: string = "UnmatchError";
  message: string;
  stack?: string;
  constructor(message: string) {
    this.message = message;
    Error.captureStackTrace(this, UnmatchError);
  }

  toString() {
    return this.stack;
  }
}

export interface Matcher {
  (element: ElementHandle<Element>, expected: string | RegExp): Promise<Error>;
}

export const Text: Matcher = async (element, expected) => {
  const text = await element.text();
  if (typeof expected === "string") {
    if (expected !== text) {
      return new UnmatchError(
        `Failed to match with element text. Expected text is "${expected}", but was "${text}" appeared.`
      );
    }
  } else {
    if (!expected.test(text)) {
      return new UnmatchError(
        `Failed to match with element text. Expected matcher is "${expected}", but was "${text}" appeared.`
      );
    }
  }
}

export const Value: Matcher = async (element, expected) => {
  const value = await element.value();
  if (typeof expected === "string") {
    if (expected !== value) {
      return new UnmatchError(
        `Failed to match with element value. Expected value is "${expected}", but was "${value}" appeared.`
      );
    }
  } else {
    if (!expected.test(value)) {
      return new UnmatchError(
        `Failed to match with element value. Expected matcher is "${expected}", but was "${value}" appeared.`
      );
    }
  }
}

export const Class: Matcher = async (element, expected) => {
  const clazz = await element.class();
  if (typeof expected === "string") {
    if (expected !== clazz) {
      return new UnmatchError(
        `Failed to match with element class. Expected class is "${expected}", but was "${clazz}" appeared.`
      );
    }
  } else {
    if (!expected.test(clazz)) {
      return new UnmatchError(
        `Failed to match with element class. Expected matcher is "${expected}", but was "${clazz}" appeared.`
      );
    }
  }
}

export const Style: Matcher = async (element, expected) => {
  const style = await element.style();
  if (typeof expected === "string") {
    if (expected !== style) {
      return new UnmatchError(
        `Failed to match with element style. Expected style is "${expected}", but was "${style}" appeared.`
      );
    }
  } else {
    if (!expected.test(style)) {
      return new UnmatchError(
        `Failed to match with element style. Expected matcher is "${expected}", but was "${style}" appeared.`
      );
    }
  }
}

export const createMatcher = (attribute: string, matchFn: (actual: string) => boolean): Matcher => {
  return async (element) => {
    const attr = await element.attr(attribute);
    if (!matchFn(attr)) {
      return new UnmatchError(`Failed to match with element attribute "${attribute}". Actual value was "${attr}".`);
    }
  }
}

export interface ElementHandle<T extends Element> extends OrgElementHandle<T> {
  $$lazy(selector: string): Promise<ElementHandles<T>>;
  shouldEqual(matcher: Matcher, expected: string): Promise<void>;
  shouldMatch(matcher: Matcher, expected: string | RegExp): Promise<void>;
  text(): Promise<string>;
  value(): Promise<string>;
  class(): Promise<string>;
  style(): Promise<string>;
  attr(attribute: string): Promise<string>;
}

function sleep(ms: number) {
  return new Promise(ok => setTimeout(ok, ms));
}

class ElementHandles<T extends Element> {
  selector: string;
  options: LaunchOptions;
  parent: ElementHandle<T>;
  constructor(selector: string, parent: ElementHandle<T>, options: LaunchOptions) {
    this.selector = selector;
    this.options = options;
    this.parent = parent;
  }
  async get(index: number): Promise<ElementHandle<T> | undefined> {
    return wrapElementHandle(await this.parent.$$(this.selector)[index], this.options);
  }
  async shouldHaveCount(count: number): Promise<void> {
    const start = Date.now();
    let error: Error | undefined;
    while (start + this.options.matchingTimeout > Date.now()) {
      const size = (await (this.parent.$$(this.selector))).length;
      error = size !== count
        ? new Error(`Failed to match element counts. Expected count is ${count} but was ${size}`)
        : undefined;
      if (!error) return
      await sleep(100);
    }
    throw error;
  }
  async map<U>(cb: (handle: ElementHandle<T>) => Promise<U>): Promise<U[]> {
    return Promise.all((await this.parent.$$(this.selector)).map(cb));
  }
  async forEach<T extends Element>(cb: (el: ElementHandle<T>, index: number) => void): Promise<void> {
    const items = await this.parent.$$(this.selector)
    for (let i = 0; i < items.length; i++) {
      cb(wrapElementHandle(items[i], this.options), i);
    }
  }
}

export function wrapElementHandle<T extends Element>(
  elementHandle: OrgElementHandle<T>,
  options: LaunchOptions,
): ElementHandle<T> {
  const extended: ElementHandle<T> = {
    ...elementHandle,
    async $(...args) {
      return wrapElementHandle(await elementHandle.$(...args), options);
    },
    async $$(...args) {
      return (await elementHandle.$$(...args)).map(it => wrapElementHandle(it, options));
    },
    async $$lazy(selector: string): Promise<ElementHandles<T>> {
      return new ElementHandles(selector, extended, options);
    },
    attr(attribute: string) {
      return elementHandle.evaluate((it, attribute: string) => it.getAttribute(attribute), attribute);
    },
    text() {
      return elementHandle.evaluate(it => it.textContent);
    },
    class() {
      return extended.attr("class");
    },
    style() {
      return extended.attr("style");
    },
    async shouldEqual(matcher, expected) {
      const start = Date.now();
      let error: Error | undefined;
      while (start + options.matchingTimeout > Date.now()) {
        error = await matcher(extended, expected);
        if (!error) return
        await sleep(100);
      }
      throw error;
    },
    async shouldMatch(matcher, expected) {
      const start = Date.now();
      const regexp = typeof expected === "string" ? RegExp(expected) : expected;
      let error: Error | undefined;
      while (start + options.matchingTimeout > Date.now()) {
        error = await matcher(extended, regexp);
        if (!error) return
        await sleep(100);
      }
      throw error;
    },
    value() {
      return extended.attr("value");
    }
  };
  (extended as any).__proto__ = (elementHandle as any).__proto__;
  return extended;
}


export interface Page extends OrgPage {
  $(selector: string): Promise<ElementHandle<Element>>;
  $$(selector: string): Promise<ElementHandle<Element>[]>;
  $$lazy(selector: string): Promise<ElementHandles<Element>>;
}

export function wrapPage(page: OrgPage, options: LaunchOptions): Page {
  const newPage = {
    ...page,
    async $(selector: string) {
      return wrapElementHandle(await page.$(selector), options);
    },
    async $$(selector: string) {
      return (await page.$$(selector)).map(it => wrapElementHandle(it, options));
    },
    async $$lazy(selector: string) {
      return new ElementHandles(selector, newPage, options);
    }
  } as any;
  newPage.__proto__ = (page as any).__proto__;
  return newPage;
}

export interface Browser extends OrgBrowser {
  newPage(): Promise<Page>;
}

export function wrapBrowser(browser: OrgBrowser, options: LaunchOptions): Browser {
  const newBrowser = {
    ...browser,
    async newPage() {
      return wrapPage(await browser.newPage(), options);
    },
  } as any;
  newBrowser.__proto__ = (browser as any).__proto__;
  return newBrowser;
}

interface LaunchOptions {
  matchingTimeout: number;
}
export async function launch(options?: LaunchOptions): Promise<Browser> {
  return wrapBrowser(await orgLaunch(), options || { matchingTimeout: 10000 });
}
