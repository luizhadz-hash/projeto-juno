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
      ? "bg-white border-emerald-200 text-emerald-900 shadow-slate-900/10"
      : toast.tipo === "erro"
      ? "bg-white border-rose-200 text-rose-900 shadow-slate-900/10"
      : "bg-white border-amber-200 text-amber-900 shadow-slate-900/10";

  const badgeIcone =
    toast.tipo === "sucesso"
      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
      : toast.tipo === "erro"
      ? "bg-rose-50 text-rose-600 border-rose-200"
      : "bg-amber-50 text-amber-600 border-amber-200";

  const icone =
    toast.tipo === "sucesso" ? "✅" : toast.tipo === "erro" ? "⚠️" : "ℹ️";

  return (
    <div
      className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border shadow-xl text-xs font-bold transition-all ${estilos}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`h-7 w-7 rounded-xl border flex items-center justify-center text-xs shrink-0 ${badgeIcone}`}
        >
          {icone}
        </span>
        <span className="leading-snug">{toast.mensagem}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-slate-400 hover:text-slate-700 font-black text-xs ml-2 cursor-pointer"
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
    <div className="no-print fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bento-card p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-4 text-center">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto text-xl border ${
            variante === "perigo"
              ? "bg-rose-50 text-rose-600 border-rose-200"
              : "bg-[#f06449]/10 text-[#e05338] border-[#f06449]/30"
          }`}
        >
          {variante === "perigo" ? "🗑️" : "⚠️"}
        </div>

        <h3 className="text-base font-black text-slate-900">{titulo}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{descricao}</p>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            disabled={carregando}
            onClick={onCancelar}
            className="w-1/2 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={carregando}
            onClick={onConfirmar}
            className={`w-1/2 py-2.5 rounded-xl text-xs font-black transition cursor-pointer disabled:opacity-50 ${
              variante === "perigo"
                ? "bg-rose-600 hover:bg-rose-700 text-white shadow-xs shadow-rose-600/25"
                : "bg-[#f06449] hover:bg-[#e05338] text-white shadow-xs shadow-[#f06449]/30"
            }`}
          >
            {carregando ? "Processando..." : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}