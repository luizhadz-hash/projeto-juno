import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#eef2f6] text-slate-900 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Bloco Principal Tático (Inspirado no Tournament Control Center) */}
        <section className="lg:col-span-7 bento-hero court-grid-bg relative overflow-hidden p-7 sm:p-9 flex flex-col justify-between min-h-[340px]">
          {/* Desenho sutil de quadra no canto direito */}
          <svg
            aria-hidden="true"
            viewBox="0 0 200 260"
            className="pointer-events-none absolute -right-6 -bottom-6 w-56 h-72 text-white/10"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="10" y="10" width="180" height="240" rx="8" />
            <line x1="10" y1="130" x2="190" y2="130" />
            <circle cx="100" cy="130" r="28" />
            <rect x="55" y="10" width="90" height="36" />
            <rect x="55" y="214" width="90" height="36" />
          </svg>

          <div className="relative z-10 space-y-4">

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
              Jogos Internos
            </h1>

            <p className="text-sm text-slate-200/90 max-w-md leading-relaxed">
              Acompanhe placares ao vivo, classificação por grupos, artilharia e
              confrontos de Futsal, Vôlei e Queimada em tempo real.
            </p>
          </div>

          {/* Pills de Modalidades */}
          <div className="relative z-10 pt-8 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold bg-white/12 border border-white/15 text-white px-3 py-1.5 rounded-xl">
              Futsal
            </span>
            <span className="text-xs font-semibold bg-white/12 border border-white/15 text-white px-3 py-1.5 rounded-xl">
              Vôlei
            </span>
            <span className="text-xs font-semibold bg-white/12 border border-white/15 text-white px-3 py-1.5 rounded-xl">
              Queimada
            </span>
          </div>
        </section>

        {/* Coluna Lateral Bento com os Acessos */}
        <section className="lg:col-span-5 flex flex-col justify-between gap-4">
          {/* Card Destaque: Área do Aluno */}
          <Link
            href="/aluno"
            className="bento-card group p-6 sm:p-7 flex-1 flex flex-col justify-between hover:border-[#f06449]/60 hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-[#f06449]/12 text-[#f06449] font-black text-lg">
                🏆
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-[#f06449]/10 text-[#e05338] px-2.5 py-1 rounded-full">
                Acesso Público
              </span>
            </div>

            <div className="mt-6 space-y-1.5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900 group-hover:text-[#e05338] transition-colors">
                  Área do Aluno
                </h2>
                <span className="text-slate-400 group-hover:text-[#f06449] group-hover:translate-x-1 transition-all font-bold">
                  →
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Consulte tabelas de classificação, agenda de partidas,
                artilharia e cartões.
              </p>
            </div>
          </Link>

          {/* Card Secundário: Painel do Professor */}
          <Link
            href="/professor"
            className="bento-card group p-6 sm:p-7 flex flex-col justify-between bg-white hover:border-slate-400 hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-slate-100 text-slate-700 font-black text-lg">
                📋
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                Arbitragem & Gestão
              </span>
            </div>

            <div className="mt-5 space-y-1.5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-slate-900 group-hover:text-[#52657a] transition-colors">
                  Painel do Professor
                </h2>
                <span className="text-slate-400 group-hover:text-slate-700 group-hover:translate-x-1 transition-all font-bold">
                  →
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Gerencie equipes, atletas, chaveamento e súmula digital.
              </p>
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}