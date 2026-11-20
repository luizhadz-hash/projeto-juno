"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import FooterVoltar from "@/app/components/FooterVoltar";
import { estaAutenticado } from "@/lib/auth";

export const STATUS_ENCERRADOS = [
  "encerrada",
  "finalizada",
  "ENCERRADA",
  "FINALIZADA",
];

export interface Modalidade {
  id: number;
  nome: string;
}

export interface Grupo {
  id: number;
  nome: string;
}

export interface Equipe {
  id: number;
  nome: string;
  serie_turma: string | null;
  grupo_id: number | null;
  modalidades_id: number | null;
  grupo: string | null;
}

export interface Partida {
  id: number;
  modalidade_id: number;
  grupo_id: number | null;
  time_a_id: number | null;
  time_b_id: number | null;
  placar_a: number | null;
  placar_b: number | null;
  status: string | null;
  horario: string | null;
  local: string | null;
  fase: "GRUPO" | "MELHOR_DE_3" | "SEMIFINAL" | "TERCEIRO_LUGAR" | "FINAL" | null;
  ordem: number | null;
  vencedor_id: number | null;
}

export interface SumulaEvento {
  id: number;
  partida_id: number;
  aluno_id: number;
  equipe_id: number;
  tipo: "gol" | "amarelo" | "vermelho";
  created_at: string;
}

export interface ClassificacaoEquipe {
  equipe_id: number;
  nome: string;
  grupo_id: number;
  grupo_nome: string;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldoGols: number;
  pontos: number;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
}

