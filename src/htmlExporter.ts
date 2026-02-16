import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";

interface ImageReference {
  path: string;
  absolutePath: string;
}

/**
 * Exports a markdown document as a self-contained HTML file with embedded images.
 * Can optionally use pre-rendered HTML from the Livemark editor.
 */
export async function exportAsHtml(
  document: vscode.TextDocument,
  renderedHtml?: string,
  editorJson?: string
): Promise<void> {
  const markdownContent = document.getText();
  const documentDir = path.dirname(document.uri.fsPath);
  const documentName = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath));

  // Find all image references in markdown or editor JSON
  const imageRefs = editorJson 
    ? await extractImageReferencesFromJson(editorJson, documentDir)
    : await extractImageReferences(markdownContent, documentDir);

  // Convert markdown to HTML with embedded images
  let htmlContent: string;
  if (renderedHtml) {
    // Use the pre-rendered HTML from Livemark editor and embed images
    htmlContent = await embedImagesInHtml(renderedHtml, imageRefs, documentDir);
  } else {
    // Fall back to simple markdown conversion
    htmlContent = await convertMarkdownToHtml(markdownContent, imageRefs, documentName);
  }

  // For pre-rendered HTML, we need to wrap it in a complete document
  const html = renderedHtml 
    ? wrapHtmlDocument(htmlContent, documentName)
    : htmlContent;

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

/**
 * Embeds images as base64 data URIs in pre-rendered HTML.
 */
async function embedImagesInHtml(
  html: string,
  imageMap: Map<string, string>,
  baseDir: string
): Promise<string> {
  let processedHtml = html;
  
  // Find all img tags in the HTML - look for both src and data-original-src
  const imgRegex = /<img[^>]*>/gi;
  const matches = [...html.matchAll(imgRegex)];
  
  for (const match of matches) {
    const fullTag = match[0];
    
    // Extract data-original-src or src attribute
    const originalSrcMatch = fullTag.match(/data-original-src=["']([^"']+)["']/i);
    const srcMatch = fullTag.match(/src=["']([^"']+)["']/i);
    
    const originalPath = originalSrcMatch ? originalSrcMatch[1] : null;
    const srcValue = srcMatch ? srcMatch[1] : null;
    
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
    
    processedHtml = processedHtml.replace(fullTag, newTag);
  }
  
  return processedHtml;
}

/**
 * Wraps HTML content in a complete HTML document with styling.
 */
function wrapHtmlDocument(htmlContent: string, title: string): string {
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
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    img {
      max-width: 100%;
      height: auto;
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
  title: string
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
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    img {
      max-width: 100%;
      height: auto;
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
