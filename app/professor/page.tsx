"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fazerLogin, verificarSessaoAtiva } from "@/lib/auth";

export default function ProfessorLoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [urlPublica, setUrlPublica] = useState("http://192.168.1.74:3000/aluno");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrlPublica(`${window.location.origin}/aluno`);
    }

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
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 space-y-6">
      {/* Formulário de Login */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl space-y-6">
        <div className="text-center space-y-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">
            Projeto Juno
          </span>
          <h1 className="text-2xl font-black text-amber-400">
            Painel do Professor
          </h1>
          <p className="text-xs text-slate-400">
            Entre com sua conta administrativa para gerenciar equipes e partidas.
          </p>
        </div>

        {erro && (
          <div className="bg-red-950/80 border border-red-500/60 text-red-200 text-xs p-3 rounded-xl text-center font-bold">
            {erro}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
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
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-slate-100 text-xs p-3 rounded-xl outline-none transition disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
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
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 text-slate-100 text-xs p-3 rounded-xl outline-none transition disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs p-3.5 rounded-xl transition disabled:opacity-50"
          >
            {carregando ? "Autenticando..." : "Entrar no Painel"}
          </button>
        </form>
      </div>

      <Link
        href="/"
        className="text-xs text-slate-400 hover:text-amber-400 font-bold transition"
      >
        ← Voltar para Início
      </Link>

      {/* Cartaz do QR Code da Área Pública */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 text-center">
        <div className="space-y-1">
          <h2 className="text-sm font-black uppercase tracking-wider text-amber-400">
            Área do Aluno
          </h2>
          <p className="text-xs text-slate-400">
            Escaneie o QR Code para acompanhar tabelas, artilharia e jogos em tempo real.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl inline-block">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
              urlPublica
            )}`}
            alt="QR Code Área do Aluno"
            className="w-44 h-44 mx-auto"
          />
        </div>

        <p className="text-[11px] font-mono text-slate-400 break-all">
          {urlPublica}
        </p>

        <button
          type="button"
          onClick={() => window.print()}
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs p-3 rounded-xl transition"
        >
          Imprimir Cartaz do QR Code
        </button>
      </div>
    </main>
  );
}