export default function ClassificacaoPage() {
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [modalidadeId, setModalidadeId] = useState<string>("");
  const [tabelasPorGrupo, setTabelasPorGrupo] = useState<{
    [grupoId: number]: { nome: string; classificacao: ClassificacaoEquipe[] };
  }>({});
  const [partidasPorGrupo, setPartidasPorGrupo] = useState<{
    [grupoId: number]: Partida[];
  }>({});
  const [equipesPorGrupo, setEquipesPorGrupo] = useState<{
    [grupoId: number]: Equipe[];
  }>({});

  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const lockAcaoRef = useRef<boolean>(false);

  const modalidadeAtual = modalidades.find((m) => String(m.id) === String(modalidadeId));
  const ehFutsal =
    Number(modalidadeId) === 1 ||
    modalidadeAtual?.nome?.trim().toLowerCase() === "futsal";

  useEffect(() => {
    async function inicializar() {
      const autenticado = await estaAutenticado();
      if (!autenticado) return;

      const { data: mods, error } = await supabase
        .from("modalidade")
        .select("id, nome")
        .order("nome", { ascending: true });

      if (error) {
        console.error("Erro ao buscar modalidades:", error);
        setMensagemErro("Erro ao carregar lista de modalidades.");
        setCarregando(false);
        return;
      }

      if (mods && mods.length > 0) {
        setModalidades(mods as Modalidade[]);
        setModalidadeId(String(mods[0].id));
      } else {
        setCarregando(false);
      }
    }
    inicializar();
  }, []);

  useEffect(() => {
    if (modalidadeId) {
      carregarClassificacao(modalidadeId);
    }
  }, [modalidadeId]);

  function determinarVencedorPartida(p: Partida): number | "PENDENTE" | null {
    if (!p.status || !STATUS_ENCERRADOS.includes(p.status)) return "PENDENTE";

    const placarA = Number(p.placar_a ?? 0);
    const placarB = Number(p.placar_b ?? 0);

    if (placarA > placarB) return p.time_a_id;
    if (placarB > placarA) return p.time_b_id;

    if (p.vencedor_id) return Number(p.vencedor_id);

    return "PENDENTE";
  }

  function determinarPerdedorPartida(p: Partida): number | null {
    const vencedor = determinarVencedorPartida(p);
    if (!vencedor || vencedor === "PENDENTE") return null;
    return vencedor === p.time_a_id ? p.time_b_id : p.time_a_id;
  }

  async function carregarClassificacao(modIdParam: string) {
    if (!modIdParam) return;
    const modIdNum = parseInt(modIdParam, 10);
    setCarregando(true);
    setMensagemErro(null);

    try {
      const { data: gruposData, error: errGrupos } = await supabase
        .from("grupos_confronto")
        .select("id, nome");

      if (errGrupos) throw new Error("Erro ao carregar grupos de confronto.");

      const { data: equipesData, error: errEquipes } = await supabase
        .from("equipes")
        .select("*")
        .eq("modalidades_id", modIdNum);

      if (errEquipes) throw new Error("Erro ao carregar equipes da modalidade.");

      const { data: partidasData, error: errPartidas } = await supabase
        .from("partidas")
        .select("*")
        .eq("modalidade_id", modIdNum);

      if (errPartidas) throw new Error("Erro ao carregar partidas.");

      const listaGrupos = (gruposData || []) as Grupo[];
      const listaEquipes = (equipesData || []) as Equipe[];
      const listaPartidas = (partidasData || []) as Partida[];

      // Auto-dispensa do Jogo 3 da Melhor de 3 caso alguém já tenha vencido 2x0
      const jogosM3ParaDispensar: number[] = [];
      listaGrupos.forEach((g) => {
        const gId = Number(g.id);
        const m3 = listaPartidas.filter(
          (p) => Number(p.grupo_id) === gId && p.fase === "MELHOR_DE_3"
        );
        const j1 = m3.find((p) => p.ordem === 1);
        const j2 = m3.find((p) => p.ordem === 2);
        const j3 = m3.find((p) => p.ordem === 3);

        if (j1 && j2 && j3 && j3.status === "agendada") {
          const v1 = determinarVencedorPartida(j1);
          const v2 = determinarVencedorPartida(j2);
          if (v1 && v2 && v1 !== "PENDENTE" && v2 !== "PENDENTE" && v1 === v2) {
            jogosM3ParaDispensar.push(j3.id);
            j3.status = "cancelada";
          }
        }
      });

      if (jogosM3ParaDispensar.length > 0) {
        await supabase
          .from("partidas")
          .update({ status: "cancelada" })
          .in("id", jogosM3ParaDispensar);
      }

      const mapaPartidasPorGrupo: { [grupoId: number]: Partida[] } = {};
      const mapaEquipesPorGrupo: { [grupoId: number]: Equipe[] } = {};

      listaGrupos.forEach((g) => {
        const gId = Number(g.id);
        mapaEquipesPorGrupo[gId] = listaEquipes.filter((eq) => Number(eq.grupo_id) === gId);
        mapaPartidasPorGrupo[gId] = listaPartidas.filter((p) => Number(p.grupo_id) === gId);
      });

      setEquipesPorGrupo(mapaEquipesPorGrupo);
      setPartidasPorGrupo(mapaPartidasPorGrupo);

      const partidasGrupoEncerradas = listaPartidas.filter(
        (p) =>
          (!p.fase || p.fase === "GRUPO") &&
          p.status &&
          STATUS_ENCERRADOS.includes(p.status)
      );

      const idsPartidasEncerradas = partidasGrupoEncerradas.map((p) => p.id);

      const cartoesPorEquipe: { [equipeId: number]: { amarelos: number; vermelhos: number } } = {};

      if (idsPartidasEncerradas.length > 0) {
        const { data: eventosData, error: errEventos } = await supabase
          .from("sumula_eventos")
          .select("*")
          .in("partida_id", idsPartidasEncerradas)
          .in("tipo", ["amarelo", "vermelho"]);

        if (!errEventos && eventosData) {
          (eventosData as SumulaEvento[]).forEach((ev) => {
            const eqId = ev.equipe_id;
            if (!cartoesPorEquipe[eqId]) {
              cartoesPorEquipe[eqId] = { amarelos: 0, vermelhos: 0 };
            }
            if (ev.tipo === "amarelo") cartoesPorEquipe[eqId].amarelos++;
            if (ev.tipo === "vermelho") cartoesPorEquipe[eqId].vermelhos++;
          });
        }
      }

      const mapaEquipeGrupo = new Map<number, number>();
      listaEquipes.forEach((eq) => {
        if (eq.grupo_id) mapaEquipeGrupo.set(eq.id, Number(eq.grupo_id));
      });

      const tabelasCalculadas: {
        [grupoId: number]: { nome: string; classificacao: ClassificacaoEquipe[] };
      } = {};

      listaGrupos.forEach((g) => {
        const gId = Number(g.id);
        const equipesDoGrupo = mapaEquipesPorGrupo[gId] || [];

        if (equipesDoGrupo.length === 0) return;

        const mapaStats = new Map<number, ClassificacaoEquipe>();

        equipesDoGrupo.forEach((eq) => {
          mapaStats.set(eq.id, {
            equipe_id: eq.id,
            nome: eq.nome,
            grupo_id: gId,
            grupo_nome: g.nome,
            jogos: 0,
            vitorias: 0,
            empates: 0,
            derrotas: 0,
            golsPro: 0,
            golsContra: 0,
            saldoGols: 0,
            pontos: 0,
            cartoesAmarelos: cartoesPorEquipe[eq.id]?.amarelos || 0,
            cartoesVermelhos: cartoesPorEquipe[eq.id]?.vermelhos || 0,
          });
        });

        partidasGrupoEncerradas.forEach((p) => {
          const idA = Number(p.time_a_id);
          const idB = Number(p.time_b_id);

          const grupoA = p.grupo_id ? Number(p.grupo_id) : mapaEquipeGrupo.get(idA);
          const grupoB = p.grupo_id ? Number(p.grupo_id) : mapaEquipeGrupo.get(idB);

          if (grupoA && grupoB && grupoA !== grupoB) {
            return;
          }

          if (grupoA === gId) {
            const timeA = mapaStats.get(idA);
            const timeB = mapaStats.get(idB);

            if (timeA && timeB) {
              const placarA = Number(p.placar_a ?? 0);
              const placarB = Number(p.placar_b ?? 0);

              timeA.jogos++;
              timeB.jogos++;
              timeA.golsPro += placarA;
              timeA.golsContra += placarB;
              timeB.golsPro += placarB;
              timeB.golsContra += placarA;

              if (placarA > placarB) {
                timeA.vitorias++;
                timeA.pontos += 3;
                timeB.derrotas++;
              } else if (placarB > placarA) {
                timeB.vitorias++;
                timeB.pontos += 3;
                timeA.derrotas++;
              } else {
                timeA.empates++;
                timeA.pontos += 1;
                timeB.empates++;
                timeB.pontos += 1;
              }
            }
          }
        });

        const listaClassificada = Array.from(mapaStats.values()).map((item) => ({
          ...item,
          saldoGols: item.golsPro - item.golsContra,
        }));

        listaClassificada.sort((a, b) => {
          if (b.pontos !== a.pontos) return b.pontos - a.pontos;
          if (b.saldoGols !== a.saldoGols) return b.saldoGols - a.saldoGols;
          if (a.cartoesAmarelos !== b.cartoesAmarelos) return a.cartoesAmarelos - b.cartoesAmarelos;
          return a.cartoesVermelhos - b.cartoesVermelhos;
        });

        tabelasCalculadas[gId] = {
          nome: g.nome,
          classificacao: listaClassificada,
        };
      });

      setTabelasPorGrupo(tabelasCalculadas);
    } catch (err: unknown) {
      console.error("Erro ao carregar classificação:", err);
      setMensagemErro(
        err instanceof Error ? err.message : "Erro inesperado ao carregar classificação."
      );
    } finally {
      setCarregando(false);
    }
  }

  // GERAÇÃO DE MELHOR DE 3 PARA 2 EQUIPES (JOGOS 1, 2 E 3)
  async function gerandoMelhorDe3Inicio(grupoId: number) {
    if (processando || lockAcaoRef.current) return;
    const modIdNum = parseInt(modalidadeId, 10);
    const eqDoGrupo = equipesPorGrupo[grupoId] || [];

    if (eqDoGrupo.length !== 2) return;

    lockAcaoRef.current = true;
    setProcessando(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      const { data: partidasM3 } = await supabase
        .from("partidas")
        .select("id")
        .eq("modalidade_id", modIdNum)
        .eq("grupo_id", grupoId)
        .eq("fase", "MELHOR_DE_3")
        .neq("status", "cancelada");

      if (partidasM3 && partidasM3.length > 0) {
        throw new Error("As partidas da Melhor de 3 já foram inicializadas para este grupo.");
      }

      const payload = [1, 2, 3].map((ordemJogo) => ({
        modalidade_id: modIdNum,
        grupo_id: grupoId,
        time_a_id: eqDoGrupo[0].id,
        time_b_id: eqDoGrupo[1].id,
        placar_a: 0,
        placar_b: 0,
        status: "agendada",
        fase: "MELHOR_DE_3",
        ordem: ordemJogo,
        vencedor_id: null,
      }));

      const { error } = await supabase.from("partidas").insert(payload);
      if (error) {
        if (error.code === "23505") {
          throw new Error("As partidas da Melhor de 3 já existem no banco.");
        }
        throw error;
      }

      setMensagemSucesso("Série Melhor de 3 (Jogos 1, 2 e 3) gerada com sucesso!");
      await carregarClassificacao(modalidadeId);
    } catch (err: unknown) {
      setMensagemErro(err instanceof Error ? err.message : "Erro ao gerar a Melhor de 3.");
    } finally {
      setProcessando(false);
      lockAcaoRef.current = false;
    }
  }

  async function gerarJogo3MelhorDe3(grupoId: number) {
    if (processando || lockAcaoRef.current) return;
    const modIdNum = parseInt(modalidadeId, 10);
    const eqDoGrupo = equipesPorGrupo[grupoId] || [];

    lockAcaoRef.current = true;
    setProcessando(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      const { data: partidasM3 } = await supabase
        .from("partidas")
        .select("id, ordem, status")
        .eq("modalidade_id", modIdNum)
        .eq("grupo_id", grupoId)
        .eq("fase", "MELHOR_DE_3");

      const jogo3Existente = (partidasM3 || []).find((p) => p.ordem === 3);

      if (jogo3Existente) {
        if (jogo3Existente.status === "cancelada") {
          const { error: errReativar } = await supabase
            .from("partidas")
            .update({ status: "agendada" })
            .eq("id", jogo3Existente.id);
          if (errReativar) throw errReativar;
          setMensagemSucesso("Jogo 3 (Desempate) reativado com sucesso!");
          await carregarClassificacao(modalidadeId);
          return;
        }
        throw new Error("O Jogo 3 da Melhor de 3 já existe.");
      }

      const payload = {
        modalidade_id: modIdNum,
        grupo_id: grupoId,
        time_a_id: eqDoGrupo[0].id,
        time_b_id: eqDoGrupo[1].id,
        placar_a: 0,
        placar_b: 0,
        status: "agendada",
        fase: "MELHOR_DE_3",
        ordem: 3,
        vencedor_id: null,
      };

      const { error } = await supabase.from("partidas").insert([payload]);
      if (error) {
        if (error.code === "23505") throw new Error("O Jogo 3 já existe no banco.");
        throw error;
      }

      setMensagemSucesso("Desempate (Jogo 3) gerado com sucesso!");
      await carregarClassificacao(modalidadeId);
    } catch (err: unknown) {
      setMensagemErro(err instanceof Error ? err.message : "Erro ao gerar o Jogo 3.");
    } finally {
      setProcessando(false);
      lockAcaoRef.current = false;
    }
  }

  // GERAÇÃO DE FINAL PARA 3 EQUIPES (3º lugar já vem da tabela de grupos)
  async function gerarFinal3Equipes(grupoId: number) {
    if (processando || lockAcaoRef.current) return;
    const modIdNum = parseInt(modalidadeId, 10);
    const classif = tabelasPorGrupo[grupoId]?.classificacao || [];

    if (classif.length < 2) return;

    lockAcaoRef.current = true;
    setProcessando(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      const { data: finalExiste } = await supabase
        .from("partidas")
        .select("id")
        .eq("modalidade_id", modIdNum)
        .eq("grupo_id", grupoId)
        .eq("fase", "FINAL");

      if (finalExiste && finalExiste.length > 0) {
        throw new Error("A partida Final já foi gerada para este grupo.");
      }

      const payload = {
        modalidade_id: modIdNum,
        grupo_id: grupoId,
        time_a_id: classif[0].equipe_id,
        time_b_id: classif[1].equipe_id,
        placar_a: 0,
        placar_b: 0,
        status: "agendada",
        fase: "FINAL",
        ordem: 1,
        vencedor_id: null,
      };

      const { error } = await supabase.from("partidas").insert([payload]);
      if (error) {
        if (error.code === "23505") throw new Error("A Final já existe no banco.");
        throw error;
      }

      setMensagemSucesso("Grande Final gerada com sucesso!");
      await carregarClassificacao(modalidadeId);
    } catch (err: unknown) {
      setMensagemErro(err instanceof Error ? err.message : "Erro ao gerar a Final.");
    } finally {
      setProcessando(false);
      lockAcaoRef.current = false;
    }
  }

  // GERAÇÃO DE SEMIFINAIS PARA 4+ EQUIPES
  async function gerarSemifinais(grupoId: number) {
    if (processando || lockAcaoRef.current) return;
    const modIdNum = parseInt(modalidadeId, 10);
    const classif = tabelasPorGrupo[grupoId]?.classificacao || [];

    if (classif.length < 4) return;

    lockAcaoRef.current = true;
    setProcessando(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      const { data: semisExistem } = await supabase
        .from("partidas")
        .select("id")
        .eq("modalidade_id", modIdNum)
        .eq("grupo_id", grupoId)
        .eq("fase", "SEMIFINAL");

      if (semisExistem && semisExistem.length > 0) {
        throw new Error("As Semifinais já foram geradas para este grupo.");
      }

      const payload = [
        {
          modalidade_id: modIdNum,
          grupo_id: grupoId,
          time_a_id: classif[0].equipe_id, // 1º
          time_b_id: classif[3].equipe_id, // 4º
          placar_a: 0,
          placar_b: 0,
          status: "agendada",
          fase: "SEMIFINAL",
          ordem: 1,
          vencedor_id: null,
        },
        {
          modalidade_id: modIdNum,
          grupo_id: grupoId,
          time_a_id: classif[1].equipe_id, // 2º
          time_b_id: classif[2].equipe_id, // 3º
          placar_a: 0,
          placar_b: 0,
          status: "agendada",
          fase: "SEMIFINAL",
          ordem: 2,
          vencedor_id: null,
        },
      ];

      const { error } = await supabase.from("partidas").insert(payload);
      if (error) {
        if (error.code === "23505") throw new Error("As Semifinais já existem no banco.");
        throw error;
      }

      setMensagemSucesso("Semifinais geradas com sucesso!");
      await carregarClassificacao(modalidadeId);
    } catch (err: unknown) {
      setMensagemErro(err instanceof Error ? err.message : "Erro ao gerar as Semifinais.");
    } finally {
      setProcessando(false);
      lockAcaoRef.current = false;
    }
  }

  // GERAÇÃO SIMULTÂNEA DE FINAL (VENCEDORES) + DISPUTA DE 3º LUGAR (PERDEDORES) PARA 4+ EQUIPES
  async function avancarVencedoresDasSemis(
    grupoId: number,
    venc1: number,
    venc2: number,
    perd1: number,
    perd2: number
  ) {
    if (processando || lockAcaoRef.current) return;
    const modIdNum = parseInt(modalidadeId, 10);

    lockAcaoRef.current = true;
    setProcessando(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      const { data: decisoesExistem } = await supabase
        .from("partidas")
        .select("id, fase")
        .eq("modalidade_id", modIdNum)
        .eq("grupo_id", grupoId)
        .in("fase", ["FINAL", "TERCEIRO_LUGAR"]);

      const jaTemFinal = (decisoesExistem || []).some((p) => p.fase === "FINAL");
      const jaTemTerceiro = (decisoesExistem || []).some((p) => p.fase === "TERCEIRO_LUGAR");

      if (jaTemFinal && jaTemTerceiro) {
        throw new Error("A Final e a Disputa de 3º Lugar já foram geradas.");
      }

      const payload: Array<{
        modalidade_id: number;
        grupo_id: number;
        time_a_id: number;
        time_b_id: number;
        placar_a: number;
        placar_b: number;
        status: string;
        fase: "FINAL" | "TERCEIRO_LUGAR";
        ordem: number;
        vencedor_id: null;
      }> = [];

      if (!jaTemTerceiro) {
        payload.push({
          modalidade_id: modIdNum,
          grupo_id: grupoId,
          time_a_id: perd1,
          time_b_id: perd2,
          placar_a: 0,
          placar_b: 0,
          status: "agendada",
          fase: "TERCEIRO_LUGAR",
          ordem: 1,
          vencedor_id: null,
        });
      }

      if (!jaTemFinal) {
        payload.push({
          modalidade_id: modIdNum,
          grupo_id: grupoId,
          time_a_id: venc1,
          time_b_id: venc2,
          placar_a: 0,
          placar_b: 0,
          status: "agendada",
          fase: "FINAL",
          ordem: 1,
          vencedor_id: null,
        });
      }

      const { error } = await supabase.from("partidas").insert(payload);
      if (error) {
        if (error.code === "23505") {
          throw new Error("As partidas decisivas já foram registradas no banco.");
        }
        throw error;
      }

      setMensagemSucesso("Grande Final e Disputa de 3º Lugar geradas com sucesso!");
      await carregarClassificacao(modalidadeId);
    } catch (err: unknown) {
      setMensagemErro(err instanceof Error ? err.message : "Erro ao gerar as Finais.");
    } finally {
      setProcessando(false);
      lockAcaoRef.current = false;
    }
  }

  return (
    <div className="print-container min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 md:p-8">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* CABEÇALHO OFICIAL EXCLUSIVO PARA IMPRESSÃO */}
        <div className="print-only border-b-2 border-black pb-3 mb-4">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide">
                PROJETO JUNO — Boletim Oficial de Classificação e Pódio
              </h1>
              <p className="text-xs font-bold mt-1">
                Modalidade: {modalidadeAtual?.nome?.toUpperCase() || "—"}
              </p>
            </div>
            <p className="text-[11px]">
              Emitido em: {new Date().toLocaleDateString("pt-BR")} às{" "}
              {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        {/* CABEÇALHO DA TELA + FILTRO + BOTÃO IMPRIMIR */}
        <div className="no-print bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-amber-400">
              🏆 Classificação e Mata-Mata
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Acompanhe tabelas de grupos, gere confrontos eliminatórios e imprima o boletim oficial.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <select
              value={modalidadeId}
              onChange={(e) => setModalidadeId(e.target.value)}
              className="flex-1 md:w-52 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 font-bold focus:border-amber-400 outline-none"
            >
              {modalidades.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome.toUpperCase()}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-2"
            >
              <span>🖨️</span>
              <span>Imprimir Boletim</span>
            </button>
          </div>
        </div>

        {mensagemErro && (
          <div className="no-print p-4 bg-red-950/80 border border-red-500/80 text-red-200 rounded-xl text-sm font-semibold flex justify-between items-center">
            <span>{mensagemErro}</span>
            <button onClick={() => setMensagemErro(null)} className="font-bold text-red-400 ml-4">
              ✕
            </button>
          </div>
        )}

        {mensagemSucesso && (
          <div className="no-print p-4 bg-emerald-950/80 border border-emerald-500/80 text-emerald-200 rounded-xl text-sm font-semibold flex justify-between items-center">
            <span>{mensagemSucesso}</span>
            <button onClick={() => setMensagemSucesso(null)} className="font-bold text-emerald-400 ml-4">
              ✕
            </button>
          </div>
        )}

        {carregando ? (
          <p className="text-slate-400 my-12 text-center font-bold text-sm animate-pulse">
            Carregando dados da classificação...
          </p>
        ) : Object.keys(tabelasPorGrupo).length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 p-10 rounded-2xl text-center text-slate-500 italic text-sm">
            Nenhuma equipe ou grupo encontrado para esta modalidade.
          </div>
        ) : (
          Object.entries(tabelasPorGrupo).map(([gIdStr, dadosGrupo]) => {
            const grupoId = Number(gIdStr);
            const equipesDoGrupo = equipesPorGrupo[grupoId] || [];
            const partidasDoGrupo = partidasPorGrupo[grupoId] || [];
            const totalEquipes = equipesDoGrupo.length;

            // Análise de status das partidas de grupo
            const partidasFaseGrupo = partidasDoGrupo.filter((p) => !p.fase || p.fase === "GRUPO");
            const temPartidasCadastradas = partidasFaseGrupo.length > 0;
            const todasGruposEncerradas =
              temPartidasCadastradas &&
              partidasFaseGrupo.every((p) => p.status && STATUS_ENCERRADOS.includes(p.status));

            // Análise de Melhor de 3 (2 equipes)
            const partidasM3 = partidasDoGrupo.filter((p) => p.fase === "MELHOR_DE_3");
            const j1 = partidasM3.find((p) => p.ordem === 1);
            const j2 = partidasM3.find((p) => p.ordem === 2);
            const j3 = partidasM3.find((p) => p.ordem === 3);

            const vencJ1 = j1 ? determinarVencedorPartida(j1) : null;
            const vencJ2 = j2 ? determinarVencedorPartida(j2) : null;
            const vencJ3 = j3 ? determinarVencedorPartida(j3) : null;

            const empatePendenteM3 =
              (vencJ1 === "PENDENTE" && STATUS_ENCERRADOS.includes(j1?.status || "")) ||
              (vencJ2 === "PENDENTE" && STATUS_ENCERRADOS.includes(j2?.status || "")) ||
              (vencJ3 === "PENDENTE" && STATUS_ENCERRADOS.includes(j3?.status || ""));

            let campeaoM3: number | null = null;
            let viceM3: number | null = null;
            let precisaJogo3 = false;

            if (
              vencJ1 &&
              vencJ2 &&
              vencJ1 !== "PENDENTE" &&
              vencJ2 !== "PENDENTE" &&
              !empatePendenteM3
            ) {
              if (vencJ1 === vencJ2) {
                campeaoM3 = vencJ1 as number;
              } else {
                precisaJogo3 = true;
                if (vencJ3 && vencJ3 !== "PENDENTE") {
                  campeaoM3 = vencJ3 as number;
                }
              }
            }

            if (campeaoM3 && equipesDoGrupo.length === 2) {
              viceM3 = equipesDoGrupo.find((e) => e.id !== campeaoM3)?.id ?? null;
            }

            // Análise de Semifinais, 3º Lugar e Final
            const partidasSemi = partidasDoGrupo.filter((p) => p.fase === "SEMIFINAL");
            const semi1 = partidasSemi.find((p) => p.ordem === 1);
            const semi2 = partidasSemi.find((p) => p.ordem === 2);

            const vencSemi1 = semi1 ? determinarVencedorPartida(semi1) : null;
            const vencSemi2 = semi2 ? determinarVencedorPartida(semi2) : null;
            const perdSemi1 = semi1 ? determinarPerdedorPartida(semi1) : null;
            const perdSemi2 = semi2 ? determinarPerdedorPartida(semi2) : null;

            const partidasTerceiro = partidasDoGrupo.filter((p) => p.fase === "TERCEIRO_LUGAR");
            const partidaTerceiro = partidasTerceiro[0];
            const vencTerceiro = partidaTerceiro
              ? determinarVencedorPartida(partidaTerceiro)
              : null;

            const partidasFinal = partidasDoGrupo.filter((p) => p.fase === "FINAL");
            const partidaFinal = partidasFinal[0];
            const vencFinal = partidaFinal ? determinarVencedorPartida(partidaFinal) : null;
            const perdFinal = partidaFinal ? determinarPerdedorPartida(partidaFinal) : null;

            const getNomeEquipe = (eqId: number | null | undefined) => {
              if (!eqId) return "A definir";
              return equipesDoGrupo.find((e) => e.id === eqId)?.nome || `Equipe #${eqId}`;
            };

            // Cálculo do Pódio Oficial (1º, 2º e 3º lugares)
            const primeiroColocadoId =
              totalEquipes === 2
                ? campeaoM3
                : vencFinal && vencFinal !== "PENDENTE"
                ? (vencFinal as number)
                : null;

            const segundoColocadoId = totalEquipes === 2 ? viceM3 : perdFinal;

            const terceiroColocadoId =
              totalEquipes === 3
                ? dadosGrupo.classificacao[2]?.equipe_id ?? null
                : totalEquipes >= 4 && vencTerceiro && vencTerceiro !== "PENDENTE"
                ? (vencTerceiro as number)
                : null;

            return (
              <section
                key={grupoId}
                className="print-card bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg space-y-6"
              >
                {/* TÍTULO DO GRUPO */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <h2 className="text-lg font-black text-slate-100">
                    Grupo: <span className="text-amber-400">{dadosGrupo.nome}</span>
                  </h2>
                  <span className="text-xs font-bold text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                    {totalEquipes} equipes
                  </span>
                </div>

                {/* 1. TABELA DE CLASSIFICAÇÃO (Apenas para 3 ou mais equipes) */}
                {totalEquipes >= 3 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Classificação da Fase de Grupos
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-slate-800">
                      <table className="print-table w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800">
                          <tr>
                            <th className="p-2.5 text-center w-12">Pos</th>
                            <th className="p-2.5">Equipe</th>
                            <th className="p-2.5 text-center">Pts</th>
                            <th className="p-2.5 text-center">J</th>
                            <th className="p-2.5 text-center">V</th>
                            <th className="p-2.5 text-center">E</th>
                            <th className="p-2.5 text-center">D</th>
                            <th className="p-2.5 text-center">{ehFutsal ? "GP" : "PP"}</th>
                            <th className="p-2.5 text-center">{ehFutsal ? "GC" : "PC"}</th>
                            <th className="p-2.5 text-center">{ehFutsal ? "SG" : "SP"}</th>
                            {ehFutsal && (
                              <>
                                <th className="p-2.5 text-center">CA</th>
                                <th className="p-2.5 text-center">CV</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {dadosGrupo.classificacao.map((item, index) => (
                            <tr key={item.equipe_id} className="hover:bg-slate-800/40 transition">
                              <td className="p-2.5 text-center font-black text-slate-400">
                                {index + 1}º
                              </td>
                              <td className="p-2.5 font-bold text-slate-100">{item.nome}</td>
                              <td className="p-2.5 text-center font-black text-amber-400">
                                {item.pontos}
                              </td>
                              <td className="p-2.5 text-center text-slate-300">{item.jogos}</td>
                              <td className="p-2.5 text-center text-slate-300">{item.vitorias}</td>
                              <td className="p-2.5 text-center text-slate-300">{item.empates}</td>
                              <td className="p-2.5 text-center text-slate-300">{item.derrotas}</td>
                              <td className="p-2.5 text-center text-slate-300">{item.golsPro}</td>
                              <td className="p-2.5 text-center text-slate-300">{item.golsContra}</td>
                              <td className="p-2.5 text-center font-bold text-slate-200">
                                {item.saldoGols}
                              </td>
                              {ehFutsal && (
                                <>
                                  <td className="p-2.5 text-center font-bold text-amber-400">
                                    {item.cartoesAmarelos}
                                  </td>
                                  <td className="p-2.5 text-center font-bold text-red-400">
                                    {item.cartoesVermelhos}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. FASE ELIMINATÓRIA / DECISÃO */}
                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Fase Eliminatória / Decisão
                  </h3>

                  {/* CASO 1: GRUPO DE 2 EQUIPES (MELHOR DE 3) */}
                  {totalEquipes === 2 && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400">
                        Formato: <strong className="text-slate-200">Melhor de 3 Jogos</strong>
                      </p>

                      {partidasM3.length === 0 ? (
                        <button
                          disabled={processando}
                          onClick={() => gerandoMelhorDe3Inicio(grupoId)}
                          className="no-print px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-black text-xs transition disabled:opacity-50"
                        >
                          Iniciar Melhor de 3 (Gerar Jogos 1, 2 e 3)
                        </button>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <LinhaJogoEliminatorio
                            rotulo="Jogo 1"
                            timeA={getNomeEquipe(j1?.time_a_id)}
                            placarA={j1?.placar_a ?? 0}
                            placarB={j1?.placar_b ?? 0}
                            timeB={getNomeEquipe(j1?.time_b_id)}
                            status={j1?.status || "agendada"}
                          />
                          <LinhaJogoEliminatorio
                            rotulo="Jogo 2"
                            timeA={getNomeEquipe(j2?.time_a_id)}
                            placarA={j2?.placar_a ?? 0}
                            placarB={j2?.placar_b ?? 0}
                            timeB={getNomeEquipe(j2?.time_b_id)}
                            status={j2?.status || "agendada"}
                          />
                          {j3 && (
                            <LinhaJogoEliminatorio
                              rotulo="Jogo 3 (Desempate)"
                              timeA={getNomeEquipe(j3.time_a_id)}
                              placarA={j3.placar_a ?? 0}
                              placarB={j3.placar_b ?? 0}
                              timeB={getNomeEquipe(j3.time_b_id)}
                              status={
                                j3.status === "cancelada"
                                  ? "Dispensado (2–0)"
                                  : j3.status || "agendada"
                              }
                              dispensado={j3.status === "cancelada"}
                            />
                          )}
                        </div>
                      )}

                      {empatePendenteM3 && (
                        <p className="no-print text-xs text-red-400 font-semibold">
                          ⚠️ Um dos jogos encerrados terminou empatado sem vencedor definido. Defina o vencedor na súmula antes de declarar o campeão.
                        </p>
                      )}

                      {precisaJogo3 && (!j3 || j3.status === "cancelada") && (
                        <div className="no-print p-3 bg-amber-950/50 border border-amber-600/60 rounded-xl text-amber-200 text-xs flex flex-wrap items-center justify-between gap-3">
                          <span className="font-bold">
                            Série empatada em 1 a 1! O Jogo 3 é necessário para definir o campeão.
                          </span>
                          <button
                            disabled={processando}
                            onClick={() => gerarJogo3MelhorDe3(grupoId)}
                            className="px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-lg transition"
                          >
                            {j3?.status === "cancelada"
                              ? "Reativar Jogo 3 (Desempate)"
                              : "Gerar Jogo 3 (Desempate)"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CASO 2: GRUPO DE 3 EQUIPES (FINAL DIRETA + 3º PELO GRUPO) */}
                  {totalEquipes === 3 && (
                    <div className="space-y-3">
                      {!todasGruposEncerradas ? (
                        <p className="no-print text-xs text-slate-400 italic">
                          Aguardando o término de todas as partidas da Fase de Grupos para liberar a Final.
                        </p>
                      ) : partidasFinal.length === 0 ? (
                        <button
                          disabled={processando}
                          onClick={() => gerarFinal3Equipes(grupoId)}
                          className="no-print px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition disabled:opacity-50"
                        >
                          Gerar Grande Final (1º x 2º)
                        </button>
                      ) : (
                        <div className="space-y-2 text-xs">
                          <LinhaJogoEliminatorio
                            rotulo="Grande Final"
                            timeA={getNomeEquipe(partidaFinal.time_a_id)}
                            placarA={partidaFinal.placar_a ?? 0}
                            placarB={partidaFinal.placar_b ?? 0}
                            timeB={getNomeEquipe(partidaFinal.time_b_id)}
                            status={partidaFinal.status || "agendada"}
                          />

                          {vencFinal === "PENDENTE" &&
                            STATUS_ENCERRADOS.includes(partidaFinal.status || "") && (
                              <p className="no-print text-xs text-red-400 font-semibold">
                                ⚠️ Partida empatada! Defina o vencedor do desempate na súmula.
                              </p>
                            )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* CASO 3: GRUPO DE 4 OU MAIS EQUIPES (SEMIFINAIS + 3º LUGAR + FINAL) */}
                  {totalEquipes >= 4 && (
                    <div className="space-y-4">
                      {!todasGruposEncerradas ? (
                        <p className="no-print text-xs text-slate-400 italic">
                          Aguardando o término de todas as partidas da Fase de Grupos para liberar as Semifinais.
                        </p>
                      ) : partidasSemi.length === 0 ? (
                        <button
                          disabled={processando}
                          onClick={() => gerarSemifinais(grupoId)}
                          className="no-print px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-black text-xs transition disabled:opacity-50"
                        >
                          Gerar Semifinais (1ºx4º e 2ºx3º)
                        </button>
                      ) : (
                        <div className="space-y-4 text-xs">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <LinhaJogoEliminatorio
                              rotulo="Semifinal 1"
                              timeA={getNomeEquipe(semi1?.time_a_id)}
                              placarA={semi1?.placar_a ?? 0}
                              placarB={semi1?.placar_b ?? 0}
                              timeB={getNomeEquipe(semi1?.time_b_id)}
                              status={semi1?.status || "agendada"}
                            />
                            <LinhaJogoEliminatorio
                              rotulo="Semifinal 2"
                              timeA={getNomeEquipe(semi2?.time_a_id)}
                              placarA={semi2?.placar_a ?? 0}
                              placarB={semi2?.placar_b ?? 0}
                              timeB={getNomeEquipe(semi2?.time_b_id)}
                              status={semi2?.status || "agendada"}
                            />
                          </div>

                          {(vencSemi1 === "PENDENTE" || vencSemi2 === "PENDENTE") &&
                            STATUS_ENCERRADOS.includes(semi1?.status || "") &&
                            STATUS_ENCERRADOS.includes(semi2?.status || "") && (
                              <p className="no-print text-xs text-red-400 font-semibold">
                                ⚠️ Uma ou ambas as semifinais terminaram empatadas sem vencedor definido. Defina o vencedor na súmula para liberar as Finais.
                              </p>
                            )}

                          {vencSemi1 &&
                            vencSemi2 &&
                            perdSemi1 &&
                            perdSemi2 &&
                            vencSemi1 !== "PENDENTE" &&
                            vencSemi2 !== "PENDENTE" &&
                            (partidasFinal.length === 0 || partidasTerceiro.length === 0) && (
                              <button
                                disabled={processando}
                                onClick={() =>
                                  avancarVencedoresDasSemis(
                                    grupoId,
                                    vencSemi1 as number,
                                    vencSemi2 as number,
                                    perdSemi1,
                                    perdSemi2
                                  )
                                }
                                className="no-print px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition"
                              >
                                Gerar Grande Final e Disputa de 3º Lugar
                              </button>
                            )}

                          {(partidasTerceiro.length > 0 || partidasFinal.length > 0) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
                              {partidasTerceiro.length > 0 && (
                                <div className="space-y-1.5">
                                  <LinhaJogoEliminatorio
                                    rotulo="🥉 Disputa de 3º Lugar"
                                    timeA={getNomeEquipe(partidaTerceiro.time_a_id)}
                                    placarA={partidaTerceiro.placar_a ?? 0}
                                    placarB={partidaTerceiro.placar_b ?? 0}
                                    timeB={getNomeEquipe(partidaTerceiro.time_b_id)}
                                    status={partidaTerceiro.status || "agendada"}
                                  />
                                  {vencTerceiro === "PENDENTE" &&
                                    STATUS_ENCERRADOS.includes(partidaTerceiro.status || "") && (
                                      <p className="no-print text-xs text-red-400 font-semibold">
                                        ⚠️ Disputa de 3º lugar empatada! Defina o vencedor na súmula.
                                      </p>
                                    )}
                                </div>
                              )}

                              {partidasFinal.length > 0 && (
                                <div className="space-y-1.5">
                                  <LinhaJogoEliminatorio
                                    rotulo="🏆 Grande Final"
                                    timeA={getNomeEquipe(partidaFinal.time_a_id)}
                                    placarA={partidaFinal.placar_a ?? 0}
                                    placarB={partidaFinal.placar_b ?? 0}
                                    timeB={getNomeEquipe(partidaFinal.time_b_id)}
                                    status={partidaFinal.status || "agendada"}
                                  />
                                  {vencFinal === "PENDENTE" &&
                                    STATUS_ENCERRADOS.includes(partidaFinal.status || "") && (
                                      <p className="no-print text-xs text-red-400 font-semibold">
                                        ⚠️ Final empatada! Defina o vencedor na súmula.
                                      </p>
                                    )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. PÓDIO OFICIAL DO GRUPO */}
                {(primeiroColocadoId || segundoColocadoId || terceiroColocadoId) && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      🏅 Pódio Oficial — {dadosGrupo.nome}
                    </h4>
                    <div
                      className={`grid grid-cols-1 ${
                        totalEquipes >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
                      } gap-3 text-xs`}
                    >
                      <div className="print-box p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/50 text-amber-300 font-bold">
                        <span className="block text-[10px] uppercase tracking-wider opacity-80">
                          🥇 1º Lugar (Campeão)
                        </span>
                        <span className="text-sm font-black text-white mt-0.5 block">
                          {primeiroColocadoId ? getNomeEquipe(primeiroColocadoId) : "A definir"}
                        </span>
                      </div>

                      <div className="print-box p-3.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 font-bold">
                        <span className="block text-[10px] uppercase tracking-wider opacity-80">
                          🥈 2º Lugar (Vice)
                        </span>
                        <span className="text-sm font-black text-slate-100 mt-0.5 block">
                          {segundoColocadoId ? getNomeEquipe(segundoColocadoId) : "A definir"}
                        </span>
                      </div>

                      {totalEquipes >= 3 && (
                        <div className="print-box p-3.5 rounded-xl bg-orange-950/25 border border-orange-600/40 text-orange-300 font-bold">
                          <span className="block text-[10px] uppercase tracking-wider opacity-80">
                            🥉 3º Lugar (Bronze)
                          </span>
                          <span className="text-sm font-black text-orange-100 mt-0.5 block">
                            {terceiroColocadoId ? getNomeEquipe(terceiroColocadoId) : "A definir"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })
        )}

        {/* RODAPÉ DE ASSINATURA EXCLUSIVO NA IMPRESSÃO */}
        <div className="print-only pt-8 mt-8 border-t border-black text-xs">
          <div className="grid grid-cols-2 gap-12 text-center pt-6">
            <div>
              <div className="border-t border-black pt-1 font-bold">
                Coordenação de Educação Física / Organização
              </div>
            </div>
            <div>
              <div className="border-t border-black pt-1 font-bold">
                Direção Escolar
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="no-print mt-8">
        <FooterVoltar href="/professor/painel" />
      </div>
    </div>
  );
}

// Subcomponente padronizado para exibir cada jogo eliminatório com clareza
function LinhaJogoEliminatorio({
  rotulo,
  timeA,
  placarA,
  placarB,
  timeB,
  status,
  dispensado = false,
}: {
  rotulo: string;
  timeA: string;
  placarA: number;
  placarB: number;
  timeB: string;
  status: string;
  dispensado?: boolean;
}) {
  const encerrado = STATUS_ENCERRADOS.includes(status);

  return (
    <div
      className={`print-box p-3.5 rounded-xl border space-y-2 ${
        dispensado
          ? "bg-slate-950/40 border-slate-800/60 text-slate-500 line-through"
          : "bg-slate-950 border-slate-800 text-slate-200"
      }`}
    >
      <div className="flex justify-between items-center text-[10px] font-bold uppercase">
        <span className="text-amber-400">{rotulo}</span>
        <span
          className={`px-2 py-0.5 rounded-full ${
            encerrado
              ? "bg-emerald-950 text-emerald-400 border border-emerald-800/70"
              : "bg-slate-900 text-slate-400 border border-slate-800"
          }`}
        >
          {status.replace("_", " ")}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs font-bold">
        <span className="truncate w-2/5 text-left">{timeA}</span>
        <span className="bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg font-black text-amber-400 shrink-0">
          {placarA} x {placarB}
        </span>
        <span className="truncate w-2/5 text-right">{timeB}</span>
      </div>
    </div>
  );
}