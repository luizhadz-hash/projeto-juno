"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fazerLogin, verificarSessaoAtiva } from "@/lib/auth";

export default function ProfessorLoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    verificarSessaoAtiva().then((logado) => {
      if (logado) {
        window.location.replace("/professor/painel");
      }
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (carregando) return;

    if (!email.trim() || !senha.trim()) {
      setErro("Por favor, preencha o e-mail e a senha.");
      return;
    }

    setCarregando(true);
    setErro("");

    const resultado = await fazerLogin(email, senha);
    if (resultado.ok) {
      window.location.replace("/professor/painel");
    } else {
      setErro(resultado.erro || "E-mail ou senha incorretos.");
      setCarregando(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#eef2f6] text-slate-900 flex flex-col items-center justify-center p-4 sm:p-6 space-y-5">
      <div className="w-full max-w-md bento-card overflow-hidden">
        {/* Cabeçalho Tático */}
        <div className="bg-gradient-to-br from-[#52657a] to-[#3b4b5e] court-grid-bg px-7 py-7 text-center space-y-1.5">
          <div className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-white/12 border border-white/15 text-white text-lg mx-auto mb-1">
            📋
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Painel do Professor
          </h1>
          <p className="text-xs text-slate-200/90">
            Acesse sua conta administrativa para gerenciar equipes e súmulas.
          </p>
        </div>

        {/* Formulário de Login */}
        <div className="p-7 space-y-5">
          {erro && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3.5 rounded-xl text-center font-bold">
              {erro}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                E-mail
              </label>
              <input
                type="email"
                placeholder="professor@escola.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErro("");
                }}
                required
                disabled={carregando}
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#52657a] focus:bg-white text-slate-900 text-xs font-medium p-3.5 rounded-xl outline-none transition disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Senha
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  setErro("");
                }}
                required
                disabled={carregando}
                className="w-full bg-slate-50 border border-slate-200 focus:border-[#52657a] focus:bg-white text-slate-900 text-xs font-medium p-3.5 rounded-xl outline-none transition disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full bg-[#f06449] hover:bg-[#e05338] text-white font-black text-xs p-3.5 rounded-xl shadow-sm shadow-[#f06449]/30 transition cursor-pointer disabled:opacity-50"
            >
              {carregando ? "Autenticando..." : "Entrar no Painel"}
            </button>
          </form>
        </div>
      </div>

      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-2xl border border-slate-200/90 shadow-xs transition"
      >
        <span className="text-[#f06449] font-black">←</span>
        <span>Voltar para Início</span>
      </Link>
    </main>
  );
}