"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { estaAutenticado } from "@/lib/auth";
import {
  ToastContainer,
  ToastItem,
  ModalConfirmacao,
} from "@/app/components/FeedbackAdmin";

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
  grupo_id: number | null;
  modalidades_id: number | null;
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

export default function GerenciarPartidasPage() {
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);

  // Filtros
  const [modalidadeId, setModalidadeId] = useState<string>("todas");
  const [grupoId, setGrupoId] = useState<string>("todos");
  const [faseFiltro, setFaseFiltro] = useState<string>("todas");
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");

  // Estados de Controle de UI
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  // Toasts e Modais
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [partidaEditando, setPartidaEditando] = useState<Partida | null>(null);
  const [inputDataHora, setInputDataHora] = useState<string>("");
  const [inputLocal, setInputLocal] = useState<string>("");
  const [partidaParaExcluir, setPartidaParaExcluir] = useState<Partida | null>(null);

  function adicionarToast(tipo: ToastItem["tipo"], mensagem: string) {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), tipo, mensagem }]);
  }

  function removerToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // Helper de Fuso Horário Local -> ISO timestamptz
  function isoToDatetimeLocal(isoString: string | null): string {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return "";
      const pad = (num: number) => String(num).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
      )}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  }

  function datetimeLocalToIso(localString: string): string | null {
    if (!localString) return null;
    try {
      const d = new Date(localString);
      if (isNaN(d.getTime())) return null;
      return d.toISOString();
    } catch {
      return null;
    }
  }

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
    if (fase === "MELHOR_DE_3") return `Melhor de 3 — Jogo ${ordem || 1}`;
    return fase;
  }

  function getNomeEquipe(id: number | null): string {
    if (!id) return "A definir";
    const eq = equipes.find((e) => Number(e.id) === Number(id));
    return eq ? eq.nome : `Equipe #${id}`;
  }

  async function carregarDadosIniciais() {
    setCarregando(true);

    try {
      const [resMods, resGrps, resEquipes, resPartidas] = await Promise.all([
        supabase.from("modalidade").select("id, nome").order("nome", { ascending: true }),
        supabase.from("grupos_confronto").select("id, nome").order("nome", { ascending: true }),
        supabase.from("equipes").select("id, nome, grupo_id, modalidades_id"),
        supabase.from("partidas").select("*").order("id", { ascending: true }),
      ]);

      if (resMods.error) throw new Error("Erro ao buscar modalidades.");
      if (resGrps.error) throw new Error("Erro ao buscar grupos.");
      if (resEquipes.error) throw new Error("Erro ao buscar equipes.");
      if (resPartidas.error) throw new Error("Erro ao buscar partidas.");

      setModalidades((resMods.data || []) as Modalidade[]);
      setGrupos((resGrps.data || []) as Grupo[]);
      setEquipes((resEquipes.data || []) as Equipe[]);
      setPartidas((resPartidas.data || []) as Partida[]);
    } catch (err: any) {
      console.error("Erro ao carregar Central de Partidas:", err);
      adicionarToast("erro", err.message || "Erro ao carregar partidas.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    async function iniciar() {
      const logado = await estaAutenticado();
      if (!logado) {
        window.location.href = "/professor";
        return;
      }
      await carregarDadosIniciais();
    }
    iniciar();
  }, []);

  // Filtragem composta estrita por modalidade_id + grupo_id + fase + status
  const partidasFiltradas = partidas.filter((p) => {
    if (modalidadeId !== "todas" && Number(p.modalidade_id) !== Number(modalidadeId)) {
      return false;
    }
    if (grupoId !== "todos" && Number(p.grupo_id) !== Number(grupoId)) {
      return false;
    }
    if (faseFiltro !== "todas") {
      const faseAtual = p.fase || "GRUPO";
      if (faseAtual !== faseFiltro) return false;
    }
    if (statusFiltro !== "todos") {
      const st = p.status || "agendada";
      if (st !== statusFiltro) return false;
    }
    return true;
  });

  // Agrupamento por Fases
  const partidasFaseGrupo = partidasFiltradas.filter((p) => !p.fase || p.fase === "GRUPO");
  const partidasMelhor3 = partidasFiltradas.filter((p) => p.fase === "MELHOR_DE_3");
  const partidasSemifinais = partidasFiltradas.filter((p) => p.fase === "SEMIFINAL");
  const partidasTerceiroLugar = partidasFiltradas.filter((p) => p.fase === "TERCEIRO_LUGAR");
  const partidasFinal = partidasFiltradas.filter((p) => p.fase === "FINAL");

  // Estatísticas dinâmicas
  const totalAgendadas = partidasFiltradas.filter((p) => (p.status || "agendada") === "agendada").length;
  const totalEmAndamento = partidasFiltradas.filter((p) => p.status === "em_andamento").length;
  const totalFinalizadas = partidasFiltradas.filter(
    (p) => p.status === "finalizada" || p.status === "encerrada"
  ).length;

  function abrirModalEdicao(partida: Partida) {
    setPartidaEditando(partida);
    setInputDataHora(isoToDatetimeLocal(partida.horario));
    setInputLocal(partida.local || "");
  }

  async function handleSalvarProgramacao() {
    if (!partidaEditando || processando) return;

    setProcessando(true);

    try {
      const novoHorarioIso = datetimeLocalToIso(inputDataHora);
      const novoLocalText = inputLocal.trim() || null;

      const { error } = await supabase
        .from("partidas")
        .update({
          horario: novoHorarioIso,
          local: novoLocalText,
        })
        .eq("id", partidaEditando.id);

      if (error) throw new Error(`Erro ao salvar atualização: ${error.message}`);

      setPartidas((prev) =>
        prev.map((p) =>
          p.id === partidaEditando.id
            ? { ...p, horario: novoHorarioIso, local: novoLocalText }
            : p
        )
      );

      adicionarToast("sucesso", "Data, horário e local atualizados!");
      setPartidaEditando(null);
    } catch (err: any) {
      adicionarToast("erro", err.message || "Erro ao atualizar a partida.");
    } finally {
      setProcessando(false);
    }
  }

  // Etapa 1: Validação antes de abrir o Modal de Confirmação
  async function solicitarExclusaoPartida(partida: Partida) {
    const statusAtual = partida.status || "agendada";
    const faseAtual = partida.fase || "GRUPO";

    if (faseAtual !== "GRUPO" || statusAtual !== "agendada") {
      adicionarToast(
        "aviso",
        "Apenas partidas agendadas da Fase de Grupos podem ser excluídas."
      );
      return;
    }

    setProcessando(true);
    try {
      const { data: eventos, error: errEventos } = await supabase
        .from("sumula_eventos")
        .select("id")
        .eq("partida_id", partida.id);

      if (errEventos) throw new Error("Erro ao verificar histórico da súmula.");

      if (eventos && eventos.length > 0) {
        adicionarToast(
          "aviso",
          "Esta partida já possui registros na súmula e não pode ser excluída."
        );
        return;
      }

      setPartidaParaExcluir(partida);
    } catch (err: any) {
      adicionarToast("erro", err.message || "Erro ao validar partida.");
    } finally {
      setProcessando(false);
    }
  }

  // Etapa 2: Confirmação e execução do DELETE por ID
  async function confirmarExclusaoPartida() {
    if (!partidaParaExcluir || processando) return;
    setProcessando(true);

    try {
      const { error: errDel } = await supabase
        .from("partidas")
        .delete()
        .eq("id", partidaParaExcluir.id);

      if (errDel) throw new Error(`Erro ao excluir partida: ${errDel.message}`);

      setPartidas((prev) => prev.filter((p) => p.id !== partidaParaExcluir.id));
      adicionarToast("sucesso", "Partida excluída com sucesso.");
    } catch (err: any) {
      adicionarToast("erro", err.message || "Erro ao excluir partida.");
    } finally {
      setProcessando(false);
      setPartidaParaExcluir(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto w-full space-y-5">
      {/* HERO TÁTICO BENTO */}
      <div className="bento-hero court-grid-bg p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-white/15 text-white px-3 py-1 rounded-full mb-2">
            Agenda & Arbitragem
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Partidas & Súmulas
          </h1>
          <p className="text-xs sm:text-sm text-slate-200/90 mt-1">
            Defina horários, locais e abra as súmulas digitais das partidas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 px-3.5 py-2 rounded-2xl">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-200/80">
              Agendadas
            </span>
            <span className="text-base font-black text-white">{totalAgendadas}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 px-3.5 py-2 rounded-2xl">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-200/80">
              Ao Vivo
            </span>
            <span className="text-base font-black text-amber-200">{totalEmAndamento}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/15 px-3.5 py-2 rounded-2xl">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-200/80">
              Concluídas
            </span>
            <span className="text-base font-black text-emerald-200">{totalFinalizadas}</span>
          </div>
        </div>
      </div>

      {/* FILTROS & INDICADORES */}
      <div className="bento-card p-5 sm:p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Modalidade
            </label>
            <select
              suppressHydrationWarning
              value={modalidadeId}
              onChange={(e) => setModalidadeId(e.target.value)}
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold focus:border-[#52657a] outline-none transition cursor-pointer"
            >
              <option value="todas">Todas as Modalidades</option>
              {modalidades.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Grupo / Categoria
            </label>
            <select
              suppressHydrationWarning
              value={grupoId}
              onChange={(e) => setGrupoId(e.target.value)}
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold focus:border-[#52657a] outline-none transition cursor-pointer"
            >
              <option value="todos">Todos os Grupos</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Fase
            </label>
            <select
              suppressHydrationWarning
              value={faseFiltro}
              onChange={(e) => setFaseFiltro(e.target.value)}
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold focus:border-[#52657a] outline-none transition cursor-pointer"
            >
              <option value="todas">Todas as Fases</option>
              <option value="GRUPO">Fase de Grupos</option>
              <option value="MELHOR_DE_3">Melhor de 3</option>
              <option value="SEMIFINAL">Semifinal</option>
              <option value="TERCEIRO_LUGAR">Disputa de 3º Lugar</option>
              <option value="FINAL">Final</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Status
            </label>
            <select
              suppressHydrationWarning
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-bold focus:border-[#52657a] outline-none transition cursor-pointer"
            >
              <option value="todos">Todos os Status</option>
              <option value="agendada">Agendada</option>
              <option value="em_andamento">Em Andamento</option>
              <option value="finalizada">Finalizada / Encerrada</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-3.5 border-t border-slate-100 text-xs font-bold text-slate-500">
          <span>
            Exibindo: <strong className="text-[#e05338]">{partidasFiltradas.length}</strong>
          </span>
          <span className="text-slate-300">•</span>
          <span>
            Agendadas: <strong className="text-slate-800">{totalAgendadas}</strong>
          </span>
          <span className="text-slate-300">•</span>
          <span>
            Em Andamento: <strong className="text-[#e05338]">{totalEmAndamento}</strong>
          </span>
          <span className="text-slate-300">•</span>
          <span>
            Finalizadas: <strong className="text-emerald-600">{totalFinalizadas}</strong>
          </span>
        </div>
      </div>

      {/* LISTAGEM ORGANIZADA POR FASES */}
      {carregando ? (
        <div className="bento-card py-16 text-center text-slate-500 font-bold text-sm animate-pulse">
          Carregando partidas...
        </div>
      ) : partidasFiltradas.length === 0 ? (
        <div className="bento-card p-12 text-center text-slate-500 italic text-xs">
          Nenhuma partida encontrada para os filtros selecionados.
        </div>
      ) : (
        <div className="space-y-5">
          {partidasFaseGrupo.length > 0 && (
            <SecaoFase
              titulo="Fase de Grupos"
              ocultarBadgeFasePadrao
              partidas={partidasFaseGrupo}
              getNomeEquipe={getNomeEquipe}
              formatarDataHora={formatarDataHoraExibicao}
              formatarFaseAmigavel={formatarFaseAmigavel}
              onEditar={abrirModalEdicao}
              onExcluir={solicitarExclusaoPartida}
              processando={processando}
            />
          )}

          {partidasMelhor3.length > 0 && (
            <SecaoFase
              titulo="Melhor de 3"
              partidas={partidasMelhor3}
              getNomeEquipe={getNomeEquipe}
              formatarDataHora={formatarDataHoraExibicao}
              formatarFaseAmigavel={formatarFaseAmigavel}
              onEditar={abrirModalEdicao}
              onExcluir={solicitarExclusaoPartida}
              processando={processando}
            />
          )}

          {partidasSemifinais.length > 0 && (
            <SecaoFase
              titulo="Semifinais"
              partidas={partidasSemifinais}
              getNomeEquipe={getNomeEquipe}
              formatarDataHora={formatarDataHoraExibicao}
              formatarFaseAmigavel={formatarFaseAmigavel}
              onEditar={abrirModalEdicao}
              onExcluir={solicitarExclusaoPartida}
              processando={processando}
            />
          )}

          {partidasTerceiroLugar.length > 0 && (
            <SecaoFase
              titulo="Disputa de 3º Lugar"
              ocultarBadgeFasePadrao
              partidas={partidasTerceiroLugar}
              getNomeEquipe={getNomeEquipe}
              formatarDataHora={formatarDataHoraExibicao}
              formatarFaseAmigavel={formatarFaseAmigavel}
              onEditar={abrirModalEdicao}
              onExcluir={solicitarExclusaoPartida}
              processando={processando}
            />
          )}

          {partidasFinal.length > 0 && (
            <SecaoFase
              titulo="Grande Final"
              ocultarBadgeFasePadrao
              partidas={partidasFinal}
              getNomeEquipe={getNomeEquipe}
              formatarDataHora={formatarDataHoraExibicao}
              formatarFaseAmigavel={formatarFaseAmigavel}
              onEditar={abrirModalEdicao}
              onExcluir={solicitarExclusaoPartida}
              processando={processando}
            />
          )}
        </div>
      )}

      {/* MODAL DE PROGRAMAÇÃO (DATA, HORÁRIO E LOCAL) */}
      {partidaEditando && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bento-card p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f06449]" />
              <h3 className="text-base font-black text-slate-900">
                Programação da Partida
              </h3>
            </div>

            <div className="text-xs text-slate-800 font-bold bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex justify-between items-center gap-2">
              <span className="truncate">{getNomeEquipe(partidaEditando.time_a_id)}</span>
              <span className="text-[#f06449] font-black shrink-0">vs</span>
              <span className="truncate">{getNomeEquipe(partidaEditando.time_b_id)}</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Data e Horário
              </label>
              <input
                type="datetime-local"
                value={inputDataHora}
                onChange={(e) => setInputDataHora(e.target.value)}
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:border-[#52657a] outline-none transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Local
              </label>
              <input
                type="text"
                placeholder="Ex: Quadra Principal, Ginásio"
                value={inputLocal}
                onChange={(e) => setInputLocal(e.target.value)}
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:border-[#52657a] outline-none transition"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                disabled={processando}
                onClick={() => setPartidaEditando(null)}
                className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={processando}
                onClick={handleSalvarProgramacao}
                className="w-1/2 py-2.5 rounded-xl bg-[#f06449] hover:bg-[#e05338] text-white text-xs font-black shadow-xs shadow-[#f06449]/30 transition cursor-pointer disabled:opacity-50"
              >
                {processando ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ModalConfirmacao
        aberto={Boolean(partidaParaExcluir)}
        titulo="Excluir partida?"
        descricao={
          partidaParaExcluir
            ? `Tem certeza que deseja excluir ${getNomeEquipe(
                partidaParaExcluir.time_a_id
              )} x ${getNomeEquipe(partidaParaExcluir.time_b_id)}?`
            : ""
        }
        textoConfirmar="Sim, Excluir"
        carregando={processando}
        onConfirmar={confirmarExclusaoPartida}
        onCancelar={() => setPartidaParaExcluir(null)}
      />

      <ToastContainer toasts={toasts} removerToast={removerToast} />
    </div>
  );
}

interface SecaoFaseProps {
  titulo: string;
  ocultarBadgeFasePadrao?: boolean;
  partidas: Partida[];
  getNomeEquipe: (id: number | null) => string;
  formatarDataHora: (iso: string | null) => string;
  formatarFaseAmigavel: (fase: string | null, ordem: number | null) => string;
  onEditar: (partida: Partida) => void;
  onExcluir: (partida: Partida) => void;
  processando: boolean;
}

function SecaoFase({
  titulo,
  ocultarBadgeFasePadrao = false,
  partidas,
  getNomeEquipe,
  formatarDataHora,
  formatarFaseAmigavel,
  onEditar,
  onExcluir,
  processando,
}: SecaoFaseProps) {
  return (
    <div className="bento-card p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#52657a]" />
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
            {titulo}
          </h2>
        </div>
        <span className="text-[11px] text-slate-500 font-bold bg-slate-100 px-2.5 py-0.5 rounded-full">
          {partidas.length} jogo(s)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {partidas.map((p) => {
          const statusPartida = p.status || "agendada";
          const ehFinalizada = statusPartida === "finalizada" || statusPartida === "encerrada";
          const ehFaseGrupo = !p.fase || p.fase === "GRUPO";
          const podeExcluir = ehFaseGrupo && statusPartida === "agendada";

          return (
            <div
              key={p.id}
              className="bg-slate-50/90 border border-slate-200/90 p-4 rounded-2xl space-y-3 flex flex-col justify-between"
            >
              <div>
                {/* Cabeçalho do Card */}
                <div className="flex justify-between items-center mb-2.5 gap-2">
                  {!ocultarBadgeFasePadrao ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#3b4b5e] bg-[#52657a]/12 px-2.5 py-0.5 rounded-lg">
                      {formatarFaseAmigavel(p.fase, p.ordem)}
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-slate-400">
                      #{p.id}
                    </span>
                  )}

                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                      ehFinalizada
                        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                        : statusPartida === "em_andamento"
                        ? "text-[#e05338] bg-[#f06449]/15 border-[#f06449]/30"
                        : "text-slate-600 bg-white border-slate-200"
                    }`}
                  >
                    {statusPartida.replace("_", " ")}
                  </span>
                </div>

                {/* Confronto e Placar */}
                <div className="flex justify-between items-center bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 my-2">
                  <span className="text-xs font-bold text-slate-900 w-2/5 text-left truncate">
                    {getNomeEquipe(p.time_a_id)}
                  </span>

                  <div className="text-sm font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg">
                    {p.placar_a ?? 0} <span className="text-[#f06449] mx-0.5">x</span> {p.placar_b ?? 0}
                  </div>

                  <span className="text-xs font-bold text-slate-900 w-2/5 text-right truncate">
                    {getNomeEquipe(p.time_b_id)}
                  </span>
                </div>

                {/* Data, Horário e Local */}
                <div className="text-[11px] text-slate-500 flex flex-wrap justify-between gap-2 pt-1">
                  <span>📅 {formatarDataHora(p.horario)}</span>
                  <span>📍 {p.local || "A definir"}</span>
                </div>

                {/* Vencedor do Desempate */}
                {ehFinalizada && p.vencedor_id && (
                  <div className="mt-2.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
                    🏆 Desempate: {getNomeEquipe(p.vencedor_id)}
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200/70">
                <button
                  disabled={processando}
                  onClick={() => onEditar(p)}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-[#3b4b5e] border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  Programação
                </button>

                <div className="flex items-center gap-2">
                  {podeExcluir && (
                    <button
                      disabled={processando}
                      onClick={() => onExcluir(p)}
                      className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                    >
                      Excluir
                    </button>
                  )}

                  <Link
                    href={`/professor/sumula/${p.id}`}
                    className="px-3.5 py-1.5 bg-[#f06449] hover:bg-[#e05338] text-white rounded-xl text-xs font-black shadow-xs shadow-[#f06449]/25 transition"
                  >
                    Súmula
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}