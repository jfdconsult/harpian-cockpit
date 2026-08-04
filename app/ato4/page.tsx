"use client";

/**
 * Rota ISOLADA do Ato IV (Portfolio Builder) para a apresentacao publica.
 *
 * Diferencas vs a rota / do cockpit:
 *  - Nao renderiza o shell/menu do cockpit — so o PortfolioBuilder puro.
 *  - Nao passa pelo Basic Auth (middleware.ts exclui /ato4 do matcher).
 *  - Fica em dominio publico: o cliente que vem da apresentacao chega
 *    direto sem prompt de senha.
 *
 * Isolamento de dados: o cockpit interno usa o mesmo componente na rota /,
 * mas eventuais persistencias/estudos sao coisas separadas — a apresentacao
 * usa a ferramenta ao vivo com o cliente, o cockpit usa pra estudo interno.
 * Nao ha sincronizacao entre os dois contextos.
 */
import PortfolioBuilder from "@/components/screens/PortfolioBuilder";

export default function Ato4Page() {
  return (
    <div style={{ minHeight: "100vh", background: "#0B1626", color: "#F5EFE0" }}>
      <PortfolioBuilder />
    </div>
  );
}
