function calendarRange(mode,today,month,start,end){
 const asDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 if(mode==='week'){
   const first=new Date(today+'T12:00:00');first.setDate(first.getDate()-(first.getDay()+6)%7);
   const last=new Date(first);last.setDate(last.getDate()+6);return [asDate(first),asDate(last)];
 }
 if(mode==='range')return [start,end];
 if(mode==='all'||mode==='missing')return [];
 const base=mode==='month'?month:today.slice(0,7);
 if(!base)return [null,null];
 let [year,m]=base.split('-').map(Number);
 let count=1;
 if(mode==='next')m++;
 if(mode==='previous')m--;
 if(mode==='year'){m=1;count=12}
 if(mode==='quarter'){m=1+3*Math.floor((m-1)/3);count=3}
 return [asDate(new Date(year,m-1,1)),asDate(new Date(year,m-1+count,0))];
}
function setupPeriod(){
 const box=document.querySelector('#periodBox');
 const monthInput=box.querySelector('[type=month]');
 monthInput.value=day().slice(0,7);
 const mode=box.querySelector('[name=mode]');
 const start=box.querySelector('[name=start]'),end=box.querySelector('[name=end]');
 [start.value,end.value]=calendarRange('current',day());
 function update(){
  monthInput.parentElement.hidden=mode.value!=='month';
  start.parentElement.hidden=end.parentElement.hidden=mode.value!=='range';
  for(const b of box.querySelectorAll('[data-period]'))b.setAttribute('aria-pressed',String(b.dataset.period===mode.value));
  render();
 }
 box.onclick=e=>{if(e.target.dataset.period){mode.value=e.target.dataset.period;update()}};
 box.onchange=update;
}
function periodFilter(){
 const box=document.querySelector('#periodBox'),mode=box.querySelector('[name=mode]').value;
 const [start,end]=calendarRange(mode,day(),box.querySelector('[type=month]').value,box.querySelector('[name=start]').value,box.querySelector('[name=end]').value);
 const invalid=mode!=='all'&&mode!=='missing'&&(!start||!end||start>end);
 box.querySelector('output').textContent=invalid?'Selecione um período com início até a data final.':start?fmt(start)+' a '+fmt(end):'';
 return op=>{
  const date=op.stage===4?op.closed:op.expectedClose;
  if(mode==='all')return true;
  if(mode==='missing')return op.stage!==4&&!date;
  return !invalid&&!!date&&date>=start&&date<=end;
 };
}
