"use client";

import { useEffect } from "react";

export interface ToastItem {
  id: number;
  tipo: "sucesso" | "erro" | "aviso";
  mensagem: string;
}

export function ToastContainer({
  toasts,
  removerToast,
}: {
  toasts: ToastItem[];
  removerToast: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => (
        <ToastUnidade key={t.id} toast={t} onClose={() => removerToast(t.id)} />
      ))}
    </div>
  );
}

function ToastUnidade({
  toast,
  onClose,
}: {
  toast: ToastItem;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const estilos =
    toast.tipo === "sucesso"
      ? "bg-slate-900 border-emerald-500/80 text-emerald-200 shadow-emerald-950/50"
      : toast.tipo === "erro"
      ? "bg-slate-900 border-red-500/80 text-red-200 shadow-red-950/50"
      : "bg-slate-900 border-amber-400/80 text-amber-200 shadow-amber-950/50";

  const icone =
    toast.tipo === "sucesso" ? "✅" : toast.tipo === "erro" ? "⚠️" : "ℹ️";

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-2xl text-xs font-bold transition-all ${estilos}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-sm">{icone}</span>
        <span className="leading-snug">{toast.mensagem}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-slate-400 hover:text-white font-black text-xs ml-2"
      >
        ✕
      </button>
    </div>
  );
}

export function ModalConfirmacao({
  aberto,
  titulo,
  descricao,
  textoConfirmar = "Confirmar",
  variante = "perigo",
  carregando = false,
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean;
  titulo: string;
  descricao: string;
  textoConfirmar?: string;
  variante?: "perigo" | "primario";
  carregando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  if (!aberto) return null;

  return (
    <div className="no-print fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 text-center">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto text-xl border ${
            variante === "perigo"
              ? "bg-red-950/60 text-red-400 border-red-700/60"
              : "bg-amber-500/20 text-amber-400 border-amber-500/40"
          }`}
        >
          {variante === "perigo" ? "🗑️" : "⚠️"}
        </div>

        <h3 className="text-base font-black text-slate-100">{titulo}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{descricao}</p>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={carregando}
            onClick={onCancelar}
            className="w-1/2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={carregando}
            onClick={onConfirmar}
            className={`w-1/2 py-2.5 rounded-xl text-xs font-black transition disabled:opacity-50 ${
              variante === "perigo"
                ? "bg-red-600 hover:bg-red-500 text-white"
                : "bg-amber-400 hover:bg-amber-300 text-slate-950"
            }`}
          >
            {carregando ? "Processando..." : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}