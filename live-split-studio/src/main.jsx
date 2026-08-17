import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Editor from '@monaco-editor/react';
import './styles.css';

const languageFor = (file='') => {
  const ext = file.split('.').pop()?.toLowerCase();
  return ({html:'html',htm:'html',css:'css',js:'javascript',mjs:'javascript',cjs:'javascript',json:'json',ts:'typescript',tsx:'typescript',jsx:'javascript',php:'php',xml:'xml',svg:'xml',md:'markdown',yml:'yaml',yaml:'yaml',scss:'scss',less:'less'})[ext] || 'plaintext';
};
const minifiable = (file='') => /\.(html?|css|js|mjs|cjs)$/i.test(file);
const formatBytes = n => n < 1024 ? `${n} o` : n < 1024*1024 ? `${(n/1024).toFixed(1)} Ko` : `${(n/1024/1024).toFixed(1)} Mo`;

function Tree({ nodes, selected, onOpen, depth=0 }) {
  const [open, setOpen] = useState({});
  return <div>{nodes.map(node => node.type === 'directory' ? (
    <div key={node.path}>
      <button className="tree-row folder" style={{paddingLeft: 10 + depth*14}} onClick={()=>setOpen(v=>({...v,[node.path]:!v[node.path]}))}>
        <span>{open[node.path] ? '▾' : '▸'}</span><span>📁</span><span>{node.name}</span>
      </button>
      {open[node.path] && <Tree nodes={node.children||[]} selected={selected} onOpen={onOpen} depth={depth+1}/>} 
    </div>
  ) : (
    <button key={node.path} className={'tree-row file ' + (selected===node.path?'active':'')} style={{paddingLeft: 28 + depth*14}} onClick={()=>node.editable && onOpen(node)} title={node.path}>
      <span className="file-icon">{node.editable ? '•' : '◦'}</span><span>{node.name}</span>
    </button>
  ))}</div>;
}

