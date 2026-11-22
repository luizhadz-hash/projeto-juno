"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { logout, verificarSessaoAtiva } from "@/lib/auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    let ativo = true;

    verificarSessaoAtiva().then((logado) => {
      if (!ativo) return;
      if (!logado) {
        router.replace("/professor");
      } else {
        setCarregandoAuth(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/professor");
      }
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleSair() {
    if (saindo) return;
    setSaindo(true);
    try {
      await logout();
      if (typeof window !== "undefined") {
        localStorage.removeItem("professor_autenticado");
        window.location.replace("/professor");
      }
    } catch (err) {
      console.error("Erro ao sair:", err);
      setSaindo(false);
    }
  }

  if (carregandoAuth) {
    return (
      <div className="min-h-screen bg-[#eef2f6] text-slate-900 flex items-center justify-center">
        <p className="text-slate-500 font-bold animate-pulse text-sm">
          Verificando autenticação...
        </p>
      </div>
    );
  }

  const menuItems = [
    { label: "Painel Principal", href: "/professor/painel" },
    { label: "Gerenciar Equipes", href: "/professor/equipes" },
    { label: "Gerenciar Alunos", href: "/professor/alunos" },
    { label: "Partidas & Súmulas", href: "/professor/partidas" },
    { label: "Chaveamento", href: "/professor/chaveamento" },
    {
      label: "Tabela de Classificação",
      href: "/professor/classificacao",
      external: true,
    },
    {
      label: "Painel Público",
      href: "/aluno",
      external: true,
    },
  ];

  const ehPainelPrincipal = pathname === "/professor/painel";

  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-900 flex flex-col md:flex-row w-full">
      {/* SIDEBAR DESKTOP */}
      <aside className="no-print hidden md:flex flex-col w-64 min-w-[16rem] shrink-0 bg-white border-r border-slate-200/90 p-5 justify-between h-screen sticky top-0 z-40">
        <div className="space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f06449]" />
            <p className="text-xs uppercase font-black tracking-wider text-slate-700">
              Painel do Professor
            </p>
          </div>

          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const ativo = pathname === item.href;
              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                  >
                    <span>{item.label}</span>
                    <span className="text-[11px] text-[#f06449] font-black">
                      ↗
                    </span>
                  </a>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                    ativo
                      ? "bg-[#f06449] text-white font-black shadow-xs shadow-[#f06449]/30"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={saindo}
            onClick={handleSair}
            className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
          >
            <span>{saindo ? "Saindo..." : "Sair do Sistema"}</span>
          </button>
        </div>
      </aside>

      {/* HEADER MOBILE */}
      <header className="no-print md:hidden bg-white border-b border-slate-200/90 p-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f06449]" />
            <p className="text-xs uppercase font-black tracking-wider text-slate-800">
              Painel do Professor
            </p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200/70 rounded-xl text-slate-800 text-xs font-bold border border-slate-200/80"
          >
            {mobileMenuOpen ? "Fechar" : "Menu"}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav className="mt-4 pt-4 border-t border-slate-100 space-y-1">
            {menuItems.map((item) => {
              const ativo = pathname === item.href;
              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    <span>{item.label}</span>
                    <span className="text-[11px] text-[#f06449] font-black">
                      ↗
                    </span>
                  </a>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                    ativo
                      ? "bg-[#f06449] text-white font-black"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-2 border-t border-slate-100 mt-2">
              <button
                type="button"
                disabled={saindo}
                onClick={handleSair}
                className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                {saindo ? "Saindo..." : "Sair do Sistema"}
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* ÁREA DE CONTEÚDO */}
      <div className="flex-1 flex flex-col min-w-0">
        {!ehPainelPrincipal && (
          <div className="no-print bg-white/80 backdrop-blur-xs border-b border-slate-200/80 px-4 md:px-8 py-3 flex items-center justify-between">
            <Link
              href="/professor/painel"
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-[#e05338] bg-slate-50 hover:bg-white px-3.5 py-2 rounded-xl border border-slate-200/90 shadow-2xs transition"
            >
              <span className="text-[#f06449] font-black">←</span>
              <span>Voltar ao painel</span>
            </Link>
          </div>
        )}

        <main className="print-container flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}