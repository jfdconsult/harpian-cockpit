declare module "html2pdf.js" {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: { scale?: number; useCORS?: boolean; backgroundColor?: string };
    jsPDF?: { unit?: string; format?: string | number[]; orientation?: "portrait" | "landscape" };
    pagebreak?: { mode?: string | string[] };
  }
  interface Html2PdfChain {
    set(opts: Html2PdfOptions): Html2PdfChain;
    from(el: HTMLElement | string): Html2PdfChain;
    save(filename?: string): Promise<void>;
    toPdf(): Html2PdfChain;
    output(type?: string): Promise<string>;
  }
  function html2pdf(): Html2PdfChain;
  export default html2pdf;
}
