"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { estaAutenticado } from "@/lib/auth";
import {
  ToastContainer,
  ToastItem,
  ModalConfirmacao,
} from "@/app/components/FeedbackAdmin";

interface Equipe {
  id: number;
  nome: string;
  modalidade_id?: number;
  modalidades_id?: number;
}

interface Modalidade {
  id: number;
  nome: string;
}

interface Aluno {
  id: number;
  nome: string;
  turma?: string | null;
  equipes_id?: number;
  equipe_id?: number;
  gols?: number;
  cartoes_amarelos?: number;
  cartoes_vermelhos?: number;
}

export default function GerenciarAlunos() {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [busca, setBusca] = useState("");

  const [nomeAluno, setNomeAluno] = useState("");
  const [turma, setTurma] = useState("");
  const [equipeSelecionada, setEquipeSelecionada] = useState("");

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [alunoParaExcluir, setAlunoParaExcluir] = useState<Aluno | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const estaMontado = useRef(true);

  function adicionarToast(tipo: ToastItem["tipo"], mensagem: string) {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), tipo, mensagem }]);
  }

  function removerToast(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  async function carregarDados() {
    try {
      const [resAlunos, resEquipes, resModalidades] = await Promise.all([
        supabase.from("alunos").select("*").order("nome", { ascending: true }),
        supabase.from("equipes").select("*").order("nome", { ascending: true }),
        supabase.from("modalidade").select("*"),
      ]);

      if (!estaMontado.current) return;

      if (!resAlunos.error) setAlunos(resAlunos.data || []);
      if (!resEquipes.error) setEquipes(resEquipes.data || []);
      if (!resModalidades.error) setModalidades(resModalidades.data || []);
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
      adicionarToast("erro", "Erro ao carregar lista de atletas.");
    } finally {
      if (estaMontado.current) setCarregando(false);
    }
  }

  useEffect(() => {
    estaMontado.current = true;

    async function iniciar() {
      const logado = await estaAutenticado();
      if (!logado) {
        window.location.replace("/professor");
        return;
      }
      await carregarDados();
    }

    iniciar();

    return () => {
      estaMontado.current = false;
    };
  }, []);

  const getEquipeDoAluno = (aluno: Aluno) => {
    const eqId = aluno.equipes_id || aluno.equipe_id;
    return equipes.find((e) => e.id === eqId);
  };

  const ehEquipeFutsal = (equipe?: Equipe | null) => {
    if (!equipe) return false;
    const modId = Number(equipe.modalidade_id || equipe.modalidades_id);
    const mod = modalidades.find((m) => m.id === modId);
    const nomeMod = mod?.nome?.trim().toLowerCase() || "";
    return modId === 1 || nomeMod === "futsal";
  };

  const equipesFutsal = equipes.filter((eq) => ehEquipeFutsal(eq));

  const handleCadastrarAluno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeAluno.trim() || !equipeSelecionada) {
      adicionarToast("aviso", "Informe o nome do atleta e a equipe.");
      return;
    }

    const equipeAlvo = equipes.find((eq) => eq.id === parseInt(equipeSelecionada, 10));
    if (!equipeAlvo || !ehEquipeFutsal(equipeAlvo)) {
      adicionarToast("aviso", "Selecione uma equipe válida de Futsal.");
      return;
    }

    setSalvando(true);

    const payloadBase = {
      nome: nomeAluno.trim(),
      turma: turma.trim() || null,
      cartoes_amarelos: 0,
      cartoes_vermelhos: 0,
      gols: 0,
    };

    let { error } = await supabase
      .from("alunos")
      .insert([{ ...payloadBase, equipes_id: parseInt(equipeSelecionada, 10) }]);

    if (error) {
      const resultSingular = await supabase
        .from("alunos")
        .insert([{ ...payloadBase, equipe_id: parseInt(equipeSelecionada, 10) }]);
      error = resultSingular.error;
    }

    setSalvando(false);

    if (!error) {
      adicionarToast("sucesso", `Atleta "${payloadBase.nome}" cadastrado!`);
      setNomeAluno("");
      setTurma("");
      setEquipeSelecionada("");
      await carregarDados();
    } else {
      adicionarToast("erro", `Erro ao cadastrar: ${error.message}`);
    }
  };

  const confirmarExclusao = async () => {
    if (!alunoParaExcluir) return;
    setExcluindo(true);

    const { error } = await supabase
      .from("alunos")
      .delete()
      .eq("id", alunoParaExcluir.id);

    setExcluindo(false);

    if (!error) {
      adicionarToast("sucesso", `Atleta "${alunoParaExcluir.nome}" removido.`);
      await carregarDados();
    } else {
      adicionarToast("erro", `Erro ao remover atleta: ${error.message}`);
    }
    setAlunoParaExcluir(null);
  };

  const alunosFiltrados = alunos.filter((al) => {
    const equipe = getEquipeDoAluno(al);
    if (!ehEquipeFutsal(equipe)) return false;

    const termo = busca.toLowerCase();
    const eqNome = equipe?.nome || "";
    return (
      al.nome?.toLowerCase().includes(termo) ||
      (al.turma && al.turma.toLowerCase().includes(termo)) ||
      eqNome.toLowerCase().includes(termo)
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <h1 className="text-2xl font-black text-amber-400">Atletas (Futsal)</h1>
        <p className="text-xs text-slate-400 mt-1">
          Vincule atletas às equipes de Futsal para controle de artilharia e cartões.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Formulário */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
          <h2 className="text-sm font-black uppercase tracking-wider text-amber-400 mb-4">
            Cadastrar Atleta
          </h2>

          <form onSubmit={handleCadastrarAluno} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                Nome do Atleta
              </label>
              <input
                type="text"
                value={nomeAluno}
                onChange={(e) => setNomeAluno(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 text-slate-100 text-sm border border-slate-800 focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                Turma / Série
              </label>
              <input
                type="text"
                value={turma}
                onChange={(e) => setTurma(e.target.value)}
                placeholder="Ex: 3º A"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 text-slate-100 text-sm border border-slate-800 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                Equipe de Futsal
              </label>
              <select
                value={equipeSelecionada}
                onChange={(e) => setEquipeSelecionada(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 text-slate-100 text-sm border border-slate-800 focus:outline-none focus:border-amber-400"
                required
              >
                <option value="">Selecione a equipe...</option>
                {equipesFutsal.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nome}
                  </option>
                ))}
              </select>
              {!carregando && equipesFutsal.length === 0 && (
                <p className="text-xs text-amber-400 mt-1.5">
                  Cadastre uma equipe de Futsal primeiro.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={salvando || equipesFutsal.length === 0}
              className="w-full font-black py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs transition mt-2 disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Cadastrar Atleta"}
            </button>
          </form>
        </div>

        {/* Listagem */}
        <div className="lg:col-span-2 bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">
              Atletas Cadastrados ({alunosFiltrados.length})
            </h2>
          </div>

          <input
            type="text"
            placeholder="Buscar por nome, turma ou equipe..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-950 text-slate-100 border border-slate-800 focus:outline-none focus:border-amber-400"
          />

          {carregando ? (
            <p className="text-slate-400 text-xs font-bold animate-pulse py-6 text-center">
              Carregando atletas...
            </p>
          ) : alunosFiltrados.length === 0 ? (
            <p className="text-slate-500 text-xs italic py-8 text-center">
              Nenhum atleta encontrado.
            </p>
          ) : (
            <ul className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
              {alunosFiltrados.map((al) => {
                const equipe = getEquipeDoAluno(al);
                const temStats =
                  (al.gols ?? 0) > 0 ||
                  (al.cartoes_amarelos ?? 0) > 0 ||
                  (al.cartoes_vermelhos ?? 0) > 0;

                return (
                  <li
                    key={al.id}
                    className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-slate-100 block truncate">
                        {al.nome}
                      </span>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800">
                          {equipe?.nome || "Sem equipe"}
                        </span>
                        {al.turma && (
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                            {al.turma}
                          </span>
                        )}
                        {temStats && (
                          <>
                            {(al.gols ?? 0) > 0 && (
                              <span className="bg-emerald-950/60 text-emerald-400 text-[11px] font-bold px-2 py-0.5 rounded border border-emerald-800/60">
                                ⚽ {al.gols}
                              </span>
                            )}
                            {(al.cartoes_amarelos ?? 0) > 0 && (
                              <span className="bg-amber-950/60 text-amber-400 text-[11px] font-bold px-2 py-0.5 rounded border border-amber-800/60">
                                🟨 {al.cartoes_amarelos}
                              </span>
                            )}
                            {(al.cartoes_vermelhos ?? 0) > 0 && (
                              <span className="bg-red-950/60 text-red-400 text-[11px] font-bold px-2 py-0.5 rounded border border-red-800/60">
                                🟥 {al.cartoes_vermelhos}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setAlunoParaExcluir(al)}
                      className="px-3 py-1.5 text-xs bg-red-950/60 hover:bg-red-600 text-red-300 hover:text-white border border-red-800/60 font-bold rounded-lg transition shrink-0"
                    >
                      Excluir
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <ModalConfirmacao
        aberto={Boolean(alunoParaExcluir)}
        titulo="Excluir atleta?"
        descricao={`Tem certeza que deseja remover "${alunoParaExcluir?.nome}" da equipe?`}
        textoConfirmar="Sim, Excluir"
        carregando={excluindo}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setAlunoParaExcluir(null)}
      />

      <ToastContainer toasts={toasts} removerToast={removerToast} />
    </div>
  );
}