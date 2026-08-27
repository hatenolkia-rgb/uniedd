"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";

interface Booking {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string;
  instrument: string;
  demo_date: string;
  demo_time: string;
  timezone: string | null;
  age_group: string | null;
  source: string | null;
  requires_payment: boolean;
  contacted: boolean;
  created_at: string;
}

export default function LeadsAdmin() {
  const supabase = getSupabaseBrowser();

  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = still checking
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [leads, setLeads] = useState<Booking[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [hideContacted, setHideContacted] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setSession(null);
      return;
    }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  const fetchLeads = useCallback(async () => {
    if (!supabase || !session) return;
    setLoadingLeads(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setFetchError(error.message);
    } else {
      setLeads((data as Booking[]) || []);
    }
    setLoadingLeads(false);
  }, [supabase, session]);

  useEffect(() => {
    if (session) fetchLeads();
  }, [session, fetchLeads]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoginError(null);
    setLoggingIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message);
    setLoggingIn(false);
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setLeads([]);
  };

  const toggleContacted = async (lead: Booking) => {
    if (!supabase) return;
    const next = !lead.contacted;
    // Optimistic update so the click feels instant
    setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, contacted: next } : l)));
    const { error } = await supabase.from("bookings").update({ contacted: next }).eq("id", lead.id);
    if (error) {
      // Roll back on failure
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, contacted: !next } : l)));
      setFetchError(`Could not update lead: ${error.message}`);
    }
  };

  if (!supabase) {
    return (
      <div className="max-w-lg mx-auto text-center py-20 px-6">
        <p className="text-sm text-[var(--muted)]">
          This page isn&rsquo;t configured yet — set{" "}
          <code className="text-xs bg-[var(--background)] px-1.5 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="text-xs bg-[var(--background)] px-1.5 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
          in your hosting environment.
        </p>
      </div>
    );
  }

  if (session === undefined) {
    return <div className="text-center py-20 text-sm text-[var(--muted)]">Loading…</div>;
  }

  if (!session) {
    return (
      <div className="max-w-sm mx-auto py-20 px-6">
        <h1 className="text-2xl font-semibold mb-1">Leads</h1>
        <p className="text-sm text-[var(--muted)] mb-8">Sign in with your UniEDD team account.</p>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-blue)]/50"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 bg-white border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:border-[var(--brand-blue)]/50"
          />
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full px-6 py-3 bg-[var(--brand-blue)] text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loggingIn ? "Signing in…" : "Sign in"}
          </button>
          {loginError && <p className="text-sm text-red-500">{loginError}</p>}
        </form>
        <p className="text-xs text-[var(--muted)] mt-6">
          Accounts are created manually in Supabase — there&rsquo;s no self-signup. Ask whoever manages the project
          to add you under Authentication → Users.
        </p>
      </div>
    );
  }

  const visibleLeads = hideContacted ? leads.filter((l) => !l.contacted) : leads;

  return (
    <div className="max-w-6xl mx-auto py-12 px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="text-sm text-[var(--muted)]">{session.user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input type="checkbox" checked={hideContacted} onChange={(e) => setHideContacted(e.target.checked)} />
            Hide contacted
          </label>
          <button
            onClick={fetchLeads}
            className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:border-[var(--brand-blue)]/40 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg hover:border-[var(--brand-blue)]/40 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {fetchError && <p className="text-sm text-red-500 mb-4">{fetchError}</p>}
      {loadingLeads && <p className="text-sm text-[var(--muted)] mb-4">Loading leads…</p>}

      {!loadingLeads && visibleLeads.length === 0 && (
        <p className="text-sm text-[var(--muted)]">No leads to show.</p>
      )}

      {visibleLeads.length > 0 && (
        <div className="overflow-x-auto border border-[var(--border)] rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--background)] text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 font-medium">Age group</th>
                <th className="px-4 py-3 font-medium">Requested slot</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Submitted</th>
                <th className="px-4 py-3 font-medium">Contacted</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads.map((lead) => (
                <tr key={lead.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 whitespace-nowrap">{lead.first_name} {lead.last_name || ""}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{lead.phone}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{lead.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{lead.instrument}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{lead.age_group || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {lead.demo_date} {lead.demo_time}
                    {lead.timezone ? ` (${lead.timezone})` : ""}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{lead.source || "website"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)]">
                    {new Date(lead.created_at).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => toggleContacted(lead)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        lead.contacted
                          ? "bg-green-500/10 text-green-600"
                          : "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                      }`}
                    >
                      {lead.contacted ? "Contacted" : "Mark contacted"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
