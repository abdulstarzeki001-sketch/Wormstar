import type {MouseEvent, PropsWithChildren} from 'react';

/** Lightweight spotlight adapted to Wormstar's existing React DOM,
 * inspired by React Bits. No extra dependencies or network access. */
export default function SpotlightCard({
  children,className=''
}: PropsWithChildren<{className?:string}>) {
  const position=(event:MouseEvent<HTMLDivElement>)=>{
    if(!window.matchMedia('(hover: hover) and (pointer: fine)').matches)return;
    const rect=event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--ws-spot-x',(event.clientX-rect.left)+'px');
    event.currentTarget.style.setProperty('--ws-spot-y',(event.clientY-rect.top)+'px');
  };
  return (
    <div className={className+' ws-spotlight-card'} onPointerMove={position}>
      {children}
    </div>
  );
}
