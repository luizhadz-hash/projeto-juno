// @/components/FooterVoltar.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface FooterVoltarProps {
  href?: string;
  label?: string;
}

export default function FooterVoltar({ href = '/professor/painel', label = 'Voltar ao Painel' }: FooterVoltarProps) {
  const router = useRouter();

  const handleVoltar = () => {
  if (typeof window !== 'undefined') {
    const destino = href || '/professor/painel';
    // Descarrega o estado da página atual e força o navegador mobile a requisitar a nova URL
    window.location.assign(destino);
  }
};

  return (
  <footer className="w-full py-4 px-6 mt-auto bg-slate-900 border-t border-slate-800 flex justify-center">
    <a
      href={href || '/professor/painel'}
      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 font-semibold rounded-lg border border-slate-700 transition cursor-pointer touch-manipulation select-none"
    >
      <span>←</span>
      <span>{label}</span>
    </a>
  </footer>
);
}