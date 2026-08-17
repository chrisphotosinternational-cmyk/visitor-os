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
const escapeRegex = s => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
  const [inspectMode,setInspectMode]=useState(true);
  const [status,setStatus]=useState('Aucun projet ouvert');
  const [previewNonce,setPreviewNonce]=useState(0);
  const [busy,setBusy]=useState(false);
  const [canRestore,setCanRestore]=useState(false);
  const saveTimer=useRef(null);
  const editorRef=useRef(null);
  const iframeRef=useRef(null);

  const dirty = file && content !== savedContent;
  const previewPath = useMemo(()=> {
    if(!project) return '';
    const htmlFile = file && /\.html?$/i.test(file) ? file : 'index.html';
    return `${project.previewBase}/${htmlFile}?studio=${previewNonce}`;
  },[project,file,previewNonce]);

  function findFirst(nodes,pred){ for(const n of nodes){ if(pred(n)) return n; if(n.children){ const r=findFirst(n.children,pred); if(r) return r; } } return null; }
  function findByPath(nodes,target){ for(const n of nodes){ if(n.path===target) return n; if(n.children){ const r=findByPath(n.children,target); if(r) return r; } } return null; }

  function locateElementInSource(text, data){
    const candidates=[];
    const attr=(name,value)=>{
      if(!value) return;
      const re=new RegExp(`\\b${name}\\s*=\\s*["']${escapeRegex(value)}["']`,'i');
      const m=re.exec(text);
      if(m) candidates.push(m.index);
    };
    attr('id',data.id);
    attr('src',data.src);
    attr('href',data.href);
    attr('alt',data.alt);
    attr('name',data.name);

    if(data.className){
      const token=String(data.className).split(/\s+/).find(Boolean);
      if(token){
        const re=new RegExp(`\\bclass\\s*=\\s*["'][^"']*\\b${escapeRegex(token)}\\b[^"']*["']`,'i');
        const m=re.exec(text); if(m) candidates.push(m.index);
      }
    }

    if(!candidates.length && data.text){
      const piece=String(data.text).slice(0,60).trim();
      if(piece){ const i=text.indexOf(piece); if(i>=0) candidates.push(i); }
    }

    if(!candidates.length && data.tag){
      const re=new RegExp(`<${escapeRegex(data.tag)}\\b`,'i');
      const m=re.exec(text); if(m) candidates.push(m.index);
    }

    if(!candidates.length) return null;
    const anchor=Math.min(...candidates);
    let start=text.lastIndexOf('<',anchor);
    if(start<0) start=anchor;
    let end=text.indexOf('>',Math.max(start,anchor));
    if(end<0) end=Math.min(text.length,start+1); else end+=1;
    return {start,end};
  }

  function selectSourceRange(text,data){
    const editor=editorRef.current;
    const model=editor?.getModel();
    if(!editor || !model) return false;
    const range=locateElementInSource(text,data);
    if(!range) return false;
    const a=model.getPositionAt(range.start);
    const b=model.getPositionAt(range.end);
    editor.setSelection({startLineNumber:a.lineNumber,startColumn:a.column,endLineNumber:b.lineNumber,endColumn:b.column});
    editor.revealRangeInCenter({startLineNumber:a.lineNumber,startColumn:a.column,endLineNumber:b.lineNumber,endColumn:b.column});
    editor.focus();
    return true;
  }

  function sendInspectMode(){
    try{ iframeRef.current?.contentWindow?.postMessage({type:'LSS_INSPECT_MODE',enabled:inspectMode},'*'); }catch{}
  }

  async function focusClickedElement(data){
    if(!project || !inspectMode) return;
    let target=decodeURIComponent(String(data.pagePath||'')).replace(/^\/+/, '').split(/[?#]/)[0];
    if(!target) target='index.html';
    if(target.endsWith('/')) target+='index.html';
    let targetNode=findByPath(tree,target);
    if(!targetNode && target==='') targetNode=findByPath(tree,'index.html');

    let sourceText=content;
    let targetFile=file;
    if(targetNode && targetNode.path!==file){
      if(dirty) await saveNow();
      sourceText=await window.studio.readFile(targetNode.path);
      targetFile=targetNode.path;
      setFile(targetFile); setContent(sourceText); setSavedContent(sourceText);
    }

    if(!targetFile || !/\.html?$/i.test(targetFile)){
      const fallback=findByPath(tree,'index.html') || findFirst(tree,n=>n.type==='file' && /\.html?$/i.test(n.path));
      if(fallback){
        sourceText=await window.studio.readFile(fallback.path);
        targetFile=fallback.path;
        setFile(targetFile); setContent(sourceText); setSavedContent(sourceText);
      }
    }

    setMode('split');
    setStatus(`Élément Live → code : <${data.tag || 'élément'}>${data.id ? '#'+data.id : ''}`);
    setTimeout(()=>{
      const ok=selectSourceRange(sourceText,data);
      if(!ok) setStatus(`Élément détecté, mais correspondance exacte introuvable dans ${targetFile || 'le HTML'}`);
    },80);
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

  useEffect(()=>{
    const fn=(e)=>{ if(e.data?.type==='LSS_ELEMENT_CLICK') focusClickedElement(e.data); };
    window.addEventListener('message',fn); return()=>window.removeEventListener('message',fn);
  },[project,tree,file,content,savedContent,inspectMode]);

  useEffect(()=>{ sendInspectMode(); },[inspectMode,previewNonce,project]);

  const previewWidth = device==='desktop' ? '100%' : device==='tablet' ? '820px' : '390px';
  return <div className="app">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">LS</span><strong>Live Split Studio</strong></div>
      <button className="primary" onClick={openProject} disabled={busy}>Ouvrir un dossier</button>
      <div className="segmented">
        <button className={mode==='code'?'on':''} onClick={()=>setMode('code')}>Code</button>
        <button className={mode==='split'?'on':''} onClick={()=>setMode('split')}>Split</button>
        <button className={mode==='live'?'on':''} onClick={()=>setMode('live')}>Live</button>
      </div>
      <button className={inspectMode?'minify':'ghost'} onClick={()=>setInspectMode(v=>!v)} disabled={!project || busy}>{inspectMode?'Sélection Live ON':'Sélection Live OFF'}</button>
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
        {project ? <Tree nodes={tree} selected={file} onOpen={openFile}/> : <div className="empty-small">Ouvrez le dossier d’un site HTML/CSS/JS.</div>}
      </aside>

      <section className={'panes mode-'+mode}>
        {(mode==='code'||mode==='split') && <div className="editor-pane">
          <div className="pane-head"><span>{file || 'Aucun fichier'}</span>{dirty && <span className="dirty">● modifié</span>}</div>
          {file ? <Editor onMount={editor=>{editorRef.current=editor;}} height="100%" language={languageFor(file)} value={content} onChange={v=>setContent(v??'')} theme="vs-dark" options={{fontSize:14,minimap:{enabled:false},automaticLayout:true,wordWrap:'on',tabSize:2,insertSpaces:true,smoothScrolling:true,formatOnPaste:true}}/> : <div className="empty">Sélectionnez un fichier éditable.</div>}
        </div>}

        {(mode==='live'||mode==='split') && <div className="preview-pane">
          <div className="pane-head preview-head"><span>LIVE PREVIEW {inspectMode ? '— cliquez un élément pour retrouver son code' : '— navigation normale'}</span><button onClick={()=>setPreviewNonce(n=>n+1)}>↻ Recharger</button></div>
          <div className="preview-stage">
            {project ? <iframe ref={iframeRef} onLoad={sendInspectMode} title="Live preview" key={previewNonce} src={previewPath} style={{width:previewWidth}}/> : <div className="empty">Le rendu apparaîtra ici.</div>}
          </div>
        </div>}
      </section>
    </main>
    <footer className="statusbar"><span>{busy ? '● ' : ''}{status}</span><span>{file ? languageFor(file).toUpperCase() : ''}</span></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);