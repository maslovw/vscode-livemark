import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";
import * as https from "https";
import * as http from "http";
import { Alignment, WidthMode } from "./config";

interface ImageReference {
  path: string;
  absolutePath: string;
}

export interface LayoutSettings {
  alignment: Alignment;
  widthMode: WidthMode;
  contentWidth: number;
}

/**
 * Exports a markdown document as a self-contained HTML file with embedded images.
 * Can optionally use pre-rendered HTML from the Livemark editor.
 */
export async function exportAsHtml(
  document: vscode.TextDocument,
  renderedHtml?: string,
  editorJson?: string,
  layout?: LayoutSettings,
  plantumlBlocks?: Array<{ source: string; url: string }>,
  domHtml?: string,
  theme?: string,
  extensionContext?: vscode.ExtensionContext
): Promise<void> {
  const markdownContent = document.getText();
  const documentDir = path.dirname(document.uri.fsPath);
  const documentName = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath));

  let html: string;

  if (domHtml) {
    // Primary path: use real DOM snapshot from the webview for pixel-perfect export
    html = await buildDomHtmlDocument(domHtml, documentDir, documentName, layout, theme, extensionContext);
  } else {
    // Find all image references in markdown or editor JSON
    const imageRefs = editorJson
      ? await extractImageReferencesFromJson(editorJson, documentDir)
      : await extractImageReferences(markdownContent, documentDir);

    // Convert markdown to HTML with embedded images
    let htmlContent: string;
    if (renderedHtml) {
      // Use the pre-rendered HTML from Livemark editor and embed images
      htmlContent = await embedImagesInHtml(renderedHtml, imageRefs, documentDir);
      // Replace plantuml source blocks with embedded SVG diagram images
      if (plantumlBlocks && plantumlBlocks.length > 0) {
        htmlContent = await embedPlantumlDiagrams(htmlContent, plantumlBlocks);
      }
    } else {
      // Fall back to simple markdown conversion
      htmlContent = await convertMarkdownToHtml(markdownContent, imageRefs, documentName, layout);
    }

    // For pre-rendered HTML, we need to wrap it in a complete document
    html = renderedHtml
      ? wrapHtmlDocument(htmlContent, documentName, layout)
      : htmlContent;
  }

  // Prompt user for save location
  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(documentDir, `${documentName}.html`)),
    filters: {
      'HTML Files': ['html'],
      'All Files': ['*']
    }
  });

  if (!saveUri) {
    return; // User cancelled
  }

  // Save the HTML file
  await vscode.workspace.fs.writeFile(
    saveUri,
    Buffer.from(html, 'utf-8')
  );

  vscode.window.showInformationMessage(`Exported to ${saveUri.fsPath}`);
}

// ─── DOM-snapshot export (primary path) ─────────────────────────────────────

/**
 * Builds a self-contained HTML document from the actual rendered DOM snapshot
 * captured from the webview. Produces an export that looks exactly like the
 * editor's rendered view, including PlantUML diagrams and syntax-highlighted
 * code blocks.
 */
