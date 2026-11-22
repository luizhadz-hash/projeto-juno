"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { verificarSessaoAtiva } from "@/lib/auth";
import FooterVoltar from "@/app/components/FooterVoltar";

interface Modalidade {
  id: number;
  nome: string;
}

interface Equipe {
  id: number;
  nome: string;
  serie_turma: string | null;
  grupo_id: number | null;
  modalidades_id: number | null;
  grupo: string | null;
}

interface Aluno {
  id: number;
  nome: string;
  equipes_id: number | null;
  gols: number | null;
  cartoes_amarelos: number | null;
  cartoes_vermelhos: number | null;
  turma: string | null;
}

interface Partida {
  id: number;
  modalidade_id: number;
  time_a_id: number | null;
  time_b_id: number | null;
  placar_a: number | null;
  placar_b: number | null;
  status: string | null;
  horario: string | null;
  local: string | null;
  grupo_id: number | null;
  fase: "GRUPO" | "MELHOR_DE_3" | "SEMIFINAL" | "TERCEIRO_LUGAR" | "FINAL" | null;
  ordem: number | null;
  vencedor_id: number | null;
}

interface SumulaEvento {
  id: number;
  partida_id: number;
  aluno_id: number;
  equipe_id: number;
  tipo: "gol" | "amarelo" | "vermelho";
  created_at: string;
}

