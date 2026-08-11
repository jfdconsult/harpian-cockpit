/**
 * Cache em memória dos datasets do Portfolio Builder.
 *
 * `benchmark-sets.json` tem ~2,9 MB e era lido + parseado do disco a CADA
 * requisição (~10 ms por chamada: 3,5 ms de leitura + 6,9 ms de parse).
 * Numa rota que roda Monte Carlo isso é desperdício puro — o conteúdo não
 * muda entre duas chamadas.
 *
 * INVALIDAÇÃO POR mtime, não cache eterno. Na Vercel o filesystem é imutável
 * dentro de um deployment, então o cache jamais serviria dado velho lá. Mas
 * em desenvolvimento o dataset É reexportado com o servidor no ar (é o que a
 * pipeline `export_3sets.py` faz), e um cache cego faria a tela mostrar
 * número velho — exatamente o motivo pelo qual as rotas usam
 * `Cache-Control: no-cache`. O `stat` custa ~0,1 ms contra os ~10 ms que
 * evita, então a checagem se paga com folga.
 */

import fs from "node:fs/promises";

interface Entrada<T> {
  mtimeMs: number;
  size: number;
  valor: T;
}

const cache = new Map<string, Entrada<unknown>>();

/** Lê e parseia um JSON, reaproveitando o resultado enquanto o arquivo não mudar. */
export async function lerJSONCacheado<T>(caminho: string): Promise<T> {
  const st = await fs.stat(caminho);
  const hit = cache.get(caminho);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) {
    return hit.valor as T;
  }
  const raw = await fs.readFile(caminho, "utf8");
  const valor = JSON.parse(raw) as T;
  cache.set(caminho, { mtimeMs: st.mtimeMs, size: st.size, valor });
  return valor;
}

/** Idem, para quem serve o texto cru sem parsear (evita só a leitura de disco). */
export async function lerTextoCacheado(caminho: string): Promise<string> {
  const chave = caminho + "::raw";
  const st = await fs.stat(caminho);
  const hit = cache.get(chave);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) {
    return hit.valor as string;
  }
  const raw = await fs.readFile(caminho, "utf8");
  cache.set(chave, { mtimeMs: st.mtimeMs, size: st.size, valor: raw });
  return raw;
}
