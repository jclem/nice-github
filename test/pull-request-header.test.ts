import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { simplifyPullRequestHeaders } from "../src/pull-request-header";

class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  nextElementSibling: FakeElement | null = null;
  parentElement: FakeElement | null = null;
  textContent = "";

  append(...children: FakeElement[]) {
    this.children.push(...children);
  }

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }

  replaceChildren(...children: FakeElement[]) {
    this.children.splice(0, this.children.length, ...children);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
}

class FakeAnchorElement extends FakeElement {}

afterEach(() => vi.unstubAllGlobals());

test("keeps GitHub's head-branch copy control", () => {
  vi.stubGlobal("HTMLElement", FakeElement);
  vi.stubGlobal("HTMLAnchorElement", FakeAnchorElement);

  const copyButton = new FakeElement();
  const head = new FakeElement();
  head.children.push(copyButton);
  const base = new FakeAnchorElement();
  const branches = new FakeElement();
  Object.assign(branches, {
    querySelector(selector: string) {
      return selector === ":scope > a" ? base : head;
    },
  });
  const root = {
    querySelectorAll() {
      return [branches];
    },
  };
  vi.stubGlobal("document", {
    createElement() {
      return new FakeElement();
    },
  });

  simplifyPullRequestHeaders(root as unknown as ParentNode);

  assert.equal(branches.children[0], base);
  assert.equal(branches.children[2], head);
  assert.equal(head.children.includes(copyButton), true);
});