async function buildDomHtmlDocument(
  domHtml: string,
  baseDir: string,
  title: string,
  layout?: LayoutSettings,
  theme?: string,
  extensionContext?: vscode.ExtensionContext
): Promise<string> {
  const isDark = theme === 'dark' || theme === 'high-contrast';
  const themeKind = isDark ? 'dark' : 'light';

  let processedHtml = domHtml;

  // 1. Fix links: convert data-href to href so they are clickable
  processedHtml = processedHtml.replace(
    /<a([^>]*)\bdata-href=["']([^"']+)["']([^>]*)>/gi,
    (_m, before, href, after) => `<a${before}href="${href}"${after}>`
  );

  // 2. Remove contenteditable attributes (figure captions, etc.)
  processedHtml = processedHtml.replace(/ contenteditable="[^"]*"/gi, '');
  processedHtml = processedHtml.replace(/ contenteditable='[^']*'/gi, '');

  // 3. Embed PlantUML SVG images in-place
  processedHtml = await embedDomPlantumlImages(processedHtml);

  // 4. Embed local images referenced via data-original-src
  processedHtml = await embedDomLocalImages(processedHtml, baseDir);

  // 5. Read bundled webview CSS from the extension package
  let bundledCss = '';
  if (extensionContext) {
    try {
      const cssUri = vscode.Uri.joinPath(extensionContext.extensionUri, 'dist-webview', 'assets', 'index.css');
      const cssBytes = await vscode.workspace.fs.readFile(cssUri);
      bundledCss = Buffer.from(cssBytes).toString('utf-8');
    } catch (err) {
      console.warn('Could not read bundled CSS for HTML export:', err);
    }
  }

  // Calculate layout CSS for the content area
  let maxWidth = '800px';
  let margin = '0 auto';
  if (layout) {
    switch (layout.widthMode) {
      case 'compact':  maxWidth = '800px';  break;
      case 'wide':     maxWidth = '1200px'; break;
      case 'fit':      maxWidth = '100%';   break;
      case 'resizable': maxWidth = `${layout.contentWidth}px`; break;
    }
    if (layout.alignment === 'left') { margin = '0 auto 0 0'; }
  }

  const themeCssVars = isDark ? getDarkThemeCssVars() : getLightThemeCssVars();

  return `<!DOCTYPE html>
<html lang="en" data-theme="${themeKind}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${bundledCss ? `<style>\n${bundledCss}\n  </style>` : ''}
  <style>
    /* ── Standalone export overrides ── */
    /* Override CSS variables with hardcoded theme values (no --vscode-* vars available) */
    :root {${themeCssVars}
    }
    body {
      margin: 0;
      padding: 0;
    }
    /* Apply layout to the content wrapper */
    .livemark-editor-content {
      max-width: ${maxWidth};
      margin: ${margin};
      padding: 20px 40px;
      box-sizing: border-box;
    }
    /* Hide editor-only UI chrome */
    .livemark-code-block-lang-selector {
      display: none !important;
    }
    /* Remove selection / focus highlight visuals */
    .livemark-image-wrapper.selected,
    .livemark-plantuml-wrapper.selected {
      outline: none !important;
      box-shadow: none !important;
    }
    .livemark-table .selectedCell::after {
      display: none !important;
    }
    /* Links are clickable in the exported document */
    .livemark-editor-content a,
    .livemark-editor-content .livemark-link {
      cursor: pointer !important;
    }
  </style>
</head>
<body>
  <div class="livemark-editor-content">
${processedHtml}
  </div>
</body>
</html>`;
}

/**
 * Fetches each PlantUML <img class="livemark-plantuml-img"> URL and replaces
 * the src attribute with an embedded base64 SVG data URI.
 */
async function embedDomPlantumlImages(html: string): Promise<string> {
  // Match <img> tags that have livemark-plantuml-img class
  const imgRegex = /<img([^>]*\bclass="[^"]*livemark-plantuml-img[^"]*"[^>]*)>/gi;
  const matches = [...html.matchAll(imgRegex)];

  let result = html;
  for (let i = matches.length - 1; i >= 0; i--) {
    const fullTag = matches[i][0];
    const srcMatch = fullTag.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) { continue; }
    const url = srcMatch[1];
    if (url.startsWith('data:')) { continue; } // already embedded

    try {
      const svgBuffer = await fetchUrl(url);
      const base64 = svgBuffer.toString('base64');
      const newTag = fullTag.replace(/\bsrc=["'][^"']+["']/i, `src="data:image/svg+xml;base64,${base64}"`);
      const idx = matches[i].index!;
      result = result.slice(0, idx) + newTag + result.slice(idx + fullTag.length);
    } catch (err) {
      console.warn(`Could not embed PlantUML diagram from ${url}:`, err);
      // Keep the original URL — diagram still shows when online
    }
  }
  return result;
}

/**
 * Replaces vscode-webview-resource image URLs with embedded base64 data URIs.
 * Uses the data-original-src attribute to find the actual file path on disk.
 * Also handles regular local img tags without a data-original-src by checking
 * whether the src looks like a vscode resource URL.
 */
