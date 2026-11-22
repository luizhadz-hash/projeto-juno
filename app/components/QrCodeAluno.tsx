"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function QrCodeAluno() {
  const [urlCompleta, setUrlCompleta] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const meuIpLocal = "192.168.1.74";
      const porta = "3000";
      if (window.location.hostname === "localhost") {
        setUrlCompleta(`http://${meuIpLocal}:${porta}/aluno`);
      } else {
        setUrlCompleta(`${window.location.origin}/aluno`);
      }
    }
  }, []);

  const handleImprimir = () => {
    window.print();
  };

  if (!urlCompleta) return null;

  return (
    <div className="bento-card print-card p-6 text-center space-y-4 w-full">
      <div className="space-y-1.5">
        <span className="inline-block text-[10px] font-black uppercase tracking-widest bg-[#f06449]/10 text-[#e05338] px-3 py-1 rounded-full">
          Acesso Público • QR Code
        </span>
        <h2 className="text-lg font-black text-slate-900">
          Área do Aluno
        </h2>
        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
          Escaneie o código abaixo com a câmera do celular para acompanhar tabelas, artilharia e jogos ao vivo.
        </p>
      </div>

      <div className="inline-flex justify-center p-4 bg-slate-50 border border-slate-200/80 rounded-2xl print:border-none print:bg-white print:p-0">
        <QRCodeSVG
          value={urlCompleta}
          size={190}
          bgColor="#ffffff"
          fgColor="#0f172a"
          level="M"
          includeMargin={false}
        />
      </div>

      <p className="text-[11px] text-slate-500 break-all font-mono bg-slate-50 py-1.5 px-3 rounded-xl border border-slate-200/70 print:border-none print:bg-transparent">
        {urlCompleta}
      </p>

      <button
        type="button"
        onClick={handleImprimir}
        className="no-print w-full py-3 px-4 bg-[#52657a] hover:bg-[#3b4b5e] text-white font-black text-xs rounded-xl transition shadow-xs cursor-pointer"
      >
        🖨️ Imprimir Cartaz do QR Code
      </button>
    </div>
  );
}