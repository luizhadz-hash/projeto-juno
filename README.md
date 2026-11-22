# 🏆 Projeto Juno — Sistema de Gestão de Jogos Internos

Plataforma web full-stack desenvolvida para modernizar a organização de campeonatos escolares interclasses (**Futsal, Vôlei e Queimada**), substituindo planilhas manuais e súmulas em papel por atualizações em tempo real.

🔗 **Acesse em produção:** [jogos-internos.vercel.app](https://jogos-internos.vercel.app)

---

## ✨ Funcionalidades Principais

### 📱 Portal Público do Aluno (`/aluno`)
- **Acesso via QR Code:** Interface mobile-first para acompanhamento pelo celular durante os jogos.
- **Tempo Real (WebSockets):** Placares, classificação e estatísticas atualizados automaticamente sem recarregar a página.
- **Classificação & Pódio:** Cálculo automático de pontos, saldo de gols/pontos, critérios de desempate disciplinar e pódio oficial.
- **Artilharia & Cartões (Futsal):** Rankings individuais com filtros por grupo e busca por atleta.

### 📋 Painel Administrativo & Súmula Digital (`/professor`)
- **Autenticação Protegida:** Acesso restrito aos organizadores e árbitros via Supabase SSR.
- **Gestão Completa:** Cadastro de equipes, atletas, datas, locais e gerador de QR Code para divulgação na escola.
- **Chaveamento Inteligente:** Geração automática de fase de grupos, mata-mata (semifinais, 3º lugar e final) ou série melhor de 3 conforme o número de equipes inscritas.
- **Súmula Digital & Impressão A4:** Registro ao vivo de gols, cartões amarelos/vermelhos e desempates nos pênaltis, com layout dedicado para impressão oficial em folha A4.

---

## 🛠️ Tecnologias Utilizadas

- **Front-end:** Next.js (App Router), React, TypeScript, Tailwind CSS (*Bento Sports UI*)
- **Back-end & Banco de Dados:** Supabase (PostgreSQL, SSR Auth, Realtime)
- **Deploy & CI/CD:** GitHub + Vercel
