import * as vscode from "vscode";
import * as path from "path";
import { getImageSaveFolder, getImageNamePattern } from "./config";

export async function deleteImageFromDisk(
  documentUri: vscode.Uri,
  imagePath: string
): Promise<void> {
  const docDir = path.dirname(documentUri.fsPath);
  const absolutePath = path.resolve(docDir, imagePath);
  const fileUri = vscode.Uri.file(absolutePath);

  try {
    await vscode.workspace.fs.stat(fileUri);
    await vscode.workspace.fs.delete(fileUri);
  } catch {
    throw new Error(`Image file not found: ${imagePath}`);
  }
}

/**
 * Compute the absolute save path and a document-relative path for a new image.
 * Shared by `generateImagePath` (preview only) and `saveImage` (actual write).
 */
function computeImagePaths(
  documentUri: vscode.Uri,
  originalFileName: string
): { absolutePath: string; relativePath: string } {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  const baseDir = workspaceFolder
    ? workspaceFolder.uri.fsPath
    : path.dirname(documentUri.fsPath);

  const saveFolder = getImageSaveFolder();
  const mdFileDir = path.relative(baseDir, path.dirname(documentUri.fsPath));
  const resolvedFolder = saveFolder.replace("{mdfilepath}", mdFileDir);
  const saveDirPath = path.join(baseDir, resolvedFolder);

  // Generate file name
  const ext = path.extname(originalFileName) || ".png";
  const namePattern = getImageNamePattern();
  const timestamp = Date.now().toString();
  const docName = path.basename(documentUri.fsPath, path.extname(documentUri.fsPath));
  const baseName = namePattern
    .replace("{timestamp}", timestamp)
    .replace("{original}", path.basename(originalFileName, ext))
    .replace("{hash}", timestamp.slice(-8))
    .replace("{mdfilename}", docName);

  const fileName = baseName + ext;
  const absolutePath = path.join(saveDirPath, fileName);
  const docDir = path.dirname(documentUri.fsPath);
  const relativePath = path.relative(docDir, absolutePath).replace(/\\/g, "/");

  return { absolutePath, relativePath };
}

export function generateImagePath(
  documentUri: vscode.Uri,
  originalFileName: string
): string {
  return computeImagePaths(documentUri, originalFileName).relativePath;
}

export async function saveImage(
  documentUri: vscode.Uri,
  base64Data: string,
  originalFileName: string
): Promise<string> {
  const { absolutePath, relativePath } = computeImagePaths(documentUri, originalFileName);

  // Ensure directory exists
  await vscode.workspace.fs.createDirectory(
    vscode.Uri.file(path.dirname(absolutePath))
  );

  // Decode base64 and write
  const buffer = Buffer.from(base64Data, "base64");
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(absolutePath),
    new Uint8Array(buffer)
  );

  return relativePath;
}

export async function saveImageWithPath(
  documentUri: vscode.Uri,
  base64Data: string,
  userProvidedPath: string
): Promise<string> {
  const docDir = path.dirname(documentUri.fsPath);
  const absolutePath = path.resolve(docDir, userProvidedPath);
  const dirPath = path.dirname(absolutePath);

  // Ensure directory exists
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirPath));

  // Decode base64 and write
  const buffer = Buffer.from(base64Data, "base64");
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(absolutePath),
    new Uint8Array(buffer)
  );

  // Return path relative to document
  return path.relative(docDir, absolutePath).replace(/\\/g, "/");
}
