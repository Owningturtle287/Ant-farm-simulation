import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.PORT||4173),base='/Ant-farm-simulation/';
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
const server=http.createServer(async(request,response)=>{
  try{
    if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
    let name=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if(name===base.slice(0,-1)){response.writeHead(302,{Location:base});response.end();return;}
    if(name.startsWith(base))name=name.slice(base.length);else name=name.slice(1);
    if(!name)name='index.html';
    const file=path.resolve(root,name);
    if(!file.startsWith(root+path.sep) || !(await stat(file)).isFile()){response.writeHead(404);response.end('Not found');return;}
    const data=await readFile(file);response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});response.end(request.method==='HEAD'?undefined:data);
  }catch{response.writeHead(404);response.end('Not found');}
});
server.listen(port,'0.0.0.0',()=>console.log(`Local: http://localhost:${port}${base}`));
