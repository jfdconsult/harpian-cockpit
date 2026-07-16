// Client for the FULL XRI feed (GET /api/xri) — internal Cockpit, no whitelist.
// Source engine: sibling repo harpian-xri (xri-daily / xri-validate-f4 / xri-calibrate-f41).

export interface XriSnapshot {
  score: number;
  state: "CALM" | "WATCH" | "STRESS" | "CRISIS";
  direction: "heating" | "cooling" | "stable";
  confidence: number;
  slow_prior: number;
  fast_market_stress: number;
  turbulence: number;
  absorption_ratio_score: number;
  dy_global: number;
  dy_material_to_us: number;
  event_adjustment: number;
  contribution_by_pillar: Record<string, number>;
  contribution_by_country: Record<string, number>;
  exposure_quality: {
    reported_coverage_pct: number;
    imputed_coverage_pct: number;
    avg_confidence: number;
    low_confidence_blocks: string[];
  };
  frequency_decomposition: {
    slow_prior_contribution: number;
    fast_market_contribution: number;
    fragility_contribution: number;
    event_contribution: number;
    stale_data_flags: string[];
  };
  data_quality_flags: string[];
  overlay_recommendation: {
    gross_exposure_cap_modifier: number;
    defensive_threshold_modifier: number;
    reentry_confirmation_required: "normal" | "double" | "blocked";
  };
  accepted_events: Array<{ event_id: string; date: string; country: string; pillar: string; channel: string; description: string; contribution: number; decay: number; cap: number }>;
  quarantined_events: Array<{ event_id: string; date: string; country: string; pillar: string; channel: string; description: string; reason: string }>;
  dy_by_country: Record<string, number>;
  sources_used: string[];
  asof_date: string;
  generated_at: string;
  versions: { model_version: string; data_version: string; feature_version: string; exposure_version: string; config_hash: string };
}

export interface XriValidation {
  reconstruction: { start: string; end: string; obs: number; exposure_version: string };
  anchor_events: {
    summary: { events_covered: number; events_hit_alert: number; hit_rate: number; median_lead_days_watch: number; alert_level: string; pre_window_days: number };
    events: Array<{ key: string; name: string; start: string; status: string; score_at_start?: number; state_at_start?: string; max_score_window?: number; max_state_window?: string; lead_days_watch?: number; hit_alert?: boolean }>;
    false_positives: { episodes: number; total_days: number; pct_of_history: number; list: Array<{ from: string; to: string; days: number }> };
  };
  overlay_backtests: Array<{
    motor_label: string; motor_period: [string, string];
    base: { cagr: number; vol: number; sharpe: number; psr: number; max_drawdown: number; n_obs: number };
    overlay: { cagr: number; vol: number; sharpe: number; psr: number; max_drawdown: number; n_obs: number; avg_exposure: number; state_changes: number };
    verdict: { drawdown_improved: boolean; dd_delta_pp: number; sharpe_improved: boolean; sharpe_delta: number; psr_improved: boolean; return_cost_pp_year: number };
  }>;
  kill_criteria: { verdict: string };
  limitations: string[];
}

export interface XriCalibration {
  search_space: { weights: string[]; thresholds: string[]; overlays: string[]; n_trials: number; embargo_days: number; first_test_year: number };
  selections: Array<{ year: number; config: string; train_calmar_delta: number | null }>;
  primary_motor: string;
  oos_period: [string, string];
  oos_base: { sharpe: number; maxdd: number; cagr: number; calmar: number };
  oos_overlay: { sharpe: number; maxdd: number; cagr: number; calmar: number };
  deflated: { n_trials: number; sr_star_daily: number; dsr_overlay: number; psr_base: number };
  robustness: { motor: string; base: { sharpe: number; maxdd: number }; overlay: { sharpe: number; maxdd: number } } | null;
  recommended_config: string | null;
  checks: { dd_ok: boolean; sharpe_ok: boolean; dsr_ok: boolean; rob_ok: boolean };
  verdict: string;
  approved: boolean;
}

export interface XriJimAnalysis {
  analysis: string;
  generated_at: string;
  sources: { jd_news: boolean; black_library: boolean };
  model: string;
}

export interface XriFeed {
  ok: boolean;
  offline?: boolean;
  snapshot?: XriSnapshot;
  validation?: XriValidation | null;
  calibration?: XriCalibration | null;
  jim_analysis?: XriJimAnalysis | null;
}

export const XRI_STATE_COLOR: Record<string, string> = {
  CALM: "#2ECC71",
  WATCH: "#F39C12",
  STRESS: "#E67E22",
  CRISIS: "#E74C3C",
};
export const XRI_STATE_LABEL: Record<string, string> = {
  CALM: "CALM", WATCH: "WATCH", STRESS: "STRESS", CRISIS: "CRISIS",
};
export const COUNTRY_PT: Record<string, string> = {
  japan: "Japan", china: "China", taiwan: "Taiwan", korea: "South Korea",
  euro_area: "Euro Area", uk: "United Kingdom", canada: "Canada", mexico: "Mexico",
  india: "India", gulf_energy: "Gulf/Energy", apac_other: "Asia-Pacific",
  latam_other: "Latin America", us: "United States", global_energy: "Global Energy",
  global_funding: "Global Funding",
};

// xri-serve — micro-service of the harpian-xri engine (uvicorn xri.serve:app --port 8879),
// same pattern as GOV_API (:8877): this SPA is output:"export", with no server route
// of its own, so it fetches directly from an external service (client-side fetch).
const XRI_API = process.env.NEXT_PUBLIC_XRI_API_URL || "http://localhost:8879";

export async function fetchXriFeed(): Promise<XriFeed> {
  try {
    const r = await fetch(`${XRI_API}/xri/full`, { cache: "no-store" });
    return (await r.json()) as XriFeed;
  } catch {
    return { ok: false, offline: true };
  }
}
