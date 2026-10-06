import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Spinner } from "./components/ui";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/ErrorBoundary";

const Login = lazy(() => import("./pages/Login"));
const Overview = lazy(() => import("./pages/Overview"));
const CashFlow = lazy(() => import("./pages/CashFlow"));
const Calendar = lazy(() => import("./pages/Calendar"));
const DailySpending = lazy(() => import("./pages/DailySpending"));
const DataQuality = lazy(() => import("./pages/DataQuality"));
const Recurring = lazy(() => import("./pages/Recurring"));
const DebtPayoff = lazy(() => import("./pages/DebtPayoff"));
const Accounts = lazy(() => import("./pages/Accounts"));
const Income = lazy(() => import("./pages/Income"));
const Expenses = lazy(() => import("./pages/Expenses"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Lending = lazy(() => import("./pages/Lending"));
const Savings = lazy(() => import("./pages/Savings"));
const PfPpf = lazy(() => import("./pages/PfPpf"));
const Loans = lazy(() => import("./pages/Loans"));
const Insurance = lazy(() => import("./pages/Insurance"));
const Farms = lazy(() => import("./pages/Farms"));
const Rental = lazy(() => import("./pages/Rental"));
const NetWorth = lazy(() => import("./pages/NetWorth"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectWorkspace = lazy(() => import("./pages/ProjectWorkspace"));
const Family = lazy(() => import("./pages/Family"));
const AccessControl = lazy(() => import("./pages/AccessControl"));
const Documents = lazy(() => import("./pages/Documents"));
const Settings = lazy(() => import("./pages/Settings"));
const Losses = lazy(() => import("./pages/Losses"));
const Diary = lazy(() => import("./pages/Diary"));
const Notifications = lazy(() => import("./pages/Notifications"));
const ErrorLog = lazy(() => import("./pages/ErrorLog"));
const Necessities = lazy(() => import("./pages/Necessities"));
const Goals = lazy(() => import("./pages/Goals"));
const Planner = lazy(() => import("./pages/Planner"));
const Calculators = lazy(() => import("./pages/Calculators"));
const ReviewInbox = lazy(() => import("./pages/ReviewInbox"));
const VersionControl = lazy(() => import("./pages/VersionControl"));
const SmartImport = lazy(() => import("./pages/SmartImport"));
const PartyPortal = lazy(() => import("./pages/PartyPortal"));
const SiteWalkthrough = lazy(() => import("./pages/SiteWalkthrough"));

function Protected({ children }) {
  const { user, checking, demoMode } = useAuth();
  const { pathname } = useLocation();
  if (checking) return <div className="min-h-screen flex items-center justify-center"><Spinner className="w-7 h-7 text-brand" /></div>;
  if (!user && !demoMode) return <Navigate to="/login" replace />;
  if (user?.role === "HOUSEHOLD_USER" && !["/accounts", "/daily-spending", "/income", "/expenses"].includes(pathname)) {
    return <Navigate to="/accounts" replace />;
  }
  return user.role === "PARTY_USER" ? <PartyPortal /> : <Layout>{children}</Layout>;
}

function Shell() {
  const { user, checking } = useAuth();
  const guarded = (Page) => <Suspense fallback={<div className="min-h-[50vh] grid place-items-center"><Spinner className="w-7 h-7 text-brand" /></div>}><Protected><Page /></Protected></Suspense>;
  return (
    <Routes>
      <Route path="/login" element={checking ? null : user ? <Navigate to="/" replace /> : <Suspense fallback={null}><Login /></Suspense>} />
      <Route path="/sitewalkthrough" element={<Suspense fallback={<div className="min-h-screen grid place-items-center"><Spinner className="w-7 h-7 text-brand" /></div>}><SiteWalkthrough /></Suspense>} />
      <Route path="/" element={guarded(Overview)} />
      <Route path="/cash-flow" element={guarded(CashFlow)} />
      <Route path="/calendar" element={guarded(Calendar)} />
      <Route path="/daily-spending" element={guarded(DailySpending)} />
      <Route path="/data-quality" element={guarded(DataQuality)} />
      <Route path="/recurring" element={guarded(Recurring)} />
      <Route path="/debt-payoff" element={guarded(DebtPayoff)} />
      <Route path="/accounts" element={guarded(Accounts)} />
      <Route path="/income" element={guarded(Income)} />
      <Route path="/expenses" element={guarded(Expenses)} />
      <Route path="/budgets" element={guarded(Budgets)} />
      <Route path="/lending" element={guarded(Lending)} />
      <Route path="/savings" element={guarded(Savings)} />
      <Route path="/pf-ppf" element={guarded(PfPpf)} />
      <Route path="/loans" element={guarded(Loans)} />
      <Route path="/insurance" element={guarded(Insurance)} />
      <Route path="/farms" element={guarded(Farms)} />
      <Route path="/rental" element={guarded(Rental)} />
      <Route path="/net-worth" element={guarded(NetWorth)} />
      <Route path="/projects" element={guarded(Projects)} />
      <Route path="/projects/:id" element={guarded(ProjectWorkspace)} />
      <Route path="/family" element={guarded(Family)} />
      <Route path="/access-control" element={guarded(AccessControl)} />
      <Route path="/documents" element={guarded(Documents)} />
      <Route path="/settings" element={guarded(Settings)} />
      <Route path="/losses" element={guarded(Losses)} />
      <Route path="/diary" element={guarded(Diary)} />
      <Route path="/notifications" element={guarded(Notifications)} />
      <Route path="/error-log" element={guarded(ErrorLog)} />
      <Route path="/necessities" element={guarded(Necessities)} />
      <Route path="/goals" element={guarded(Goals)} />
      <Route path="/planner" element={guarded(Planner)} />
      <Route path="/calculators" element={guarded(Calculators)} />
      <Route path="/review" element={guarded(ReviewInbox)} />
      <Route path="/versions" element={guarded(VersionControl)} />
      <Route path="/smart-import" element={guarded(SmartImport)} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary><AuthProvider><BrowserRouter><Shell /></BrowserRouter></AuthProvider></ErrorBoundary>
  );
}
