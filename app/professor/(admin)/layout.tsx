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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-slate-400 font-bold animate-pulse text-sm">
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row w-full">
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col w-64 min-w-[16rem] shrink-0 bg-slate-900 border-r border-slate-800 p-5 justify-between h-screen sticky top-0 z-40">
        <div className="space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-xl font-black text-amber-400 tracking-wider">
              PROJETO JUNO
            </h2>
            <p className="text-[10px] uppercase font-bold text-slate-500 mt-1">
              Painel do Professor
            </p>
          </div>

          <nav className="space-y-1">
            {menuItems.map((item) => {
              const ativo = pathname === item.href;
              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
                  >
                    <span>{item.label}</span>
                    <span className="text-[11px] text-amber-400 font-normal">
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
                      ? "bg-amber-400 text-slate-950 font-black"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <button
            type="button"
            disabled={saindo}
            onClick={handleSair}
            className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-950/40 hover:text-red-300 transition disabled:opacity-50"
          >
            <span>{saindo ? "Saindo..." : "Sair do Sistema"}</span>
          </button>
        </div>
      </aside>

      {/* HEADER MOBILE */}
      <header className="md:hidden bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-amber-400">PROJETO JUNO</h2>
            <p className="text-[10px] font-bold text-slate-500">
              Painel do Professor
            </p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="px-3 py-1.5 bg-slate-800 rounded-lg text-slate-200 text-xs font-bold border border-slate-700"
          >
            {mobileMenuOpen ? "Fechar" : "Menu"}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav className="mt-4 pt-4 border-t border-slate-800 space-y-1">
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
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-800"
                  >
                    <span>{item.label}</span>
                    <span className="text-[11px] text-amber-400">↗</span>
                  </a>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center px-3 py-2.5 rounded-lg text-xs font-bold transition ${
                    ativo
                      ? "bg-amber-400 text-slate-950 font-black"
                      : "text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <div className="pt-2 border-t border-slate-800 mt-2">
              <button
                type="button"
                disabled={saindo}
                onClick={handleSair}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-red-400 hover:bg-red-950/30 disabled:opacity-50"
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
          <div className="bg-slate-900/60 border-b border-slate-800 px-4 md:px-8 py-3 flex items-center justify-between">
            <Link
              href="/professor/painel"
              className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-amber-400 bg-slate-800/80 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700/80 transition"
            >
              <span>←</span>
              <span>Voltar ao painel</span>
            </Link>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              PROJETO JUNO • Gestão Escolar
            </span>
          </div>
        )}

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}