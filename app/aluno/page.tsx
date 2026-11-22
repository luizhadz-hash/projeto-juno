"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import FooterVoltar from "@/app/components/FooterVoltar";

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

export interface GrupoConfronto {
  id: number;
  nome: string;
}

export interface Equipe {
  id: number;
  nome: string;
  grupo_id: number;
  modalidades_id: number;
}

export interface Aluno {
  id: number;
  nome: string;
  equipes_id: number;
  turma?: string | null;
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

export interface ClassificacaoTime {
  equipeId: number;
  nome: string;
  pontos: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldoGols: number;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
}

export interface ArtilheiroAgrupado {
  alunoId: number;
  nomeAluno: string;
  nomeEquipe: string;
  nomeGrupo: string;
  gols: number;
}

export interface CartoesAgrupados {
  alunoId: number;
  nomeAluno: string;
  nomeEquipe: string;
  nomeGrupo: string;
  amarelos: number;
  vermelhos: number;
}

export default function AlunoPage() {
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [modalidadeSelecionada, setModalidadeSelecionada] = useState<number | null>(null);

  const [grupos, setGrupos] = useState<GrupoConfronto[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [eventosSumula, setEventosSumula] = useState<SumulaEvento[]>([]);

  const [abaAtiva, setAbaAtiva] = useState<"classificacao" | "artilharia" | "cartoes" | "jogos">("classificacao");
  const [grupoFiltro, setGrupoFiltro] = useState<number | "TODOS">("TODOS");
  const [buscaNome, setBuscaNome] = useState("");

  const [carregando, setCarregando] = useState(true);

  const modalidadeAtualObj = modalidades.find((m) => Number(m.id) === Number(modalidadeSelecionada));
  const ehFutsal =
    Number(modalidadeSelecionada) === 1 ||
    modalidadeAtualObj?.nome?.trim().toLowerCase() === "futsal";

  function formatarDataHoraExibicao(isoString: string | null): string {
    if (!isoString) return "A definir";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "A definir";
      return d
        .toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
        .replace(",", " às");
    } catch {
      return "A definir";
    }
  }

  function formatarFaseAmigavel(fase: string | null, ordem: number | null): string {
    if (!fase || fase === "GRUPO") return "Fase de Grupos";
    if (fase === "SEMIFINAL") return `Semifinal ${ordem || 1}`;
    if (fase === "TERCEIRO_LUGAR") return "Disputa de 3º Lugar";
    if (fase === "FINAL") return "Grande Final";
    if (fase === "MELHOR_DE_3") return `Jogo ${ordem || 1}`;
    return fase;
  }

  function getNomeEquipe(id: number | null): string {
    if (!id) return "A definir";
    const eq = equipes.find((e) => Number(e.id) === Number(id));
    return eq ? eq.nome : `Equipe #${id}`;
  }

  function getGrupoNomePorEquipe(equipeId: number | null): string {
    if (!equipeId) return "Indefinido";
    const eq = equipes.find((e) => Number(e.id) === Number(equipeId));
    if (!eq) return "Indefinido";
    const grupo = grupos.find((g) => Number(g.id) === Number(eq.grupo_id));
    return grupo ? grupo.nome : "Indefinido";
  }

  function determinarVencedorPartida(p: Partida): number | "PENDENTE" | null {
    if (!p.status || !STATUS_ENCERRADOS.includes(p.status)) return "PENDENTE";

    const placarA = Number(p.placar_a ?? 0);
    const placarB = Number(p.placar_b ?? 0);

    if (placarA > placarB) return p.time_a_id;
    if (placarB > placarA) return p.time_b_id;

    if (p.vencedor_id) return Number(p.vencedor_id);

    return "PENDENTE";
  }

  function determinarPerdedorPartida(p: Partida): number | "PENDENTE" | null {
    const vencedor = determinarVencedorPartida(p);
    if (!vencedor || vencedor === "PENDENTE") return "PENDENTE";
    if (Number(vencedor) === Number(p.time_a_id)) return p.time_b_id;
    if (Number(vencedor) === Number(p.time_b_id)) return p.time_a_id;
    return "PENDENTE";
  }

  function avaliarSerieMelhorDe3(partidasM3: Partida[], equipesGrupo: Equipe[]) {
    if (equipesGrupo.length !== 2 || partidasM3.length === 0) {
      return { campeaoId: null, viceId: null, statusTexto: "" };
    }

    const eq1 = equipesGrupo[0];
    const eq2 = equipesGrupo[1];

    const j1 = partidasM3.find((p) => p.ordem === 1);
    const j2 = partidasM3.find((p) => p.ordem === 2);
    const j3 = partidasM3.find((p) => p.ordem === 3);

    const v1 = j1 ? determinarVencedorPartida(j1) : null;
    const v2 = j2 ? determinarVencedorPartida(j2) : null;
    const v3 = j3 ? determinarVencedorPartida(j3) : null;

    let vitoriasEq1 = 0;
    let vitoriasEq2 = 0;
    let pontosEq1 = 0;
    let pontosEq2 = 0;

    [j1, j2, j3].forEach((jogo) => {
      if (!jogo || !jogo.status || !STATUS_ENCERRADOS.includes(jogo.status)) return;
      const v = determinarVencedorPartida(jogo);
      if (v === eq1.id) vitoriasEq1 += 1;
      if (v === eq2.id) vitoriasEq2 += 1;

      if (Number(jogo.time_a_id) === Number(eq1.id)) {
        pontosEq1 += Number(jogo.placar_a ?? 0);
        pontosEq2 += Number(jogo.placar_b ?? 0);
      } else {
        pontosEq2 += Number(jogo.placar_a ?? 0);
        pontosEq1 += Number(jogo.placar_b ?? 0);
      }
    });

    if (v1 && v2 && v1 !== "PENDENTE" && v2 !== "PENDENTE" && v1 === v2) {
      const campeaoId = Number(v1);
      const viceId = campeaoId === Number(eq1.id) ? eq2.id : eq1.id;
      return {
        campeaoId,
        viceId,
        statusTexto: "Série encerrada em 2 jogos (2–0)",
      };
    }

    const todosEncerrados = [j1, j2, j3].every(
      (j) => j && j.status && STATUS_ENCERRADOS.includes(j.status)
    );

    if (todosEncerrados) {
      if (vitoriasEq1 > vitoriasEq2) {
        return { campeaoId: eq1.id, viceId: eq2.id, statusTexto: `Série encerrada (${vitoriasEq1}–${vitoriasEq2})` };
      }
      if (vitoriasEq2 > vitoriasEq1) {
        return { campeaoId: eq2.id, viceId: eq1.id, statusTexto: `Série encerrada (${vitoriasEq2}–${vitoriasEq1})` };
      }

      if (pontosEq1 > pontosEq2) {
        return {
          campeaoId: eq1.id,
          viceId: eq2.id,
          statusTexto: `Campeão definido no saldo (${pontosEq1} x ${pontosEq2})`,
        };
      }
      if (pontosEq2 > pontosEq1) {
        return {
          campeaoId: eq2.id,
          viceId: eq1.id,
          statusTexto: `Campeão definido no saldo (${pontosEq2} x ${pontosEq1})`,
        };
      }

      if (v3 && v3 !== "PENDENTE") {
        const campeaoId = Number(v3);
        const viceId = campeaoId === Number(eq1.id) ? eq2.id : eq1.id;
        return {
          campeaoId,
          viceId,
          statusTexto: "Campeão definido no desempate do Jogo 3",
        };
      }
    }

    return { campeaoId: null, viceId: null, statusTexto: "" };
  }

  useEffect(() => {
    async function carregarModalidades() {
      try {
        const { data, error } = await supabase
          .from("modalidade")
          .select("id, nome")
          .order("id", { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          setModalidades(data as Modalidade[]);
          setModalidadeSelecionada(data[0].id);
        } else {
          setCarregando(false);
        }
      } catch (e) {
        console.error("Erro ao carregar modalidades:", e);
        setCarregando(false);
      }
    }
    carregarModalidades();
  }, []);

  useEffect(() => {
    if (!ehFutsal && (abaAtiva === "artilharia" || abaAtiva === "cartoes")) {
      setAbaAtiva("classificacao");
      setBuscaNome("");
    }
  }, [ehFutsal, abaAtiva]);

  const carregarDadosCompletos = useCallback(
    async (silencioso = false) => {
      if (!modalidadeSelecionada) return;
      if (!silencioso) setCarregando(true);

      try {
        const [resGrupos, resEquipes, resPartidas] = await Promise.all([
          supabase.from("grupos_confronto").select("id, nome").order("nome", { ascending: true }),
          supabase.from("equipes").select("*").eq("modalidades_id", modalidadeSelecionada),
          supabase.from("partidas").select("*").eq("modalidade_id", modalidadeSelecionada),
        ]);

        if (resGrupos.error) throw resGrupos.error;
        if (resEquipes.error) throw resEquipes.error;
        if (resPartidas.error) throw resPartidas.error;

        const listaEquipes = (resEquipes.data || []) as Equipe[];
        const listaPartidas = (resPartidas.data || []) as Partida[];
        const idsEquipes = listaEquipes.map((e) => e.id);

        let listaAlunos: Aluno[] = [];
        let listaEventos: SumulaEvento[] = [];

        const modSelecionadaObj = modalidades.find((m) => Number(m.id) === Number(modalidadeSelecionada));
        const isModalidadeFutsal =
          Number(modalidadeSelecionada) === 1 ||
          modSelecionadaObj?.nome?.trim().toLowerCase() === "futsal";

        if (isModalidadeFutsal) {
          if (idsEquipes.length > 0) {
            const resAlunos = await supabase.from("alunos").select("*").in("equipes_id", idsEquipes);
            if (!resAlunos.error && resAlunos.data) {
              listaAlunos = resAlunos.data as Aluno[];
            }
          }

          const idsPartidasEncerradas = listaPartidas
            .filter((p) => p.status && STATUS_ENCERRADOS.includes(p.status))
            .map((p) => p.id);

          if (idsPartidasEncerradas.length > 0) {
            const resEventos = await supabase
              .from("sumula_eventos")
              .select("*")
              .in("partida_id", idsPartidasEncerradas);

            if (!resEventos.error && resEventos.data) {
              listaEventos = resEventos.data as SumulaEvento[];
            }
          }
        }

        setGrupos((resGrupos.data || []) as GrupoConfronto[]);
        setEquipes(listaEquipes);
        setPartidas(listaPartidas);
        setAlunos(listaAlunos);
        setEventosSumula(listaEventos);
      } catch (e) {
        console.error("Erro ao carregar dados do aluno:", e);
      } finally {
        if (!silencioso) setCarregando(false);
      }
    },
    [modalidadeSelecionada, modalidades]
  );

  useEffect(() => {
    carregarDadosCompletos(false);
  }, [carregarDadosCompletos]);

  useEffect(() => {
    if (!modalidadeSelecionada) return;

    const canal = supabase
      .channel(`aluno-realtime-mod-${modalidadeSelecionada}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "partidas",
          filter: `modalidade_id=eq.${modalidadeSelecionada}`,
        },
        () => {
          carregarDadosCompletos(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sumula_eventos",
        },
        () => {
          if (ehFutsal) {
            carregarDadosCompletos(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [modalidadeSelecionada, ehFutsal, carregarDadosCompletos]);

  function obterGrupoDaPartida(p: Partida, equipesContexto: Equipe[]): number | null {
    if (p.grupo_id !== null && p.grupo_id !== undefined) {
      return Number(p.grupo_id);
    }
    if (!p.time_a_id || !p.time_b_id) return null;

    const eqA = equipesContexto.find((e) => Number(e.id) === Number(p.time_a_id));
    const eqB = equipesContexto.find((e) => Number(e.id) === Number(p.time_b_id));

    if (eqA && eqB && Number(eqA.grupo_id) === Number(eqB.grupo_id)) {
      return Number(eqA.grupo_id);
    }

    return null;
  }

  function calcularTabelaGrupo(grupoId: number): ClassificacaoTime[] {
    const equipesDoGrupo = equipes.filter(
      (e) => Number(e.grupo_id) === grupoId && Number(e.modalidades_id) === Number(modalidadeSelecionada)
    );
    if (equipesDoGrupo.length === 0) return [];

    const partidasGrupoEncerradas = partidas.filter((p) => {
      const ehFaseGrupo = !p.fase || p.fase === "GRUPO";
      const ehMesmaModalidade = Number(p.modalidade_id) === Number(modalidadeSelecionada);
      const grupoCalculado = obterGrupoDaPartida(p, equipes);
      const pertenceAoGrupo = grupoCalculado === grupoId;

      return ehFaseGrupo && ehMesmaModalidade && pertenceAoGrupo && p.status && STATUS_ENCERRADOS.includes(p.status);
    });

    const idsPartidasGrupo = partidasGrupoEncerradas.map((p) => p.id);

    const cartoesMap: { [equipeId: number]: { amarelos: number; vermelhos: number } } = {};
    if (ehFutsal) {
      eventosSumula.forEach((ev) => {
        if (idsPartidasGrupo.includes(Number(ev.partida_id))) {
          const partidaDoEvento = partidasGrupoEncerradas.find((p) => Number(p.id) === Number(ev.partida_id));
          const eqId = Number(ev.equipe_id);

          if (
            partidaDoEvento &&
            eqId &&
            (Number(partidaDoEvento.time_a_id) === eqId || Number(partidaDoEvento.time_b_id) === eqId)
          ) {
            if (!cartoesMap[eqId]) cartoesMap[eqId] = { amarelos: 0, vermelhos: 0 };
            if (ev.tipo === "amarelo") cartoesMap[eqId].amarelos += 1;
            if (ev.tipo === "vermelho") cartoesMap[eqId].vermelhos += 1;
          }
        }
      });
    }

    const tabela: { [equipeId: number]: ClassificacaoTime } = {};
    equipesDoGrupo.forEach((eq) => {
      const c = cartoesMap[eq.id] || { amarelos: 0, vermelhos: 0 };
      tabela[eq.id] = {
        equipeId: eq.id,
        nome: eq.nome,
        pontos: 0,
        jogos: 0,
        vitorias: 0,
        empates: 0,
        derrotas: 0,
        golsPro: 0,
        golsContra: 0,
        saldoGols: 0,
        cartoesAmarelos: c.amarelos,
        cartoesVermelhos: c.vermelhos,
      };
    });

    partidasGrupoEncerradas.forEach((p) => {
      const gA = Number(p.placar_a ?? 0);
      const gB = Number(p.placar_b ?? 0);
      const tA = tabela[Number(p.time_a_id)];
      const tB = tabela[Number(p.time_b_id)];

      if (tA && tB) {
        tA.jogos += 1;
        tB.jogos += 1;
        tA.golsPro += gA;
        tA.golsContra += gB;
        tB.golsPro += gB;
        tB.golsContra += gA;

        if (gA > gB) {
          tA.pontos += 3;
          tA.vitorias += 1;
          tB.derrotas += 1;
        } else if (gB > gA) {
          tB.pontos += 3;
          tB.vitorias += 1;
          tA.derrotas += 1;
        } else {
          tA.pontos += 1;
          tB.pontos += 1;
          tA.empates += 1;
          tB.empates += 1;
        }

        tA.saldoGols = tA.golsPro - tA.golsContra;
        tB.saldoGols = tB.golsPro - tB.golsContra;
      }
    });

    return Object.values(tabela).sort((a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.saldoGols !== a.saldoGols) return b.saldoGols - a.saldoGols;
      if (b.golsPro !== a.golsPro) return b.golsPro - a.golsPro;
      if (ehFutsal) {
        if (a.cartoesAmarelos !== b.cartoesAmarelos) return a.cartoesAmarelos - b.cartoesAmarelos;
        return a.cartoesVermelhos - b.cartoesVermelhos;
      }
      return 0;
    });
  }

  function calcularArtilharia(): ArtilheiroAgrupado[] {
    if (!ehFutsal) return [];
    const mapaGols: { [alunoId: number]: number } = {};

    eventosSumula.forEach((ev) => {
      if (ev.tipo !== "gol") return;

      const partidaDoEvento = partidas.find((p) => Number(p.id) === Number(ev.partida_id));
      if (!partidaDoEvento) return;
      if (Number(partidaDoEvento.modalidade_id) !== Number(modalidadeSelecionada)) return;
      if (!partidaDoEvento.status || !STATUS_ENCERRADOS.includes(partidaDoEvento.status)) return;

      const grupoPartida = obterGrupoDaPartida(partidaDoEvento, equipes);
      if (grupoFiltro !== "TODOS" && grupoPartida !== Number(grupoFiltro)) return;

      const aluId = Number(ev.aluno_id);
      const alunoObj = alunos.find((a) => Number(a.id) === aluId);
      if (!alunoObj) return;

      const eq = equipes.find((e) => Number(e.id) === Number(alunoObj.equipes_id));
      if (!eq) return;

      if (Number(eq.modalidades_id) !== Number(modalidadeSelecionada)) return;
      if (grupoFiltro !== "TODOS" && Number(eq.grupo_id) !== Number(grupoFiltro)) return;
      if (Number(ev.equipe_id) !== Number(eq.id)) return;

      const participaDaPartida =
        Number(partidaDoEvento.time_a_id) === Number(eq.id) ||
        Number(partidaDoEvento.time_b_id) === Number(eq.id);
      if (!participaDaPartida) return;

      mapaGols[aluId] = (mapaGols[aluId] || 0) + 1;
    });

    const lista: ArtilheiroAgrupado[] = [];
    Object.entries(mapaGols).forEach(([alunoIdStr, totalGols]) => {
      const aId = Number(alunoIdStr);
      const alunoObj = alunos.find((a) => Number(a.id) === aId);
      if (!alunoObj) return;

      const eq = equipes.find(
        (e) => Number(e.id) === Number(alunoObj.equipes_id) && Number(e.modalidades_id) === Number(modalidadeSelecionada)
      );
      if (!eq) return;

      if (buscaNome && !alunoObj.nome.toLowerCase().includes(buscaNome.toLowerCase())) return;

      lista.push({
        alunoId: aId,
        nomeAluno: alunoObj.nome,
        nomeEquipe: eq.nome,
        nomeGrupo: getGrupoNomePorEquipe(eq.id),
        gols: totalGols,
      });
    });

    return lista.sort((a, b) => b.gols - a.gols);
  }

  function calcularCartoes(): CartoesAgrupados[] {
    if (!ehFutsal) return [];

    const porPartidaAluno: { [chave: string]: { alunoId: number; amarelos: number; vermelhos: number } } = {};

    eventosSumula.forEach((ev) => {
      if (ev.tipo !== "amarelo" && ev.tipo !== "vermelho") return;

      const partidaDoEvento = partidas.find((p) => Number(p.id) === Number(ev.partida_id));
      if (!partidaDoEvento) return;
      if (Number(partidaDoEvento.modalidade_id) !== Number(modalidadeSelecionada)) return;
      if (!partidaDoEvento.status || !STATUS_ENCERRADOS.includes(partidaDoEvento.status)) return;

      const grupoPartida = obterGrupoDaPartida(partidaDoEvento, equipes);
      if (grupoFiltro !== "TODOS" && grupoPartida !== Number(grupoFiltro)) return;

      const aluId = Number(ev.aluno_id);
      const alunoObj = alunos.find((a) => Number(a.id) === aluId);
      if (!alunoObj) return;

      const eq = equipes.find((e) => Number(e.id) === Number(alunoObj.equipes_id));
      if (!eq) return;

      if (Number(eq.modalidades_id) !== Number(modalidadeSelecionada)) return;
      if (grupoFiltro !== "TODOS" && Number(eq.grupo_id) !== Number(grupoFiltro)) return;
      if (Number(ev.equipe_id) !== Number(eq.id)) return;

      const participaDaPartida =
        Number(partidaDoEvento.time_a_id) === Number(eq.id) ||
        Number(partidaDoEvento.time_b_id) === Number(eq.id);
      if (!participaDaPartida) return;

      const chave = `${partidaDoEvento.id}_${aluId}`;
      if (!porPartidaAluno[chave]) {
        porPartidaAluno[chave] = { alunoId: aluId, amarelos: 0, vermelhos: 0 };
      }

      if (ev.tipo === "amarelo" && porPartidaAluno[chave].amarelos < 2) {
        porPartidaAluno[chave].amarelos += 1;
      }
      if (ev.tipo === "vermelho" && porPartidaAluno[chave].vermelhos < 1) {
        porPartidaAluno[chave].vermelhos += 1;
      }
    });

    const mapaCartoes: { [alunoId: number]: { amarelos: number; vermelhos: number } } = {};
    Object.values(porPartidaAluno).forEach((reg) => {
      if (!mapaCartoes[reg.alunoId]) mapaCartoes[reg.alunoId] = { amarelos: 0, vermelhos: 0 };
      mapaCartoes[reg.alunoId].amarelos += reg.amarelos;
      mapaCartoes[reg.alunoId].vermelhos += reg.vermelhos;
    });

    const lista: CartoesAgrupados[] = [];
    Object.entries(mapaCartoes).forEach(([alunoIdStr, c]) => {
      const aId = Number(alunoIdStr);
      const alunoObj = alunos.find((a) => Number(a.id) === aId);
      if (!alunoObj) return;

      const eq = equipes.find(
        (e) => Number(e.id) === Number(alunoObj.equipes_id) && Number(e.modalidades_id) === Number(modalidadeSelecionada)
      );
      if (!eq) return;

      if (buscaNome && !alunoObj.nome.toLowerCase().includes(buscaNome.toLowerCase())) return;

      lista.push({
        alunoId: aId,
        nomeAluno: alunoObj.nome,
        nomeEquipe: eq.nome,
        nomeGrupo: getGrupoNomePorEquipe(eq.id),
        amarelos: c.amarelos,
        vermelhos: c.vermelhos,
      });
    });

    return lista.sort((a, b) => b.vermelhos - a.vermelhos || b.amarelos - a.amarelos);
  }

  const gruposExibidos =
    grupoFiltro === "TODOS" ? grupos : grupos.filter((g) => g.id === grupoFiltro);

  const artilheiros = calcularArtilharia();
  const comCartoes = calcularCartoes();

  const totalJogosEncerrados = partidas.filter(
    (p) => p.status && STATUS_ENCERRADOS.includes(p.status)
  ).length;
  const totalJogosAoVivo = partidas.filter((p) => p.status === "em_andamento").length;

  return (
    <main className="min-h-screen bg-[#eef2f6] text-slate-900 p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* HERO TÁTICO BENTO */}
        <header className="bento-hero court-grid-bg relative overflow-hidden p-6 sm:p-8">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                {totalJogosAoVivo > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#f06449] text-white">
                    {totalJogosAoVivo} {totalJogosAoVivo === 1 ? "jogo agora" : "jogos agora"}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Painel do Aluno
              </h1>
              <p className="text-xs sm:text-sm text-slate-200/90">
                {ehFutsal
                  ? "Classificação, mata-mata, artilharia, cartões e pódio oficial."
                  : "Classificação, agenda de partidas, chaveamento e pódio oficial."}
              </p>
            </div>

            {/* Seletor de Modalidade + Mini Resumo */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-2.5 rounded-2xl">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-200/80">
                    Equipes
                  </span>
                  <span className="text-base font-black text-white">{equipes.length}</span>
                </div>
                <div className="h-6 w-px bg-white/15" />
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-200/80">
                    Finalizados
                  </span>
                  <span className="text-base font-black text-white">
                    {totalJogosEncerrados}/{partidas.length}
                  </span>
                </div>
              </div>

              <select
                suppressHydrationWarning
                value={modalidadeSelecionada || ""}
                onChange={(e) => {
                  setModalidadeSelecionada(Number(e.target.value));
                  setGrupoFiltro("TODOS");
                }}
                aria-label="Selecionar Modalidade"
                className="bg-white text-slate-900 text-xs font-black px-4 py-3.5 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-[#f06449] cursor-pointer"
              >
                {modalidades.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* BARRA DE NAVEGAÇÃO (ABAS) E FILTROS */}
        <section className="bento-card p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setAbaAtiva("classificacao")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                abaAtiva === "classificacao"
                  ? "bg-[#f06449] text-white font-black shadow-sm shadow-[#f06449]/30"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
              }`}
            >
              Classificação & Pódio
            </button>

            {ehFutsal && (
              <>
                <button
                  onClick={() => setAbaAtiva("artilharia")}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    abaAtiva === "artilharia"
                      ? "bg-[#f06449] text-white font-black shadow-sm shadow-[#f06449]/30"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
                  }`}
                >
                  Artilharia
                </button>
                <button
                  onClick={() => setAbaAtiva("cartoes")}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    abaAtiva === "cartoes"
                      ? "bg-[#f06449] text-white font-black shadow-sm shadow-[#f06449]/30"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
                  }`}
                >
                  Cartões
                </button>
              </>
            )}

            <button
              onClick={() => setAbaAtiva("jogos")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                abaAtiva === "jogos"
                  ? "bg-[#f06449] text-white font-black shadow-sm shadow-[#f06449]/30"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
              }`}
            >
              Jogos
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <select
              suppressHydrationWarning
              value={grupoFiltro}
              onChange={(e) => setGrupoFiltro(e.target.value === "TODOS" ? "TODOS" : Number(e.target.value))}
              aria-label="Filtrar por Grupo"
              className="bg-slate-50 border border-slate-200 text-xs font-bold px-3.5 py-2.5 rounded-xl text-slate-700 outline-none focus:border-[#52657a] cursor-pointer"
            >
              <option value="TODOS">Todos os Grupos</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>

            {ehFutsal && (abaAtiva === "artilharia" || abaAtiva === "cartoes") && (
              <input
                type="text"
                placeholder="Buscar atleta..."
                value={buscaNome}
                onChange={(e) => setBuscaNome(e.target.value)}
                className="w-full sm:w-52 bg-slate-50 border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#52657a]"
              />
            )}
          </div>
        </section>

        {carregando ? (
          <div className="bento-card text-center py-14 text-slate-500 text-sm font-bold animate-pulse">
            Carregando dados do torneio...
          </div>
        ) : (
          <>
            {/* ABA 1: CLASSIFICAÇÃO, MATA-MATA E PÓDIO */}
            {abaAtiva === "classificacao" &&
              gruposExibidos.map((grupo) => {
                const tabela = calcularTabelaGrupo(grupo.id);
                const equipesDoGrupo = equipes.filter(
                  (e) => Number(e.grupo_id) === grupo.id && Number(e.modalidades_id) === Number(modalidadeSelecionada)
                );

                if (equipesDoGrupo.length === 0) return null;

                const partidasDoGrupo = partidas.filter(
                  (p) =>
                    obterGrupoDaPartida(p, equipes) === grupo.id &&
                    Number(p.modalidade_id) === Number(modalidadeSelecionada)
                );

                const partidasM3 = partidasDoGrupo.filter((p) => p.fase === "MELHOR_DE_3");
                const j1 = partidasM3.find((p) => p.ordem === 1);
                const j2 = partidasM3.find((p) => p.ordem === 2);
                const j3 = partidasM3.find((p) => p.ordem === 3);

                const resultadoM3 = avaliarSerieMelhorDe3(partidasM3, equipesDoGrupo);

                const semifinais = partidasDoGrupo.filter((p) => p.fase === "SEMIFINAL");
                const terceiroPartidas = partidasDoGrupo.filter((p) => p.fase === "TERCEIRO_LUGAR");
                const partidaTerceiro = terceiroPartidas[0];
                const vencTerceiro = partidaTerceiro ? determinarVencedorPartida(partidaTerceiro) : null;

                const finalPartidas = partidasDoGrupo.filter((p) => p.fase === "FINAL");
                const partidaFinal = finalPartidas[0];
                const vencFinal = partidaFinal ? determinarVencedorPartida(partidaFinal) : null;
                const viceFinal = partidaFinal ? determinarPerdedorPartida(partidaFinal) : null;

                let primeiroLugar: string | null = null;
                let segundoLugar: string | null = null;
                let terceiroLugar: string | null = null;

                if (equipesDoGrupo.length === 2 && resultadoM3.campeaoId) {
                  primeiroLugar = getNomeEquipe(resultadoM3.campeaoId);
                  segundoLugar = resultadoM3.viceId ? getNomeEquipe(resultadoM3.viceId) : null;
                } else if (equipesDoGrupo.length === 3 && vencFinal && vencFinal !== "PENDENTE") {
                  primeiroLugar = getNomeEquipe(Number(vencFinal));
                  segundoLugar = viceFinal && viceFinal !== "PENDENTE" ? getNomeEquipe(Number(viceFinal)) : null;
                  if (tabela.length >= 3) {
                    terceiroLugar = tabela[2].nome;
                  }
                } else if (equipesDoGrupo.length >= 4 && vencFinal && vencFinal !== "PENDENTE") {
                  primeiroLugar = getNomeEquipe(Number(vencFinal));
                  segundoLugar = viceFinal && viceFinal !== "PENDENTE" ? getNomeEquipe(Number(viceFinal)) : null;
                  if (vencTerceiro && vencTerceiro !== "PENDENTE") {
                    terceiroLugar = getNomeEquipe(Number(vencTerceiro));
                  }
                }

                return (
                  <div key={grupo.id} className="bento-card p-5 sm:p-7 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="h-3 w-3 rounded-full bg-[#52657a]" />
                        <h2 className="text-lg font-black text-slate-900 capitalize">{grupo.nome}</h2>
                      </div>
                      <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                        {equipesDoGrupo.length} equipes
                      </span>
                    </div>

                    {/* Tabela de Classificação */}
                    {equipesDoGrupo.length >= 3 && (
                      <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] border-b border-slate-200/80">
                              <th className="p-3 w-11 text-center">#</th>
                              <th className="p-3">Equipe</th>
                              <th className="p-3 text-center">Pts</th>
                              <th className="p-3 text-center">J</th>
                              <th className="p-3 text-center">V</th>
                              <th className="p-3 text-center">E</th>
                              <th className="p-3 text-center">D</th>
                              <th className="p-3 text-center">{ehFutsal ? "GP" : "PP"}</th>
                              <th className="p-3 text-center">{ehFutsal ? "GC" : "PC"}</th>
                              <th className="p-3 text-center">{ehFutsal ? "SG" : "SP"}</th>
                              {ehFutsal && (
                                <>
                                  <th className="p-3 text-center">CA</th>
                                  <th className="p-3 text-center">CV</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {tabela.map((t, idx) => (
                              <tr key={t.equipeId} className="hover:bg-slate-50/90 transition-colors">
                                <td className="p-3 text-center">
                                  <span
                                    className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-black ${
                                      idx === 0
                                        ? "bg-[#f06449]/15 text-[#e05338]"
                                        : idx === 1
                                        ? "bg-[#52657a]/15 text-[#3b4b5e]"
                                        : "bg-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {idx + 1}º
                                  </span>
                                </td>
                                <td className="p-3 font-bold text-slate-900">{t.nome}</td>
                                <td className="p-3 text-center font-black text-[#e05338] text-sm">
                                  {t.pontos}
                                </td>
                                <td className="p-3 text-center text-slate-600">{t.jogos}</td>
                                <td className="p-3 text-center text-emerald-600 font-semibold">{t.vitorias}</td>
                                <td className="p-3 text-center text-slate-500">{t.empates}</td>
                                <td className="p-3 text-center text-slate-500">{t.derrotas}</td>
                                <td className="p-3 text-center text-slate-600">{t.golsPro}</td>
                                <td className="p-3 text-center text-slate-600">{t.golsContra}</td>
                                <td className="p-3 text-center font-bold text-slate-800">{t.saldoGols}</td>
                                {ehFutsal && (
                                  <>
                                    <td className="p-3 text-center text-amber-600 font-bold">{t.cartoesAmarelos}</td>
                                    <td className="p-3 text-center text-rose-600 font-bold">{t.cartoesVermelhos}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Melhor de 3 */}
                    {equipesDoGrupo.length === 2 && partidasM3.length > 0 && (
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                          Série Melhor de 3
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {j1 && <CardPartidaMataMata partida={j1} titulo="Jogo 1" getNomeEquipe={getNomeEquipe} />}
                          {j2 && <CardPartidaMataMata partida={j2} titulo="Jogo 2" getNomeEquipe={getNomeEquipe} />}
                          {j3 && <CardPartidaMataMata partida={j3} titulo="Jogo 3" getNomeEquipe={getNomeEquipe} />}
                        </div>
                        {resultadoM3.statusTexto && (
                          <p className="text-xs text-[#e05338] font-bold text-center bg-[#f06449]/10 py-2 px-3 rounded-xl">
                            {resultadoM3.statusTexto}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Final (3 Equipes) */}
                    {equipesDoGrupo.length === 3 && finalPartidas.length > 0 && (
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-[#e05338]">
                          Grande Final
                        </h3>
                        <CardPartidaMataMata
                          partida={partidaFinal}
                          titulo="Final"
                          getNomeEquipe={getNomeEquipe}
                        />
                        {vencFinal === "PENDENTE" && STATUS_ENCERRADOS.includes(partidaFinal.status || "") && (
                          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl text-center">
                            ⚠️ Final empatada — aguardando definição de desempate.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mata-Mata (4+ Equipes) */}
                    {equipesDoGrupo.length >= 4 &&
                      (semifinais.length > 0 || terceiroPartidas.length > 0 || finalPartidas.length > 0) && (
                        <div className="pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {semifinais.length > 0 && (
                            <div className="space-y-3">
                              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                                Semifinais
                              </h3>
                              {semifinais.map((semi) => (
                                <CardPartidaMataMata
                                  key={semi.id}
                                  partida={semi}
                                  titulo={formatarFaseAmigavel(semi.fase, semi.ordem)}
                                  getNomeEquipe={getNomeEquipe}
                                />
                              ))}
                            </div>
                          )}

                          <div className="space-y-3">
                            {finalPartidas.length > 0 && (
                              <div className="space-y-2">
                                <h3 className="text-xs font-black uppercase tracking-wider text-[#e05338]">
                                  Grande Final
                                </h3>
                                <CardPartidaMataMata
                                  partida={partidaFinal}
                                  titulo="Final"
                                  getNomeEquipe={getNomeEquipe}
                                />
                                {vencFinal === "PENDENTE" && STATUS_ENCERRADOS.includes(partidaFinal.status || "") && (
                                  <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl text-center">
                                    ⚠️ Final empatada — aguardando desempate.
                                  </div>
                                )}
                              </div>
                            )}

                            {terceiroPartidas.length > 0 && (
                              <div className="space-y-2">
                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
                                  Disputa de 3º Lugar
                                </h3>
                                <CardPartidaMataMata
                                  partida={partidaTerceiro}
                                  titulo="3º Lugar"
                                  getNomeEquipe={getNomeEquipe}
                                />
                                {vencTerceiro === "PENDENTE" &&
                                  STATUS_ENCERRADOS.includes(partidaTerceiro.status || "") && (
                                    <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs rounded-xl text-center">
                                      ⚠️ Disputa de 3º empatada — aguardando desempate.
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    {/* PÓDIO */}
                    {primeiroLugar && (
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <h3 className="text-xs font-black uppercase tracking-wider text-[#52657a]">
                          🏆 Pódio Oficial
                        </h3>
                        <div className={`grid grid-cols-1 ${terceiroLugar ? "md:grid-cols-3" : "md:grid-cols-2"} gap-3`}>
                          <div className="bg-amber-50 border border-amber-300/80 p-4 rounded-2xl text-center shadow-xs">
                            <span className="text-[11px] font-black uppercase text-amber-700 block">
                              🥇 Campeão
                            </span>
                            <span className="text-base font-black text-slate-900 mt-1 block">
                              {primeiroLugar}
                            </span>
                          </div>

                          {segundoLugar && (
                            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl text-center">
                              <span className="text-[11px] font-black uppercase text-slate-500 block">
                                🥈 Vice-Campeão
                              </span>
                              <span className="text-base font-bold text-slate-800 mt-1 block">
                                {segundoLugar}
                              </span>
                            </div>
                          )}

                          {terceiroLugar && (
                            <div className="bg-orange-50/80 border border-orange-200 p-4 rounded-2xl text-center">
                              <span className="text-[11px] font-black uppercase text-orange-700 block">
                                🥉 3º Lugar
                              </span>
                              <span className="text-base font-bold text-slate-800 mt-1 block">
                                {terceiroLugar}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            {/* ABA 2: ARTILHARIA */}
            {ehFutsal && abaAtiva === "artilharia" && (
              <div className="bento-card p-5 sm:p-7 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-black text-slate-900">Artilharia</h2>
                  <span className="text-xs font-bold bg-[#f06449]/10 text-[#e05338] px-3 py-1 rounded-full">
                    Futsal
                  </span>
                </div>
                {artilheiros.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4">
                    Nenhum gol registrado em partidas finalizadas para este filtro.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] border-b border-slate-200/80">
                          <th className="p-3 w-12 text-center">#</th>
                          <th className="p-3">Atleta</th>
                          <th className="p-3">Equipe</th>
                          <th className="p-3">Grupo</th>
                          <th className="p-3 text-center">Gols</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {artilheiros.map((item, idx) => (
                          <tr key={item.alunoId} className="hover:bg-slate-50/90 transition-colors">
                            <td className="p-3 text-center font-black text-slate-500">{idx + 1}º</td>
                            <td className="p-3 font-bold text-slate-900">{item.nomeAluno}</td>
                            <td className="p-3 text-slate-700 font-medium">{item.nomeEquipe}</td>
                            <td className="p-3 text-slate-500 capitalize">{item.nomeGrupo}</td>
                            <td className="p-3 text-center font-black text-[#e05338] text-sm">
                              ⚽ {item.gols}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ABA 3: CARTÕES */}
            {ehFutsal && abaAtiva === "cartoes" && (
              <div className="bento-card p-5 sm:p-7 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-black text-slate-900">Controle Disciplinar</h2>
                  <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                    Cartões
                  </span>
                </div>
                {comCartoes.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4">
                    Nenhum cartão registrado em partidas finalizadas para este filtro.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] border-b border-slate-200/80">
                          <th className="p-3">Atleta</th>
                          <th className="p-3">Equipe</th>
                          <th className="p-3">Grupo</th>
                          <th className="p-3 text-center">🟨 Amarelos</th>
                          <th className="p-3 text-center">🟥 Vermelhos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {comCartoes.map((item) => (
                          <tr key={item.alunoId} className="hover:bg-slate-50/90 transition-colors">
                            <td className="p-3 font-bold text-slate-900">{item.nomeAluno}</td>
                            <td className="p-3 text-slate-700 font-medium">{item.nomeEquipe}</td>
                            <td className="p-3 text-slate-500 capitalize">{item.nomeGrupo}</td>
                            <td className="p-3 text-center font-bold text-amber-600">{item.amarelos}</td>
                            <td className="p-3 text-center font-bold text-rose-600">{item.vermelhos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ABA 4: JOGOS */}
            {abaAtiva === "jogos" &&
              gruposExibidos.map((grupo) => {
                const partidasDoGrupo = partidas.filter(
                  (p) =>
                    obterGrupoDaPartida(p, equipes) === grupo.id &&
                    Number(p.modalidade_id) === Number(modalidadeSelecionada)
                );
                if (partidasDoGrupo.length === 0) return null;

                const pGrupo = partidasDoGrupo.filter((p) => !p.fase || p.fase === "GRUPO");
                const pM3 = partidasDoGrupo.filter((p) => p.fase === "MELHOR_DE_3");
                const pSemi = partidasDoGrupo.filter((p) => p.fase === "SEMIFINAL");
                const pTerceiro = partidasDoGrupo.filter((p) => p.fase === "TERCEIRO_LUGAR");
                const pFinal = partidasDoGrupo.filter((p) => p.fase === "FINAL");

                return (
                  <div key={grupo.id} className="bento-card p-5 sm:p-7 space-y-6">
                    <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                      <span className="h-3 w-3 rounded-full bg-[#52657a]" />
                      <h2 className="text-lg font-black text-slate-900 capitalize">{grupo.nome}</h2>
                    </div>

                    {pGrupo.length > 0 && (
                      <BlocoJogosFase
                        titulo="Fase de Grupos"
                        partidas={pGrupo}
                        getNomeEquipe={getNomeEquipe}
                        formatarDataHora={formatarDataHoraExibicao}
                        formatarFaseAmigavel={formatarFaseAmigavel}
                      />
                    )}

                    {pM3.length > 0 && (
                      <BlocoJogosFase
                        titulo="Melhor de 3"
                        partidas={pM3}
                        getNomeEquipe={getNomeEquipe}
                        formatarDataHora={formatarDataHoraExibicao}
                        formatarFaseAmigavel={formatarFaseAmigavel}
                      />
                    )}

                    {pSemi.length > 0 && (
                      <BlocoJogosFase
                        titulo="Semifinais"
                        partidas={pSemi}
                        getNomeEquipe={getNomeEquipe}
                        formatarDataHora={formatarDataHoraExibicao}
                        formatarFaseAmigavel={formatarFaseAmigavel}
                      />
                    )}

                    {pTerceiro.length > 0 && (
                      <BlocoJogosFase
                        titulo="Disputa de 3º Lugar"
                        partidas={pTerceiro}
                        getNomeEquipe={getNomeEquipe}
                        formatarDataHora={formatarDataHoraExibicao}
                        formatarFaseAmigavel={formatarFaseAmigavel}
                      />
                    )}

                    {pFinal.length > 0 && (
                      <BlocoJogosFase
                        titulo="Grande Final"
                        partidas={pFinal}
                        getNomeEquipe={getNomeEquipe}
                        formatarDataHora={formatarDataHoraExibicao}
                        formatarFaseAmigavel={formatarFaseAmigavel}
                      />
                    )}
                  </div>
                );
              })}
          </>
        )}
      </div>
    </main>
  );
}

function CardPartidaMataMata({
  partida,
  titulo,
  getNomeEquipe,
}: {
  partida: Partida;
  titulo: string;
  getNomeEquipe: (id: number | null) => string;
}) {
  const pA = partida.placar_a ?? 0;
  const pB = partida.placar_b ?? 0;
  const ehEmpate = pA === pB;
  const statusEncerrado = partida.status && STATUS_ENCERRADOS.includes(partida.status);
  const temPenaltis = ehEmpate && partida.vencedor_id && statusEncerrado;

  return (
    <div className="bg-slate-50/90 border border-slate-200/90 p-4 rounded-2xl space-y-2.5">
      <div className="flex justify-between items-center text-[10px] font-bold uppercase">
        <span className="text-[#3b4b5e] bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
          {titulo}
        </span>
        <span
          className={`px-2.5 py-0.5 rounded-full ${
            statusEncerrado
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-white text-slate-500 border border-slate-200"
          }`}
        >
          {partida.status ? partida.status.replace("_", " ") : "agendada"}
        </span>
      </div>

      <div className="flex justify-between items-center text-xs font-bold py-1 gap-2">
        <span
          className={
            pA > pB || (ehEmpate && Number(partida.vencedor_id) === Number(partida.time_a_id))
              ? "text-[#e05338] font-black"
              : "text-slate-800"
          }
        >
          {getNomeEquipe(partida.time_a_id)}
        </span>
        <span className="bg-[#52657a] text-white px-3.5 py-1 rounded-xl font-black shrink-0 shadow-xs">
          {pA} x {pB}
        </span>
        <span
          className={
            pB > pA || (ehEmpate && Number(partida.vencedor_id) === Number(partida.time_b_id))
              ? "text-[#e05338] font-black text-right"
              : "text-slate-800 text-right"
          }
        >
          {getNomeEquipe(partida.time_b_id)}
        </span>
      </div>

      {temPenaltis && (
        <div className="text-[10px] text-emerald-700 text-center font-bold bg-emerald-50 p-1.5 rounded-xl border border-emerald-200">
          🏆 Desempate: {getNomeEquipe(partida.vencedor_id)}
        </div>
      )}
    </div>
  );
}

function BlocoJogosFase({
  titulo,
  partidas,
  getNomeEquipe,
  formatarDataHora,
  formatarFaseAmigavel,
}: {
  titulo: string;
  partidas: Partida[];
  getNomeEquipe: (id: number | null) => string;
  formatarDataHora: (iso: string | null) => string;
  formatarFaseAmigavel: (fase: string | null, ordem: number | null) => string;
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
        {titulo}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {partidas.map((p) => {
          const statusPartida = p.status || "agendada";
          const statusEncerrado = STATUS_ENCERRADOS.includes(statusPartida);
          const pA = p.placar_a ?? 0;
          const pB = p.placar_b ?? 0;
          const ehEmpate = pA === pB;
          const temPenaltis = ehEmpate && p.vencedor_id && statusEncerrado;

          return (
            <div key={p.id} className="bg-slate-50/90 border border-slate-200/90 p-4 rounded-2xl space-y-2.5">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                <span className="text-[#3b4b5e] bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                  {formatarFaseAmigavel(p.fase, p.ordem)}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full ${
                    statusEncerrado
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : statusPartida === "em_andamento"
                      ? "bg-[#f06449]/15 text-[#e05338] border border-[#f06449]/30"
                      : "bg-white text-slate-500 border border-slate-200"
                  }`}
                >
                  {statusPartida.replace("_", " ")}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs font-bold py-1 gap-2">
                <span className="text-slate-800">{getNomeEquipe(p.time_a_id)}</span>
                <span className="bg-[#52657a] text-white px-3.5 py-1 rounded-xl font-black shrink-0 shadow-xs">
                  {pA} x {pB}
                </span>
                <span className="text-slate-800 text-right">{getNomeEquipe(p.time_b_id)}</span>
              </div>

              <div className="text-[11px] text-slate-500 flex justify-between items-center pt-2 border-t border-slate-200/70">
                <span>📅 {formatarDataHora(p.horario)}</span>
                {p.local && <span>📍 {p.local}</span>}
              </div>

              {temPenaltis && (
                <div className="text-[10px] text-emerald-700 text-center font-bold bg-emerald-50 p-1.5 rounded-xl border border-emerald-200">
                  🏆 Desempate: {getNomeEquipe(p.vencedor_id)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}