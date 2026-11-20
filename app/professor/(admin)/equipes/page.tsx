"use client";

import { useState, useEffect } from "react";
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

interface Equipe {
  id: number;
  nome: string;
  modalidades_id?: number;
  modalidade_id?: number;
  grupo_id?: number;
  grupo_confronto_id?: number;
  grupos_confronto_id?: number;
}

export default function GerenciarEquipes() {
  const [nome, setNome] = useState("");
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [gruposConfronto, setGruposConfronto] = useState<GrupoConfronto[]>([]);

  const [modalidadeId, setModalidadeId] = useState("");
  const [grupoId, setGrupoId] = useState("");

  const [filtroModalidade, setFiltroModalidade] = useState("TODAS");
  const [filtroGrupo, setFiltroGrupo] = useState("TODOS");

  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [equipeEmEdicao, setEquipeEmEdicao] = useState<Equipe | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Toasts e Modal de Exclusão
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [equipeParaExcluir, setEquipeParaExcluir] = useState<Equipe | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  function adicionarToast(tipo: ToastItem["tipo"], mensagem: string) {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), tipo, mensagem }]);
  }

  function removerToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  async function carregarDados() {
    setCarregando(true);

    const [{ data: mods }, { data: grps }, { data: eqs }] = await Promise.all([
      supabase.from("modalidade").select("*").order("id", { ascending: true }),
      supabase.from("grupos_confronto").select("*").order("nome", { ascending: true }),
      supabase.from("equipes").select("*").order("nome", { ascending: true }),
    ]);

    if (mods && mods.length > 0) {
      setModalidades(mods);
      if (!modalidadeId) setModalidadeId(mods[0].id.toString());
    }

    if (grps && grps.length > 0) {
      setGruposConfronto(grps);
      if (!grupoId) setGrupoId(grps[0].id.toString());
    }

    if (eqs) {
      setEquipes(eqs);
    }

    setCarregando(false);
  }

  useEffect(() => {
    async function iniciar() {
      const logado = await estaAutenticado();
      if (!logado) {
        window.location.replace("/professor");
        return;
      }
      try {
        await carregarDados();
      } catch (err) {
        console.error("Erro ao carregar equipes:", err);
        adicionarToast("erro", "Não foi possível carregar as equipes.");
        setCarregando(false);
      }
    }
    iniciar();
  }, []);

  function handleIniciarEdicao(eq: Equipe) {
    setEquipeEmEdicao(eq);
    setNome(eq.nome);
    setModalidadeId((eq.modalidades_id || eq.modalidade_id)?.toString() || "");
    setGrupoId(
      (eq.grupo_id || eq.grupo_confronto_id || eq.grupos_confronto_id)?.toString() || ""
    );
  }

  function handleCancelarEdicao() {
    setEquipeEmEdicao(null);
    setNome("");
    if (modalidades.length > 0) setModalidadeId(modalidades[0].id.toString());
    if (gruposConfronto.length > 0) setGrupoId(gruposConfronto[0].id.toString());
  }

  async function handleCadastrar(e: React.FormEvent) {
    e.preventDefault();

    if (!nome.trim() || !modalidadeId || !grupoId) {
      adicionarToast("aviso", "Preencha o nome, a modalidade e o grupo da equipe.");
      return;
    }

    setSalvando(true);

    const payload = {
      nome: nome.trim(),
      modalidades_id: parseInt(modalidadeId, 10),
      grupo_id: parseInt(grupoId, 10),
    };

    const { error } = equipeEmEdicao
      ? await supabase.from("equipes").update(payload).eq("id", equipeEmEdicao.id)
      : await supabase.from("equipes").insert([payload]);

    setSalvando(false);

    if (error) {
      adicionarToast("erro", `Erro ao salvar equipe: ${error.message}`);
    } else {
      adicionarToast(
        "sucesso",
        equipeEmEdicao
          ? `Equipe "${payload.nome}" atualizada!`
          : `Equipe "${payload.nome}" cadastrada!`
      );
      handleCancelarEdicao();
      carregarDados();
    }
  }

  async function confirmarExclusao() {
    if (!equipeParaExcluir) return;
    setExcluindo(true);

    const { error } = await supabase
      .from("equipes")
      .delete()
      .eq("id", equipeParaExcluir.id);

    setExcluindo(false);

    if (error) {
      adicionarToast("erro", `Não foi possível excluir: ${error.message}`);
    } else {
      adicionarToast("sucesso", `Equipe "${equipeParaExcluir.nome}" excluída.`);
      if (equipeEmEdicao?.id === equipeParaExcluir.id) {
        handleCancelarEdicao();
      }
      carregarDados();
    }
    setEquipeParaExcluir(null);
  }

  const getNomeModalidade = (modId?: number) =>
    modalidades.find((m) => m.id === modId)?.nome || "—";

  const getNomeGrupo = (grpId?: number) =>
    gruposConfronto.find((g) => g.id === grpId)?.nome || "Sem grupo";

  const equipesFiltradas = equipes.filter((eq) => {
    const idMod = eq.modalidades_id || eq.modalidade_id;
    const idGrp = eq.grupo_id || eq.grupo_confronto_id || eq.grupos_confronto_id;

    const okMod =
      filtroModalidade === "TODAS" || Number(idMod) === Number(filtroModalidade);
    const okGrp =
      filtroGrupo === "TODOS" || Number(idGrp) === Number(filtroGrupo);

    return okMod && okGrp;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <h1 className="text-2xl font-black text-amber-400">Gerenciar Equipes</h1>
        <p className="text-xs text-slate-400 mt-1">
          Cadastre e organize as equipes por modalidade e categoria.
        </p>
      </div>

      {carregando ? (
        <div className="text-center py-12 text-slate-400 text-sm font-bold animate-pulse">
          Carregando equipes...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Formulário */}
          <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-sm font-black uppercase tracking-wider text-amber-400 mb-4">
              {equipeEmEdicao ? "Editar Equipe" : "Nova Equipe"}
            </h2>

            <form onSubmit={handleCadastrar} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  Nome da Equipe
                </label>
                <input
                  type="text"
                  placeholder="Ex: 3º Ano A"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 text-slate-100 text-sm border border-slate-800 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  Modalidade
                </label>
                <select
                  value={modalidadeId}
                  onChange={(e) => setModalidadeId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 text-slate-100 text-sm border border-slate-800 focus:outline-none focus:border-amber-400"
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
                  onChange={(e) => setGrupoId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 text-slate-100 text-sm border border-slate-800 focus:outline-none focus:border-amber-400"
                >
                  {gruposConfronto.map((grp) => (
                    <option key={grp.id} value={grp.id}>
                      {grp.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 font-black py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs transition disabled:opacity-50"
                >
                  {salvando
                    ? "Salvando..."
                    : equipeEmEdicao
                    ? "Salvar Alterações"
                    : "Cadastrar Equipe"}
                </button>

                {equipeEmEdicao && (
                  <button
                    type="button"
                    onClick={handleCancelarEdicao}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Lista de Equipes */}
          <div className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
                Equipes Cadastradas ({equipesFiltradas.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={filtroModalidade}
                onChange={(e) => setFiltroModalidade(e.target.value)}
                aria-label="Filtrar por Modalidade"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 focus:outline-none focus:border-amber-400 text-xs font-bold"
              >
                <option value="TODAS">Todas as Modalidades</option>
                {modalidades.map((mod) => (
                  <option key={mod.id} value={mod.id}>
                    {mod.nome}
                  </option>
                ))}
              </select>

              <select
                value={filtroGrupo}
                onChange={(e) => setFiltroGrupo(e.target.value)}
                aria-label="Filtrar por Grupo"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 text-slate-200 border border-slate-800 focus:outline-none focus:border-amber-400 text-xs font-bold"
              >
                <option value="TODOS">Todos os Grupos</option>
                {gruposConfronto.map((grp) => (
                  <option key={grp.id} value={grp.id}>
                    {grp.nome}
                  </option>
                ))}
              </select>
            </div>

            {equipesFiltradas.length === 0 ? (
              <p className="text-slate-500 py-8 text-center italic text-xs">
                Nenhuma equipe encontrada para os filtros selecionados.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                {equipesFiltradas.map((eq) => {
                  const idMod = eq.modalidades_id || eq.modalidade_id;
                  const idGrp =
                    eq.grupo_id || eq.grupo_confronto_id || eq.grupos_confronto_id;

                  return (
                    <div
                      key={eq.id}
                      className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-slate-100 truncate">
                          {eq.nome}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800">
                            {getNomeModalidade(idMod)}
                          </span>
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                            {getNomeGrupo(idGrp)}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleIniciarEdicao(eq)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold rounded-lg transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setEquipeParaExcluir(eq)}
                          className="px-3 py-1.5 bg-red-950/60 hover:bg-red-600 text-red-300 hover:text-white border border-red-800/60 text-xs font-bold rounded-lg transition"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <ModalConfirmacao
        aberto={Boolean(equipeParaExcluir)}
        titulo="Excluir equipe?"
        descricao={`Tem certeza que deseja excluir "${equipeParaExcluir?.nome}"? Essa ação não poderá ser desfeita.`}
        textoConfirmar="Sim, Excluir"
        carregando={excluindo}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setEquipeParaExcluir(null)}
      />

      <ToastContainer toasts={toasts} removerToast={removerToast} />
    </div>
  );
}