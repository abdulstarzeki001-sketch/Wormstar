/**
 * Vendor-neutral, pure Workers AI response parsing + reasoning selection.
 * Never surfaces chain-of-thought/reasoning fields as user-visible answers.
 * User selects effort; owner policy and provider's finite token budget still apply.
 */
const EFFORTS=new Set(['auto','low','medium','high']);
export function chooseReasoningEffort(mode,requested='auto',tokenBudget=1500){
 if(typeof requested!=='string'||!EFFORTS.has(requested))throw new TypeError('Invalid reasoning effort');
 const selection=requested==='auto'?(mode==='code'||mode==='ctf'?'medium':'low'):requested;
 // A "high" reasoning pass can exhaust a short output budget and return no answer.
 return selection==='high'&&tokenBudget<1200?'medium':selection;
}
function plain(value){
 if(typeof value==='string')return value.trim();
 if(!Array.isArray(value))return '';
 return value.map(part=>{
  if(typeof part==='string')return part;
  if(part?.type==='text' && typeof part?.text==='string')return part.text;
  if(part?.type==='output_text' && typeof part?.text==='string')return part.text;
  return '';
 }).filter(Boolean).join('\n').trim();
}
export function extractModelAnswer(response){
 if(typeof response==='string')return response.trim();
 if(!response||typeof response!=='object')return '';
 const top=plain(response.response)||plain(response.output_text);
 if(top)return top;
 const message=response.choices?.[0]?.message;
 const choice=plain(message?.content)||plain(response.choices?.[0]?.text);
 if(choice)return choice;
 const outputs=response.output;
 if(Array.isArray(outputs)){
  return outputs.filter(x=>x?.role==='assistant'||x?.type==='message')
    .map(x=>plain(x.content)).filter(Boolean).join('\n').trim();
 }
 return '';
}
