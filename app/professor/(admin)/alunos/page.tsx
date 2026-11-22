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
    <div className="max-w-6xl mx-auto space-y-5">
      {/* HERO TÁTICO BENTO */}
      <div className="bento-hero court-grid-bg p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-white/15 text-white px-3 py-1 rounded-full mb-2">
            Modalidade Futsal
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Atletas (Futsal)
          </h1>
          <p className="text-xs sm:text-sm text-slate-200/90 mt-1">
            Vincule atletas às equipes de Futsal para controle de artilharia e cartões.
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-sm border border-white/15 px-4 py-2.5 rounded-2xl self-start sm:self-center">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-200/80">
            Total Inscritos
          </span>
          <span className="text-lg font-black text-white">{alunosFiltrados.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Formulário */}
        <div className="bento-card p-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5 mb-5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f06449]" />
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              Cadastrar Atleta
            </h2>
          </div>

          <form onSubmit={handleCadastrarAluno} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Nome do Atleta
              </label>
              <input
                type="text"
                value={nomeAluno}
                onChange={(e) => setNomeAluno(e.target.value)}
                placeholder="Ex: João Silva"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 focus:bg-white text-slate-900 text-sm border border-slate-200 focus:outline-none focus:border-[#52657a] transition"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Turma / Série
              </label>
              <input
                type="text"
                value={turma}
                onChange={(e) => setTurma(e.target.value)}
                placeholder="Ex: 3º A"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 focus:bg-white text-slate-900 text-sm border border-slate-200 focus:outline-none focus:border-[#52657a] transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Equipe de Futsal
              </label>
              <select
                suppressHydrationWarning
                value={equipeSelecionada}
                onChange={(e) => setEquipeSelecionada(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 focus:bg-white text-slate-900 text-sm border border-slate-200 focus:outline-none focus:border-[#52657a] transition cursor-pointer"
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
                <p className="text-xs text-[#e05338] font-semibold mt-1.5">
                  Cadastre uma equipe de Futsal primeiro.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={salvando || equipesFutsal.length === 0}
              className="w-full font-black py-3 px-4 rounded-xl bg-[#f06449] hover:bg-[#e05338] text-white text-xs shadow-xs shadow-[#f06449]/30 transition mt-2 cursor-pointer disabled:opacity-50"
            >
              {salvando ? "Salvando..." : "Cadastrar Atleta"}
            </button>
          </form>
        </div>

        {/* Listagem */}
        <div className="lg:col-span-2 bento-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              Atletas Cadastrados ({alunosFiltrados.length})
            </h2>
          </div>

          <input
            type="text"
            placeholder="Buscar por nome, turma ou equipe..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50 focus:bg-white text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:outline-none focus:border-[#52657a] transition"
          />

          {carregando ? (
            <p className="text-slate-500 text-xs font-bold animate-pulse py-8 text-center">
              Carregando atletas...
            </p>
          ) : alunosFiltrados.length === 0 ? (
            <p className="text-slate-500 text-xs italic py-10 text-center">
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
                    className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/90 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <span className="font-bold text-sm text-slate-900 block truncate">
                        {al.nome}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-[#52657a]/12 text-[#3b4b5e]">
                          {equipe?.nome || "Sem equipe"}
                        </span>
                        {al.turma && (
                          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-lg bg-white text-slate-600 border border-slate-200/80">
                            {al.turma}
                          </span>
                        )}
                        {temStats && (
                          <>
                            {(al.gols ?? 0) > 0 && (
                              <span className="bg-emerald-50 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-emerald-200">
                                ⚽ {al.gols}
                              </span>
                            )}
                            {(al.cartoes_amarelos ?? 0) > 0 && (
                              <span className="bg-amber-50 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-amber-200">
                                🟨 {al.cartoes_amarelos}
                              </span>
                            )}
                            {(al.cartoes_vermelhos ?? 0) > 0 && (
                              <span className="bg-rose-50 text-rose-700 text-[11px] font-bold px-2 py-0.5 rounded-lg border border-rose-200">
                                🟥 {al.cartoes_vermelhos}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setAlunoParaExcluir(al)}
                      className="px-3 py-1.5 text-xs bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 font-bold rounded-xl transition shrink-0 cursor-pointer"
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