function App(){
  const [project,setProject]=useState(null);
  const [tree,setTree]=useState([]);
  const [file,setFile]=useState(null);
  const [content,setContent]=useState('');
  const [savedContent,setSavedContent]=useState('');
  const [mode,setMode]=useState('split');
  const [device,setDevice]=useState('desktop');
  const [autoSave,setAutoSave]=useState(true);
  const [status,setStatus]=useState('Aucun projet ouvert');
  const [previewNonce,setPreviewNonce]=useState(0);
  const [busy,setBusy]=useState(false);
  const [canRestore,setCanRestore]=useState(false);
  const saveTimer=useRef(null);

  const dirty = file && content !== savedContent;
  const previewPath = useMemo(()=> {
    if(!project) return '';
    const htmlFile = file && /\.html?$/i.test(file) ? file : 'index.html';
    return `${project.previewBase}/${htmlFile}?studio=${previewNonce}`;
  },[project,file,previewNonce]);

  function findFirst(nodes,pred){ for(const n of nodes){ if(pred(n)) return n; if(n.children){ const r=findFirst(n.children,pred); if(r) return r; } } return null; }

  async function openHtmlFile(){
    const p=await window.studio.openHtmlFile();
    if(!p) return;
    setProject(p); setTree(p.tree); setCanRestore(false);
    if(p.selectedFile){
      setFile(p.selectedFile); setContent(p.selectedContent ?? ''); setSavedContent(p.selectedContent ?? ''); setStatus(`Fichier : ${p.selectedFile}`);
    }
  }

  async function openProject(){
    const p=await window.studio.openProject();
    if(!p) return;
    setProject(p); setTree(p.tree); setFile(null); setContent(''); setSavedContent(''); setCanRestore(false); setStatus(`Projet : ${p.name}`);
    const firstHtml=findFirst(p.tree, n=>n.type==='file' && /(^|\/)index\.html?$/i.test(n.path)) || findFirst(p.tree,n=>n.type==='file' && /\.html?$/i.test(n.path));
    if(firstHtml) await openFile(firstHtml);
  }

  async function openFile(node){
    if(dirty) await saveNow();
    const text=await window.studio.readFile(node.path);
    setFile(node.path); setContent(text); setSavedContent(text); setStatus(node.path);
  }

  async function reloadCurrent(){
    if(!file) return;
    const text=await window.studio.readFile(file);
    setContent(text); setSavedContent(text);
  }

  async function saveNow(){
    if(!file || content===savedContent) return;
    await window.studio.writeFile(file,content); setSavedContent(content); setStatus(`Enregistré — ${file}`); setPreviewNonce(n=>n+1);
  }

  async function minifyCurrent(){
    if(!file || !minifiable(file) || busy) return;
    if(dirty) await saveNow();
    setBusy(true); setStatus(`Minification de ${file}…`);
    try {
      const r=await window.studio.minifyFile(file);
      setContent(r.content); setSavedContent(r.content); setCanRestore(true); setPreviewNonce(n=>n+1);
      const gain=r.before ? Math.max(0, Math.round((1-r.after/r.before)*100)) : 0;
      setStatus(`Minifié — ${file} : ${formatBytes(r.before)} → ${formatBytes(r.after)} (${gain}% de réduction)`);
    } catch(e) { setStatus(`Erreur de minification : ${e.message || e}`); }
    finally { setBusy(false); }
  }

  async function minifySite(){
    if(!project || busy) return;
    if(dirty) await saveNow();
    setBusy(true); setStatus('Minification de tout le site…');
    try {
      const r=await window.studio.minifySite();
      setCanRestore(!!r.backupAvailable); await reloadCurrent(); setPreviewNonce(n=>n+1);
      const gain=r.before ? Math.max(0, Math.round((1-r.after/r.before)*100)) : 0;
      setStatus(`Site minifié — ${r.count}/${r.total} fichiers, ${formatBytes(r.before)} → ${formatBytes(r.after)} (${gain}% de réduction)${r.failures?.length ? ` — ${r.failures.length} erreur(s)` : ''}`);
    } catch(e) { setStatus(`Erreur de minification : ${e.message || e}`); }
    finally { setBusy(false); }
  }

  async function restoreLast(){
    if(!canRestore || busy) return;
    setBusy(true); setStatus('Restauration de la dernière minification…');
    try {
      const r=await window.studio.restoreLastMinify();
      if(!r.ok) throw new Error(r.reason || 'Restauration impossible');
      setCanRestore(false); await reloadCurrent(); setPreviewNonce(n=>n+1); setStatus(`Dernière minification annulée — ${r.restored} fichier(s) restauré(s)`);
    } catch(e) { setStatus(`Erreur de restauration : ${e.message || e}`); }
    finally { setBusy(false); }
  }

  useEffect(()=>{
    if(!autoSave || !dirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(saveNow,450);
    return()=>clearTimeout(saveTimer.current);
  },[content,autoSave,file]);

  useEffect(()=>{
    const fn=(e)=>{ if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveNow();} };
    window.addEventListener('keydown',fn); return()=>window.removeEventListener('keydown',fn);
  });

  const previewWidth = device==='desktop' ? '100%' : device==='tablet' ? '820px' : '390px';
  return <div className="app">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">LS</span><strong>Live Split Studio</strong></div>
      <button className="primary" onClick={openHtmlFile} disabled={busy}>Ouvrir HTML</button>
      <button className="ghost" onClick={openProject} disabled={busy}>Ouvrir un dossier</button>
      <div className="segmented">
        <button className={mode==='code'?'on':''} onClick={()=>setMode('code')}>Code</button>
        <button className={mode==='split'?'on':''} onClick={()=>setMode('split')}>Split</button>
        <button className={mode==='live'?'on':''} onClick={()=>setMode('live')}>Live</button>
      </div>
      <div className="segmented compact">
        <button className={device==='desktop'?'on':''} onClick={()=>setDevice('desktop')}>Desktop</button>
        <button className={device==='tablet'?'on':''} onClick={()=>setDevice('tablet')}>Tablet</button>
        <button className={device==='mobile'?'on':''} onClick={()=>setDevice('mobile')}>Mobile</button>
      </div>
      <label className="autosave"><input type="checkbox" checked={autoSave} onChange={e=>setAutoSave(e.target.checked)}/> Live save</label>
      <button className="ghost" disabled={!dirty || busy} onClick={saveNow}>Enregistrer</button>
      <div className="divider"/>
      <button className="minify" disabled={!file || !minifiable(file) || busy} onClick={minifyCurrent}>Minifier fichier</button>
      <button className="minify" disabled={!project || busy} onClick={minifySite}>Minifier site</button>
      <button className="ghost" disabled={!canRestore || busy} onClick={restoreLast}>Annuler minification</button>
    </header>

    <main className="workspace">
      <aside className="sidebar">
        <div className="side-title">FICHIERS</div>
        {project ? <Tree nodes={tree} selected={file} onOpen={openFile}/> : <div className="empty-small">Ouvrez directement un fichier HTML, ou le dossier complet du site.</div>}
      </aside>

      <section className={'panes mode-'+mode}>
        {(mode==='code'||mode==='split') && <div className="editor-pane">
          <div className="pane-head"><span>{file || 'Aucun fichier'}</span>{dirty && <span className="dirty">● modifié</span>}</div>
          {file ? <Editor height="100%" language={languageFor(file)} value={content} onChange={v=>setContent(v??'')} theme="vs-dark" options={{fontSize:14,minimap:{enabled:false},automaticLayout:true,wordWrap:'on',tabSize:2,insertSpaces:true,smoothScrolling:true,formatOnPaste:true}}/> : <div className="empty">Sélectionnez un fichier éditable.</div>}
        </div>}

        {(mode==='live'||mode==='split') && <div className="preview-pane">
          <div className="pane-head preview-head"><span>LIVE PREVIEW</span><button onClick={()=>setPreviewNonce(n=>n+1)}>↻ Recharger</button></div>
          <div className="preview-stage">
            {project ? <iframe title="Live preview" key={previewNonce} src={previewPath} style={{width:previewWidth}}/> : <div className="empty">Le rendu apparaîtra ici.</div>}
          </div>
        </div>}
      </section>
    </main>
    <footer className="statusbar"><span>{busy ? '● ' : ''}{status}</span><span>{file ? languageFor(file).toUpperCase() : ''}</span></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);