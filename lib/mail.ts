import "server-only";

// Envoi d'e-mails via l'API Resend (https://resend.com). Variables : RESEND_API_KEY, ADMIN_EMAIL,
// et MAIL_FROM (facultatif, adresse d'un domaine vérifié chez Resend).

const DEFAULT_FROM = "Atelier de groupe <onboarding@resend.dev>";

export function mailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function send(to: string, subject: string, html: string, text: string, from?: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: from ?? (process.env.MAIL_FROM || DEFAULT_FROM), to, subject, html, text }),
    });
    if (!res.ok) {
      // Raison du refus (ex. adresse non autorisée sans domaine vérifié). La clé n'est jamais affichée.
      const detail = (await res.json().catch(() => null)) as { message?: string } | null;
      console.error(`[e-mail] envoi refusé par Resend (${res.status}) : ${detail?.message ?? "raison inconnue"}`);
    }
    return res.ok;
  } catch {
    console.error("[e-mail] Resend injoignable");
    return false;
  }
}

export type RequestMail = {
  projectName: string;
  slug: string;
  requester: string;
  email: string;
  school: string;
  className: string;
  course: string;
  message: string;
  decisionUrl: string;
};

/** Prévient l'administrateur d'une nouvelle demande de projet. */
export async function sendRequestMail(info: RequestMail): Promise<boolean> {
  const admin = process.env.ADMIN_EMAIL;
  if (!admin || !process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== "production") {
      // En local sans e-mail configuré : le lien de décision s'affiche dans le terminal.
      console.log(`[demande de projet] ${info.projectName} : ${info.decisionUrl}`);
      return true;
    }
    return false;
  }
  const rows: Array<[string, string]> = [
    ["Projet", `${info.projectName} (${info.slug})`],
    ["Demandé par", info.requester],
    ["E-mail", info.email],
    ["École", info.school],
    ["Classe", info.className],
    ["Cours", info.course],
    ["Message", info.message || "(aucun)"],
  ];
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
      <p>Nouvelle demande de projet :</p>
      <table cellpadding="4" style="border-collapse:collapse">
        ${rows.map(([k, v]) => `<tr><td style="color:#666">${k}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`).join("")}
      </table>
      <p style="margin-top:20px">
        <a href="${escapeHtml(info.decisionUrl)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Voir la demande</a>
      </p>
      <p style="color:#666;font-size:12px">Le lien est valable 14 jours.</p>
    </div>`;
  const text = `${rows.map(([k, v]) => `${k} : ${v}`).join("\n")}\n\nVoir la demande : ${info.decisionUrl}`;
  const subject = `Demande de projet : ${info.projectName}`;
  if (await send(admin, subject, html, text)) return true;
  // Domaine d'envoi pas encore vérifié : l'adresse de test de Resend peut toujours écrire à l'administrateur.
  return process.env.MAIL_FROM ? send(admin, subject, html, text, DEFAULT_FROM) : false;
}

/** E-mails au demandeur : seulement si un domaine d'envoi est configuré (MAIL_FROM). */
export function studentMailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

/** Projet accepté : nom, mot de passe et bouton "Se connecter". */
export async function sendAcceptedMail(to: string, projectName: string, password: string, loginUrl: string) {
  if (!studentMailEnabled()) return false;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
      <p>Bonne nouvelle : ton projet est accepté.</p>
      <table cellpadding="4" style="border-collapse:collapse">
        <tr><td style="color:#666">Nom du projet</td><td><strong>${escapeHtml(projectName)}</strong></td></tr>
        <tr><td style="color:#666">Mot de passe</td><td><strong>${escapeHtml(password)}</strong></td></tr>
      </table>
      <p style="margin-top:20px">
        <a href="${escapeHtml(loginUrl)}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Se connecter</a>
      </p>
      <p style="color:#666;font-size:12px">Partage ces infos seulement avec ton groupe.</p>
    </div>`;
  const text = `Ton projet est accepté.
Nom du projet : ${projectName}
Mot de passe : ${password}
Se connecter : ${loginUrl}`;
  return send(to, `Projet accepté : ${projectName}`, html, text);
}

export type PasswordEntry = { name: string; password: string; loginUrl: string };

/** Mot de passe oublié : tous les projets créés par cette adresse, dans un seul e-mail. */
export async function sendPasswordMail(to: string, projects: PasswordEntry[]) {
  if (!studentMailEnabled() || !projects.length) return false;
  const blocks = projects
    .map(
      (p) => `
      <table cellpadding="4" style="border-collapse:collapse;margin-bottom:8px">
        <tr><td style="color:#666">Nom du projet</td><td><strong>${escapeHtml(p.name)}</strong></td></tr>
        <tr><td style="color:#666">Mot de passe</td><td><strong>${escapeHtml(p.password)}</strong></td></tr>
      </table>
      <p style="margin:0 0 20px">
        <a href="${escapeHtml(p.loginUrl)}" style="background:#111;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">Se connecter</a>
      </p>`,
    )
    .join("");
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
      <p>${projects.length > 1 ? "Voici les mots de passe de tes projets." : "Voici le mot de passe de ton projet."}</p>
      ${blocks}
      <p style="color:#666;font-size:12px">Tu n'as rien demandé ? Tu peux ignorer cet e-mail.</p>
    </div>`;
  const text = projects
    .map((p) => `Nom du projet : ${p.name}
Mot de passe : ${p.password}
Se connecter : ${p.loginUrl}`)
    .join("\n\n");
  const subject = projects.length > 1 ? "Mots de passe de tes projets" : `Mot de passe : ${projects[0].name}`;
  return send(to, subject, html, text);
}

export async function sendRefusedMail(to: string, projectName: string) {
  if (!studentMailEnabled()) return false;
  const text = `Ta demande pour le projet "${projectName}" n'a pas été acceptée.`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111"><p>${escapeHtml(text)}</p></div>`;
  return send(to, `Projet refusé : ${projectName}`, html, text);
}
