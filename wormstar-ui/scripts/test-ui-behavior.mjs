import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

function element(tag='div'){
  return {tag,style:{},dataset:{},children:[],classList:{toggle(){},add(value){this.last=value;}},
    replaceChildren(...children){this.children=children;},
    set innerHTML(_){throw Error('HTML parsing must not be used');}};
}

test('language changes preserve the formatted hero while rendering other labels as text',()=>{
  const start=html.indexOf('function setLang(next){');
  const end=html.indexOf('\n$("#langBtn").addEventListener',start);
  assert.ok(start>=0&&end>start);
  const hero=element('h1');hero.dataset.i18n='hero_title';
  const label=element();label.dataset.i18n='overview';
  const langButton=element('button'),crumb=element(),chat=element('textarea');
  const nodes={'#langBtn':langButton,'#crumbText':crumb,'#chatInput':chat};
  const document={documentElement:{},body:element('body'),createElement:element,
    createTextNode:text=>({tag:'#text',textContent:text})};
  const ctx=vm.createContext({document,lang:'ar',translations:{ar:{hero_title:'present',overview:'نظرة عامة'}},
    english:{hero_title:'present',overview:'<not markup>'},$:s=>nodes[s],$$:()=>[hero,label]});
  vm.runInContext(html.slice(start,end),ctx);
  ctx.setLang('en');
  assert.equal(document.documentElement.dir,'ltr');
  assert.equal(label.textContent,'<not markup>');
  assert.equal(hero.children[1].tag,'span');
  assert.equal(hero.children[1].textContent,'clarity.');
  assert.equal(hero.children[2].tag,'br');
  assert.equal(langButton.children[0].textContent,'AR');
  ctx.setLang('ar');
  assert.equal(document.documentElement.dir,'rtl');
  assert.equal(hero.children[1].textContent,'رؤية أوضح.');
  assert.equal(langButton.children[0].textContent,'EN');
});

test('mobile menu clones navigation and wires page controls without parsing HTML',()=>{
  const start=html.indexOf('$("#menuBtn").addEventListener("click",()=>{');
  const end=html.indexOf('\n});',start)+4;
  assert.ok(start>=0&&end>start);
  let openMenu,selected;
  const menu={addEventListener:(_event,fn)=>{openMenu=fn;}};
  const button={dataset:{page:'assistant'},addEventListener:(_event,fn)=>{button.activate=fn;}};
  const original={cloneNode:deep=>{assert.equal(deep,true);return button;}};
  const sidebar={childNodes:[original]};
  const drawer=element();drawer.querySelectorAll=()=>drawer.children;
  const overlay=element();
  const nodes={'#menuBtn':menu,'#drawer':drawer,'.sidebar':sidebar,'#overlay':overlay};
  vm.runInNewContext(html.slice(start,end),{$:s=>nodes[s],go:page=>{selected=page;}});
  openMenu();
  assert.equal(drawer.children[0],button);
  assert.equal(overlay.classList.last,'open');
  button.activate();
  assert.equal(selected,'assistant');
});
