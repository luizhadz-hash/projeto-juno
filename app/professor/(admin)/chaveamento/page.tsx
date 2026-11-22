"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { estaAutenticado } from "@/lib/auth";
import {
  ToastContainer,
  ToastItem,
  ModalConfirmacao,
} from "@/app/components/FeedbackAdmin";

interface Modalidade {
  id: number;
  nome: string;
}

interface GrupoConfronto {
  id: number;
  nome: string;
}

interface ConfrontoGerado {
  time_a_id: number;
  time_b_id: number;
  nome_equipe_a: string;
  nome_equipe_b: string;
  modalidade_id: number;
  fase: "GRUPO" | "MELHOR_DE_3";
  ordem: number | null;
}

export default function ChaveamentoPage() {
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [gruposConfronto, setGruposConfronto] = useState<GrupoConfronto[]>([]);

  const [modalidadeId, setModalidadeId] = useState<string>("");
  const [grupoId, setGrupoId] = useState<string>("");

  const [confrontosGerados, setConfrontosGerados] = useState<ConfrontoGerado[]>([]);
  const [qtdExistenteCategoria, setQtdExistenteCategoria] = useState<number>(0);

  const [carregando, setCarregando] = useState<boolean>(true);
  const [salvando, setSalvando] = useState<boolean>(false);
  const [limpando, setLimpando] = useState<boolean>(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modalSobrescrever, setModalSobrescrever] = useState<boolean>(false);
  const [modalLimparCategoria, setModalLimparCategoria] = useState<boolean>(false);

  const lockSalvamentoRef = useRef<boolean>(false);

  function adicionarToast(tipo: ToastItem["tipo"], mensagem: string) {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), tipo, mensagem }]);
  }

  function removerToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    async function iniciar() {
      const logado = await estaAutenticado();
      if (!logado) {
        window.location.replace("/professor");
        return;
      }
      await carregarFiltros();
    }
    iniciar();
  }, []);

  async function carregarFiltros() {
    setCarregando(true);
    try {
      const [{ data: mods }, { data: grps }] = await Promise.all([
        supabase.from("modalidade").select("*").order("id", { ascending: true }),
        supabase.from("grupos_confronto").select("*").order("nome", { ascending: true }),
      ]);

      const modInicial = mods?.[0]?.id?.toString() || "";
      const grpInicial = grps?.[0]?.id?.toString() || "";

      if (mods) setModalidades(mods as Modalidade[]);
      if (grps) setGruposConfronto(grps as GrupoConfronto[]);

      setModalidadeId(modInicial);
      setGrupoId(grpInicial);

      if (modInicial && grpInicial) {
        await verificarPartidasExistentes(modInicial, grpInicial);
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      adicionarToast("erro", "Erro ao carregar modalidades e grupos.");
    } finally {
      setCarregando(false);
    }
  }

  async function verificarPartidasExistentes(modStr: string, grpStr: string) {
    if (!modStr || !grpStr) {
      setQtdExistenteCategoria(0);
      return;
    }

    const { count, error } = await supabase
      .from("partidas")
      .select("id", { count: "exact", head: true })
      .eq("modalidade_id", parseInt(modStr, 10))
      .eq("grupo_id", parseInt(grpStr, 10))
      .in("fase", ["GRUPO", "MELHOR_DE_3"]);

    if (!error) {
      setQtdExistenteCategoria(count || 0);
    }
  }

  function reorganizarSemJogosSeguidos(partidas: ConfrontoGerado[]) {
    const listaOriginal = [...partidas];
    const listaOrdenada: ConfrontoGerado[] = [];

    while (listaOriginal.length > 0) {
      const ultimoJogo = listaOrdenada[listaOrdenada.length - 1];
      let idxProximoJogo = -1;

      if (!ultimoJogo) {
        idxProximoJogo = 0;
      } else {
        idxProximoJogo = listaOriginal.findIndex((p) => {
          const timeARepetido =
            p.time_a_id === ultimoJogo.time_a_id ||
            p.time_a_id === ultimoJogo.time_b_id;
          const timeBRepetido =
            p.time_b_id === ultimoJogo.time_a_id ||
            p.time_b_id === ultimoJogo.time_b_id;

          return !timeARepetido && !timeBRepetido;
        });
      }

      if (idxProximoJogo === -1) idxProximoJogo = 0;

      const [jogoSelecionado] = listaOriginal.splice(idxProximoJogo, 1);
      listaOrdenada.push(jogoSelecionado);
    }

    return listaOrdenada;
  }

  async function handleSortearChaveamento() {
    if (!modalidadeId || !grupoId) {
      adicionarToast("aviso", "Selecione a modalidade e o grupo.");
      return;
    }

    const modIdNum = parseInt(modalidadeId, 10);
    const grpIdNum = parseInt(grupoId, 10);

    const { data: equipes, error } = await supabase
      .from("equipes")
      .select("*")
      .eq("modalidades_id", modIdNum)
      .eq("grupo_id", grpIdNum);

    if (error) {
      adicionarToast("erro", `Erro ao buscar equipes: ${error.message}`);
      return;
    }

    if (!equipes || equipes.length < 2) {
      adicionarToast("aviso", "Cadastre pelo menos 2 equipes neste grupo para sortear.");
      setConfrontosGerados([]);
      return;
    }

    if (equipes.length === 2) {
      const [eqA, eqB] = equipes;
      const melhorDe3: ConfrontoGerado[] = [1, 2, 3].map((numeroJogo) => ({
        time_a_id: eqA.id,
        time_b_id: eqB.id,
        nome_equipe_a: eqA.nome,
        nome_equipe_b: eqB.nome,
        modalidade_id: modIdNum,
        fase: "MELHOR_DE_3",
        ordem: numeroJogo,
      }));
      setConfrontosGerados(melhorDe3);
      return;
    }

    let partidasTemp: ConfrontoGerado[] = [];
    for (let i = 0; i < equipes.length; i++) {
      for (let j = i + 1; j < equipes.length; j++) {
        partidasTemp.push({
          time_a_id: equipes[i].id,
          time_b_id: equipes[j].id,
          nome_equipe_a: equipes[i].nome,
          nome_equipe_b: equipes[j].nome,
          modalidade_id: modIdNum,
          fase: "GRUPO",
          ordem: null,
        });
      }
    }

    setConfrontosGerados(reorganizarSemJogosSeguidos(partidasTemp));
  }

  async function iniciarSalvamento() {
    if (confrontosGerados.length === 0 || salvando || lockSalvamentoRef.current) return;

    if (qtdExistenteCategoria > 0) {
      setModalSobrescrever(true);
      return;
    }

    await executarGravacaoBanco(false);
  }

  async function executarGravacaoBanco(sobrescrever: boolean) {
    if (lockSalvamentoRef.current) return;
    lockSalvamentoRef.current = true;
    setSalvando(true);
    setModalSobrescrever(false);

    const modIdNum = parseInt(modalidadeId, 10);
    const grpIdNum = parseInt(grupoId, 10);
    const faseAlvo = confrontosGerados[0].fase;

    try {
      if (sobrescrever) {
        const { error: errDelete } = await supabase
          .from("partidas")
          .delete()
          .eq("modalidade_id", modIdNum)
          .eq("grupo_id", grpIdNum)
          .in("fase", ["GRUPO", "MELHOR_DE_3"]);

        if (errDelete) {
          adicionarToast("erro", `Erro ao substituir chaveamento: ${errDelete.message}`);
          return;
        }
      }

      const payload = confrontosGerados.map((p) => ({
        time_a_id: p.time_a_id,
        time_b_id: p.time_b_id,
        modalidade_id: p.modalidade_id || modIdNum,
        grupo_id: grpIdNum,
        placar_a: 0,
        placar_b: 0,
        status: "agendada",
        horario: null,
        fase: p.fase,
        ordem: p.ordem,
        vencedor_id: null,
      }));

      const { error: errInsert } = await supabase.from("partidas").insert(payload);

      if (errInsert) {
        if (errInsert.code === "23505") {
          adicionarToast("aviso", "Este chaveamento já foi salvo anteriormente.");
        } else {
          adicionarToast("erro", `Erro ao salvar: ${errInsert.message}`);
        }
      } else {
        adicionarToast(
          "sucesso",
          faseAlvo === "MELHOR_DE_3"
            ? "Série Melhor de 3 salva com sucesso!"
            : "Chaveamento salvo com sucesso!"
        );
        setConfrontosGerados([]);
        await verificarPartidasExistentes(modalidadeId, grupoId);
      }
    } finally {
      setSalvando(false);
      lockSalvamentoRef.current = false;
    }
  }

  async function confirmarLimpezaCategoria() {
    if (!modalidadeId || !grupoId) return;
    setLimpando(true);

    const { error } = await supabase
      .from("partidas")
      .delete()
      .eq("modalidade_id", parseInt(modalidadeId, 10))
      .eq("grupo_id", parseInt(grupoId, 10))
      .in("fase", ["GRUPO", "MELHOR_DE_3"]);

    setLimpando(false);
    setModalLimparCategoria(false);

    if (!error) {
      adicionarToast("sucesso", "Chaveamento da categoria removido.");
      setQtdExistenteCategoria(0);
    } else {
      adicionarToast("erro", `Erro ao remover: ${error.message}`);
    }
  }

  const nomeGrupoSelecionado =
    gruposConfronto.find((g) => g.id.toString() === grupoId)?.nome || "";

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* HERO TÁTICO BENTO */}
      <div className="bento-hero court-grid-bg p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-white/15 text-white px-3 py-1 rounded-full mb-2">
            Sorteio & Rodadas
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Chaveamento
          </h1>
          <p className="text-xs sm:text-sm text-slate-200/90 mt-1">
            Sorteie os confrontos iniciais por modalidade e categoria.
          </p>
        </div>

        <Link
          href="/professor/partidas"
          className="px-4 py-2.5 rounded-2xl bg-white/12 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition text-center self-start sm:self-center"
        >
          Ir para Partidas & Súmulas →
        </Link>
      </div>

      {carregando ? (
        <div className="bento-card text-center py-14 text-slate-500 text-sm font-bold animate-pulse">
          Carregando configurações...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Configuração do Sorteio */}
          <div className="bento-card p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f06449]" />
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                Configuração
              </h2>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Modalidade
              </label>
              <select
                suppressHydrationWarning
                value={modalidadeId}
                onChange={(e) => {
                  const novoMod = e.target.value;
                  setModalidadeId(novoMod);
                  setConfrontosGerados([]);
                  verificarPartidasExistentes(novoMod, grupoId);
                }}
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 text-slate-900 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#52657a] transition cursor-pointer"
              >
                {modalidades.map((mod) => (
                  <option key={mod.id} value={mod.id}>
                    {mod.nome}
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
                onChange={(e) => {
                  const novoGrp = e.target.value;
                  setGrupoId(novoGrp);
                  setConfrontosGerados([]);
                  verificarPartidasExistentes(modalidadeId, novoGrp);
                }}
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 text-slate-900 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-[#52657a] transition cursor-pointer"
              >
                {gruposConfronto.map((grp) => (
                  <option key={grp.id} value={grp.id}>
                    {grp.nome}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleSortearChaveamento}
              className="w-full font-black py-3 px-4 rounded-xl bg-[#f06449] hover:bg-[#e05338] text-white text-xs shadow-xs shadow-[#f06449]/30 transition cursor-pointer"
            >
              Sortear Confrontos
            </button>

            {qtdExistenteCategoria > 0 && (
              <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-500">
                  {qtdExistenteCategoria} jogo(s) ativo(s) neste grupo
                </span>
                <button
                  type="button"
                  onClick={() => setModalLimparCategoria(true)}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  Limpar grupo
                </button>
              </div>
            )}
          </div>

          {/* Prévia dos Confrontos Sorteados */}
          <div className="lg:col-span-2 bento-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                Prévia do Sorteio
              </h2>

              {confrontosGerados.length > 0 && (
                <button
                  type="button"
                  onClick={iniciarSalvamento}
                  disabled={salvando}
                  className="font-black py-2 px-4 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/25 transition cursor-pointer disabled:opacity-50"
                >
                  {salvando ? "Salvando..." : "Confirmar e Salvar"}
                </button>
              )}
            </div>

            {confrontosGerados.length === 0 ? (
              <p className="text-xs text-slate-500 py-12 text-center italic">
                Selecione a modalidade e o grupo e clique em &ldquo;Sortear Confrontos&rdquo;.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {confrontosGerados.map((partida, index) => (
                  <div
                    key={index}
                    className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 flex items-center justify-between text-xs gap-3"
                  >
                    <span className="font-bold text-slate-400 shrink-0">
                      {partida.fase === "MELHOR_DE_3"
                        ? `Jogo ${partida.ordem}`
                        : `#${index + 1}`}
                    </span>

                    <div className="flex items-center gap-3 font-bold text-slate-900">
                      <span>{partida.nome_equipe_a}</span>
                      <span className="text-[#f06449] font-black text-[11px]">VS</span>
                      <span>{partida.nome_equipe_b}</span>
                    </div>

                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[#52657a]/12 text-[#3b4b5e] shrink-0">
                      {partida.fase === "MELHOR_DE_3" ? "Melhor de 3" : "Fase de Grupos"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ModalConfirmacao
        aberto={modalSobrescrever}
        titulo="Sobrescrever chaveamento?"
        descricao={`Já existem ${qtdExistenteCategoria} partida(s) cadastrada(s) para "${nomeGrupoSelecionado}". Ao confirmar, elas serão substituídas pelo novo sorteio.`}
        textoConfirmar="Sobrescrever"
        variante="primario"
        carregando={salvando}
        onConfirmar={() => executarGravacaoBanco(true)}
        onCancelar={() => setModalSobrescrever(false)}
      />

      <ModalConfirmacao
        aberto={modalLimparCategoria}
        titulo="Limpar chaveamento do grupo?"
        descricao={`Todas as partidas iniciais de "${nomeGrupoSelecionado}" nesta modalidade serão removidas.`}
        textoConfirmar="Sim, Limpar"
        carregando={limpando}
        onConfirmar={confirmarLimpezaCategoria}
        onCancelar={() => setModalLimparCategoria(false)}
      />

      <ToastContainer toasts={toasts} removerToast={removerToast} />
    </div>
  );
}