"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";

export default function QrCodeAluno() {
  const [urlCompleta, setUrlCompleta] = useState("");

  useEffect(() => {
    // Pega o domínio automaticamente (localhost ou site publicado)
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
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-center space-y-4 max-w-sm mx-auto my-6 print:border-none print:bg-white print:text-black">
      <div className="space-y-1">
        <h2 className="text-lg font-black text-amber-400 print:text-black">
          📱 Área do Aluno
        </h2>
        <p className="text-xs text-slate-400 print:text-slate-700">
          Escaneie o QR Code para ver tabelas, artilharia e jogos em tempo real.
        </p>
      </div>

      <div className="flex justify-center p-4 bg-white rounded-xl print:p-0">
        <QRCodeSVG
          value={urlCompleta}
          size={200}
          bgColor={"#ffffff"}
          fgColor={"#000000"}
          level={"L"}
          includeMargin={false}
        />
      </div>

      <p className="text-[11px] text-slate-500 break-all print:text-slate-800 font-mono">
        {urlCompleta}
      </p>

      <button
        onClick={handleImprimir}
        className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl transition shadow-lg print:hidden"
      >
        🖨️ Imprimir Cartaz do QR Code
      </button>
    </div>
  );
}