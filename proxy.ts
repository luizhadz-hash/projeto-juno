import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Valida o usuário autenticado no servidor do Supabase
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protege todas as sub-rotas de /professor/* (ex: /professor/painel, /professor/sumula/1, /professor/partidas, etc.)
  const ehRotaProtegida = pathname.startsWith("/professor/");

  if (ehRotaProtegida && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/professor";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  // Se já estiver autenticado e acessar /professor, redireciona para o painel
  if (pathname === "/professor" && user) {
    const painelUrl = request.nextUrl.clone();
    painelUrl.pathname = "/professor/painel";
    return NextResponse.redirect(painelUrl);
  }

  return response;
}

export const config = {
  matcher: ["/professor", "/professor/:path*"],
};