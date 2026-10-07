import React, { act } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import api from "./lib/api";

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
const setInputValue = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

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
    await act(async () => {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await flush();
      await flush();
    });
    expect(host.querySelector(".wealth-orbit")).toBeNull();
    expect(host.querySelector(".wealth-command-panel")?.textContent).toContain("Total net worth");
    expect(host.querySelector('[data-testid="net-worth-panel"]').textContent).toContain("Illustrative demo data");
    expect(host.querySelector('[data-testid="net-worth-history"] .wealth-chart-area')).toBeTruthy();
    expect(host.querySelectorAll('[data-testid="net-worth-history"] table tbody tr').length).toBeGreaterThanOrEqual(3);
    expect(host.querySelector('[data-testid="record-net-worth-snapshot"]')?.textContent).toBe("Record today");
    expect(host.querySelector('[data-testid="account-freshness"]').textContent).toContain("Latest balance activity");
    expect(host.querySelector('[data-testid="account-freshness"]').textContent).toContain("Latest reconciliation");
    expect(host.querySelectorAll(".wealth-key-stats .wealth-stat")).toHaveLength(3);
    expect(host.querySelector('[data-testid="allocation-total-summary"]')?.textContent).toContain("Total assets");
    expect(host.querySelector('[data-testid="allocation-total-summary"]')?.textContent).toContain("₹");
    expect(host.querySelector('[data-testid="donut-center"]')?.textContent).toContain("ASSET MIX");
    expect(host.querySelector('[data-testid="donut-center"]')?.textContent).toContain("asset types");
    expect(host.querySelectorAll(".chart-data-table table").length).toBeGreaterThan(0);
    expect(host.querySelector(".chart-data-table table caption")?.textContent).toContain("data");
    expect(host.querySelectorAll('[data-testid="action-center"]')).toHaveLength(1);
    expect(host.querySelector('[aria-label^="Resolve or postpone "]')).toBeTruthy();
    expect(host.querySelector("main.app-main").textContent).toContain("What needs your attention?");

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

    expect(host.querySelector("main.app-main").textContent).toContain("Total Budget");
    expect(host.querySelector("main.app-main").textContent).toContain("₹97.50L");
    expect(host.querySelector("main.app-main").textContent).toContain("Skyline Heights Residence");
    expect(host.querySelector("main.app-main").textContent).toContain("Spent ₹33.60L");
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
    expect(host.querySelector('[data-testid="mobile-nav-daily"]')?.getAttribute("href")).toBe("/daily-spending");
    const nextAction = host.querySelector('[data-testid="mobile-nav-next"]');
    expect(nextAction?.getAttribute("aria-label")).toMatch(/^Open next priority:/);
    await act(async () => {
      nextAction.click();
      await flush();
    });
    expect(window.location.pathname).not.toBe("/planner");
    expect(host.querySelector('[data-testid="header-quick-add"]')?.getAttribute("aria-label"))
      .toBe("Record a transaction");

    const moreButton = host.querySelector('[data-testid="mobile-nav-more"]');
    expect(moreButton).toBeTruthy();
    await act(async () => {
      moreButton.click();
      await flush();
    });

    const drawer = host.querySelector(".app-mobile-drawer");
    expect(drawer).toBeTruthy();
    expect(drawer.querySelector('[data-testid="nav-group-home"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="nav-group-daily"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="nav-group-plan"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="nav-group-projects"]')?.textContent).toContain("Projects & Farms");
    expect(drawer.querySelector('[data-testid="nav-group-more"]')).toBeTruthy();
    await act(async () => {
      const planGroup = drawer.querySelector('[data-testid="nav-group-plan"]');
      if (planGroup.getAttribute("aria-expanded") !== "true") planGroup.click();
      await flush();
    });
    expect(drawer.querySelector('[data-testid="nav-budgets"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="nav-calculators"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="nav-loans"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="nav-insurance"]')).toBeTruthy();
    await act(async () => {
      const moreGroup = drawer.querySelector('[data-testid="nav-group-more"]');
      if (moreGroup.getAttribute("aria-expanded") !== "true") moreGroup.click();
      await flush();
    });
    expect(drawer.querySelector('[data-testid="nav-calendar"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="nav-data-quality"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="nav-access-control"]')).toBeTruthy();
    expect(drawer.querySelector('[data-testid="nav-advanced-toggle-plan"]')).toBeNull();
    expect(drawer.querySelector('[data-testid="nav-advanced-toggle-daily"]')).toBeNull();
    expect(drawer.querySelector('[data-testid="nav-advanced-toggle-more"]')).toBeNull();
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

  it("lets an admin search, change access status, and create a user with visible sign-in details", async () => {
    await act(async () => {
      window.history.replaceState({}, "", "/access-control");
      root.render(<App />);
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    expect(host.querySelector('[data-testid="access-summary"]')?.textContent).toContain("Active access");
    expect(host.querySelector('[data-testid="user-card-user-architect"]')).toBeTruthy();

    const search = host.querySelector('[data-testid="user-search"]');
    await act(async () => {
      setInputValue(search, "architect");
      await flush();
    });
    expect(host.querySelector('[data-testid="user-card-user-architect"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="user-card-user-contractor"]')).toBeNull();

    await act(async () => {
      setInputValue(search, "");
      await flush();
      host.querySelector('[data-testid="toggle-user-active-user-architect"]').click();
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(host.querySelector('[data-testid="user-card-user-architect"]').textContent).toContain("inactive");

    await act(async () => {
      host.querySelector('[data-testid="add-user"]').click();
      await flush();
    });
    const name = document.querySelector('[data-testid="user-name"]');
    expect(name).toBeTruthy();
    await act(async () => {
      setInputValue(name, "Maya Shah");
      await flush();
    });
    expect(document.querySelector('[data-testid="user-email"]').value).toBe("shah@nivara.com");
    await act(async () => {
      document.querySelector('[data-testid="user-save"]').click();
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(host.querySelector('[data-testid="created-user-credentials"]')?.textContent).toContain("shah@nivara.com");
    expect(host.querySelector('[data-testid="created-user-credentials"]')?.textContent).toContain("Shah@123");
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

  it("closes the mobile search overlay when tapping outside it", async () => {
    await act(async () => {
      root.render(<App />);
      await flush();
    });

    await act(async () => {
      host.querySelector('button[aria-label="Search financial records"]').click();
      await flush();
    });
    expect(host.querySelector("#financial-search-mobile")).toBeTruthy();

    await act(async () => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      await flush();
    });
    expect(host.querySelector("#financial-search-mobile")).toBeNull();
  });

  it("offers cash expenses without linking or deducting the cash account", async () => {
    await act(async () => {
      window.history.replaceState({}, "", "/expenses");
      root.render(<App />);
      await flush();
      await flush();
    });

    await act(async () => {
      host.querySelector('[data-testid="add-expense-records"]').click();
      await flush();
    });
    const expenseAccount = document.querySelector('[data-testid="field-account_id"]');
    expect(expenseAccount.querySelector('option[value="__cash__"]')?.textContent)
      .toBe("Cash (no account deduction)");
    expect(expenseAccount.querySelector('option[value="account-cash"]')).toBeNull();
    await act(async () => {
      expenseAccount.value = "__cash__";
      expenseAccount.dispatchEvent(new Event("change", { bubbles: true }));
      await flush();
    });
    expect(document.querySelector('[data-testid="field-payment_mode"]').value).toBe("Cash");

    await act(async () => {
      window.history.pushState({}, "", "/daily-spending");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await flush();
      await flush();
    });
    const dailyAccount = host.querySelector('[data-testid="daily-expense-account"]');
    expect(dailyAccount.querySelector('option[value="__cash__"]')?.textContent)
      .toBe("Cash (no account deduction)");
    expect(dailyAccount.querySelector('option[value="account-cash"]')).toBeNull();
    await act(async () => {
      const paymentMode = host.querySelector('[data-testid="daily-expense-payment-mode"]');
      paymentMode.value = "Cash";
      paymentMode.dispatchEvent(new Event("change", { bubbles: true }));
      await flush();
    });
    expect(host.querySelector('[data-testid="daily-expense-account"]').value).toBe("__cash__");
    expect(host.querySelector('[data-testid="daily-quick-add"]')).toBeTruthy();
    await act(async () => {
      host.querySelector('[data-testid="daily-quick-add"]').click();
      await flush();
      await flush();
    });
    expect(document.querySelector(".quick-add-modal")).toBeTruthy();
    expect(document.querySelector('[data-testid="quick-type-EXPENSE"]')).toBeTruthy();
  });

  it("selects cash without an account in quick transaction entry", async () => {
    await act(async () => {
      root.render(<App />);
      await flush();
    });
    await act(async () => {
      host.querySelector('[data-testid="header-quick-add"]').click();
      await flush();
      await flush();
    });

    const account = document.querySelector('[data-testid="quick-account"]');
    expect(account.querySelector('option[value="__cash__"]')?.textContent)
      .toBe("Cash (no account deduction)");
    await act(async () => {
      account.value = "__cash__";
      account.dispatchEvent(new Event("change", { bubbles: true }));
      await flush();
    });
    expect(document.querySelector('[data-testid="quick-payment-mode"]').value).toBe("Cash");
  });

  it("refreshes dashboard priorities after a policy is edited on its own page", async () => {
    await act(async () => {
      root.render(<App />);
      await new Promise((resolve) => setTimeout(resolve, 40));
    });

    const actionCenter = host.querySelector('[data-testid="action-center"]');
    expect(actionCenter.textContent).toContain("₹32.0K");

    await act(async () => {
      await api.put("/insurance/insurance-health", { premium: 12345 });
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    const insuranceSummary = await api.get("/insurance/summary");
    expect(insuranceSummary.data.total_annual_premium).toBe(44545);
    expect(insuranceSummary.data.by_type.find((item) => item.name === "Health")?.value).toBe(12345);

    expect(actionCenter.textContent).toContain("₹12.3K");
    expect(actionCenter.textContent).not.toContain("₹32.0K");
  });

  it("recalculates liabilities and net worth when loan or borrowing balances change", async () => {
    await act(async () => {
      root.render(<App />);
      await flush();
    });
    const beforeLoanEdit = (await api.get("/dashboard/overview")).data;
    await api.put("/loans/loan-woodsville", { outstanding: 4500000 });
    const afterLoanEdit = (await api.get("/dashboard/overview")).data;
    expect(afterLoanEdit.total_liabilities).toBe(beforeLoanEdit.total_liabilities - 484251);
    expect(afterLoanEdit.net_worth).toBe(beforeLoanEdit.net_worth + 484251);

    const beforeBorrowingEdit = afterLoanEdit;
    await api.put("/lending/lending-axis", { amount: 700000 });
    const afterBorrowingEdit = (await api.get("/dashboard/overview")).data;
    expect(afterBorrowingEdit.total_liabilities).toBe(beforeBorrowingEdit.total_liabilities - 100000);
    expect(afterBorrowingEdit.net_worth).toBe(beforeBorrowingEdit.net_worth + 100000);
  });
});
