"use client";
import { useEffect, useRef, useState } from "react";
import { MENUS, type ScreenId } from "@/lib/nav";
import { useDialog } from "./ui/Dialog";

function Clock() {
  const [t, setT] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString("pt-BR"));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);
  return <div className="clock">{t}</div>;
}

export default function Topbar({ go, jimOpen, onJimToggle, onSettingsToggle }: { go: (id: ScreenId, param?: string) => void; jimOpen?: boolean; onJimToggle?: () => void; onSettingsToggle?: () => void }) {
  // menu aberto por CLIQUE (hover continua funcionando via CSS; clique cobre touch/teclado)
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dialog = useDialog();

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function navigate(id: ScreenId, param?: string) {
    setOpenMenu(null);
    go(id, param);
  }

  return (
    <div className="topbar" ref={barRef}>
      <div
        className="brand"
        role="button"
        tabIndex={0}
        onClick={() => navigate("mission-control")}
        onKeyDown={(e) => e.key === "Enter" && navigate("mission-control")}
      >
        <div className="lg">H</div>HARPIAN<span className="sub">COCKPIT GESTOR</span>
      </div>

      {MENUS.map((m) => (
        <div className={`menu${openMenu === m.label ? " open" : ""}`} key={m.label}>
          {m.direct ? (
            <div
              className="mtab"
              role="button"
              tabIndex={0}
              onClick={() => navigate(m.direct!)}
              onKeyDown={(e) => e.key === "Enter" && navigate(m.direct!)}
            >
              <i className={`ti ${m.icon}`} />{m.label}
            </div>
          ) : (
            <div
              className="mtab"
              role="button"
              tabIndex={0}
              aria-haspopup="menu"
              aria-expanded={openMenu === m.label}
              onClick={() => setOpenMenu(openMenu === m.label ? null : m.label)}
              onKeyDown={(e) => e.key === "Enter" && setOpenMenu(openMenu === m.label ? null : m.label)}
            >
              <i className={`ti ${m.icon}`} />{m.label}
              <i className="ti ti-chevron-down" style={{ fontSize: 13 }} />
            </div>
          )}
          {m.columns && (
            <div className={`dropdown${m.wide ? " wide" : ""}`} role="menu">
              {m.columns.map((col, ci) => (
                <div className="dd-col" key={ci} style={{ flex: 1 }}>
                  {col.label && <div className="dd-label">{col.label}</div>}
                  {col.items.map((it, ii) => (
                    <div
                      className="dd-item"
                      key={ii}
                      role="menuitem"
                      tabIndex={0}
                      onClick={() => navigate(it.id, it.param)}
                      onKeyDown={(e) => e.key === "Enter" && navigate(it.id, it.param)}
                    >
                      <i className={`ti ${it.icon}`} />{it.label}
                      {it.tag && <span className="tag g" style={{ marginLeft: "auto" }}>{it.tag}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="right">
        <div
          className={`jim${jimOpen ? " active" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => onJimToggle?.()}
          onKeyDown={(e) => e.key === "Enter" && onJimToggle?.()}
        >
          <i className="ti ti-sparkles" />Jim AI
        </div>
        <div
          className="jim"
          role="button"
          tabIndex={0}
          onClick={() => onSettingsToggle?.()}
          onKeyDown={(e) => e.key === "Enter" && onSettingsToggle?.()}
          title="Configurações"
        >
          <i className="ti ti-settings" />
        </div>
        <div className="pillstate" style={{ cursor: "default" }}><span className="dot" />JD · sócio-gestor</div>
        <Clock />
      </div>
    </div>
  );
}
