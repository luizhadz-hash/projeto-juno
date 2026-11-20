import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full space-y-6 shadow-2xl">
        {/* Cabeçalho */}
        <div className="text-center space-y-1.5 border-b border-slate-800 pb-6">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
            Projeto Juno
          </span>
          <h1 className="text-3xl font-black text-amber-400">
            Jogos Internos
          </h1>
          <p className="text-xs text-slate-400">
            Acompanhe resultados, classificação e confrontos em tempo real.
          </p>
        </div>

        {/* Botões de Navegação */}
        <div className="space-y-3">
          <Link
            href="/aluno"
            className="block text-left bg-amber-400 hover:bg-amber-300 text-slate-950 p-4 rounded-xl transition"
          >
            <h2 className="text-sm font-black">Área do Aluno</h2>
            <p className="text-xs font-semibold text-slate-900/80 mt-0.5">
              Consulte tabelas, classificação, jogos e artilharia.
            </p>
          </Link>

          <Link
            href="/professor"
            className="block text-left bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 p-4 rounded-xl transition"
          >
            <h2 className="text-sm font-bold text-slate-100">
              Painel do Professor
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Gerencie equipes, chaveamento e súmula digital.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}