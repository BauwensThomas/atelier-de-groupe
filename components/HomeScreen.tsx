"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, MailCheck, Users, X } from "lucide-react";
import { Turnstile, turnstileActive } from "./Turnstile";

type ProjectLink = { slug: string; name: string; prof?: boolean };
type Props = { projects: ProjectLink[]; initialProject: string; year: number };
type Tab = "join" | "request";

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

/** Nom de projet : chaque espace devient un trait d'union (sans doublon). */
function projectNameInput(value: string): string {
  return value.replace(/\s/g, "-").replace(/-{2,}/g, "-");
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-3">
      <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint && <div className="mt-1 text-xs">{hint}</div>}
    </div>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

async function post(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data: data as { error?: string; captcha?: boolean; slug?: string } };
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || loading) return;
    if (turnstileActive && !token) {
      setError("Coche la case pour confirmer que tu n'es pas un robot.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { ok, data } = await post("/api/projects/forgot", { email, turnstileToken: token });
      if (ok) setDone((data as { message?: string }).message ?? "Demande envoyée.");
      else setError(data.error ?? "Envoi impossible.");
    } catch {
      setError("Envoi impossible. Vérifie ta connexion internet.");
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div className="py-2 text-center">
        <MailCheck size={26} className="mx-auto mb-2 text-green-600" aria-hidden />
        <p className="text-sm text-neutral-700">{done}</p>
        <button type="button" onClick={onBack} className="mt-4 text-sm font-medium text-neutral-700 underline underline-offset-2">
          Retour
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="mb-3 text-sm text-neutral-600">
        Indique l&apos;adresse e-mail utilisée pour créer le projet. Tu y recevras le nom et le mot de passe de tes
        projets.
      </p>
      <Field label="E-mail de la personne qui a créé le projet" htmlFor="forgot-email">
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          className={inputClass}
        />
      </Field>
      <Turnstile onToken={setToken} />
      {error && (
        <p role="alert" className="my-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <SubmitButton loading={loading}>Envoyer le mot de passe par e-mail</SubmitButton>
      <button type="button" onClick={onBack} className="mt-3 w-full text-center text-sm text-neutral-500 hover:text-neutral-800">
        Retour
      </button>
    </form>
  );
}

function JoinForm({ initialProject }: { initialProject: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialProject);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needCaptcha, setNeedCaptcha] = useState(false);
  const [token, setToken] = useState("");
  const [forgot, setForgot] = useState(false);
  const [wrong, setWrong] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !password || loading) return;
    setLoading(true);
    setError("");
    try {
      const { ok, data } = await post("/api/projects/join", { name, password, turnstileToken: token });
      if (ok && data.slug) {
        router.push(`/p/${encodeURIComponent(data.slug)}`);
        return;
      }
      setError(data.error ?? "Connexion impossible.");
      setWrong(true);
      if (data.captcha) setNeedCaptcha(true);
    } catch {
      setError("Connexion impossible. Vérifie ta connexion internet.");
    }
    setLoading(false);
  }

  if (forgot) return <ForgotForm onBack={() => setForgot(false)} />;

  return (
    <form onSubmit={onSubmit}>
      <Field label="Nom du projet" htmlFor="join-name">
        <input
          id="join-name"
          value={name}
          onChange={(e) => setName(projectNameInput(e.target.value))}
          autoFocus={!initialProject}
          className={inputClass}
        />
      </Field>
      <Field label="Mot de passe" htmlFor="join-password">
        <input
          id="join-password"
          type="password"
          autoComplete="current-password"
          autoFocus={Boolean(initialProject)}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </Field>
      {needCaptcha && <Turnstile onToken={setToken} />}
      {error && (
        <p role="alert" className="mb-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <SubmitButton loading={loading}>Entrer</SubmitButton>
      <button
        type="button"
        onClick={() => setForgot(true)}
        className={`mt-3 w-full text-center text-sm ${wrong ? "font-medium text-neutral-800 underline underline-offset-2" : "text-neutral-500 hover:text-neutral-800"}`}
      >
        {wrong ? "Mot de passe oublié ? Le recevoir par e-mail" : "Mot de passe oublié ?"}
      </button>
    </form>
  );
}

type Availability = { state: "idle" | "checking" | "free" | "taken" | "invalid"; slug?: string; message?: string };

function RequestForm({ onSent }: { onSent: (name: string) => void }) {
  const [form, setForm] = useState({
    name: "",
    firstName: "",
    lastName: "",
    email: "",
    school: "",
    className: "",
    course: "",
    message: "",
    password: "",
    confirm: "",
  });
  const [availability, setAvailability] = useState<Availability>({ state: "idle" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState("");

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Vérifie le nom pendant la saisie (après une courte pause).
  useEffect(() => {
    const name = form.name.trim();
    if (!name) {
      // Champ vidé : on efface tout de suite l'indication de disponibilité.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAvailability({ state: "idle" });
      return;
    }
    setAvailability((a) => ({ ...a, state: "checking" }));
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/check?name=${encodeURIComponent(name)}`);
        const data = (await res.json()) as { slug?: string; available?: boolean; error?: string };
        if (data.error) setAvailability({ state: "invalid", slug: data.slug, message: data.error });
        else setAvailability({ state: data.available ? "free" : "taken", slug: data.slug });
      } catch {
        setAvailability({ state: "idle" });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.name]);

  const mismatch = form.confirm.length > 0 && form.password !== form.confirm;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (form.password !== form.confirm) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    if (turnstileActive && !token) {
      setError("Confirme que tu n'es pas un robot.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { ok, data } = await post("/api/projects/request", { ...form, turnstileToken: token });
      if (ok) {
        onSent(form.name.trim());
        return;
      }
      setError(data.error ?? "La demande n'a pas pu être envoyée.");
    } catch {
      setError("La demande n'a pas pu être envoyée. Vérifie ta connexion internet.");
    }
    setLoading(false);
  }

  const nameHint =
    availability.state === "checking" ? (
      <span className="text-neutral-400">Vérification…</span>
    ) : availability.state === "free" ? (
      <span className="flex items-center gap-1 text-green-700">
        <Check size={13} aria-hidden /> Disponible, adresse : /p/{availability.slug}
      </span>
    ) : availability.state === "taken" ? (
      <span className="flex items-center gap-1 text-red-600">
        <X size={13} aria-hidden /> Ce nom est déjà utilisé.
      </span>
    ) : availability.state === "invalid" ? (
      <span className="text-red-600">{availability.message}</span>
    ) : null;

  return (
    <form onSubmit={onSubmit}>
      <Field label="Nom du projet" htmlFor="req-name" hint={nameHint}>
        <input
          id="req-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: projectNameInput(e.target.value) }))}
          maxLength={40}
          className={inputClass}
          autoFocus
        />
      </Field>
      <div className="grid gap-x-3 sm:grid-cols-3">
        <Field label="Prénom" htmlFor="req-first">
          <input id="req-first" value={form.firstName} onChange={set("firstName")} maxLength={40} autoComplete="given-name" className={inputClass} />
        </Field>
        <Field label="Nom" htmlFor="req-last">
          <input id="req-last" value={form.lastName} onChange={set("lastName")} maxLength={40} autoComplete="family-name" className={inputClass} />
        </Field>
        <Field
          label="E-mail personnel"
          htmlFor="req-email"
          hint={
            /@([a-z0-9-]+\.)*ephec\.be\s*$/i.test(form.email) ? (
              <span className="text-amber-700">
                Les adresses de l&apos;école bloquent nos e-mails : utilise plutôt ton adresse personnelle.
              </span>
            ) : (
              <span className="text-neutral-900">Gmail, Outlook.com… (pas @ de l&apos;école)</span>
            )
          }
        >
          <input id="req-email" type="email" value={form.email} onChange={set("email")} maxLength={120} autoComplete="email" className={inputClass} />
        </Field>
        <Field label="École" htmlFor="req-school">
          <input id="req-school" value={form.school} onChange={set("school")} maxLength={100} className={inputClass} />
        </Field>
        <Field label="Classe" htmlFor="req-class">
          <input id="req-class" value={form.className} onChange={set("className")} maxLength={60} className={inputClass} />
        </Field>
        <Field label="Cours" htmlFor="req-course">
          <input id="req-course" value={form.course} onChange={set("course")} maxLength={80} className={inputClass} />
        </Field>
      </div>
      <Field label="Message (facultatif)" htmlFor="req-message">
        <textarea id="req-message" value={form.message} onChange={set("message")} maxLength={240} rows={2} className={`${inputClass} resize-none`} />
      </Field>
      <div className="grid gap-x-3 sm:grid-cols-3">
        <Field label="Mot de passe du projet" htmlFor="req-password" hint={<span className="text-neutral-400">6 caractères minimum</span>}>
          <input id="req-password" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} className={inputClass} />
        </Field>
        <Field
          label="Confirmer le mot de passe"
          htmlFor="req-confirm"
          hint={mismatch ? <span className="text-red-600">Pas identique.</span> : undefined}
        >
          <input id="req-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} className={inputClass} />
        </Field>
      </div>
      <Turnstile onToken={setToken} />
      {error && (
        <p role="alert" className="my-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <SubmitButton loading={loading}>Envoyer la demande</SubmitButton>
      <p className="mt-2 text-center text-xs text-neutral-500">
        Ta demande sera examinée avant l&apos;ouverture du projet. Une fois acceptée, tu reçois un e-mail avec le nom du
        projet et le mot de passe.
      </p>
    </form>
  );
}

export function HomeScreen({ projects, initialProject, year }: Props) {
  const [tab, setTab] = useState<Tab>("join");
  const [sent, setSent] = useState("");

  return (
    <main className="flex min-h-screen flex-col items-center px-4 pt-10 pb-6">
      <div className="flex w-full flex-1 items-start justify-center sm:items-center">
      <div className={`w-full transition-[max-width] ${tab === "request" && !sent ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <Users size={20} aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Atelier de groupe</h1>
            <p className="text-sm text-neutral-500">Espace de travail pour les projets de groupe</p>
          </div>
        </div>

        {projects.length > 0 && (
          <section className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Mes projets</h2>
              <button
                type="button"
                onClick={async () => {
                  await fetch("/api/projects/logout", { method: "POST" }).catch(() => null);
                  window.location.href = "/";
                }}
                className="text-[11px] text-neutral-500 underline underline-offset-2 hover:text-neutral-800"
              >
                Se déconnecter
              </button>
            </div>
            <ul className="flex flex-col">
              {[...projects].reverse().map((p) => (
                <li key={p.slug}>
                  <a
                    href={`/p/${encodeURIComponent(p.slug)}`}
                    className="-mx-2 flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-neutral-50"
                  >
                    <span className="truncate font-medium">{p.name}</span>
                    {p.prof && <span className="ml-2 shrink-0 rounded bg-fuchsia-100 px-1.5 text-[11px] font-semibold text-fuchsia-800">Professeur</span>}
                    <span className="flex-1" />
                    <ChevronRight size={16} className="shrink-0 text-neutral-400" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-neutral-200">
          {sent ? (
            <div className="py-4 text-center">
              <MailCheck size={28} className="mx-auto mb-3 text-green-600" aria-hidden />
              <p className="font-medium">Demande envoyée pour « {sent} »</p>
              <p className="mt-1 text-sm text-neutral-500">
                Elle sera examinée avant l&apos;ouverture du projet. Dès qu&apos;elle est acceptée, tu reçois un e-mail
                avec le nom du projet, le mot de passe et un bouton pour te connecter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSent("");
                  setTab("join");
                }}
                className="mt-4 text-sm font-medium text-neutral-700 underline underline-offset-2"
              >
                Retour
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 rounded-lg bg-neutral-100 p-1 text-sm font-medium" role="tablist">
                {(
                  [
                    ["join", "Rejoindre un projet"],
                    ["request", "Demander un projet"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={tab === value}
                    onClick={() => setTab(value)}
                    className={`rounded-md px-3 py-1.5 transition ${tab === value ? "bg-white shadow-sm" : "text-neutral-500 hover:text-neutral-800"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tab === "join" ? (
                <JoinForm initialProject={initialProject} />
              ) : (
                <RequestForm onSent={setSent} />
              )}
            </>
          )}
        </section>
      </div>
      </div>
      <footer className="mt-8 flex items-center gap-4 text-xs text-neutral-400">
        <a href="/aide" className="font-medium text-neutral-600 underline underline-offset-2 hover:text-neutral-900">
          Mode d&apos;emploi
        </a>
        <span>© {year} Belgacai</span>
      </footer>
    </main>
  );
}
