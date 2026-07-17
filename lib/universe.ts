// HC-US TOTAL universe — 215 tickers from broad_us.parquet (the S&P 500-derived
// depurated basket used by the flagship engine). Frozen snapshot embedded here
// so screens can show/filter without waiting for a backend round-trip; refresh
// by re-running: pandas.read_parquet(broad_us.parquet).columns → JSON.
export const HC_US_TOTAL_UNIVERSE: readonly string[] = [
  "ACGL", "ADI", "ADSK", "AEE", "AFL", "AIG", "AIZ", "AJG", "AKAM", "ALL",
  "AME", "AMP", "AON", "AOS", "ARE", "ATO", "AVB", "AVY", "AWK", "BALL",
  "BBY", "BEN", "BF-B", "BG", "BLDR", "BNY", "BRK-B", "BRO", "BXP", "CAH",
  "CASY", "CCL", "CDNS", "CHD", "CHRW", "CIEN", "CINF", "CLX", "CMI", "CMS",
  "CNC", "CNP", "COHR", "COO", "COR", "CPB", "CPT", "CRL", "CSX", "CTSH",
  "DAL", "DECK", "DGX", "DLTR", "DOC", "DOV", "DRI", "DTE", "DVA", "ED",
  "EFX", "EG", "EIX", "EME", "EQR", "EQT", "ERIE", "ES", "ESS", "EVRG",
  "EXPD", "EXPE", "EXR", "FAST", "FDS", "FDX", "FE", "FFIV", "FICO", "FIS",
  "FISV", "FRT", "FSLR", "FTNT", "GEN", "GL", "GLW", "GPC", "GPN", "GWW",
  "HAS", "HBAN", "HIG", "HPQ", "HRL", "HSIC", "HST", "HUBB", "HUM", "IDXX",
  "IEX", "IFF", "INCY", "INTC", "IRM", "IT", "IVZ", "J", "JBHT", "JBL",
  "JCI", "JKHY", "KEY", "KIM", "L", "LDOS", "LEN", "LH", "LHX", "LII",
  "LNT", "LUV", "LVS", "MAA", "MAS", "MCHP", "MET", "MGM", "MKC", "MPWR",
  "MRSH", "MSCI", "MSI", "MTB", "MTD", "NDAQ", "NDSN", "NI", "NRG", "NSC",
  "NTAP", "NTRS", "NVR", "ODFL", "OMC", "ON", "PCAR", "PCG", "PFG", "PHM",
  "PNC", "PNR", "PNW", "POOL", "PPG", "PPL", "PRU", "PSKY", "PTC", "PWR",
  "REG", "RF", "RJF", "RL", "RMD", "ROK", "ROL", "ROP", "RSG", "RVTY",
  "SATS", "SBAC", "SMCI", "SNA", "SNPS", "STE", "STLD", "STT", "STX", "SW",
  "SWK", "SWKS", "TAP", "TDY", "TECH", "TEL", "TER", "TFC", "TKO", "TPL",
  "TPR", "TRMB", "TROW", "TRV", "TSCO", "TXT", "TYL", "UAL", "UDR", "UHS",
  "USB", "VRSN", "VTR", "VTRS", "WAB", "WAT", "WDC", "WEC", "WRB", "WSM",
  "WST", "WTW", "WY", "WYNN", "ZBRA",
];
