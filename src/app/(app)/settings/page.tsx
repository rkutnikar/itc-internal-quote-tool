"use client";

import { useEffect, useState } from "react";
import SectionCard from "@/components/settings/section-card";
import Field from "@/components/settings/field";
import { SaveFeedback, type SaveState } from "@/components/settings/save-feedback";
import PricingRulesSection from "@/components/settings/pricing-rules-section";
import type { PricingConfig } from "@/lib/pricing";
import { fetchJson } from "@/components/use-api";

interface PublicSettings {
  frappe: {
    url: string;
    apiKey: string;
    apiSecretSet: boolean;
    urlFromEnv: boolean;
    credentialsFromEnv: boolean;
  };
  fields: {
    customerPriority: string;
    employeeCtc: string;
    supplierRate: string;
    supplierIsConsultant: string;
  };
  general: {
    currency: string;
    quoteValidityDays: number;
  };
  pricing: PricingConfig;
  document: {
    companyName: string;
    companyAddress: string;
    termsText: string;
    footerNote: string;
    showDiscount: boolean;
  };
  auth: {
    passwordSet: boolean;
    passwordFromEnv: boolean;
  };
}

type TestStatus = "pass" | "fail" | "warn" | "skipped";

interface TestResult {
  id: string;
  label: string;
  status: TestStatus;
  detail: string;
  fix?: string;
}

