#!/usr/bin/env node
/**
 * Wormstar change-scoped security gate.
 * Scans newly added source lines without executing them; SHA-bound report.
 * Flags are heuristics requiring review, not confirmed vulnerabilities.
 */
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

export const RULES=Object.freeze([
 {id:'dynamic-eval',severity:'high',message:'Dynamic eval or Function constructor introduced',test:/\b(?:eval\s*\(|new\s+Function\s*\(|Function\s*\(\s*['"])/},
 {id:'shell-execution',severity:'high',message:'Shell execution introduced in application source',test:/\b(?:child_process|node:child_process)\b|\b(?:execSync|spawnSync)\s*\(/},
 {id:'new-unsafe-html',severity:'medium',message:'New untrusted HTML insertion requires review',test:/\b(?:insertAdjacentHTML|dangerouslySetInnerHTML)\b|\.innerHTML\s*=/},
 {id:'hardcoded-credential',severity:'high',message:'Possible committed access token',test:/(?:ghp_|github_pat_|sk-proj-|AKIA[0-9A-Z]{16}|(?:CLOUDFLARE_API_TOKEN|WORMSTAR_ACCESS_TOKEN)\s*[:=]\s*["'][^\s"']{12,})/},
 {id:'disabled-tls',severity:'high',message:'TLS verification disabled in source',test:/(?:rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0)/}
]);
const PATHS=/^(?:cloudflare-worker|wormstar-ui|integrations\/star-cyber-audit-ish|integrations\/wormstar-linux-terminal|training\/uboor-security-lab)\/.*\.(?:js|mjs|ts|tsx|jsx|html|py|sh)$/;
const EXCLUSIONS=/(?:^|\/)(?:tests?|fixtures|samples|research|raw-uploads)\//;
export function analyzeDiff(diff){
 const findings=[];let file='',line=0,added=0,scanned=0;
 for(const raw of diff.split(/\r?\n/)){
  if(raw.startsWith('+++ b/')){file=raw.slice(6);continue}
  if(raw.startsWith('+++ /dev/null')){file='';continue}
  if(raw.startsWith('@@')){
   const match=raw.match(/\+(\d+)(?:,\d+)?/);
   if(match)line=Number(match[1]);
   continue;
  }
  if(raw.startsWith('+')&&!raw.startsWith('+++')){
   added++;
   const body=raw.slice(1);
   if(PATHS.test(file)&&!EXCLUSIONS.test(file)){
     scanned++;
    for(const rule of RULES){
      if(rule.test.test(body))findings.push({id:rule.id,severity:rule.severity,file,line,message:rule.message});
    }
   }
   line++;
  }else if(raw.startsWith(' ')&&!raw.startsWith('+++'))line++;
 }
 return {findings,addedLines:added,scannedAddedLines:scanned};
}
function git(...args){return execFileSync('git',args,{encoding:'utf8',maxBuffer:12*1024*1024}).trim()}
function validSha(value){return /^[a-f0-9]{40}$/i.test(value)}
function main(){
 const out=resolve(process.env.REPORT_PATH||'artifacts/security-gate.json');
 const sha=process.env.GITHUB_SHA||git('rev-parse','HEAD');
 const provided=process.env.BASE_SHA||'';
 const base=validSha(provided)&&!/^0+$/.test(provided)?provided:git('rev-parse','HEAD~1');
 if(!validSha(sha)||!validSha(base))throw Error('Unable to resolve Git SHAs');
 const diff=git('diff','--no-ext-diff','--unified=0','--diff-filter=ACMR',base,sha,'--');
 const {findings,addedLines,scannedAddedLines}=analyzeDiff(diff);
 const failing=findings.filter(x=>x.severity==='high'||x.severity==='medium');
 const report={schemaVersion:1,kind:'wormstar-security-change-gate',git_sha:sha,base_sha:base,
  totalAddedLines:addedLines,analyzedAddedLines:scannedAddedLines,findings,summary:{high:findings.filter(x=>x.severity==='high').length,
  medium:findings.filter(x=>x.severity==='medium').length,pass:failing.length===0}};
 mkdirSync(dirname(out),{recursive:true});
 writeFileSync(out,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log('Security gate '+(failing.length?'FAILED':'PASSED')+': '+scannedAddedLines+' of '+addedLines+' added lines scanned, '+findings.length+' findings. '+out);
 for(const f of findings)console.log('::warning file='+f.file+',line='+f.line+'::'+f.id+' ('+f.severity+') '+f.message);
 if(failing.length)process.exitCode=1;
}
if(process.argv[1]&&new URL('file://'+resolve(process.argv[1])).href===import.meta.url){
 try{main()}catch(error){console.error('Security gate failed closed:',error.message);process.exitCode=2}
}
