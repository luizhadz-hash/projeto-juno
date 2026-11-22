// @/components/FooterVoltar.tsx
"use client";

import React from "react";

interface FooterVoltarProps {
  href?: string;
  label?: string;
}

export default function FooterVoltar({
  href = "/professor/painel",
  label = "Voltar ao Painel",
}: FooterVoltarProps) {
  return (
    <footer className="no-print w-full py-5 px-6 mt-auto flex justify-center">
      <a
        href={href || "/professor/painel"}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-2xl border border-slate-200/90 shadow-xs transition-all cursor-pointer touch-manipulation select-none"
      >
        <span className="text-[#f06449] font-black">←</span>
        <span>{label}</span>
      </a>
    </footer>
  );
}