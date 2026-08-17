const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { URL } = require('url');
const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: minifyJs } = require('terser');

let win, projectRoot = null, previewServer = null, previewPort = null, lastBackup = null;
const ignored = new Set(['node_modules','.git','.DS_Store','dist','.idea','.vscode','.live-split-backups']);
const editableExtensions = new Set(['.html','.htm','.css','.js','.mjs','.cjs','.json','.xml','.svg','.txt','.md','.php','.scss','.sass','.less','.ts','.tsx','.jsx','.vue','.svelte','.yml','.yaml','.htaccess']);
const minifiableExtensions = new Set(['.html','.htm','.css','.js','.mjs','.cjs']);
const sseClients = new Set();

function safePath(root, rel='') {
  const resolved = path.resolve(root, rel), base = path.resolve(root);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) throw new Error('Path outside project root');
  return resolved;
}
function scanDirectory(root, current=root) {
  return fs.readdirSync(current,{withFileTypes:true}).filter(e=>!ignored.has(e.name)).sort((a,b)=>Number(b.isDirectory())-Number(a.isDirectory())||a.name.localeCompare(b.name)).map(e=>{
    const abs=path.join(current,e.name), rel=path.relative(root,abs).split(path.sep).join('/');
    return e.isDirectory()?{name:e.name,path:rel,type:'directory',children:scanDirectory(root,abs)}:{name:e.name,path:rel,type:'file',editable:editableExtensions.has(path.extname(e.name).toLowerCase())};
  });
}
function mimeType(filePath){
  const ext=path.extname(filePath).toLowerCase();
  return ({'.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.mp4':'video/mp4','.webm':'video/webm','.pdf':'application/pdf'})[ext]||'application/octet-stream';
}
function injectLiveReload(html){
  const script=`<script>(function(){try{const es=new EventSource('/__live_split_events');es.onmessage=()=>location.reload();}catch(e){}})();<\/script>`;
  return /<\/body>/i.test(html)?html.replace(/<\/body>/i,script+'</body>'):html+script;
}
function notifyPreviewReload(){ for(const res of sseClients){ try{res.write('data: reload\n\n');}catch{ sseClients.delete(res); } } }
async function ensurePreviewServer(){
  if(previewServer) return previewPort;
  previewServer=http.createServer((req,res)=>{
    if(!projectRoot){res.writeHead(404);return res.end('No project open');}
    const parsed=new URL(req.url,'http://127.0.0.1');
    if(parsed.pathname==='/__live_split_events'){
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','Access-Control-Allow-Origin':'*'});res.write('\n');sseClients.add(res);req.on('close',()=>sseClients.delete(res));return;
    }
    let requestPath=decodeURIComponent(parsed.pathname).replace(/^\/+/, ''); if(!requestPath) requestPath='index.html';
    let filePath; try{filePath=safePath(projectRoot,requestPath);}catch{res.writeHead(403);return res.end('Forbidden');}
    if(fs.existsSync(filePath)&&fs.statSync(filePath).isDirectory()) filePath=path.join(filePath,'index.html');
    if(!fs.existsSync(filePath)||!fs.statSync(filePath).isFile()){res.writeHead(404);return res.end('Not found');}
    try{
      const type=mimeType(filePath);
      if(type.startsWith('text/html')){res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});return res.end(injectLiveReload(fs.readFileSync(filePath,'utf8')));}
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});fs.createReadStream(filePath).pipe(res);
    }catch(err){res.writeHead(500);res.end(String(err.message||err));}
  });
  await new Promise((resolve,reject)=>{previewServer.once('error',reject);previewServer.listen(0,'127.0.0.1',()=>{previewPort=previewServer.address().port;resolve();});});
  return previewPort;
}
function createWindow(){
  win=new BrowserWindow({width:1600,height:980,minWidth:1050,minHeight:700,title:'Live Split Studio',backgroundColor:'#111214',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:false}});
  if(!app.isPackaged) win.loadURL(process.env.VITE_DEV_SERVER_URL||'http://127.0.0.1:5173'); else win.loadFile(path.join(__dirname,'dist','index.html'));
}
async function projectPayload(selectedFile=null){
  const port=await ensurePreviewServer();
  const out={root:projectRoot,name:path.basename(projectRoot),tree:scanDirectory(projectRoot),previewBase:`http://127.0.0.1:${port}`};
  if(selectedFile){out.selectedFile=selectedFile;out.selectedContent=fs.readFileSync(safePath(projectRoot,selectedFile),'utf8');}
  return out;
}
async function openHtmlAsProject(absPath){
  if(!absPath||!fs.existsSync(absPath)||!fs.statSync(absPath).isFile()) return null;
  const ext=path.extname(absPath).toLowerCase(); if(!['.html','.htm'].includes(ext)) throw new Error('Sélectionnez un fichier HTML ou HTM.');
  projectRoot=path.dirname(absPath); lastBackup=null; return projectPayload(path.basename(absPath));
}
function backupRootForProject(){return path.join(app.getPath('userData'),'minify-backups',crypto.createHash('sha256').update(projectRoot).digest('hex').slice(0,16));}
function makeBackup(files){
  const root=path.join(backupRootForProject(),new Date().toISOString().replace(/[:.]/g,'-'));
  for(const rel of files){const src=safePath(projectRoot,rel),dst=path.join(root,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);}
  fs.writeFileSync(path.join(root,'_project.txt'),projectRoot,'utf8');lastBackup={root,files,createdAt:Date.now()};return lastBackup;
}
async function minifyContent(rel,content){
  const ext=path.extname(rel).toLowerCase();
  if(['.html','.htm'].includes(ext)) return minifyHtml(content,{collapseWhitespace:true,conservativeCollapse:true,removeComments:true,removeRedundantAttributes:true,removeScriptTypeAttributes:true,removeStyleLinkTypeAttributes:true,useShortDoctype:true,minifyCSS:true,minifyJS:true,keepClosingSlash:true});
  if(ext==='.css'){const out=new CleanCSS({level:2}).minify(content);if(out.errors?.length)throw new Error(out.errors.join('\n'));return out.styles;}
  if(['.js','.mjs','.cjs'].includes(ext)){const out=await minifyJs(content,{compress:true,mangle:false,format:{comments:false}});if(!out.code)throw new Error('JavaScript minification produced no output');return out.code;}
  throw new Error('Unsupported file type for minification');
}
function collectMinifiableFiles(root,current=root,out=[]){for(const e of fs.readdirSync(current,{withFileTypes:true})){if(ignored.has(e.name))continue;const abs=path.join(current,e.name);if(e.isDirectory())collectMinifiableFiles(root,abs,out);else if(minifiableExtensions.has(path.extname(e.name).toLowerCase()))out.push(path.relative(root,abs).split(path.sep).join('/'));}return out;}

