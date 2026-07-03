export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="screen">
      <div className="hd">
        <div>
          <div className="h1">{title}</div>
          <div className="sub">Em portagem do protótipo HTML para Next.js.</div>
        </div>
      </div>
      <div className="ph">
        <b>Tela ainda não portada</b>
        Disponível no protótipo estático (harpian-cockpit) — chegando ao Next.js em breve.
      </div>
    </div>
  );
}
