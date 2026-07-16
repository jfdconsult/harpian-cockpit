export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="screen">
      <div className="hd">
        <div>
          <div className="h1">{title}</div>
          <div className="sub">Being ported from the HTML prototype to Next.js.</div>
        </div>
      </div>
      <div className="ph">
        <b>Screen not yet ported</b>
        Available in the static prototype (harpian-cockpit) — coming to Next.js soon.
      </div>
    </div>
  );
}