async function embedDomLocalImages(html: string, baseDir: string): Promise<string> {
  const imgRegex = /<img([^>]*)>/gi;
  const matches = [...html.matchAll(imgRegex)];

  let result = html;
  for (let i = matches.length - 1; i >= 0; i--) {
    const fullTag = matches[i][0];
    const srcMatch = fullTag.match(/\bsrc=["']([^"']+)["']/i);
    const originalSrcMatch = fullTag.match(/\bdata-original-src=["']([^"']+)["']/i);

    if (!srcMatch) { continue; }
    const srcValue = srcMatch[1];

    // Already embedded, or external URL without an original path — skip
    if (srcValue.startsWith('data:')) { continue; }
    if (!originalSrcMatch && (srcValue.startsWith('http://') || srcValue.startsWith('https://'))) { continue; }
    // PlantUML images are handled by embedDomPlantumlImages — skip
    if (fullTag.includes('livemark-plantuml-img')) { continue; }

    const originalPath = originalSrcMatch ? originalSrcMatch[1] : null;
    const filePath = originalPath || (
      srcValue.startsWith('vscode-resource') || srcValue.includes('vscode-webview')
        ? null
        : srcValue
    );
    if (!filePath) { continue; }

    try {
      const absolutePath = path.resolve(baseDir, filePath);
      const imageBuffer = await fs.readFile(absolutePath);
      const base64 = imageBuffer.toString('base64');
      const ext = path.extname(absolutePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',  '.svg': 'image/svg+xml',
        '.webp': 'image/webp', '.png': 'image/png',
      };
      const mimeType = mimeMap[ext] ?? 'image/png';
      const dataUri = `data:${mimeType};base64,${base64}`;

      let newTag = fullTag.replace(/\bsrc=["'][^"']+["']/i, `src="${dataUri}"`);
      // Remove the data-original-src attribute — no longer needed
      newTag = newTag.replace(/\s*\bdata-original-src=["'][^"']+["']/i, '');

      const idx = matches[i].index!;
      result = result.slice(0, idx) + newTag + result.slice(idx + fullTag.length);
    } catch (err) {
      console.warn(`Could not embed image ${filePath}:`, err);
    }
  }
  return result;
}

/** CSS variable overrides for light-theme standalone export. */
function getLightThemeCssVars(): string {
  return `
      --livemark-bg: #ffffff;
      --livemark-fg: #333333;
      --livemark-font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      --livemark-font-size: 14px;
      --livemark-line-height: 1.6;
      --livemark-link-color: #006ab1;
      --livemark-link-active: #005da0;
      --livemark-border: #e0e0e0;
      --livemark-selection: #add6ff;
      --livemark-code-bg: #f5f5f5;
      --livemark-code-fg: #333333;
      --livemark-blockquote-border: #007acc;
      --livemark-blockquote-bg: #f8f8f8;
      --livemark-toolbar-bg: #f3f3f3;
      --livemark-toolbar-fg: #616161;
      --livemark-toolbar-border: #e0e0e0;
      --livemark-btn-hover: #e4e4e4;
      --livemark-btn-active: #d4d4d4;
      --livemark-focus-border: #007acc;
      --livemark-scrollbar: rgba(100, 100, 100, 0.4);
      --vscode-editor-font-family: monospace;
      --vscode-editor-font-size: 13px;
      --vscode-descriptionForeground: #616161;
      --vscode-input-placeholderForeground: #a0a0a0;
      --vscode-panel-border: #e0e0e0;
      --vscode-editorGroupHeader-tabsBackground: rgba(0, 0, 0, 0.05);
      --vscode-list-hoverBackground: rgba(0, 0, 0, 0.04);
      --vscode-editorWidget-border: #cecece;
      --vscode-editorWidget-background: #f3f3f3;
      --vscode-focusBorder: #007acc;`;
}

