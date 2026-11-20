import { supabase } from "@/lib/supabase";

/**
 * Autentica o professor via Supabase Auth (E-mail e Senha)
 */
export async function fazerLogin(
  email: string,
  senha: string
): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password: senha,
  });

  if (error) {
    if (error.message.toLowerCase().includes("invalid login credentials")) {
      return { ok: false, erro: "E-mail ou senha incorretos." };
    }
    return { ok: false, erro: error.message };
  }

  return { ok: true };
}

/**
 * Verifica de forma assíncrona se existe sessão válida no Supabase Auth
 */
export async function verificarSessaoAtiva(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return Boolean(session);
}

/**
 * Compatibilidade síncrona com páginas legadas.
 */
export function estaAutenticado(): boolean {
  if (typeof window === "undefined") return false;
  return document.cookie.includes("sb-");
}

/**
 * Encerra a sessão no Supabase Auth, limpa cookies residuais e redireciona
 */
export async function fazerLogout(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (err) {
    console.error("Erro ao encerrar sessão no Supabase:", err);
  }

  if (typeof window !== "undefined") {
    localStorage.removeItem("professor_autenticado");

    // Remove qualquer cookie residual do Supabase (sb-*) para evitar falso positivo
    document.cookie.split(";").forEach((cookie) => {
      const nome = cookie.split("=")[0]?.trim();
      if (nome && nome.startsWith("sb-")) {
        document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });

    window.location.replace("/professor");
  }
}

export const logout = fazerLogout;