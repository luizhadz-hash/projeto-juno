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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-amber-400">Chaveamento</h1>
          <p className="text-xs text-slate-400 mt-1">
            Sorteie os confrontos iniciais por modalidade e categoria.
          </p>
        </div>

        <Link
          href="/professor/partidas"
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition text-center"
        >
          Ir para Partidas & Súmulas →
        </Link>
      </div>

      {carregando ? (
        <div className="text-center py-12 text-slate-400 text-sm font-bold animate-pulse">
          Carregando configurações...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Configuração do Sorteio */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-amber-400">
              Configuração
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                Modalidade
              </label>
              <select
                value={modalidadeId}
                onChange={(e) => {
                  const novoMod = e.target.value;
                  setModalidadeId(novoMod);
                  setConfrontosGerados([]);
                  verificarPartidasExistentes(novoMod, grupoId);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-400"
              >
                {modalidades.map((mod) => (
                  <option key={mod.id} value={mod.id}>
                    {mod.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                Grupo / Categoria
              </label>
              <select
                value={grupoId}
                onChange={(e) => {
                  const novoGrp = e.target.value;
                  setGrupoId(novoGrp);
                  setConfrontosGerados([]);
                  verificarPartidasExistentes(modalidadeId, novoGrp);
                }}
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-400"
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
              className="w-full font-black py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs transition"
            >
              Sortear Confrontos
            </button>

            {qtdExistenteCategoria > 0 && (
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  {qtdExistenteCategoria} jogo(s) ativo(s) neste grupo
                </span>
                <button
                  type="button"
                  onClick={() => setModalLimparCategoria(true)}
                  className="text-[11px] font-bold text-red-400 hover:text-red-300"
                >
                  Limpar grupo
                </button>
              </div>
            )}
          </div>

          {/* Prévia dos Confrontos Sorteados */}
          <div className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
                Prévia do Sorteio
              </h2>

              {confrontosGerados.length > 0 && (
                <button
                  type="button"
                  onClick={iniciarSalvamento}
                  disabled={salvando}
                  className="font-black py-2 px-4 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                >
                  {salvando ? "Salvando..." : "Confirmar e Salvar"}
                </button>
              )}
            </div>

            {confrontosGerados.length === 0 ? (
              <p className="text-xs text-slate-500 py-10 text-center italic">
                Selecione a modalidade e o grupo e clique em &ldquo;Sortear Confrontos&rdquo;.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {confrontosGerados.map((partida, index) => (
                  <div
                    key={index}
                    className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs gap-3"
                  >
                    <span className="font-bold text-slate-400 shrink-0">
                      {partida.fase === "MELHOR_DE_3"
                        ? `Jogo ${partida.ordem}`
                        : `#${index + 1}`}
                    </span>

                    <div className="flex items-center gap-3 font-bold text-slate-100">
                      <span>{partida.nome_equipe_a}</span>
                      <span className="text-amber-400 text-[11px]">VS</span>
                      <span>{partida.nome_equipe_b}</span>
                    </div>

                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800 shrink-0">
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