app.whenReady().then(()=>{createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{if(previewServer)previewServer.close();});

ipcMain.handle('project:open',async()=>{
  const result=await dialog.showOpenDialog(win,{properties:['openDirectory']}); if(result.canceled||!result.filePaths[0])return null;
  projectRoot=result.filePaths[0];lastBackup=null;return projectPayload();
});
ipcMain.handle('project:open-html-file',async()=>{
  const result=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Fichiers HTML',extensions:['html','htm']}]}); if(result.canceled||!result.filePaths[0])return null;
  return openHtmlAsProject(result.filePaths[0]);
});
ipcMain.handle('project:tree',async()=>projectRoot?scanDirectory(projectRoot):[]);
ipcMain.handle('file:read',async(_,rel)=>fs.readFileSync(safePath(projectRoot,rel),'utf8'));
ipcMain.handle('file:write',async(_,rel,content)=>{if(!projectRoot)throw new Error('No project open');fs.writeFileSync(safePath(projectRoot,rel),content,'utf8');notifyPreviewReload();return{ok:true,savedAt:Date.now()};});
ipcMain.handle('minify:file',async(_,rel)=>{
  if(!projectRoot)throw new Error('No project open');const abs=safePath(projectRoot,rel);if(!minifiableExtensions.has(path.extname(abs).toLowerCase()))throw new Error('Ce type de fichier ne peut pas être minifié.');
  makeBackup([rel]);const source=fs.readFileSync(abs,'utf8'),minified=await minifyContent(rel,source);fs.writeFileSync(abs,minified,'utf8');notifyPreviewReload();return{ok:true,rel,before:Buffer.byteLength(source),after:Buffer.byteLength(minified),content:minified,backupAvailable:true};
});
ipcMain.handle('minify:site',async()=>{
  if(!projectRoot)throw new Error('No project open');const files=collectMinifiableFiles(projectRoot);if(!files.length)return{ok:true,count:0,before:0,after:0,failures:[]};makeBackup(files);
  let before=0,after=0;const failures=[];for(const rel of files){const abs=safePath(projectRoot,rel);try{const source=fs.readFileSync(abs,'utf8');before+=Buffer.byteLength(source);const minified=await minifyContent(rel,source);after+=Buffer.byteLength(minified);fs.writeFileSync(abs,minified,'utf8');}catch(err){failures.push({rel,error:String(err.message||err)});}}
  notifyPreviewReload();return{ok:true,count:files.length-failures.length,total:files.length,before,after,failures,backupAvailable:true};
});
ipcMain.handle('minify:restore-last',async()=>{
  if(!projectRoot||!lastBackup)return{ok:false,reason:'Aucune sauvegarde de minification disponible.'};for(const rel of lastBackup.files){const src=path.join(lastBackup.root,rel);if(!fs.existsSync(src))continue;const dst=safePath(projectRoot,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(src,dst);}notifyPreviewReload();const restored=lastBackup.files.length;lastBackup=null;return{ok:true,restored};
});