async function putSettings<T>(body: T): Promise<PublicSettings> {
  return fetchJson<PublicSettings>("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    document.title = "Settings — ITC Quote Tool";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const data = await fetchJson<PublicSettings>("/api/settings");
        if (!cancelled) setSettings(data);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load settings.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  return (
    <div className="flex flex-col gap-10">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Configuration</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Connect the tool to your Frappe site, map custom fields, and manage the shared
          team password.
        </p>
      </header>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-warning-light px-4 py-3 text-sm text-warning">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => setRetryTick((t) => t + 1)}
            className="inline-flex items-center justify-center rounded-sm border border-warning px-3 py-1.5 text-xs font-medium text-warning transition hover:bg-warning hover:text-paper"
          >
            Retry
          </button>
        </div>
      )}

      {!settings && !loadError && <SettingsSkeleton />}

      {settings && (
        <div className="flex flex-col gap-8">
          <FrappeConnectionSection
            initial={settings.frappe}
            onSaved={(frappe) => setSettings((s) => (s ? { ...s, frappe } : s))}
          />
          <ConnectionTestSection />
          <FieldMappingSection
            initial={settings.fields}
            onSaved={(fields) => setSettings((s) => (s ? { ...s, fields } : s))}
          />
          <GeneralSection
            initial={settings.general}
            onSaved={(general) => setSettings((s) => (s ? { ...s, general } : s))}
          />
          <PricingRulesSection
            initial={settings.pricing}
            currency={settings.general.currency}
            onSaved={(pricing) => setSettings((s) => (s ? { ...s, pricing } : s))}
          />
          <QuoteDocumentSection
            initial={settings.document}
            onSaved={(document) => setSettings((s) => (s ? { ...s, document } : s))}
          />
          <SecuritySection auth={settings.auth} />
        </div>
      )}
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-sm border border-border bg-border/20" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Frappe Connection
// ---------------------------------------------------------------------------

function FrappeConnectionSection({
  initial,
  onSaved,
}: {
  initial: PublicSettings["frappe"];
  onSaved: (frappe: PublicSettings["frappe"]) => void;
}) {
  const [url, setUrl] = useState(initial.url);
  const [apiKey, setApiKey] = useState(initial.apiKey);
  const [apiSecret, setApiSecret] = useState("");
  const [state, setState] = useState<SaveState>({ status: "idle" });

  const envLocked = initial.urlFromEnv || initial.credentialsFromEnv;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "saving" });
    try {
      const updated = await putSettings({
        frappe: { url: url.trim(), apiKey: apiKey.trim(), apiSecret: apiSecret.trim() },
      });
      setApiSecret("");
      onSaved(updated.frappe);
      setState({ status: "saved" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save.",
      });
    }
  }

  return (
    <SectionCard
      title="Frappe Connection"
      description="Credentials used to talk to your ERPNext / Frappe site."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field
          id="frappe-url"
          label="Site URL"
          type="url"
          placeholder="https://erp.example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={initial.urlFromEnv}
          helperText={
            initial.urlFromEnv
              ? "Set via environment variable on the server."
              : "The base URL of your Frappe site, no trailing slash."
          }
        />
        <Field
          id="frappe-api-key"
          label="API Key"
          type="text"
          autoComplete="off"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={initial.credentialsFromEnv}
          helperText={
            initial.credentialsFromEnv
              ? "Set via environment variable on the server."
              : "Frappe API key for the integration user."
          }
        />
        <Field
          id="frappe-api-secret"
          label="API Secret"
          type="password"
          autoComplete="off"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          disabled={initial.credentialsFromEnv}
          placeholder={initial.apiSecretSet ? "•••••••• (unchanged)" : ""}
          helperText={
            initial.credentialsFromEnv
              ? "Set via environment variable on the server."
              : "Leave blank to keep the currently saved secret."
          }
        />

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={state.status === "saving" || envLocked}
            className="inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.status === "saving" ? "Saving…" : "Save connection"}
          </button>
          <SaveFeedback state={state} />
        </div>
        {envLocked && (
          <p className="text-xs text-muted">
            Some fields are locked because they are set via environment variables.
          </p>
        )}
      </form>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Connection Test
// ---------------------------------------------------------------------------

const STATUS_META: Record<TestStatus, { icon: string; color: string; label: string }> = {
  pass: { icon: "✓", color: "text-accent bg-accent-light", label: "Pass" },
  warn: { icon: "⚠", color: "text-amber bg-amber-light", label: "Warning" },
  fail: { icon: "✕", color: "text-warning bg-warning-light", label: "Fail" },
  skipped: { icon: "–", color: "text-muted bg-paper", label: "Skipped" },
};

function ConnectionTestSection() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runTest() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/test", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        results?: TestResult[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Connection test failed.");
      setResults(data.results ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <SectionCard
      title="Run Connection Test"
      description="Verifies reachability, authentication, and required field mappings. Takes up to ~30 seconds."
    >
      <div>
        <button
          type="button"
          onClick={runTest}
          disabled={running}
          className="inline-flex items-center justify-center gap-2 rounded-sm border border-accent bg-accent-light px-4 py-2.5 text-sm font-medium text-accent transition duration-150 hover:bg-accent hover:text-paper disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running && (
            <span
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
          )}
          {running ? "Running test…" : "Run connection test"}
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-sm bg-warning-light px-3 py-2 text-sm text-warning">
          {error}
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="flex flex-col gap-3">
          {results.map((r) => {
            const meta = STATUS_META[r.status];
            return (
              <li key={r.id} className="rounded-sm border border-border p-4">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold ${meta.color}`}
                  >
                    {meta.icon}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-medium text-ink">{r.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{r.detail}</p>
                    {r.fix && (
                      <p className="mt-2 pl-3 text-xs text-muted border-l-2 border-border">
                        <span className="font-medium text-ink">How to fix: </span>
                        {r.fix}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Field Mapping
// ---------------------------------------------------------------------------

function FieldMappingSection({
  initial,
  onSaved,
}: {
  initial: PublicSettings["fields"];
  onSaved: (fields: PublicSettings["fields"]) => void;
}) {
  const [customerPriority, setCustomerPriority] = useState(initial.customerPriority);
  const [employeeCtc, setEmployeeCtc] = useState(initial.employeeCtc);
  const [supplierRate, setSupplierRate] = useState(initial.supplierRate);
  const [supplierIsConsultant, setSupplierIsConsultant] = useState(initial.supplierIsConsultant);
  const [state, setState] = useState<SaveState>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "saving" });
    try {
      const updated = await putSettings({
        fields: {
          customerPriority: customerPriority.trim(),
          employeeCtc: employeeCtc.trim(),
          supplierRate: supplierRate.trim(),
          supplierIsConsultant: supplierIsConsultant.trim(),
        },
      });
      onSaved(updated.fields);
      setState({ status: "saved" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save.",
      });
    }
  }

  return (
    <SectionCard
      title="Field Mapping"
      description="Fieldnames in your Frappe DocTypes that the tool reads from."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field
          id="field-customer-priority"
          label="Customer priority field"
          type="text"
          value={customerPriority}
          onChange={(e) => setCustomerPriority(e.target.value)}
          helperText="Fieldname on Customer that stores priority (P1/P2/P3)."
        />
        <Field
          id="field-employee-ctc"
          label="Employee CTC field"
          type="text"
          value={employeeCtc}
          onChange={(e) => setEmployeeCtc(e.target.value)}
          helperText="Fieldname on Employee that stores annual CTC."
        />
        <Field
          id="field-supplier-rate"
          label="Supplier rate field"
          type="text"
          value={supplierRate}
          onChange={(e) => setSupplierRate(e.target.value)}
          helperText="Fieldname on Supplier that stores the monthly rate."
        />
        <Field
          id="field-supplier-is-consultant"
          label="Supplier is-consultant field"
          type="text"
          value={supplierIsConsultant}
          onChange={(e) => setSupplierIsConsultant(e.target.value)}
          helperText="Fieldname on Supplier that flags whether the supplier is a consultant."
        />

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={state.status === "saving"}
            className="inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.status === "saving" ? "Saving…" : "Save field mapping"}
          </button>
          <SaveFeedback state={state} />
        </div>
      </form>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// General
// ---------------------------------------------------------------------------

function GeneralSection({
  initial,
  onSaved,
}: {
  initial: PublicSettings["general"];
  onSaved: (general: PublicSettings["general"]) => void;
}) {
  const [currency, setCurrency] = useState(initial.currency);
  const [quoteValidityDays, setQuoteValidityDays] = useState(String(initial.quoteValidityDays));
  const [state, setState] = useState<SaveState>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const days = Number(quoteValidityDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setState({ status: "error", message: "Quote validity must be a whole number between 1 and 365." });
      return;
    }
    setState({ status: "saving" });
    try {
      const updated = await putSettings({
        general: { currency: currency.trim(), quoteValidityDays: days },
      });
      onSaved(updated.general);
      setState({ status: "saved" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save.",
      });
    }
  }

  return (
    <SectionCard title="General" description="Defaults used across quotes.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field
          id="general-currency"
          label="Currency"
          type="text"
          placeholder="INR"
          maxLength={8}
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          helperText="ISO currency code used for quote totals, e.g. INR."
        />
        <Field
          id="general-quote-validity"
          label="Quote validity (days)"
          type="number"
          min={1}
          max={365}
          value={quoteValidityDays}
          onChange={(e) => setQuoteValidityDays(e.target.value)}
          helperText="How many days a generated quote stays valid for."
        />

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={state.status === "saving"}
            className="inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.status === "saving" ? "Saving…" : "Save general settings"}
          </button>
          <SaveFeedback state={state} />
        </div>
      </form>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Quote Document
// ---------------------------------------------------------------------------

function QuoteDocumentSection({
  initial,
  onSaved,
}: {
  initial: PublicSettings["document"];
  onSaved: (document: PublicSettings["document"]) => void;
}) {
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [companyAddress, setCompanyAddress] = useState(initial.companyAddress);
  const [termsText, setTermsText] = useState(initial.termsText);
  const [footerNote, setFooterNote] = useState(initial.footerNote);
  const [showDiscount, setShowDiscount] = useState(initial.showDiscount);
  const [state, setState] = useState<SaveState>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (companyName.trim().length > 120) {
      setState({ status: "error", message: "Company name must be 120 characters or fewer." });
      return;
    }
    if (companyAddress.length > 400) {
      setState({ status: "error", message: "Company address must be 400 characters or fewer." });
      return;
    }
    if (termsText.length > 4000) {
      setState({ status: "error", message: "Terms text must be 4000 characters or fewer." });
      return;
    }
    if (footerNote.trim().length > 300) {
      setState({ status: "error", message: "Footer note must be 300 characters or fewer." });
      return;
    }
    setState({ status: "saving" });
    try {
      const updated = await putSettings({
        document: {
          companyName: companyName.trim(),
          companyAddress,
          termsText,
          footerNote: footerNote.trim(),
          showDiscount,
        },
      });
      onSaved(updated.document);
      setState({ status: "saved" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save.",
      });
    }
  }

  return (
    <SectionCard
      title="Quote Document"
      description="Branding and boilerplate text used on the client-facing quote PDF."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field
          id="document-company-name"
          label="Company name"
          type="text"
          maxLength={120}
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="document-company-address"
            className="text-xs font-medium uppercase tracking-wide text-muted"
          >
            Company address
          </label>
          <textarea
            id="document-company-address"
            rows={3}
            maxLength={400}
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="document-terms-text"
            className="text-xs font-medium uppercase tracking-wide text-muted"
          >
            Terms text
          </label>
          <textarea
            id="document-terms-text"
            rows={6}
            maxLength={4000}
            value={termsText}
            onChange={(e) => setTermsText(e.target.value)}
            className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
          />
          <p className="text-xs text-muted">Printed in the Terms block of every quote PDF.</p>
        </div>

        <Field
          id="document-footer-note"
          label="Footer note"
          type="text"
          maxLength={300}
          value={footerNote}
          onChange={(e) => setFooterNote(e.target.value)}
          helperText="Optional; defaults to quote number + date."
        />

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={showDiscount}
              onChange={(e) => setShowDiscount(e.target.checked)}
              className="h-4 w-4 rounded-sm border-border text-accent focus:ring-accent-light"
            />
            Show applied discount on the client PDF
          </label>
          <p className="text-xs text-muted">
            When off, the discounted rate is shown with no mention of a discount.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={state.status === "saving"}
            className="inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.status === "saving" ? "Saving…" : "Save quote document"}
          </button>
          <SaveFeedback state={state} />
        </div>
      </form>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

function SecuritySection({ auth }: { auth: PublicSettings["auth"] }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState<SaveState>({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      setState({ status: "error", message: "Password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setState({ status: "error", message: "Passwords do not match." });
      return;
    }
    setState({ status: "saving" });
    try {
      await putSettings({ newPassword });
      setNewPassword("");
      setConfirmPassword("");
      setState({ status: "saved" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save.",
      });
    }
  }

  return (
    <SectionCard title="Security" description="Shared password used to access this tool.">
      {auth.passwordFromEnv ? (
        <p className="text-sm text-muted">
          Password is managed via <code className="text-xs">APP_PASSWORD</code> env var.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field
            id="security-new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="At least 8 characters. Shared by everyone on the team."
          />
          <Field
            id="security-confirm-password"
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={state.status === "saving"}
              className="inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state.status === "saving" ? "Saving…" : "Change password"}
            </button>
            <SaveFeedback state={state} />
          </div>
        </form>
      )}
    </SectionCard>
  );
}