export default function SumulaDigitalPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const resolvedParams = use(params);
  const partidaId = Number(resolvedParams.matchId);

  const [partida, setPartida] = useState<Partida | null>(null);
  const [modalidade, setModalidade] = useState<Modalidade | null>(null);
  const [equipeA, setEquipeA] = useState<Equipe | null>(null);
  const [equipeB, setEquipeB] = useState<Equipe | null>(null);

  const [alunosA, setAlunosA] = useState<Aluno[]>([]);
  const [alunosB, setAlunosB] = useState<Aluno[]>([]);
  const [eventos, setEventos] = useState<SumulaEvento[]>([]);

  const [placarA, setPlacarA] = useState(0);
  const [placarB, setPlacarB] = useState(0);

  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  // Controle de finalização e desempate por pênaltis
  const [mostrarModalFinalizar, setMostrarModalFinalizar] = useState(false);
  const [vencedorPenaltisId, setVencedorPenaltisId] = useState<number | null>(null);

  // Trava síncrona contra cliques duplos simultâneos
  const lockAcaoRef = useRef<boolean>(false);

  function formatarDataHora(dataIso: string | null) {
    if (!dataIso) return "Data/horário ainda não definidos";
    try {
      const d = new Date(dataIso);
      if (isNaN(d.getTime())) return "Data/horário ainda não definidos";
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
      return "Data/horário ainda não definidos";
    }
  }

  function formatarFase(fase: string | null, ordem: number | null) {
    if (!fase || fase === "GRUPO") return "Fase de Grupos";
    if (fase === "SEMIFINAL") return `Semifinal ${ordem || 1}`;
    if (fase === "TERCEIRO_LUGAR") return "Disputa de 3º Lugar";
    if (fase === "FINAL") return "Grande Final";
    if (fase === "MELHOR_DE_3") return `Melhor de 3 — Jogo ${ordem || 1}`;
    return fase;
  }

  function verificarEhFutsal(mod: Modalidade | null, modId?: number) {
    const nome = mod?.nome?.trim().toLowerCase() || "";
    return nome === "futsal" || modId === 1;
  }

  async function carregarTudo() {
    if (!partidaId || Number.isNaN(partidaId)) {
      setMensagemErro("Identificador de partida inválido.");
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setMensagemErro(null);

    try {
      // 1. Buscar Partida
      const { data: pData, error: pError } = await supabase
        .from("partidas")
        .select("*")
        .eq("id", partidaId)
        .single();

      if (pError || !pData) {
        setMensagemErro("Erro ao carregar os dados da partida.");
        return;
      }

      const partidaCarregada = pData as Partida;
      setPartida(partidaCarregada);
      setPlacarA(partidaCarregada.placar_a ?? 0);
      setPlacarB(partidaCarregada.placar_b ?? 0);
      if (partidaCarregada.vencedor_id) {
        setVencedorPenaltisId(partidaCarregada.vencedor_id);
      }

      // 2. Buscar Modalidade
      let modalidadeCarregada: Modalidade | null = null;
      if (partidaCarregada.modalidade_id) {
        const { data: mData, error: mError } = await supabase
          .from("modalidade")
          .select("*")
          .eq("id", partidaCarregada.modalidade_id)
          .single();

        if (!mError && mData) {
          modalidadeCarregada = mData as Modalidade;
          setModalidade(modalidadeCarregada);
        }
      }

      // 3. Buscar Equipes
      const idsEquipes = [
        partidaCarregada.time_a_id,
        partidaCarregada.time_b_id,
      ].filter(Boolean) as number[];

      if (idsEquipes.length > 0) {
        const { data: eqData, error: eqError } = await supabase
          .from("equipes")
          .select("*")
          .in("id", idsEquipes);

        if (!eqError && eqData) {
          setEquipeA(
            eqData.find((e) => e.id === partidaCarregada.time_a_id) || null
          );
          setEquipeB(
            eqData.find((e) => e.id === partidaCarregada.time_b_id) || null
          );
        }
      }

      // 4 e 5. Buscar Alunos e Eventos SOMENTE se a modalidade for Futsal
      const ehFutsal = verificarEhFutsal(
        modalidadeCarregada,
        partidaCarregada.modalidade_id
      );

      if (ehFutsal) {
        if (idsEquipes.length > 0) {
          const { data: aluData, error: aluError } = await supabase
            .from("alunos")
            .select("*")
            .in("equipes_id", idsEquipes)
            .order("nome", { ascending: true });

          if (!aluError && aluData) {
            const listaAlunos = aluData as Aluno[];
            setAlunosA(
              listaAlunos.filter(
                (a) => a.equipes_id === partidaCarregada.time_a_id
              )
            );
            setAlunosB(
              listaAlunos.filter(
                (a) => a.equipes_id === partidaCarregada.time_b_id
              )
            );
          }
        }

        const { data: evData, error: evError } = await supabase
          .from("sumula_eventos")
          .select("*")
          .eq("partida_id", partidaId)
          .order("created_at", { ascending: true });

        if (!evError && evData) {
          setEventos(evData as SumulaEvento[]);
        }
      } else {
        setAlunosA([]);
        setAlunosB([]);
        setEventos([]);
      }
    } catch (e) {
      console.error("Erro inesperado:", e);
      setMensagemErro("Ocorreu um erro ao carregar as informações da súmula.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    async function verificarEIniciar() {
      const autenticado = await verificarSessaoAtiva();
      if (!autenticado) {
        window.location.replace("/professor");
        return;
      }
      carregarTudo();
    }
    verificarEIniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidaId]);

  function contarEventosAluno(
    alunoId: number,
    tipo: "gol" | "amarelo" | "vermelho"
  ) {
    return eventos.filter((e) => e.aluno_id === alunoId && e.tipo === tipo)
      .length;
  }

  function alunoEstaExpulso(alunoId: number) {
    const amarelos = contarEventosAluno(alunoId, "amarelo");
    const vermelhos = contarEventosAluno(alunoId, "vermelho");
    return amarelos >= 2 || vermelhos >= 1;
  }

  async function adicionarEvento(
    aluno: Aluno,
    tipo: "gol" | "amarelo" | "vermelho"
  ) {
    if (processando || lockAcaoRef.current) return;

    if (partida?.status === "finalizada") {
      setMensagemErro("Esta partida já está finalizada e não pode ser alterada.");
      return;
    }

    const ehFutsal = verificarEhFutsal(modalidade, partida?.modalidade_id);

    if ((tipo === "amarelo" || tipo === "vermelho") && !ehFutsal) {
      setMensagemErro(
        "Cartões amarelos e vermelhos são permitidos apenas na modalidade Futsal."
      );
      return;
    }

    const timeA = partida?.time_a_id;
    const timeB = partida?.time_b_id;
    if (aluno.equipes_id !== timeA && aluno.equipes_id !== timeB) {
      setMensagemErro(
        "Este aluno não pertence a nenhuma das equipes desta partida."
      );
      return;
    }

    const amarelosAtuais = contarEventosAluno(aluno.id, "amarelo");
    const vermelhosAtuais = contarEventosAluno(aluno.id, "vermelho");

    if (tipo === "amarelo" || tipo === "vermelho") {
      if (vermelhosAtuais >= 1 || amarelosAtuais >= 2) {
        setMensagemErro(
          `O aluno ${aluno.nome} já foi expulso nesta partida e não pode receber novos cartões.`
        );
        return;
      }

      if (tipo === "amarelo" && amarelosAtuais >= 2) {
        setMensagemErro(
          `O aluno ${aluno.nome} já atingiu o limite de 2 cartões amarelos.`
        );
        return;
      }

      if (tipo === "vermelho" && vermelhosAtuais >= 1) {
        setMensagemErro(
          `O aluno ${aluno.nome} já recebeu cartão vermelho nesta partida.`
        );
        return;
      }
    }

    const equipeId = aluno.equipes_id;
    const geraVermelhoAutomatico = tipo === "amarelo" && amarelosAtuais === 1;

    lockAcaoRef.current = true;
    setProcessando(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      const registrosParaInserir = geraVermelhoAutomatico
        ? [
            {
              partida_id: partidaId,
              aluno_id: aluno.id,
              equipe_id: equipeId,
              tipo: "amarelo" as const,
            },
            {
              partida_id: partidaId,
              aluno_id: aluno.id,
              equipe_id: equipeId,
              tipo: "vermelho" as const,
            },
          ]
        : [
            {
              partida_id: partidaId,
              aluno_id: aluno.id,
              equipe_id: equipeId,
              tipo,
            },
          ];

      const { data: novosEventosData, error: errEvento } = await supabase
        .from("sumula_eventos")
        .insert(registrosParaInserir)
        .select();

      if (errEvento || !novosEventosData || novosEventosData.length === 0) {
        throw new Error("Erro ao registrar o evento na súmula.");
      }

      const novosEventos = novosEventosData as SumulaEvento[];

      if (tipo === "gol") {
        const eTimeA = equipeId === timeA;
        const novoPlacarA = eTimeA ? placarA + 1 : placarA;
        const novoPlacarB = !eTimeA ? placarB + 1 : placarB;

        const { error: errPartida } = await supabase
          .from("partidas")
          .update({
            placar_a: novoPlacarA,
            placar_b: novoPlacarB,
            status: "em_andamento",
          })
          .eq("id", partidaId);

        if (errPartida) throw new Error("Erro ao atualizar o placar da partida.");

        const { error: errAluno } = await supabase
          .from("alunos")
          .update({ gols: (aluno.gols ?? 0) + 1 })
          .eq("id", aluno.id);

        if (errAluno) throw new Error("Erro ao atualizar gols do aluno.");

        setPlacarA(novoPlacarA);
        setPlacarB(novoPlacarB);
        setPartida((prev) =>
          prev
            ? {
                ...prev,
                status: "em_andamento",
                placar_a: novoPlacarA,
                placar_b: novoPlacarB,
              }
            : null
        );

        const atualizarLista = (lista: Aluno[]) =>
          lista.map((a) =>
            a.id === aluno.id ? { ...a, gols: (a.gols ?? 0) + 1 } : a
          );
        if (eTimeA) setAlunosA(atualizarLista);
        else setAlunosB(atualizarLista);
      } else if (geraVermelhoAutomatico) {
        const novosAmarelos = (aluno.cartoes_amarelos ?? 0) + 1;
        const novosVermelhos = (aluno.cartoes_vermelhos ?? 0) + 1;

        const { error: errAluno } = await supabase
          .from("alunos")
          .update({
            cartoes_amarelos: novosAmarelos,
            cartoes_vermelhos: novosVermelhos,
          })
          .eq("id", aluno.id);

        if (errAluno) throw new Error("Erro ao atualizar cartões do aluno.");

        const atualizarLista = (lista: Aluno[]) =>
          lista.map((a) =>
            a.id === aluno.id
              ? {
                  ...a,
                  cartoes_amarelos: novosAmarelos,
                  cartoes_vermelhos: novosVermelhos,
                }
              : a
          );
        if (equipeId === timeA) setAlunosA(atualizarLista);
        else setAlunosB(atualizarLista);

        setMensagemSucesso(
          `2º cartão amarelo para ${aluno.nome}: cartão vermelho automático aplicado e aluno expulso da partida.`
        );
      } else {
        const campo =
          tipo === "amarelo" ? "cartoes_amarelos" : "cartoes_vermelhos";
        const valorAtual = aluno[campo] ?? 0;

        const { error: errAluno } = await supabase
          .from("alunos")
          .update({ [campo]: valorAtual + 1 })
          .eq("id", aluno.id);

        if (errAluno) throw new Error("Erro ao atualizar cartões do aluno.");

        const atualizarLista = (lista: Aluno[]) =>
          lista.map((a) =>
            a.id === aluno.id ? { ...a, [campo]: valorAtual + 1 } : a
          );
        if (equipeId === timeA) setAlunosA(atualizarLista);
        else setAlunosB(atualizarLista);

        if (tipo === "vermelho") {
          setMensagemSucesso(
            `Cartão vermelho direto para ${aluno.nome}: aluno expulso da partida.`
          );
        }
      }

      setEventos((prev) => [...prev, ...novosEventos]);
    } catch (err: unknown) {
      setMensagemErro(
        err instanceof Error ? err.message : "Erro ao registrar evento."
      );
    } finally {
      setProcessando(false);
      lockAcaoRef.current = false;
    }
  }

  async function removerEvento(
    aluno: Aluno,
    tipo: "gol" | "amarelo" | "vermelho"
  ) {
    if (processando || lockAcaoRef.current) return;
    if (partida?.status === "finalizada") {
      setMensagemErro("Esta partida já está finalizada e não pode ser alterada.");
      return;
    }

    const eventosDoAluno = eventos.filter((e) => e.aluno_id === aluno.id);
    const eventoParaRemover = [...eventosDoAluno]
      .reverse()
      .find((e) => e.tipo === tipo);

    if (!eventoParaRemover) {
      setMensagemErro(
        "Nenhum evento desse tipo foi encontrado para este aluno nesta partida."
      );
      return;
    }

    const amarelosAluno = eventosDoAluno.filter(
      (e) => e.tipo === "amarelo"
    ).length;
    const ultimoVermelho = [...eventosDoAluno]
      .reverse()
      .find((e) => e.tipo === "vermelho");
    const removerVermelhoAssociado =
      tipo === "amarelo" && amarelosAluno === 2 && Boolean(ultimoVermelho);

    lockAcaoRef.current = true;
    setProcessando(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      const idsParaExcluir =
        removerVermelhoAssociado && ultimoVermelho
          ? [eventoParaRemover.id, ultimoVermelho.id]
          : [eventoParaRemover.id];

      const { error: errDel } = await supabase
        .from("sumula_eventos")
        .delete()
        .in("id", idsParaExcluir);

      if (errDel) throw new Error("Erro ao remover o evento da súmula.");

      const equipeId = aluno.equipes_id;
      const timeA = partida?.time_a_id;

      if (tipo === "gol") {
        const eTimeA = equipeId === timeA;
        const novoPlacarA = eTimeA ? Math.max(0, placarA - 1) : placarA;
        const novoPlacarB = !eTimeA ? Math.max(0, placarB - 1) : placarB;

        const { error: errPartida } = await supabase
          .from("partidas")
          .update({ placar_a: novoPlacarA, placar_b: novoPlacarB })
          .eq("id", partidaId);

        if (errPartida) throw new Error("Erro ao atualizar o placar da partida.");

        const { error: errAluno } = await supabase
          .from("alunos")
          .update({ gols: Math.max(0, (aluno.gols ?? 0) - 1) })
          .eq("id", aluno.id);

        if (errAluno) throw new Error("Erro ao atualizar estatísticas do aluno.");

        setPlacarA(novoPlacarA);
        setPlacarB(novoPlacarB);
        setPartida((prev) =>
          prev
            ? { ...prev, placar_a: novoPlacarA, placar_b: novoPlacarB }
            : null
        );

        const atualizarLista = (lista: Aluno[]) =>
          lista.map((a) =>
            a.id === aluno.id
              ? { ...a, gols: Math.max(0, (a.gols ?? 0) - 1) }
              : a
          );
        if (eTimeA) setAlunosA(atualizarLista);
        else setAlunosB(atualizarLista);
      } else if (removerVermelhoAssociado) {
        const novosAmarelos = Math.max(0, (aluno.cartoes_amarelos ?? 0) - 1);
        const novosVermelhos = Math.max(0, (aluno.cartoes_vermelhos ?? 0) - 1);

        const { error: errAluno } = await supabase
          .from("alunos")
          .update({
            cartoes_amarelos: novosAmarelos,
            cartoes_vermelhos: novosVermelhos,
          })
          .eq("id", aluno.id);

        if (errAluno) throw new Error("Erro ao atualizar cartões do aluno.");

        const atualizarLista = (lista: Aluno[]) =>
          lista.map((a) =>
            a.id === aluno.id
              ? {
                  ...a,
                  cartoes_amarelos: novosAmarelos,
                  cartoes_vermelhos: novosVermelhos,
                }
              : a
          );
        if (equipeId === timeA) setAlunosA(atualizarLista);
        else setAlunosB(atualizarLista);
      } else {
        const campo =
          tipo === "amarelo" ? "cartoes_amarelos" : "cartoes_vermelhos";
        const valorAtual = aluno[campo] ?? 0;
        const novoValor = Math.max(0, valorAtual - 1);

        const { error: errAluno } = await supabase
          .from("alunos")
          .update({ [campo]: novoValor })
          .eq("id", aluno.id);

        if (errAluno) throw new Error("Erro ao atualizar cartões do aluno.");

        const atualizarLista = (lista: Aluno[]) =>
          lista.map((a) =>
            a.id === aluno.id ? { ...a, [campo]: novoValor } : a
          );
        if (equipeId === timeA) setAlunosA(atualizarLista);
        else setAlunosB(atualizarLista);
      }

      setEventos((prev) => prev.filter((e) => !idsParaExcluir.includes(e.id)));
    } catch (err: unknown) {
      setMensagemErro(
        err instanceof Error ? err.message : "Erro ao remover evento."
      );
    } finally {
      setProcessando(false);
      lockAcaoRef.current = false;
    }
  }

  async function atualizarPlacarDireto(novoA: number, novoB: number) {
    if (processando || lockAcaoRef.current) return;
    if (partida?.status === "finalizada") {
      setMensagemErro("Esta partida já está finalizada e não pode ser alterada.");
      return;
    }

    lockAcaoRef.current = true;
    setProcessando(true);
    setMensagemErro(null);

    try {
      const { error } = await supabase
        .from("partidas")
        .update({ placar_a: novoA, placar_b: novoB, status: "em_andamento" })
        .eq("id", partidaId);

      if (error) throw new Error("Erro ao atualizar o placar.");

      setPlacarA(novoA);
      setPlacarB(novoB);
      setPartida((prev) =>
        prev
          ? {
              ...prev,
              status: "em_andamento",
              placar_a: novoA,
              placar_b: novoB,
            }
          : null
      );
    } catch (err: unknown) {
      setMensagemErro(
        err instanceof Error ? err.message : "Erro ao atualizar o placar."
      );
    } finally {
      setProcessando(false);
      lockAcaoRef.current = false;
    }
  }

  async function alterarStatusPartida(novoStatus: string) {
    if (processando) return;

    if (partida?.status === "finalizada") {
      setMensagemErro(
        "A partida já foi finalizada e está bloqueada para alterações."
      );
      return;
    }

    if (novoStatus === "finalizada") {
      setMostrarModalFinalizar(true);
      return;
    }

    await executarMudancaStatus(novoStatus, null);
  }

  async function executarMudancaStatus(
    novoStatus: string,
    vencedorPenaltisManualId: number | null = null
  ) {
    const ehEliminatoria =
      partida?.fase === "MELHOR_DE_3" ||
      partida?.fase === "SEMIFINAL" ||
      partida?.fase === "TERCEIRO_LUGAR" ||
      partida?.fase === "FINAL";

    const ehEmpate = placarA === placarB;
    const idVencedorAnotado = vencedorPenaltisManualId || vencedorPenaltisId;

    if (novoStatus === "finalizada" && ehEliminatoria && ehEmpate) {
      if (!idVencedorAnotado) {
        setMensagemErro(
          "Selecione qual equipe venceu no desempate antes de finalizar a partida."
        );
        setMostrarModalFinalizar(true);
        return;
      }

      if (
        idVencedorAnotado !== partida?.time_a_id &&
        idVencedorAnotado !== partida?.time_b_id
      ) {
        setMensagemErro(
          "O vencedor do desempate deve pertencer a uma das duas equipes da partida."
        );
        return;
      }
    }

    setProcessando(true);
    setMensagemErro(null);
    setMensagemSucesso(null);

    try {
      const payload: { status: string; vencedor_id?: number | null } = {
        status: novoStatus,
      };

      if (
        novoStatus === "finalizada" &&
        ehEliminatoria &&
        ehEmpate &&
        idVencedorAnotado
      ) {
        payload.vencedor_id = idVencedorAnotado;
      }

      const { error } = await supabase
        .from("partidas")
        .update(payload)
        .eq("id", partidaId);

      if (error) throw new Error("Erro ao atualizar o status da partida.");

      setPartida((prev) =>
        prev
          ? {
              ...prev,
              status: novoStatus,
              ...(payload.vencedor_id !== undefined
                ? { vencedor_id: payload.vencedor_id }
                : {}),
            }
          : null
      );

      setMensagemSucesso(
        `Status alterado para: ${novoStatus.replace("_", " ").toUpperCase()}`
      );
    } catch (err: unknown) {
      setMensagemErro(
        err instanceof Error ? err.message : "Erro ao alterar status da partida."
      );
    } finally {
      setProcessando(false);
      setMostrarModalFinalizar(false);
    }
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-[#eef2f6] text-slate-900 p-8 flex items-center justify-center">
        <p className="text-sm text-slate-500 font-bold animate-pulse">
          Carregando dados da súmula...
        </p>
      </main>
    );
  }

  const isFutsal = verificarEhFutsal(modalidade, partida?.modalidade_id);
  const partidaFinalizada = partida?.status === "finalizada";
  const ehEliminatoria =
    partida?.fase === "MELHOR_DE_3" ||
    partida?.fase === "SEMIFINAL" ||
    partida?.fase === "TERCEIRO_LUGAR" ||
    partida?.fase === "FINAL";
  const ehEmpate = placarA === placarB;

  const todosAlunos = [...alunosA, ...alunosB];
  const getNomeAluno = (alunoId: number) =>
    todosAlunos.find((a) => a.id === alunoId)?.nome || `Atleta #${alunoId}`;
  const getNomeEquipePorId = (eqId: number) =>
    eqId === equipeA?.id
      ? equipeA?.nome || "Equipe A"
      : equipeB?.nome || "Equipe B";

  return (
    <main className="print-container min-h-screen bg-[#eef2f6] text-slate-900 p-4 sm:p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* CABEÇALHO OFICIAL EXCLUSIVO PARA IMPRESSÃO */}
        <div className="print-only border-b-2 border-black pb-3 mb-4">
          <div className="flex justify-between items-end">
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide">
                Súmula Oficial da Partida #{partidaId}
              </h1>
              <p className="text-xs font-bold mt-1">
                Modalidade: {modalidade?.nome?.toUpperCase() || "—"} •{" "}
                {formatarFase(partida?.fase || null, partida?.ordem || null)}
              </p>
            </div>
            <div className="text-right text-[11px]">
              <p>
                Status:{" "}
                {(partida?.status || "agendada").replace("_", " ").toUpperCase()}
              </p>
              <p>
                Impresso em: {new Date().toLocaleDateString("pt-BR")} às{" "}
                {new Date().toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>

        {/* BARRA SUPERIOR DE NAVEGAÇÃO E IMPRESSÃO */}
        <div className="no-print bento-card flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <Link
            href="/professor/partidas"
            className="text-xs font-bold text-slate-700 hover:text-[#e05338] transition flex items-center gap-2"
          >
            <span className="text-[#f06449] font-black">←</span>
            <span>Voltar para Partidas & Súmulas</span>
          </Link>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-[#52657a] hover:bg-[#3f5063] text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2"
          >
            <span>🖨️</span>
            <span>Imprimir Súmula</span>
          </button>
        </div>

        {/* Notificações de Erro/Sucesso */}
        {mensagemErro && (
          <div className="no-print bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-2xl text-xs font-bold flex justify-between items-center shadow-xs">
            <span>{mensagemErro}</span>
            <button
              onClick={() => setMensagemErro(null)}
              className="text-rose-500 hover:text-rose-700 font-black ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {mensagemSucesso && (
          <div className="no-print bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs font-bold flex justify-between items-center shadow-xs">
            <span>{mensagemSucesso}</span>
            <button
              onClick={() => setMensagemSucesso(null)}
              className="text-emerald-500 hover:text-emerald-700 font-black ml-4 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Alerta de Edição Bloqueada */}
        {partidaFinalizada && (
          <div className="no-print bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-2xl text-xs font-bold text-center">
            Partida finalizada — edição bloqueada. Utilize o botão &ldquo;Imprimir Súmula&rdquo; acima para emitir o documento oficial.
          </div>
        )}

        {/* HERO PLACAR E CABEÇALHO DA PARTIDA */}
        <section className="print-card bento-hero court-grid-bg p-6 sm:p-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-white bg-white/15 px-3 py-1 rounded-full">
              {modalidade?.nome || "Modalidade"}
            </span>

            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-100 bg-white/10 px-3 py-1 rounded-full">
              {formatarFase(partida?.fase || null, partida?.ordem || null)}
            </span>

            <span
              className={`text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${
                partidaFinalizada
                  ? "text-emerald-950 bg-emerald-300"
                  : partida?.status === "em_andamento"
                  ? "text-white bg-[#f06449]"
                  : "text-slate-100 bg-white/15"
              }`}
            >
              {partida?.status ? partida.status.replace("_", " ") : "Agendada"}
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-200/90 mb-6">
            <span>📅 {formatarDataHora(partida?.horario || null)}</span>
            {partida?.local && <span>• 📍 {partida.local}</span>}
          </div>

          <div className="grid grid-cols-3 items-center gap-2 my-4">
            <div className="text-right pr-2 md:pr-6">
              <h2 className="text-lg md:text-2xl font-black text-white">
                {equipeA?.nome || "Time A"}
              </h2>
              {equipeA?.serie_turma && (
                <p className="text-xs text-slate-200/80 mt-0.5">
                  {equipeA.serie_turma}
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 sm:gap-4 bg-white px-5 py-3.5 rounded-2xl shadow-lg mx-auto">
              <span className="text-3xl md:text-5xl font-black text-slate-900">
                {placarA}
              </span>
              <span className="text-[#f06449] font-black text-lg">x</span>
              <span className="text-3xl md:text-5xl font-black text-slate-900">
                {placarB}
              </span>
            </div>

            <div className="text-left pl-2 md:pl-6">
              <h2 className="text-lg md:text-2xl font-black text-white">
                {equipeB?.nome || "Time B"}
              </h2>
              {equipeB?.serie_turma && (
                <p className="text-xs text-slate-200/80 mt-0.5">
                  {equipeB.serie_turma}
                </p>
              )}
            </div>
          </div>

          {/* Vencedor do Desempate */}
          {partidaFinalizada && partida?.vencedor_id && ehEmpate && (
            <div className="mt-3 text-xs font-black text-emerald-950 bg-emerald-300 px-3.5 py-1.5 rounded-xl inline-block">
              🏆 Vencedor do desempate:{" "}
              {partida.vencedor_id === equipeA?.id
                ? equipeA?.nome
                : equipeB?.nome}
            </div>
          )}

          {/* Controle de Status */}
          <div className="no-print flex flex-wrap justify-center gap-3 pt-5 mt-6 border-t border-white/15">
            <button
              disabled={processando || partidaFinalizada}
              onClick={() => alterarStatusPartida("em_andamento")}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer disabled:opacity-40 ${
                partida?.status === "em_andamento"
                  ? "bg-[#f06449] text-white shadow-sm"
                  : "bg-white/15 hover:bg-white/25 text-white border border-white/20"
              }`}
            >
              Em Andamento
            </button>
            <button
              disabled={processando || partidaFinalizada}
              onClick={() => alterarStatusPartida("finalizada")}
              className={`px-4 py-2.5 rounded-xl text-xs font-black transition cursor-pointer disabled:opacity-40 ${
                partida?.status === "finalizada"
                  ? "bg-emerald-400 text-emerald-950"
                  : "bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm"
              }`}
            >
              Finalizar Partida
            </button>
          </div>
        </section>

        {/* MÓDULO 1: SÚMULA FUTSAL (Atletas, Gols e Disciplina) */}
        {isFutsal ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                { equipe: equipeA, alunos: alunosA, id: partida?.time_a_id },
                { equipe: equipeB, alunos: alunosB, id: partida?.time_b_id },
              ].map(({ equipe, alunos, id }, idx) => (
                <section
                  key={id || `eq-${idx}`}
                  className="print-card bento-card p-5 sm:p-6"
                >
                  <div className="flex justify-between items-center pb-3.5 mb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#f06449]" />
                      <h3 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                        {equipe?.nome || "Equipe"}
                      </h3>
                    </div>
                    <span className="text-xs text-[#3b4b5e] bg-[#52657a]/10 px-2.5 py-0.5 rounded-full font-bold">
                      {alunos.length} atletas
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {alunos.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-4 text-center">
                        Nenhum aluno cadastrado nesta equipe.
                      </p>
                    ) : (
                      alunos.map((aluno) => {
                        const golsJogo = contarEventosAluno(aluno.id, "gol");
                        const amarelosJogo = contarEventosAluno(
                          aluno.id,
                          "amarelo"
                        );
                        const vermelhosJogo = contarEventosAluno(
                          aluno.id,
                          "vermelho"
                        );
                        const expulso = alunoEstaExpulso(aluno.id);

                        return (
                          <div
                            key={aluno.id}
                            className={`print-box p-3.5 rounded-2xl border space-y-2.5 transition ${
                              expulso
                                ? "bg-rose-50/90 border-rose-200"
                                : "bg-slate-50/90 border-slate-200/90"
                            }`}
                          >
                            <div className="flex justify-between items-center gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-bold text-slate-900">
                                  {aluno.nome}
                                </span>
                                {expulso && (
                                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-600 text-white">
                                    Expulso
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                <span
                                  title="Gols nesta partida"
                                  className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-emerald-700"
                                >
                                  ⚽ {golsJogo}
                                </span>
                                <span
                                  title="Cartões amarelos nesta partida"
                                  className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-amber-700"
                                >
                                  🟨 {amarelosJogo}/2
                                </span>
                                <span
                                  title="Cartões vermelhos nesta partida"
                                  className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 text-rose-700"
                                >
                                  🟥 {vermelhosJogo}/1
                                </span>
                              </div>
                            </div>

                            {!partidaFinalizada && (
                              <div className="no-print flex flex-wrap gap-2 pt-2.5 border-t border-slate-200/70 justify-end">
                                {/* Controle de Gols */}
                                <div className="flex items-center border border-emerald-200 rounded-xl bg-white overflow-hidden">
                                  <button
                                    disabled={processando || golsJogo === 0}
                                    onClick={() => removerEvento(aluno, "gol")}
                                    className="px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-600 hover:text-white font-black transition cursor-pointer disabled:opacity-30"
                                  >
                                    -
                                  </button>
                                  <span className="px-2 text-[11px] font-bold text-emerald-800">
                                    ⚽ Gol
                                  </span>
                                  <button
                                    disabled={processando}
                                    onClick={() => adicionarEvento(aluno, "gol")}
                                    className="px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-600 hover:text-white font-black transition cursor-pointer disabled:opacity-30"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* Controle de Amarelo */}
                                <div className="flex items-center border border-amber-200 rounded-xl bg-white overflow-hidden">
                                  <button
                                    disabled={processando || amarelosJogo === 0}
                                    onClick={() =>
                                      removerEvento(aluno, "amarelo")
                                    }
                                    className="px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-400 hover:text-slate-950 font-black transition cursor-pointer disabled:opacity-30"
                                  >
                                    -
                                  </button>
                                  <span className="px-2 text-[11px] font-bold text-amber-800">
                                    🟨
                                  </span>
                                  <button
                                    disabled={
                                      processando ||
                                      expulso ||
                                      amarelosJogo >= 2
                                    }
                                    onClick={() =>
                                      adicionarEvento(aluno, "amarelo")
                                    }
                                    title={
                                      expulso
                                        ? "Aluno expulso não pode receber novos cartões"
                                        : amarelosJogo === 1
                                        ? "Aplicar 2º amarelo (gera vermelho automático e expulsão)"
                                        : "Aplicar 1º cartão amarelo"
                                    }
                                    className="px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-400 hover:text-slate-950 font-black transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* Controle de Vermelho */}
                                <div className="flex items-center border border-rose-200 rounded-xl bg-white overflow-hidden">
                                  <button
                                    disabled={
                                      processando ||
                                      vermelhosJogo === 0 ||
                                      amarelosJogo >= 2
                                    }
                                    onClick={() =>
                                      removerEvento(aluno, "vermelho")
                                    }
                                    title={
                                      amarelosJogo >= 2
                                        ? "Vermelho decorrente de 2 amarelos — remova o 2º amarelo para desfazer"
                                        : "Remover cartão vermelho"
                                    }
                                    className="px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-600 hover:text-white font-black transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    -
                                  </button>
                                  <span className="px-2 text-[11px] font-bold text-rose-800">
                                    🟥
                                  </span>
                                  <button
                                    disabled={
                                      processando ||
                                      expulso ||
                                      vermelhosJogo >= 1
                                    }
                                    onClick={() =>
                                      adicionarEvento(aluno, "vermelho")
                                    }
                                    title={
                                      expulso
                                        ? "Aluno já foi expulso nesta partida"
                                        : "Aplicar cartão vermelho direto"
                                    }
                                    className="px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-600 hover:text-white font-black transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              ))}
            </div>

            {/* RELATÓRIO CRONOLÓGICO DE EVENTOS DA SÚMULA (Tela + Impressão) */}
            {eventos.length > 0 && (
              <section className="print-card bento-card p-5 sm:p-6 space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#52657a]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Relatório de Ocorrências da Partida ({eventos.length})
                  </h3>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-slate-200/90">
                  <table className="print-table w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200/90">
                      <tr>
                        <th className="p-3 w-12 text-center">#</th>
                        <th className="p-3">Ocorrência</th>
                        <th className="p-3">Atleta</th>
                        <th className="p-3">Equipe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {eventos.map((ev, idx) => (
                        <tr key={ev.id}>
                          <td className="p-3 text-center text-slate-400 font-bold">
                            {idx + 1}
                          </td>
                          <td className="p-3 font-bold text-slate-800">
                            {ev.tipo === "gol" && "⚽ Gol"}
                            {ev.tipo === "amarelo" && "🟨 Cartão Amarelo"}
                            {ev.tipo === "vermelho" && "🟥 Cartão Vermelho"}
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            {getNomeAluno(ev.aluno_id)}
                          </td>
                          <td className="p-3 text-slate-600">
                            {getNomeEquipePorId(ev.equipe_id)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        ) : (
          /* MÓDULO 2: SÚMULA COLETIVA (Vôlei / Queimada — Sem atletas nem cartões) */
          <section className="print-card bento-card p-6 sm:p-8 text-center space-y-5">
            <div>
              <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-[#52657a]/10 text-[#3b4b5e] px-3 py-1 rounded-full mb-2">
                Modalidade Coletiva
              </span>
              <h3 className="font-black text-base text-slate-900 uppercase tracking-wide">
                Súmula Coletiva —{" "}
                {modalidade?.nome?.toUpperCase() || "MODALIDADE"}
              </h3>
              <p className="no-print text-xs text-slate-500 mt-1">
                Ajuste a pontuação ou sets conquistados por cada equipe durante a partida.
              </p>
            </div>

            <div className="no-print grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto pt-2">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/90">
                <p className="text-xs font-black text-slate-800 mb-3 truncate">
                  {equipeA?.nome || "Time A"}
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    disabled={processando || partidaFinalizada}
                    onClick={() =>
                      atualizarPlacarDireto(Math.max(0, placarA - 1), placarB)
                    }
                    className="w-11 h-11 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-lg font-black transition cursor-pointer disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="text-3xl font-black text-slate-900 w-9">
                    {placarA}
                  </span>
                  <button
                    disabled={processando || partidaFinalizada}
                    onClick={() => atualizarPlacarDireto(placarA + 1, placarB)}
                    className="w-11 h-11 bg-[#f06449] hover:bg-[#e05338] text-white rounded-xl text-lg font-black shadow-xs shadow-[#f06449]/30 transition cursor-pointer disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/90">
                <p className="text-xs font-black text-slate-800 mb-3 truncate">
                  {equipeB?.nome || "Time B"}
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    disabled={processando || partidaFinalizada}
                    onClick={() =>
                      atualizarPlacarDireto(placarA, Math.max(0, placarB - 1))
                    }
                    className="w-11 h-11 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl text-lg font-black transition cursor-pointer disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="text-3xl font-black text-slate-900 w-9">
                    {placarB}
                  </span>
                  <button
                    disabled={processando || partidaFinalizada}
                    onClick={() => atualizarPlacarDireto(placarA, placarB + 1)}
                    className="w-11 h-11 bg-[#f06449] hover:bg-[#e05338] text-white rounded-xl text-lg font-black shadow-xs shadow-[#f06449]/30 transition cursor-pointer disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="print-only text-xs pt-2">
              <p>
                Modalidade estritamente coletiva. Resultado homologado conforme placar oficial acima.
              </p>
            </div>
          </section>
        )}

        {/* CAMPO OFICIAL DE ASSINATURAS EXCLUSIVO NA IMPRESSÃO */}
        <div className="print-only pt-10 mt-8 border-t border-black text-xs">
          <div className="grid grid-cols-3 gap-6 text-center pt-8">
            <div>
              <div className="border-t border-black pt-1 font-bold">
                Árbitro / Mesário
              </div>
            </div>
            <div>
              <div className="border-t border-black pt-1 font-bold">
                Capitão — {equipeA?.nome || "Equipe A"}
              </div>
            </div>
            <div>
              <div className="border-t border-black pt-1 font-bold">
                Capitão — {equipeB?.nome || "Equipe B"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE FINALIZAÇÃO */}
      {mostrarModalFinalizar && (
        <div className="no-print fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bento-card p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4 text-center">
            <h3 className="text-lg font-black text-slate-900">
              Finalizar partida?
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              Placar Final:{" "}
              <strong className="text-slate-900">
                {equipeA?.nome} <span className="text-[#f06449]">{placarA} x {placarB}</span> {equipeB?.nome}
              </strong>
            </p>

            {/* SEÇÃO OBRIGATÓRIA DE DESEMPATE SE FOR ELIMINATÓRIA EMPATADA */}
            {ehEliminatoria && ehEmpate && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-left space-y-2.5">
                <p className="text-xs font-bold text-amber-900 text-center">
                  Partida eliminatória empatada — selecione o vencedor do desempate:
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setVencedorPenaltisId(equipeA?.id || null)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      vencedorPenaltisId === equipeA?.id
                        ? "bg-[#f06449] text-white border-[#f06449] font-black shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {vencedorPenaltisId === equipeA?.id ? "✓ " : ""}
                    {equipeA?.nome} venceu no desempate
                  </button>

                  <button
                    type="button"
                    onClick={() => setVencedorPenaltisId(equipeB?.id || null)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      vencedorPenaltisId === equipeB?.id
                        ? "bg-[#f06449] text-white border-[#f06449] font-black shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {vencedorPenaltisId === equipeB?.id ? "✓ " : ""}
                    {equipeB?.nome} venceu no desempate
                  </button>
                </div>
              </div>
            )}

            <p className="text-[11px] text-rose-600 font-bold">
              Após finalizar, a súmula será bloqueada e não será mais possível alterar o placar ou eventos.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                disabled={processando}
                onClick={() => setMostrarModalFinalizar(false)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={processando}
                onClick={() =>
                  executarMudancaStatus("finalizada", vencedorPenaltisId)
                }
                className="w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs shadow-emerald-600/25 transition cursor-pointer disabled:opacity-50"
              >
                {processando ? "Finalizando..." : "Sim, Finalizar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="no-print mt-8">
        <FooterVoltar href="/professor/partidas" label="Voltar às partidas" />
      </div>
    </main>
  );
}