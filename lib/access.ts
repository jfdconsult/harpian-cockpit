/**
 * Cockpit Access Gate — controle de acesso ao Harpian Cockpit (gestores).
 *
 * Mesmo mecanismo do gate da apresentacao institucional e do Terminal:
 * allowlist de emails + senha compartilhada + sessao JWT httpOnly. Substitui
 * o HTTP Basic Auth anterior (COCKPIT_AUTH_USER/PASS) por uma tela de login
 * propria, com a mesma UX das outras duas frentes Harpian.
 *
 * - Emails autorizados: allowlist explicito (case-insensitive)
 * - Senha compartilhada: hash bcrypt (cost 12)
 * - Sessao: JWT httpOnly cookie, 7 dias
 * - Log: cada acesso registra email + user-agent + timestamp (server logs)
 */

export const ACCESS_COOKIE = "harpian_cockpit_access";
export const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dias

/**
 * Allowlist de emails autorizados a acessar o Cockpit.
 * Comparacao case-insensitive. Trimmed.
 * Editar aqui e commitar para adicionar/remover usuarios.
 */
export const ALLOWED_EMAILS: readonly string[] = [
  "dj@harpian.com",
  "ds@harpian.com",
  "jfd@harpian.com",
  "jz@harpian.com",
  "jp@harpian.com",
] as const;

/**
 * Hash bcrypt (cost 12) da senha compartilhada do Cockpit.
 * Gerado com: bcryptjs.hashSync('<senha>', 12) — senha entregue fora do
 * codigo (ver handoff da sessao que criou este gate).
 *
 * Em ambiente produtivo, mover para env var COCKPIT_PASSWORD_HASH
 * (fallback prioritario nesta constante). Hash e one-way — leaked hash
 * nao expoe a senha diretamente.
 */
export const PASSWORD_HASH_FALLBACK =
  "$2b$12$4jAE5dqNwWtA.zvg/5Gin.gO90QNrEFlHZn4xCATh4Wy/6lFHmVWO";

export function getPasswordHash(): string {
  return process.env.COCKPIT_PASSWORD_HASH || PASSWORD_HASH_FALLBACK;
}

export function isEmailAllowed(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return ALLOWED_EMAILS.some((allowed) => allowed.toLowerCase() === normalized);
}

export interface AccessTokenPayload {
  sub: string; // email
  email: string;
  iat?: number;
  exp?: number;
}
