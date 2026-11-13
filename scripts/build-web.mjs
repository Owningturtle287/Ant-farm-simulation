import {readdir,readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=path.join(root,'web'),output=path.join(root,'dist');
async function files(directory,prefix=''){
  const result=[];
  for(const entry of (await readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const relative=path.join(prefix,entry.name);if(entry.isDirectory())result.push(...await files(path.join(directory,entry.name),relative));else result.push(relative);}
  return result;
}
const entries=await files(source),hash=createHash('sha256');
for(const file of entries){hash.update(file);hash.update(await readFile(path.join(source,file)));}
const build=hash.digest('hex').slice(0,12);
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
for(const file of entries){const destination=path.join(output,file);await mkdir(path.dirname(destination),{recursive:true});const data=await readFile(path.join(source,file));await writeFile(destination,/\.(html|js)$/.test(file)?data.toString().replaceAll('__BUILD_ID__',build):data);}
await writeFile(path.join(output,'.nojekyll'),'');
console.log(`Built Little Colony ${build}: ${entries.length} self-contained files in dist/`);
