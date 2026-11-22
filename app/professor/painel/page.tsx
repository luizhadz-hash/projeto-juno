"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { logout, verificarSessaoAtiva } from "@/lib/auth";
import QrCodeAluno from "@/app/components/QrCodeAluno";

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
                    item.ativo
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
            <p className="text-xs font-black uppercase tracking-wider text-slate-800">
              Painel do Professor
            </p>
          </div>
          <button
            onClick={() => setMenuMobileAberto(!menuMobileAberto)}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200/70 rounded-xl text-slate-800 text-xs font-bold border border-slate-200/80"
          >
            {menuMobileAberto ? "Fechar" : "Menu"}
          </button>
        </div>

        {menuMobileAberto && (
          <nav className="mt-4 pt-4 border-t border-slate-100 space-y-1">
            {menuItems.map((item) => {
              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMenuMobileAberto(false)}
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
                  onClick={() => setMenuMobileAberto(false)}
                  className={`flex items-center px-3 py-2.5 rounded-xl text-xs font-bold transition ${
                    item.ativo
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

      {/* ÁREA PRINCIPAL */}
      <main className="print-container flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full space-y-5">
          {/* HERO TÁTICO BENTO */}
          <div className="no-print bento-hero court-grid-bg p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Olá, Professor
            </h1>
            <p className="text-xs sm:text-sm text-slate-200/90 mt-1">
              Resumo geral, andamento das partidas e cartaz de acesso público do torneio.
            </p>
          </div>

          {carregando ? (
            <div className="no-print bento-card py-16 text-center text-slate-500 font-bold text-sm animate-pulse">
              Carregando indicadores...
            </div>
          ) : (
            <>
              {/* INDICADORES PRINCIPAIS */}
              <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bento-card p-5 sm:p-6">
                  <span className="text-xs font-bold text-slate-500 block">
                    Alunos Cadastrados
                  </span>
                  <p className="text-3xl font-black text-slate-900 mt-2">
                    {totalAlunos}
                  </p>
                </div>

                <div className="bento-card p-5 sm:p-6">
                  <span className="text-xs font-bold text-slate-500 block">
                    Equipes Inscritas
                  </span>
                  <p className="text-3xl font-black text-[#e05338] mt-2">
                    {totalEquipes}
                  </p>
                </div>

                <div className="bento-card p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">
                      Andamento dos Jogos
                    </span>
                    <span className="text-xs font-black text-[#52657a] bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {percentualConcluido}%
                    </span>
                  </div>
                  <p className="text-2xl font-black text-slate-900 mt-2">
                    {totalFinalizadas}
                    <span className="text-sm font-bold text-slate-400">
                      /{totalPartidas} concluídas
                    </span>
                  </p>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-3">
                    <div
                      className="h-full bg-[#f06449] rounded-full transition-all duration-500"
                      style={{ width: `${percentualConcluido}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* GRID BENTO: PRÓXIMAS PARTIDAS + CARTAZ QR CODE */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* PRÓXIMAS PARTIDAS AGENDADAS */}
                <div className="no-print lg:col-span-8 bento-card p-5 sm:p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3.5">
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                        Próximas Partidas
                      </h2>
                      {totalEmAndamento > 0 && (
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#f06449]/15 text-[#e05338]">
                          {totalEmAndamento} em andamento
                        </span>
                      )}
                    </div>

                    <Link
                      href="/professor/partidas"
                      className="text-xs font-bold text-[#52657a] hover:text-[#e05338] transition"
                    >
                      Ver todas →
                    </Link>
                  </div>

                  {proximosJogos.length === 0 ? (
                    <p className="text-xs text-slate-500 py-10 text-center italic">
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
                            className="bg-slate-50/90 border border-slate-200/90 p-4 rounded-2xl flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {modNome && (
                                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-lg bg-white text-[#3b4b5e] border border-slate-200">
                                    {modNome}
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-slate-500">
                                  {formatarFase(jogo.fase, jogo.ordem)}
                                </span>
                                {emAndamento && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f06449]/15 text-[#e05338]">
                                    Ao vivo
                                  </span>
                                )}
                              </div>

                              <div className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 truncate">
                                <span className="truncate">
                                  {getNomeEquipe(jogo.time_a_id)}
                                </span>
                                <span className="text-[#f06449] font-black text-xs shrink-0">
                                  vs
                                </span>
                                <span className="truncate">
                                  {getNomeEquipe(jogo.time_b_id)}
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-500 flex flex-wrap gap-2">
                                <span>{formatarHorario(jogo.horario)}</span>
                                {jogo.local && <span>• {jogo.local}</span>}
                              </div>
                            </div>

                            <Link
                              href={`/professor/sumula/${jogo.id}`}
                              className="px-3.5 py-2 bg-[#f06449] hover:bg-[#e05338] text-white text-xs rounded-xl font-black transition shrink-0 shadow-xs shadow-[#f06449]/25"
                            >
                              Súmula
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* CARTAZ QR CODE ÁREA PÚBLICA */}
                <div className="lg:col-span-4">
                  <QrCodeAluno />
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}