/** CSS variable overrides for dark-theme standalone export. */
function getDarkThemeCssVars(): string {
  return `
      --livemark-bg: #1e1e1e;
      --livemark-fg: #d4d4d4;
      --livemark-font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      --livemark-font-size: 14px;
      --livemark-line-height: 1.6;
      --livemark-link-color: #3794ff;
      --livemark-link-active: #3794ff;
      --livemark-border: #3c3c3c;
      --livemark-selection: #264f78;
      --livemark-code-bg: #2d2d2d;
      --livemark-code-fg: #d4d4d4;
      --livemark-blockquote-border: #007acc;
      --livemark-blockquote-bg: #2d2d2d;
      --livemark-toolbar-bg: #252526;
      --livemark-toolbar-fg: #cccccc;
      --livemark-toolbar-border: #454545;
      --livemark-btn-hover: #3c3c3c;
      --livemark-btn-active: #505050;
      --livemark-focus-border: #007acc;
      --livemark-scrollbar: rgba(121, 121, 121, 0.4);
      --vscode-editor-font-family: monospace;
      --vscode-editor-font-size: 13px;
      --vscode-descriptionForeground: #aaaaaa;
      --vscode-input-placeholderForeground: #666666;
      --vscode-panel-border: #3c3c3c;
      --vscode-editorGroupHeader-tabsBackground: rgba(255, 255, 255, 0.05);
      --vscode-list-hoverBackground: rgba(255, 255, 255, 0.04);
      --vscode-editorWidget-border: #454545;
      --vscode-editorWidget-background: #252526;
      --vscode-focusBorder: #007acc;`;
}

/**
 * Replaces <pre data-plantuml> blocks in pre-rendered HTML with embedded SVG
 * images fetched from the provided PlantUML server URLs.
 * Blocks are matched in document order against the plantumlBlocks array.
 */
async function embedPlantumlDiagrams(
  html: string,
  plantumlBlocks: Array<{ source: string; url: string }>
): Promise<string> {
  // Match every <pre … data-plantuml … >…</pre> in document order.
  // The source text inside may contain HTML entities so we can't match by
  // content — we simply replace each occurrence in order.
  const preRegex = /<pre[^>]*\bdata-plantuml\b[^>]*>[\s\S]*?<\/pre>/gi;
  const matches = [...html.matchAll(preRegex)];

  let processedHtml = html;
  // Iterate in reverse order so that replacing one match doesn't shift the
  // indices of subsequent ones.
  for (let i = Math.min(matches.length, plantumlBlocks.length) - 1; i >= 0; i--) {
    const matchText = matches[i][0];
    const { url } = plantumlBlocks[i];

    let replacement: string;
    try {
      const svgBuffer = await fetchUrl(url);
      const base64 = svgBuffer.toString("base64");
      const dataUri = `data:image/svg+xml;base64,${base64}`;
      replacement = `<img src="${dataUri}" alt="PlantUML Diagram" style="max-width:100%;height:auto;">`;
    } catch (err) {
      console.warn(`Failed to fetch PlantUML diagram from ${url}:`, err);
      // Fall back to a live URL reference so the diagram still appears when
      // the exported file is opened with internet access.
      replacement = `<img src="${url}" alt="PlantUML Diagram" style="max-width:100%;height:auto;">`;
    }

    // Replace only this specific occurrence (safe because we go in reverse)
    const matchIndex = matches[i].index!;
    processedHtml =
      processedHtml.slice(0, matchIndex) +
      replacement +
      processedHtml.slice(matchIndex + matchText.length);
  }

  return processedHtml;
}

/**
 * Fetches an HTTP/HTTPS URL and returns the response body as a Buffer.
 */
