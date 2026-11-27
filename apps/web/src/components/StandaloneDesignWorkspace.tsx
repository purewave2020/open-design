'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import type { ProjectFile } from '../types';
import { FileViewer } from './FileViewer';
import { IframeKeepAliveProvider } from './IframeKeepAlivePool';
import { SketchEditor } from './SketchEditor';
import styles from './StandaloneDesignWorkspace.module.css';
import {
  emptySketchScene,
  parseSketchWorkspaceDocument,
  serializeExcalidrawSketchScene,
  type ExcalidrawSketchScene,
} from './sketch-model';

const STANDALONE_PROJECT_ID = 'standalone-design';

const STARTER_HTML = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Open Design</title>
    <style>
      body { margin: 0; padding: 48px; font-family: system-ui, sans-serif; background: #f4f7fb; color: #17243b; }
      main { max-width: 760px; margin: 0 auto; padding: 48px; border: 1px solid #dfe4ec; border-radius: 18px; background: white; }
      h1 { margin-top: 0; font-size: 42px; }
      p { color: #60718d; line-height: 1.7; }
    </style>
  </head>
  <body><main><h1>上传一个 HTML 文件开始编辑</h1><p>预览、代码、评论、标注和手动编辑都由 Open Design 的文件查看器提供。</p></main></body>
</html>`;

type LocalEntry = {
  file: ProjectFile;
  text?: string;
  blobUrl?: string;
  sketch?: ExcalidrawSketchScene;
};

function projectFile(name: string, kind: ProjectFile['kind'], size: number, mime: string): ProjectFile {
  return {
    name,
    path: name,
    type: 'file',
    size,
    mtime: Date.now(),
    kind,
    mime,
  };
}

function classifyFile(file: File): ProjectFile['kind'] {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'html' || extension === 'htm') return 'html';
  if (file.name.endsWith('.sketch.json')) return 'sketch';
  if (extension === 'pdf' || file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/')) return 'image';
  if (['doc', 'docx'].includes(extension)) return 'document';
  if (['ppt', 'pptx'].includes(extension)) return 'presentation';
  if (['xls', 'xlsx'].includes(extension)) return 'spreadsheet';
  if (['css', 'js', 'jsx', 'ts', 'tsx', 'json'].includes(extension)) return 'code';
  if (['md', 'markdown', 'txt', 'csv', 'xml', 'yaml', 'yml'].includes(extension)) return 'text';
  return 'binary';
}

function fileIcon(kind: ProjectFile['kind']): string {
  return {
    html: 'HTML',
    sketch: 'SK',
    image: 'IMG',
    pdf: 'PDF',
    document: 'DOC',
    presentation: 'PPT',
    spreadsheet: 'XLS',
    code: '</>',
    text: 'TXT',
    binary: 'BIN',
    video: 'VID',
    audio: 'AUD',
  }[kind];
}

function downloadText(name: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function LocalDocumentViewer({ entry }: { entry: LocalEntry }) {
  if (entry.file.kind === 'image' && entry.blobUrl) {
    return <img className={styles.documentImage} src={entry.blobUrl} alt={entry.file.name} />;
  }
  if (entry.file.kind === 'pdf' && entry.blobUrl) {
    return <iframe className={styles.documentFrame} src={entry.blobUrl} title={entry.file.name} />;
  }
  return (
    <div className={styles.documentCard}>
      <h2>{entry.file.name}</h2>
      <p>该文件可以下载或切换回文件列表继续编辑。</p>
      <pre>{entry.text || '当前文件类型没有可直接显示的文本内容。'}</pre>
    </div>
  );
}

export function StandaloneDesignWorkspace() {
  const starter = useMemo<LocalEntry>(() => ({
    file: projectFile('index.html', 'html', new Blob([STARTER_HTML]).size, 'text/html'),
    text: STARTER_HTML,
  }), []);
  const [entries, setEntries] = useState<LocalEntry[]>([starter]);
  const [activeName, setActiveName] = useState(starter.file.name);
  const [refreshKey, setRefreshKey] = useState(0);

  const active = entries.find((entry) => entry.file.name === activeName) ?? entries[0] ?? null;

  async function addFiles(files: FileList | File[]): Promise<void> {
    const nextEntries = [...entries];
    let nextActiveName = activeName;
    for (const source of Array.from(files)) {
      const kind = classifyFile(source);
      const text = ['html', 'sketch', 'code', 'text'].includes(kind)
        ? await source.text()
        : undefined;
      const sketch = kind === 'sketch'
        ? parseSketchWorkspaceDocument(text ?? '').scene
        : undefined;
      const blobUrl = text === undefined ? URL.createObjectURL(source) : undefined;
      const next: LocalEntry = {
        file: projectFile(source.name, kind, source.size, source.type || 'application/octet-stream'),
        text,
        blobUrl,
        sketch,
      };
      const existingIndex = nextEntries.findIndex((entry) => entry.file.name === next.file.name);
      if (existingIndex >= 0) nextEntries[existingIndex] = next;
      else nextEntries.push(next);
      nextActiveName = next.file.name;
    }
    setEntries(nextEntries);
    setActiveName(nextActiveName);
    setRefreshKey((value) => value + 1);
  }

  function onFileInput(event: ChangeEvent<HTMLInputElement>): void {
    if (event.currentTarget.files) void addFiles(event.currentTarget.files);
    event.currentTarget.value = '';
  }

  function updateSketch(scene: ExcalidrawSketchScene): void {
    setEntries((current) => current.map((entry) => (
      entry.file.name === activeName
        ? { ...entry, sketch: scene, text: serializeExcalidrawSketchScene(scene, entry.file.name) }
        : entry
    )));
  }

  function saveSketch(scene?: ExcalidrawSketchScene): boolean {
    if (!active || active.file.kind !== 'sketch') return false;
    const nextScene = scene ?? active.sketch ?? emptySketchScene(active.file.name);
    updateSketch(nextScene);
    downloadText(
      active.file.name,
      serializeExcalidrawSketchScene(nextScene, active.file.name),
      'application/json',
    );
    return true;
  }

  function exportSketchImage(base64: string, fileName: string): boolean {
    const anchor = document.createElement('a');
    anchor.href = base64;
    anchor.download = fileName;
    anchor.click();
    return true;
  }

  const files = entries.map((entry) => entry.file);

  return (
    <IframeKeepAliveProvider>
      <div className={styles.workspace}>
        <header className={styles.header}>
          <div>
            <strong>设计文件</strong>
            <span>独立工作区</span>
          </div>
          <label className={styles.upload}>
            上传文件
            <input type="file" multiple onChange={onFileInput} />
          </label>
        </header>

        <div className={styles.layout}>
          <aside className={styles.files} aria-label="设计文件列表">
            <div className={styles.filesHead}>
              <span>项目文件</span>
              <span>{files.length}</span>
            </div>
            {entries.map((entry) => (
              <button
                key={entry.file.name}
                type="button"
                className={entry.file.name === activeName ? styles.isActive : ''}
                onClick={() => setActiveName(entry.file.name)}
              >
                <span className={styles.fileIcon}>{fileIcon(entry.file.kind)}</span>
                <span>{entry.file.name}</span>
              </button>
            ))}
          </aside>

          <main className={styles.surface}>
            {active?.file.kind === 'html' && active.text !== undefined ? (
              <FileViewer
                projectId={STANDALONE_PROJECT_ID}
                projectKind="prototype"
                file={active.file}
                liveHtml={active.text}
                filesRefreshKey={refreshKey}
                isDeck={false}
                streaming={false}
                workspaceActive
                onFileSaved={() => {}}
              />
            ) : null}
            {active?.file.kind === 'sketch' ? (
              <SketchEditor
                fileName={active.file.name}
                scene={active.sketch ?? emptySketchScene(active.file.name)}
                onSceneChange={updateSketch}
                onSave={saveSketch}
                onExportImage={exportSketchImage}
                saving={false}
                dirty={false}
                savedAt={undefined}
              />
            ) : null}
            {active && active.file.kind !== 'html' && active.file.kind !== 'sketch' ? (
              <div className={styles.documentViewer}>
                <LocalDocumentViewer entry={active} />
                <button
                  type="button"
                  className={styles.documentDownload}
                  onClick={() => {
                    if (active.blobUrl) window.open(active.blobUrl, '_blank');
                    else downloadText(active.file.name, active.text ?? '', active.file.mime);
                  }}
                >
                  下载 / 打开文件
                </button>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </IframeKeepAliveProvider>
  );
}
