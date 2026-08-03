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
  template: `
<div class="pdf-viewer-wrap">
  <!-- Toolbar -->
  <div class="pdf-toolbar">
    <div class="pdf-toolbar-left">
      <span class="pdf-title">{{ title }}</span>
      <span class="pdf-pages" *ngIf="mode() === 'canvas' && totalPages() > 0">{{ currentPage() }} / {{ totalPages() }} pages</span>
    </div>
    <div class="pdf-toolbar-right">
      <button class="pdf-btn pdf-btn-mode" (click)="toggleMode()" [title]="mode() === 'canvas' ? 'Passer en vue intégrée navigateur' : 'Passer en vue avec surlignage'">
        {{ mode() === 'canvas' ? '🖼️ Navigateur' : '🟡 Surlignage' }}
      </button>
      <ng-container *ngIf="mode() === 'canvas'">
        <button class="pdf-btn" (click)="zoom(-0.2)" title="Dézoomer">－</button>
        <span class="zoom-label">{{ (scale() * 100).toFixed(0) }}%</span>
        <button class="pdf-btn" (click)="zoom(0.2)" title="Zoomer">＋</button>
      </ng-container>
      <button class="pdf-btn pdf-btn-dl" (click)="download()" title="Télécharger">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Highlight legend -->
  <div class="highlight-legend" *ngIf="mode() === 'canvas' && highlightText">
    <span class="legend-dot"></span>
    Recherche : "{{ highlightText }}"
  </div>

  <!-- Loading -->
  <div class="pdf-loading" *ngIf="loading() && mode() === 'canvas'">
    <div class="pdf-spinner"></div>
    <p>Chargement du document PDF…</p>
  </div>

  <!-- Error -->
  <div class="pdf-error" *ngIf="errorMsg() && mode() === 'canvas'">
    <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <p>{{ errorMsg() }}</p>
    <button class="pdf-btn pdf-btn-mode" style="width:auto; padding:0 12px;" (click)="mode.set('iframe')">Afficher via le lecteur du navigateur</button>
  </div>

  <!-- Iframe Mode -->
  <div class="pdf-iframe-container" *ngIf="mode() === 'iframe'">
    <iframe [src]="safePdfUrl" width="100%" height="100%" frameborder="0"></iframe>
  </div>

  <!-- Pages container (Canvas Mode) -->
  <div class="pdf-pages-container" #pagesContainer *ngIf="mode() === 'canvas'">
    <div *ngFor="let pg of pageRefs(); let i = index"
         class="pdf-page-wrap" [id]="'page-' + (i+1)">
      <span class="page-num-label">Page {{ i + 1 }}</span>
      <div class="pdf-page-inner">
        <canvas [id]="'canvas-' + (i+1)"></canvas>
        <div [id]="'textlayer-' + (i+1)" class="text-layer"></div>
      </div>
    </div>
  </div>
</div>
  `,
  styles: [`
    :host {
      display: flex; flex-direction: column; width: 100%; height: 100%;
      min-height: 0; overflow: hidden; flex: 1; overscroll-behavior: contain;
    }
    .pdf-viewer-wrap {
      display: flex; flex-direction: column; width: 100%; height: 100%;
      min-height: 0; overflow: hidden; flex: 1;
      background: #1a1a2e; color: #e8e8f0; overscroll-behavior: contain;
    }

    /* Toolbar */
    .pdf-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 16px; background: #16213e; border-bottom: 1px solid rgba(255,255,255,.08);
      min-height: 48px; flex-shrink: 0; z-index: 10;
    }
    .pdf-toolbar-left { display: flex; align-items: center; gap: 12px; overflow: hidden; }
    .pdf-title { font-size: 13px; font-weight: 600; color: #e8e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 280px; }
    .pdf-pages { font-size: 11px; color: rgba(255,255,255,.4); white-space: nowrap; }
    .pdf-toolbar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .zoom-label { font-size: 12px; color: rgba(255,255,255,.5); min-width: 40px; text-align: center; }
    .pdf-btn {
      background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.1);
      color: #e8e8f0; border-radius: 6px; width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 16px; transition: all .15s;
    }
    .pdf-btn:hover { background: rgba(0,166,147,.2); border-color: rgba(0,166,147,.4); }
    .pdf-btn-dl { width: 32px; }
    .pdf-btn-mode {
      width: auto; padding: 0 10px; font-size: 12px; font-weight: 500;
    }

    /* Legend */
    .highlight-legend {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 16px; background: rgba(255,220,0,.08);
      border-bottom: 1px solid rgba(255,220,0,.15);
      font-size: 11px; color: rgba(255,220,0,.8); flex-shrink: 0;
    }
    .legend-dot { width: 10px; height: 10px; background: rgba(255,220,0,.6); border-radius: 2px; }

    /* Loading / Error */
    .pdf-loading, .pdf-error {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 60px; gap: 16px; color: rgba(255,255,255,.4); font-size: 14px; flex: 1;
    }
    .pdf-spinner {
      width: 36px; height: 36px; border: 3px solid rgba(0,166,147,.2);
      border-top-color: #00a693; border-radius: 50%; animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Iframe mode */
    .pdf-iframe-container {
      flex: 1; width: 100%; height: 100%; min-height: 0; background: #fff; overscroll-behavior: contain;
    }

    /* Pages container (Canvas mode) */
    .pdf-pages-container {
      flex: 1; width: 100%; height: 100%; min-height: 0;
      overflow-y: auto; overflow-x: auto; padding: 24px 16px; display: flex;
      flex-direction: column; align-items: center; gap: 24px;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.2) transparent;
      box-sizing: border-box; overscroll-behavior: contain;
    }
    .pdf-page-wrap { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; }
    .page-num-label { font-size: 10px; color: rgba(255,255,255,.35); letter-spacing: .5px; }
    .pdf-page-inner {
      position: relative; box-shadow: 0 6px 28px rgba(0,0,0,.6);
      border-radius: 4px; overflow: hidden; background: #fff;
    }
    canvas { display: block; }

    /* Text layer — bright yellow highlight boxes over PDF canvas */
    .text-layer {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      overflow: hidden; pointer-events: none; z-index: 20;
    }
    .text-layer .highlight-box {
      position: absolute;
      background: #ffe500 !important;
      opacity: 0.55 !important;
      border: 2px solid #e6b800 !important;
      box-shadow: 0 0 12px rgba(255, 229, 0, 0.7);
      border-radius: 3px;
      z-index: 30 !important;
      pointer-events: none;
    }
  `]
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