function fetchUrl(url: string, maxRedirects: number = 5, timeoutMs: number = 15000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https://") ? https : http;
    const req = mod
      .get(url, { timeout: timeoutMs }, (res) => {
        // Follow redirects (301, 302, 307, 308)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (maxRedirects <= 0) {
            reject(new Error(`Too many redirects fetching ${url}`));
            return;
          }
          fetchUrl(res.headers.location, maxRedirects - 1, timeoutMs).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url} after ${timeoutMs}ms`));
    });
  });
}

/**
 * Embeds images as base64 data URIs in pre-rendered HTML and adds figure/figcaption.
 */
async function embedImagesInHtml(
  html: string,
  imageMap: Map<string, string>,
  baseDir: string
): Promise<string> {
  let processedHtml = html;
  
  // Fix links: convert data-href to href for clickability
  processedHtml = processedHtml.replace(/<a([^>]*)data-href=["']([^"']+)["']([^>]*)>/gi, (match, before, href, after) => {
    // Remove data-href and add href attribute
    return `<a${before}href="${href}"${after}>`;
  });
  
  // Find all img tags in the HTML - look for both src and data-original-src
  const imgRegex = /<img[^>]*>/gi;
  const matches = [...html.matchAll(imgRegex)];
  
  for (const match of matches) {
    const fullTag = match[0];
    
    // Extract data-original-src or src attribute
    const originalSrcMatch = fullTag.match(/data-original-src=["']([^"']+)["']/i);
    const srcMatch = fullTag.match(/src=["']([^"']+)["']/i);
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
    
    const originalPath = originalSrcMatch ? originalSrcMatch[1] : null;
    const srcValue = srcMatch ? srcMatch[1] : null;
    const altValue = altMatch ? altMatch[1] : '';
    
    if (!srcValue) continue;
    
    // Skip if src is already a data URI
    if (srcValue.startsWith('data:')) {
      continue;
    }
    
    // Skip external URLs (but process them if they have data-original-src)
    if ((srcValue.startsWith('http://') || srcValue.startsWith('https://')) && !originalPath) {
      continue;
    }
    
    // Determine the actual image path
    let imagePath = originalPath;
    if (!imagePath) {
      // If no originalPath and it's a vscode-resource URL, skip it
      if (srcValue.includes('vscode-resource') || srcValue.includes('vscode-webview')) {
        console.warn(`Skipping vscode URI without originalSrc: ${srcValue}`);
        continue;
      }
      // Otherwise use the src value as path
      imagePath = srcValue;
    }
    
    // Get or create data URI for this image
    let dataUri = imageMap.get(imagePath);
    if (!dataUri) {
      // Try to load the image
      try {
        const absolutePath = path.resolve(baseDir, imagePath);
        const imageBuffer = await fs.readFile(absolutePath);
        const base64Data = imageBuffer.toString('base64');
        const ext = path.extname(absolutePath).toLowerCase();
        
        let mimeType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') {
          mimeType = 'image/jpeg';
        } else if (ext === '.gif') {
          mimeType = 'image/gif';
        } else if (ext === '.svg') {
          mimeType = 'image/svg+xml';
        } else if (ext === '.webp') {
          mimeType = 'image/webp';
        }
        
        dataUri = `data:${mimeType};base64,${base64Data}`;
        imageMap.set(imagePath, dataUri);
      } catch (error) {
        console.warn(`Failed to embed image ${imagePath}:`, error);
        continue;
      }
    }
    
    // Replace the src attribute with data URI and remove data-original-src
    let newTag = fullTag.replace(/src=["']([^"']+)["']/i, `src="${dataUri}"`);
    // Remove data-original-src attribute
    newTag = newTag.replace(/\s*data-original-src=["']([^"']+)["']/i, '');
    
    // Wrap in figure with figcaption if there's an alt text
    if (altValue) {
      const figureTag = `<figure class="livemark-image-figure">${newTag}<figcaption class="livemark-image-caption">${escapeHtml(altValue)}</figcaption></figure>`;
      processedHtml = processedHtml.replace(fullTag, figureTag);
    } else {
      processedHtml = processedHtml.replace(fullTag, newTag);
    }
  }
  
  return processedHtml;
}

/**
 * Generates body CSS for layout settings matching the editor's rendered view.
 */
function getLayoutCss(layout?: LayoutSettings): string {
  let maxWidth = '800px';
  let margin = '0 auto';

  if (layout) {
    switch (layout.widthMode) {
      case 'compact':
        maxWidth = '800px';
        break;
      case 'wide':
        maxWidth = '1200px';
        break;
      case 'fit':
        maxWidth = '100%';
        break;
      case 'resizable':
        maxWidth = `${layout.contentWidth}px`;
        break;
    }

    if (layout.alignment === 'left') {
      margin = '0 auto 0 0';
    }
  }

  return `max-width: ${maxWidth};\n      margin: ${margin};`;
}

/**
 * Wraps HTML content in a complete HTML document with styling.
 */
function wrapHtmlDocument(htmlContent: string, title: string, layout?: LayoutSettings): string {
  const layoutCss = getLayoutCss(layout);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      ${layoutCss}
      padding: 20px;
      color: #333;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    figure.livemark-image-figure {
      margin: 1em 0;
      text-align: center;
    }
    figure.livemark-image-figure img {
      display: block;
      margin: 0 auto;
    }
    figcaption.livemark-image-caption {
      margin-top: 0.5em;
      font-size: 0.9em;
      color: #666;
      font-style: italic;
      text-align: center;
    }
    pre {
      background: #f4f4f4;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', Courier, monospace;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin: 0;
      padding-left: 20px;
      color: #666;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 15px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background: #f4f4f4;
      font-weight: bold;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1em; }
    h5 { font-size: 0.875em; }
    h6 { font-size: 0.85em; color: #6a737d; }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    ul, ol {
      padding-left: 2em;
    }
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 24px 0;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
}

/**
 * Extracts image references from TipTap JSON structure.
 */
async function extractImageReferencesFromJson(
  jsonString: string,
  baseDir: string
): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  
  try {
    const json = JSON.parse(jsonString);
    
    // Recursively walk the JSON tree to find image nodes
    const findImages = (node: any) => {
      if (node.type === 'image' && node.attrs) {
        const originalSrc = node.attrs.originalSrc;
        if (originalSrc && !originalSrc.startsWith('http://') && !originalSrc.startsWith('https://') && !originalSrc.startsWith('data:')) {
          addImageToMap(originalSrc, baseDir, imageMap);
        }
      }
      
      if (node.content && Array.isArray(node.content)) {
        for (const child of node.content) {
          findImages(child);
        }
      }
    };
    
    findImages(json);
    
    // Wait for all images to be processed
    await Promise.all(Array.from(imageMap.keys()).map(async (key) => {
      if (!imageMap.get(key)) {
        await addImageToMap(key, baseDir, imageMap);
      }
    }));
  } catch (error) {
    console.error('Failed to parse editor JSON:', error);
  }
  
  return imageMap;
}

/**
 * Extracts all image references from the markdown content.
 */
async function extractImageReferences(
  markdown: string,
  baseDir: string
): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>();
  
  // Match markdown image syntax: ![alt](path) and <img src="path">
  const markdownImageRegex = /!\[.*?\]\(([^)]+)\)/g;
  const htmlImageRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  
  let match;
  
  // Extract markdown-style images
  while ((match = markdownImageRegex.exec(markdown)) !== null) {
    const imagePath = match[1].split(' ')[0]; // Remove title if present
    if (!imagePath.startsWith('http://') && !imagePath.startsWith('https://') && !imagePath.startsWith('data:')) {
      await addImageToMap(imagePath, baseDir, imageMap);
    }
  }
  
  // Extract HTML-style images
  while ((match = htmlImageRegex.exec(markdown)) !== null) {
    const imagePath = match[1];
    if (!imagePath.startsWith('http://') && !imagePath.startsWith('https://') && !imagePath.startsWith('data:')) {
      await addImageToMap(imagePath, baseDir, imageMap);
    }
  }
  
  return imageMap;
}

/**
 * Adds an image to the map with its base64 data URI.
 */
async function addImageToMap(
  relativePath: string,
  baseDir: string,
  imageMap: Map<string, string>
): Promise<void> {
  try {
    const absolutePath = path.resolve(baseDir, relativePath);
    const imageBuffer = await fs.readFile(absolutePath);
    const base64Data = imageBuffer.toString('base64');
    const ext = path.extname(absolutePath).toLowerCase();
    
    // Determine MIME type
    let mimeType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === '.gif') {
      mimeType = 'image/gif';
    } else if (ext === '.svg') {
      mimeType = 'image/svg+xml';
    } else if (ext === '.webp') {
      mimeType = 'image/webp';
    }
    
    const dataUri = `data:${mimeType};base64,${base64Data}`;
    imageMap.set(relativePath, dataUri);
  } catch (error) {
    console.warn(`Failed to embed image ${relativePath}:`, error);
  }
}

/**
 * Converts markdown to HTML with embedded images.
 * Uses a simple approach with marked-style conversion.
 */
async function convertMarkdownToHtml(
  markdown: string,
  imageMap: Map<string, string>,
  title: string,
  layout?: LayoutSettings
): Promise<string> {
  // Replace image paths with data URIs
  let processedMarkdown = markdown;
  
  for (const [originalPath, dataUri] of imageMap.entries()) {
    // Escape special regex characters in the path
    const escapedPath = originalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Replace in markdown syntax
    const markdownRegex = new RegExp(`(!\\[.*?\\]\\()${escapedPath}(\\s*[^)]*\\))`, 'g');
    processedMarkdown = processedMarkdown.replace(markdownRegex, `$1${dataUri}$2`);
    
    // Replace in HTML img tags
    const htmlRegex = new RegExp(`(<img[^>]+src=["'])${escapedPath}(["'][^>]*>)`, 'gi');
    processedMarkdown = processedMarkdown.replace(htmlRegex, `$1${dataUri}$2`);
  }
  
  // Convert markdown to HTML using a simple conversion
  // For production use, we'd use a proper markdown library like marked or remark
  const htmlContent = simpleMarkdownToHtml(processedMarkdown);
  
  // Wrap in a complete HTML document
  const layoutCss = getLayoutCss(layout);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      ${layoutCss}
      padding: 20px;
      color: #333;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    figure.livemark-image-figure {
      margin: 1em 0;
      text-align: center;
    }
    figure.livemark-image-figure img {
      display: block;
      margin: 0 auto;
    }
    figcaption.livemark-image-caption {
      margin-top: 0.5em;
      font-size: 0.9em;
      color: #666;
      font-style: italic;
      text-align: center;
    }
    pre {
      background: #f4f4f4;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', Courier, monospace;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin: 0;
      padding-left: 20px;
      color: #666;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 15px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background: #f4f4f4;
      font-weight: bold;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 24px;
      margin-bottom: 16px;
      font-weight: 600;
      line-height: 1.25;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1em; }
    h5 { font-size: 0.875em; }
    h6 { font-size: 0.85em; color: #6a737d; }
    a {
      color: #0366d6;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    ul, ol {
      padding-left: 2em;
    }
    hr {
      border: none;
      border-top: 1px solid #ddd;
      margin: 24px 0;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
}

/**
 * Simple markdown to HTML converter.
 * This is a basic implementation - in production you'd want to use a library like marked or remark-rehype.
 */
function simpleMarkdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Convert headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  
  // Convert bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // Convert italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Convert strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  
  // Convert inline code (but not in code blocks)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Convert code blocks
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code>${escapeHtml(code)}</code></pre>`;
  });
  
  // Convert images (already processed with data URIs)
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  
  // Convert links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  // Convert horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^\*\*\*$/gm, '<hr>');
  
  // Convert blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  
  // Convert unordered lists
  html = html.replace(/^\s*[\*\-\+]\s+(.+)$/gm, '<li>$1</li>');
  
  // Wrap consecutive <li> tags in <ul>
  html = html.replace(/(<li>.*?<\/li>\s*)+/gs, (match) => {
    return `<ul>${match}</ul>`;
  });
  
  // Convert ordered lists
  html = html.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');
  
  // Convert paragraphs (lines separated by blank lines)
  const lines = html.split('\n');
  const result: string[] = [];
  let inParagraph = false;
  let paragraphLines: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip if it's already an HTML tag
    if (line.startsWith('<')) {
      if (inParagraph && paragraphLines.length > 0) {
        result.push(`<p>${paragraphLines.join(' ')}</p>`);
        paragraphLines = [];
        inParagraph = false;
      }
      result.push(line);
    } else if (line === '') {
      if (inParagraph && paragraphLines.length > 0) {
        result.push(`<p>${paragraphLines.join(' ')}</p>`);
        paragraphLines = [];
        inParagraph = false;
      }
    } else {
      inParagraph = true;
      paragraphLines.push(line);
    }
  }
  
  // Close any remaining paragraph
  if (inParagraph && paragraphLines.length > 0) {
    result.push(`<p>${paragraphLines.join(' ')}</p>`);
  }
  
  return result.join('\n');
}

/**
 * Escapes HTML special characters.
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
