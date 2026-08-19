import {
  Component, Input, OnChanges, SimpleChanges,
  AfterViewInit, ViewChild, ElementRef, signal, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

declare const pdfjsLib: any;

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pdf-viewer.component.html',
  styleUrls: ['./pdf-viewer.component.scss'],
})
export class PdfViewerComponent implements OnChanges {
  @Input() pdfUrl = '';
  @Input() highlightText = '';
  @Input() targetPage: number | string = '';
  @Input() title = '';

  loading = signal(true);
  errorMsg = signal('');
  totalPages = signal(0);
  currentPage = signal(0);
  scale = signal(1.3);
  pageRefs = signal<number[]>([]);
  mode = signal<'canvas' | 'iframe'>('canvas');

  private pdfDoc: any = null;
  private renderingQueue: boolean = false;

  constructor(private zone: NgZone, private sanitizer: DomSanitizer) {}

  get safePdfUrl(): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfUrl);
  }

  toggleMode() {
    this.mode.set(this.mode() === 'canvas' ? 'iframe' : 'canvas');
    console.log('🔄 [PDF Viewer] Toggled viewer mode to:', this.mode());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['pdfUrl'] && this.pdfUrl) {
      console.log('📄 [PDF Viewer] pdfUrl input changed:', this.pdfUrl);
      this.loadPdf();
    }
  }

  private async loadPdf() {
    if (!this.pdfUrl) return;
    this.loading.set(true);
    this.errorMsg.set('');
    this.pageRefs.set([]);
    this.totalPages.set(0);
    this.pdfDoc = null;

    console.log('🔍 [PDF Viewer] Loading document:', {
      url: this.pdfUrl,
      highlightText: this.highlightText,
      targetPage: this.targetPage,
      scale: this.scale()
    });

    try {
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        console.error('❌ [PDF Viewer] PDF.js library not loaded on window object.');
        this.errorMsg.set('PDF.js non chargé.');
        this.loading.set(false);
        return;
      }

      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const loadingTask = pdfjsLib.getDocument({ url: this.pdfUrl, withCredentials: false });
      this.pdfDoc = await loadingTask.promise;
      const numPages = this.pdfDoc.numPages;

      console.log(`✅ [PDF Viewer] Document loaded successfully. Total pages: ${numPages}`);

      this.zone.run(() => {
        this.totalPages.set(numPages);
        this.pageRefs.set(Array.from({ length: numPages }, (_, i) => i + 1));
        this.loading.set(false);
      });

      setTimeout(() => this.renderAllPages(), 150);
    } catch (e: any) {
      console.error('❌ [PDF Viewer] Exception in loadPdf:', e);
      this.zone.run(() => {
        this.errorMsg.set('Impossible de charger le PDF. Vérifiez que le fichier existe dans le dossier pdfs.');
        this.loading.set(false);
      });
    }
  }

  private async renderAllPages() {
    if (!this.pdfDoc || this.renderingQueue) {
      console.warn('⚠️ [PDF Viewer] renderAllPages skipped: pdfDoc missing or render already in progress');
      return;
    }

    this.renderingQueue = true;
    const targetPhrase = this.normalizePhrase(this.highlightText);
    console.log('🚀 [PDF Viewer] Starting page rendering batch with scale:', this.scale(), '| Highlight phrase:', `"${targetPhrase}"`);

    const numPages = this.pdfDoc.numPages;
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      await this.renderPage(pageNum, targetPhrase);
    }

    this.renderingQueue = false;

    const totalHighlightBoxes = document.querySelectorAll('.highlight-box').length;
    console.log(`✨ [PDF Viewer] Batch rendering completed. Total highlight boxes on screen: ${totalHighlightBoxes}`);

    setTimeout(() => this.scrollToTarget(), 200);
  }

  private async renderPage(pageNum: number, targetPhrase: string) {
    try {
      const page = await this.pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.scale() });

      const canvas = document.getElementById(`canvas-${pageNum}`) as HTMLCanvasElement;
      if (!canvas) {
        console.warn(`⚠️ [PDF Viewer] Canvas element #canvas-${pageNum} not found in DOM.`);
        return;
      }

      const context = canvas.getContext('2d');
      if (!context) return;

      // Update Canvas Dimensions and CSS styles explicitly for Zoom to take effect!
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      context.clearRect(0, 0, canvas.width, canvas.height);

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      console.log(`📄 [PDF Viewer] Rendered page ${pageNum}/${this.totalPages()} at scale ${this.scale()} (${viewport.width.toFixed(0)}x${viewport.height.toFixed(0)}px)`);

      if (targetPhrase) {
        await this.highlightTextOnPage(page, viewport, pageNum, targetPhrase);
      }
    } catch (e) {
      console.warn(`⚠️ [PDF Viewer] Error rendering page ${pageNum}:`, e);
    }
  }

  private async highlightTextOnPage(page: any, viewport: any, pageNum: number, targetPhrase: string) {
    try {
      const textContent = await page.getTextContent();
      const textLayer = document.getElementById(`textlayer-${pageNum}`);
      if (!textLayer) return;

      textLayer.innerHTML = '';
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;

      const items = textContent.items;
      if (!items || items.length === 0) return;

      const fullPageText = items.map((it: any) => it.str).join(' ');
      const normalizedFullText = this.normalizePhrase(fullPageText);

      // Extract significant keywords (length >= 3)
      const keywords = targetPhrase.split(' ').filter(w => w.length >= 3);
      const isFullPhrasePresent = targetPhrase.length > 0 && normalizedFullText.includes(targetPhrase);

      let highlightCount = 0;

      for (const item of items) {
        const itemStr = this.normalizePhrase(item.str);
        if (!itemStr) continue;

        let isMatch = false;

        if (isFullPhrasePresent) {
          isMatch = targetPhrase.includes(itemStr) || itemStr.includes(targetPhrase);
        } else if (keywords.length > 0) {
          isMatch = keywords.some(kw => itemStr.includes(kw));
        }

        if (isMatch) {
          const pdfjsLib = (window as any).pdfjsLib;
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);

          const box = document.createElement('div');
          box.className = 'highlight-box';
          box.style.left = `${tx[4]}px`;
          box.style.top = `${tx[5] - item.height * this.scale()}px`;
          box.style.width = `${item.width * this.scale()}px`;
          box.style.height = `${item.height * this.scale() * 1.25}px`;

          textLayer.appendChild(box);
          highlightCount++;
        }
      }

      if (highlightCount > 0) {
        console.log(`🟡 [PDF Viewer] Page ${pageNum}: Highlighted ${highlightCount} text item(s) for query.`);
      }
    } catch (e) {
      console.warn(`⚠️ [PDF Viewer] Error highlighting text on page ${pageNum}:`, e);
    }
  }

  private scrollToTarget() {
    console.log('📜 [PDF Viewer] Attempting auto-scroll to target page or highlight...');
    const pagesContainer = document.querySelector('.pdf-pages-container');
    if (!pagesContainer) {
      console.warn('⚠️ [PDF Viewer] .pdf-pages-container not found in DOM.');
      return;
    }

    let targetEl: HTMLElement | null = null;
    const highlightBox = document.querySelector('.highlight-box');
    if (highlightBox) {
      targetEl = highlightBox.closest('.pdf-page-wrap') as HTMLElement;
      console.log('🎯 [PDF Viewer] Found highlight box, target page:', targetEl?.id);
    }

    if (!targetEl && this.targetPage) {
      const pageNum = parseInt(String(this.targetPage), 10);
      if (!isNaN(pageNum)) {
        targetEl = document.getElementById(`page-${pageNum}`);
        console.log(`🎯 [PDF Viewer] Target page numeric ID page-${pageNum} found:`, !!targetEl);
      }
    }

    if (targetEl) {
      console.log('🚀 [PDF Viewer] Smooth scrolling to target element:', targetEl.id);
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      console.log('ℹ️ [PDF Viewer] No highlight or target page specified, staying at page 1.');
    }
  }

  private normalizePhrase(str: string): string {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  zoom(delta: number) {
    const oldScale = this.scale();
    const newScale = Math.min(Math.max(parseFloat((oldScale + delta).toFixed(2)), 0.6), 2.8);
    console.log(`🔍 [PDF Viewer] Zoom clicked! Old Scale: ${oldScale} -> New Scale: ${newScale}`);
    this.scale.set(newScale);
    
    // Force re-render of canvases with new scale
    this.renderingQueue = false;
    this.renderAllPages();
  }

  download() {
    if (this.pdfUrl) {
      console.log('⬇️ [PDF Viewer] Downloading PDF:', this.pdfUrl);
      window.open(this.pdfUrl, '_blank');
    }
  }
}
