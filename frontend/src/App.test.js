import React, { act } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
jest.setTimeout(60000);

const routes = [
  "/", "/cash-flow", "/calendar", "/daily-spending", "/data-quality", "/recurring",
  "/debt-payoff", "/accounts", "/income", "/expenses", "/budgets", "/lending",
  "/savings", "/pf-ppf", "/loans", "/insurance", "/farms", "/rental", "/net-worth",
  "/projects", "/family", "/access-control", "/documents", "/settings", "/losses",
  "/diary", "/notifications", "/error-log", "/necessities", "/goals", "/planner",
  "/calculators", "/review", "/versions", "/smart-import",
];

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("application route smoke test", () => {
  let host;
  let root;

  beforeEach(() => {
    sessionStorage.setItem("nivara_demo_mode", "true");
    localStorage.removeItem("nivara_token");
    window.history.replaceState({}, "", "/");
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root.unmount());
    }
    host?.remove();
    sessionStorage.removeItem("nivara_demo_mode");
    localStorage.removeItem("nivara_token");
  });

  it("renders every registered finance route with usable page content", async () => {
    await act(async () => {
      root.render(<App />);
      await flush();
      await flush();
    });

    for (const route of routes) {
      await act(async () => {
        window.history.pushState({}, "", route);
        window.dispatchEvent(new PopStateEvent("popstate"));
        await flush();
        await flush();
      });

      const main = host.querySelector("main.app-main");
      expect(main).toBeTruthy();
      expect(main.querySelector("h1, h2")).toBeTruthy();
      expect(main.textContent).not.toContain("This screen needs a refresh");
    }
  });

  it("opens a seeded project workspace from its project card", async () => {
    await act(async () => {
      root.render(<App />);
      await flush();
      await flush();
    });
    await act(async () => {
      window.history.pushState({}, "", "/projects");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await flush();
      await flush();
    });

    const projectCard = host.querySelector('[data-testid^="project-card-"]');
    expect(projectCard).toBeTruthy();
    await act(async () => {
      projectCard.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
      await flush();
    });

    expect(window.location.pathname).toMatch(/^\/projects\/[^/]+$/);
    expect(host.querySelector("main.app-main h1, main.app-main h2")).toBeTruthy();
    expect(host.querySelector("main.app-main").textContent).not.toContain("This screen needs a refresh");
  });

  it("starts the public walkthrough in the temporary demo workspace", async () => {
    await act(async () => {
      root.render(<App />);
      await flush();
      await flush();
    });
    await act(async () => {
      window.history.pushState({}, "", "/sitewalkthrough");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await flush();
      await flush();
    });

    const startButton = [...host.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Explore the live demo"));
    expect(startButton).toBeTruthy();
    await act(async () => {
      startButton.click();
      await flush();
      await flush();
    });

    expect(window.location.pathname).toBe("/");
    expect(host.textContent).toContain("Public demo workspace");
    expect(host.querySelector("main.app-main h1, main.app-main h2")).toBeTruthy();
  });

  it("keeps phone navigation compact and opens the full section drawer", async () => {
    await act(async () => {
      root.render(<App />);
      await flush();
      await flush();
    });

    expect(host.querySelectorAll(".app-mobile-nav > *")).toHaveLength(5);
    expect(host.querySelector('[data-testid="mobile-fab"]')).toBeNull();
    expect(host.querySelector('[data-testid="header-quick-add"]')?.getAttribute("aria-label"))
      .toBe("Record a transaction");

    const moreButton = host.querySelector('[data-testid="mobile-nav-more"]');
    expect(moreButton).toBeTruthy();
    await act(async () => {
      moreButton.click();
      await flush();
    });

    expect(host.querySelector(".app-mobile-drawer")).toBeTruthy();
    expect(host.querySelector('[data-testid="nav-budgets"]')).toBeTruthy();
  });

  it("shows complete CRUD records and accessible actions in the phone layout", async () => {
    window.history.replaceState({}, "", "/accounts");
    await act(async () => {
      root.render(<App />);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const mobileList = host.querySelector('[data-testid="crud-mobile-list"]');
    expect(mobileList).toBeTruthy();
    expect(mobileList.querySelector('[data-testid^="crud-mobile-row-"]')).toBeTruthy();
    expect(mobileList.textContent).toContain("Data confidence");
    expect(mobileList.textContent).toContain("Statement");
    expect(mobileList.textContent).toContain("Sharing");
    expect(mobileList.querySelector('[data-testid^="mobile-edit-"]')?.getAttribute("aria-label"))
      .toMatch(/^Edit /);
  });

  it("keeps transaction save actions separate from the scrollable phone form", async () => {
    await act(async () => {
      root.render(<App />);
      await flush();
    });

    await act(async () => {
      host.querySelector('[data-testid="header-quick-add"]').click();
      await flush();
      await flush();
    });

    expect(document.querySelector(".quick-add-modal")).toBeTruthy();
    expect(document.querySelector(".quick-add-fields")).toBeTruthy();
    expect(document.querySelector(".quick-add-actions [data-testid='quick-submit']")).toBeTruthy();
  });
});
