"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { logout, verificarSessaoAtiva } from "@/lib/auth";

interface Modalidade {
  id: number;
  nome: string;
}

interface Equipe {
  id: number;
  nome: string;
}

interface Partida {
  id: number;
  modalidade_id: number;
  time_a_id: number | null;
  time_b_id: number | null;
  status: string | null;
  horario: string | null;
  local: string | null;
  fase: string | null;
  ordem: number | null;
}

export default function PainelProfessorPage() {
  const [totalAlunos, setTotalAlunos] = useState<number>(0);
  const [totalEquipes, setTotalEquipes] = useState<number>(0);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function iniciar() {
      const logado = await verificarSessaoAtiva();
      if (!ativo) return;

      if (!logado) {
        window.location.replace("/professor");
        return;
      }

      try {
        setCarregando(true);

        const [resAlunos, resEquipes, resPartidas, resModalidades] =
          await Promise.all([
            supabase.from("alunos").select("id", { count: "exact", head: true }),
            supabase.from("equipes").select("id, nome"),
            supabase.from("partidas").select("*").order("id", { ascending: true }),
            supabase.from("modalidade").select("id, nome"),
          ]);

        if (!ativo) return;

        setTotalAlunos(resAlunos.count || 0);

        const eqData = (resEquipes.data || []) as Equipe[];
        setEquipes(eqData);
        setTotalEquipes(eqData.length);

        setPartidas((resPartidas.data || []) as Partida[]);
        setModalidades((resModalidades.data || []) as Modalidade[]);
      } catch (err) {
        console.error("Erro ao carregar resumo do painel:", err);
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    iniciar();

    return () => {
      ativo = false;
    };
  }, []);

  async function handleSair() {
    if (saindo) return;
    setSaindo(true);
    await logout();
  }

  function getNomeEquipe(id: number | null): string {
    if (!id) return "A definir";
    const eq = equipes.find((e) => Number(e.id) === Number(id));
    return eq ? eq.nome : "A definir";
  }

  function getNomeModalidade(id: number): string {
    const mod = modalidades.find((m) => Number(m.id) === Number(id));
    return mod ? mod.nome : "";
  }

  function formatarFase(fase: string | null, ordem: number | null): string {
    if (!fase || fase === "GRUPO") return "Fase de Grupos";
    if (fase === "SEMIFINAL") return `Semifinal ${ordem || 1}`;
    if (fase === "TERCEIRO_LUGAR") return "Disputa de 3º Lugar";
    if (fase === "FINAL") return "Grande Final";
    if (fase === "MELHOR_DE_3") return `Melhor de 3 — Jogo ${ordem || 1}`;
    return fase;
  }

  function formatarHorario(iso: string | null): string {
    if (!iso) return "Horário a definir";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Horário a definir";
    return d
      .toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(",", " às");
  }

  const totalPartidas = partidas.length;
  const totalFinalizadas = partidas.filter(
    (p) => p.status === "finalizada" || p.status === "encerrada"
  ).length;
  const totalEmAndamento = partidas.filter(
    (p) => p.status === "em_andamento"
  ).length;
  const percentualConcluido =
    totalPartidas > 0 ? Math.round((totalFinalizadas / totalPartidas) * 100) : 0;

  const proximosJogos = partidas
    .filter(
      (p) =>
        (p.status || "agendada") === "agendada" || p.status === "em_andamento"
    )
    .slice(0, 6);

  const menuItems = [
    { label: "Painel Principal", href: "/professor/painel", ativo: true },
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
                    item.ativo
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
            onClick={() => setMenuMobileAberto(!menuMobileAberto)}
            className="px-3 py-1.5 bg-slate-800 rounded-lg text-slate-200 text-xs font-bold border border-slate-700"
          >
            {menuMobileAberto ? "Fechar" : "Menu"}
          </button>
        </div>

        {menuMobileAberto && (
          <nav className="mt-4 pt-4 border-t border-slate-800 space-y-1">
            {menuItems.map((item) => {
              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuMobileAberto(false)}
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
                  onClick={() => setMenuMobileAberto(false)}
                  className={`flex items-center px-3 py-2.5 rounded-lg text-xs font-bold transition ${
                    item.ativo
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

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <h1 className="text-2xl font-black text-slate-100">
              Olá, Professor
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Resumo geral e acompanhamento das próximas partidas do torneio.
            </p>
          </div>

          {carregando ? (
            <div className="py-16 text-center text-slate-400 font-bold text-sm animate-pulse">
              Carregando indicadores...
            </div>
          ) : (
            <>
              {/* INDICADORES PRINCIPAIS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <span className="text-xs font-bold text-slate-400 block">
                    Alunos Cadastrados
                  </span>
                  <p className="text-3xl font-black text-amber-400 mt-2">
                    {totalAlunos}
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <span className="text-xs font-bold text-slate-400 block">
                    Equipes Inscritas
                  </span>
                  <p className="text-3xl font-black text-amber-400 mt-2">
                    {totalEquipes}
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">
                      Andamento dos Jogos
                    </span>
                    <span className="text-xs font-black text-amber-400">
                      {percentualConcluido}%
                    </span>
                  </div>
                  <p className="text-2xl font-black text-slate-100 mt-2">
                    {totalFinalizadas}
                    <span className="text-sm font-bold text-slate-500">
                      /{totalPartidas} concluídas
                    </span>
                  </p>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden mt-3 border border-slate-800">
                    <div
                      className="h-full bg-amber-400 transition-all duration-500"
                      style={{ width: `${percentualConcluido}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* PRÓXIMAS PARTIDAS AGENDADAS */}
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-black uppercase tracking-wider text-amber-400">
                      Próximas Partidas
                    </h2>
                    {totalEmAndamento > 0 && (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-950/60 text-amber-400 border border-amber-700/60">
                        {totalEmAndamento} em andamento
                      </span>
                    )}
                  </div>

                  <Link
                    href="/professor/partidas"
                    className="text-xs font-bold text-slate-400 hover:text-amber-400 transition"
                  >
                    Ver todas →
                  </Link>
                </div>

                {proximosJogos.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center italic">
                    Nenhuma partida agendada ou em andamento no momento.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {proximosJogos.map((jogo) => {
                      const modNome = getNomeModalidade(jogo.modalidade_id);
                      const emAndamento = jogo.status === "em_andamento";

                      return (
                        <div
                          key={jogo.id}
                          className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              {modNome && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800">
                                  {modNome}
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-slate-400">
                                {formatarFase(jogo.fase, jogo.ordem)}
                              </span>
                              {emAndamento && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/70">
                                  Em andamento
                                </span>
                              )}
                            </div>

                            <div className="text-sm font-bold text-slate-100 flex items-center gap-2 truncate">
                              <span className="truncate">
                                {getNomeEquipe(jogo.time_a_id)}
                              </span>
                              <span className="text-amber-400 font-black text-xs">
                                vs
                              </span>
                              <span className="truncate">
                                {getNomeEquipe(jogo.time_b_id)}
                              </span>
                            </div>

                            <div className="text-[11px] text-slate-500 flex flex-wrap gap-3">
                              <span>{formatarHorario(jogo.horario)}</span>
                              {jogo.local && <span>• {jogo.local}</span>}
                            </div>
                          </div>

                          <Link
                            href={`/professor/sumula/${jogo.id}`}
                            className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs rounded-xl font-black transition shrink-0"
                          >
                            Súmula
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}