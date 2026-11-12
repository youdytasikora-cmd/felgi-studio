"use strict";
const canvas=document.querySelector("#stage"),ctx=canvas.getContext("2d");
const els={photo:document.querySelector("#photo"),wheels:document.querySelector("#wheels"),size:document.querySelector("#size"),tilt:document.querySelector("#tilt"),angle:document.querySelector("#angle"),skew:document.querySelector("#skew"),widthScale:document.querySelector("#widthScale"),status:document.querySelector("#status")};
const types=[{label:"FIVE / S",spokes:5,color:"#d7dad8",rim:"#8f969b",style:0},{label:"MESH / 18",spokes:12,color:"#d8ba7b",rim:"#937c50",style:1},{label:"TURBINE",spokes:9,color:"#515b65",rim:"#1d242e",style:2}];
let selectedType=0,photo=null,items=[],selected=-1,drag=null;
let maskMode=false, maskDrag=false, detectionToken=0;
const overlaynote=document.querySelector("#overlaynote");
for(const key of ["archCut","archCurve","brightness","contrast","warmth","shadow","edgeBlur"])els[key]=document.querySelector("#"+key);
function wheelData(type){const c=document.createElement("canvas");c.width=c.height=400;const x=c.getContext("2d"),t=types[type],R=190,cx=200,cy=200;x.translate(cx,cy);
let outer=x.createRadialGradient(0,0,140,0,0,190);outer.addColorStop(0,"#0b0d10");outer.addColorStop(.8,"#383b3e");outer.addColorStop(.91,"#bfc4c7");outer.addColorStop(1,"#35393d");
x.fillStyle=outer;x.beginPath();x.arc(0,0,R,0,Math.PI*2);x.fill();
x.fillStyle="#101216";x.beginPath();x.arc(0,0,165,0,Math.PI*2);x.fill();
const grad=x.createLinearGradient(-120,-120,130,150);grad.addColorStop(0,"#fafafa");grad.addColorStop(.28,t.color);grad.addColorStop(.73,t.rim);grad.addColorStop(1,"#3d4348");
for(let i=0;i<t.spokes;i++){x.save();x.rotate(2*Math.PI*i/t.spokes);x.fillStyle=grad;x.strokeStyle="#f7f8f9";x.lineWidth=2;x.beginPath();const w=t.style===1?8:t.style===2?13:20;x.moveTo(-w,27);x.lineTo(-w-7,150);x.lineTo(t.style===2?24:w+7,155);x.lineTo(w,27);x.closePath();x.fill();x.stroke();if(t.style===1){x.beginPath();x.moveTo(-7,70);x.lineTo(12,152);x.strokeStyle="#27221a";x.lineWidth=4;x.stroke()}x.restore()}
x.strokeStyle=t.color;x.lineWidth=11;x.beginPath();x.arc(0,0,165,0,Math.PI*2);x.stroke();
x.strokeStyle="#596066";x.lineWidth=4;x.beginPath();x.arc(0,0,177,0,Math.PI*2);x.stroke();
x.fillStyle="#a8adb0";x.beginPath();x.arc(0,0,30,0,Math.PI*2);x.fill();
x.fillStyle="#30363b";x.beginPath();x.arc(0,0,21,0,Math.PI*2);x.fill();
for(let i=0;i<5;i++){let a=i*Math.PI*2/5;x.beginPath();x.arc(Math.cos(a)*46,Math.sin(a)*46,5,0,Math.PI*2);x.fillStyle="#d0d4d4";x.fill()}
return c}
const assets=types.map((_,i)=>wheelData(i));
types.forEach((t,i)=>{const b=document.createElement("button");b.type="button";b.className="wheelbtn"+(i===0?" active":"");const im=document.createElement("img");im.alt="Własny rysunek felgi "+t.label;im.src=assets[i].toDataURL("image/png");b.append(im,document.createTextNode(t.label));b.addEventListener("click",()=>{selectedType=i;document.querySelectorAll(".wheelbtn").forEach((n,j)=>n.classList.toggle("active",i===j));if(selected!==-1)items[selected].type=i;render()});els.wheels.append(b)});
function add(x,y,size=110){items.push({x,y,size,tilt:100,widthScale:85,angle:0,skew:0,type:selectedType,archCut:-25,archCurve:30,brightness:100,contrast:100,warmth:0,shadow:40,edgeBlur:1,strokes:[]});selected=items.length-1;sync();render()}
function sync(){const v=items[selected];for(const k of ["size","tilt","widthScale","angle","skew","archCut","archCurve","brightness","contrast","warmth","shadow","edgeBlur"]){els[k].disabled=!v;if(v)els[k].value=k==="edgeBlur"?v[k]:Math.round(v[k])}["size","tilt","widthScale","angle","skew","archCut","archCurve","brightness","contrast","warmth","shadow","edgeBlur"].forEach(k=>document.querySelector("#"+k+"Val").textContent=v?(k==="size"?Math.round(v.size)+" px":(k==="tilt"||k==="widthScale")?v[k]+"%":(k==="archCut"||k==="archCurve"||k==="brightness"||k==="contrast"||k==="shadow")?v[k]+"%":k==="edgeBlur"?v[k]+" px":k==="warmth"?String(v[k]):v[k]+"°"):"—");els.status.textContent=photo?"ZDJĘCIE LOKALNE • "+items.length+" FELGI":"TRYB DEMONSTRACYJNY";
const selectedLabel=document.querySelector("#selectedWheelLabel");
if(selectedLabel)selectedLabel.textContent=selected<0?"Kliknij felgę, aby ją edytować":"Wybrana felga "+(selected+1)+" z "+items.length;
overlaynote.textContent=photo&&items.length<2?"KLIKNIJ ŚRODEK "+(items.length===0?"PIERWSZEGO":"DRUGIEGO")+" KOŁA": "PRZECIĄGNIJ FELGĘ, ABY USTAWIĆ POZYCJĘ"}
function transform(w){ctx.translate(w.x,w.y);ctx.rotate(w.angle*Math.PI/180);ctx.transform((w.widthScale??85)/100,w.skew/250,0,w.tilt/100,0,0)}
const wheelLayer=document.createElement("canvas");wheelLayer.width=1200;wheelLayer.height=800;
const wc=wheelLayer.getContext("2d");
function drawWheel(w,highlight){
  const sz=w.size, arch=w.archCut??-25, curve=w.archCurve??30;
  wc.setTransform(1,0,0,1,0,0);wc.clearRect(0,0,1200,800);
  wc.save();wc.translate(w.x,w.y);wc.rotate(w.angle*Math.PI/180);
  wc.transform((w.widthScale??85)/100,w.skew/250,0,w.tilt/100,0,0);
  // Local tyre-coloured underlay softly hides remnants of the original metal rim,
  // without painting over the outer sidewall (the falloff ends inside the detected tyre).
  wc.save();const tyreFade=wc.createRadialGradient(0,0,sz*.72,0,0,sz*1.12);
  tyreFade.addColorStop(0,"rgba(10,12,14,.92)");tyreFade.addColorStop(.68,"rgba(10,12,14,.83)");tyreFade.addColorStop(1,"rgba(10,12,14,0)");
  wc.fillStyle=tyreFade;wc.beginPath();wc.arc(0,0,sz*1.12,0,Math.PI*2);wc.fill();wc.restore();
  wc.save();wc.shadowColor="rgba(0,0,0,"+((w.shadow??40)/130)+")";wc.shadowBlur=sz*.18;wc.shadowOffsetY=sz*.07;
  wc.fillStyle="rgba(0,0,0,.42)";wc.beginPath();wc.arc(0,0,sz*.98,0,Math.PI*2);wc.fill();wc.restore();
  const grad=wc.createRadialGradient(0,0,sz*.6,0,0,sz*1.06);
  grad.addColorStop(0,"rgba(0,0,0,0)");grad.addColorStop(.8,"rgba(0,0,0,.12)");
  grad.addColorStop(1,"rgba(0,0,0,.45)");wc.fillStyle=grad;wc.beginPath();wc.arc(0,0,sz*1.07,0,Math.PI*2);wc.fill();
  wc.save();wc.filter="brightness("+(w.brightness??100)+"%) contrast("+(w.contrast??100)+"%) blur("+(w.edgeBlur??1)+"px)";
  wc.drawImage(assets[w.type],-sz,-sz,sz*2,sz*2);wc.restore();
  const temp=(w.warmth??0)/100;
  wc.globalCompositeOperation="source-atop";
  wc.fillStyle=temp>=0?"rgba(255,155,60,"+(temp*.26)+")":"rgba(80,155,255,"+(-temp*.26)+")";
  wc.fillRect(-sz*1.2,-sz*1.2,sz*2.4,sz*2.4);wc.globalCompositeOperation="source-over";
  // Edytowalny łuk nadkola: odtwarza oryginalne zdjęcie powyżej krzywej.
  wc.globalCompositeOperation="destination-out";
  wc.beginPath();wc.moveTo(-sz*1.25,-sz*1.55);
  wc.lineTo(sz*1.25,-sz*1.55);
  if(w.archProfile&&w.archProfile.length>=5){
    const shift=(arch+18)/100,delta=(curve-85)/100;
    const archY=pt=>pt.y+shift-delta*.45*(1-Math.pow(Math.min(1,Math.abs(pt.x)/.9),2));
    wc.lineTo(sz*1.25,sz*(-.20+shift));
    const pts=w.archProfile;
    for(let i=pts.length-1;i>=0;i--)wc.lineTo(sz*pts[i].x,sz*archY(pts[i]));
    wc.lineTo(-sz*1.25,sz*(-.20+shift));
  }else{
    wc.lineTo(sz*1.25,sz*arch/100);
    wc.quadraticCurveTo(0,sz*(arch-curve*1.15)/100,-sz*1.25,sz*arch/100);
  }
  wc.closePath();wc.fillStyle="#000";wc.fill();wc.restore();
  // Pędzel w globalnych współrzędnych Canvas: wymazuje tylko warstwę danej felgi.
  wc.save();wc.globalCompositeOperation="destination-out";wc.lineCap="round";wc.lineJoin="round";
  for(const stroke of w.strokes??[]){
    if(!stroke.length)continue;
    wc.lineWidth=stroke[0].size;wc.strokeStyle="black";wc.beginPath();
    wc.moveTo(stroke[0].x,stroke[0].y);
    if(stroke.length===1){wc.lineTo(stroke[0].x+.01,stroke[0].y+.01)}
    for(let i=1;i<stroke.length;i++)wc.lineTo(stroke[i].x,stroke[i].y);
    wc.stroke();
  }wc.restore();
  ctx.drawImage(wheelLayer,0,0);
  // No yellow or green selection outline in the public preview.
}
function demo(){let bg=ctx.createLinearGradient(0,0,0,800);bg.addColorStop(0,"#aab1af");bg.addColorStop(.7,"#606a6c");bg.addColorStop(1,"#404748");ctx.fillStyle=bg;ctx.fillRect(0,0,1200,800);
ctx.fillStyle="#555f62";ctx.fillRect(0,570,1200,230);
ctx.fillStyle="#272f34";ctx.beginPath();ctx.moveTo(95,530);ctx.lineTo(200,405);ctx.lineTo(390,340);ctx.lineTo(725,337);ctx.lineTo(920,402);ctx.lineTo(1065,478);ctx.lineTo(1095,552);ctx.lineTo(990,586);ctx.lineTo(170,588);ctx.closePath();ctx.fill();
ctx.fillStyle="#74818a";ctx.beginPath();ctx.moveTo(165,505);ctx.lineTo(250,406);ctx.lineTo(413,357);ctx.lineTo(708,358);ctx.lineTo(918,416);ctx.lineTo(1030,504);ctx.lineTo(1015,566);ctx.lineTo(160,568);ctx.closePath();ctx.fill();
ctx.fillStyle="#25343e";ctx.beginPath();ctx.moveTo(289,407);ctx.lineTo(422,372);ctx.lineTo(694,372);ctx.lineTo(846,415);ctx.lineTo(895,466);ctx.lineTo(253,465);ctx.closePath();ctx.fill();ctx.strokeStyle="#aab5b9";ctx.lineWidth=4;ctx.stroke();
ctx.strokeStyle="#263239";ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(588,372);ctx.lineTo(584,466);ctx.moveTo(590,478);ctx.lineTo(590,559);ctx.stroke();
ctx.fillStyle="#afb8bd";ctx.fillRect(1040,505,36,17);ctx.fillStyle="#e7dad0";ctx.fillRect(148,508,31,12);
for(let x of [315,870]){ctx.fillStyle="#25282c";ctx.beginPath();ctx.ellipse(x,566,113,114,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#444a4f";ctx.beginPath();ctx.ellipse(x,566,81,84,0,0,Math.PI*2);ctx.fill()}
ctx.fillStyle="#f3f4ec";ctx.font="bold 17px sans-serif";ctx.fillText("DEMO — ilustrowany samochód; dodaj własne zdjęcie",42,52)}
function render(){ctx.clearRect(0,0,canvas.width,canvas.height);if(photo){ctx.fillStyle="#15181b";ctx.fillRect(0,0,1200,800);const s=Math.min(1200/photo.width,800/photo.height),w=photo.width*s,h=photo.height*s;ctx.drawImage(photo,(1200-w)/2,(800-h)/2,w,h)}else demo();items.forEach((w,i)=>drawWheel(w,i===selected));}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*1200/r.width,y:(e.clientY-r.top)*800/r.height}}
function hit(p,w){const a=-w.angle*Math.PI/180,dx=p.x-w.x,dy=p.y-w.y;const xx=dx*Math.cos(a)-dy*Math.sin(a),yy=dx*Math.sin(a)+dy*Math.cos(a);const xs=xx/((w.widthScale??85)/100),y=(yy-xx*w.skew/250)/(w.tilt/100);return xs*xs+y*y<=w.size*w.size}
canvas.addEventListener("pointerdown",e=>{const p=point(e);
if(maskMode){if(selected<0)return;maskDrag=true;items[selected].strokes??=[];items[selected].strokes.push([{...p,size:Number(document.querySelector("#brushSize").value)}]);canvas.setPointerCapture(e.pointerId);render();return}
for(let i=items.length-1;i>=0;i--){if(hit(p,items[i])){selected=i;drag={dx:p.x-items[i].x,dy:p.y-items[i].y};canvas.setPointerCapture(e.pointerId);sync();render();return}}if(photo&&items.length<2){add(p.x,p.y,Math.round(Math.min(1200,800)*.09));return}selected=-1;sync();render()});
canvas.addEventListener("pointermove",e=>{if(maskDrag&&selected>=0){const p=point(e);items[selected].strokes.at(-1).push({...p,size:Number(document.querySelector("#brushSize").value)});render();return}if(!drag||selected<0)return;const p=point(e);items[selected].x=p.x-drag.dx;items[selected].y=p.y-drag.dy;render()});for(let evt of ["pointerup","pointercancel"])canvas.addEventListener(evt,()=>{drag=null;maskDrag=false});
for(let k of ["size","tilt","widthScale","angle","skew","archCut","archCurve","brightness","contrast","warmth","shadow","edgeBlur"])document.querySelector("#"+k).addEventListener("input",()=>{if(selected<0)return;items[selected][k]=Number(document.querySelector("#"+k).value);sync();render()});
document.querySelector("#add").onclick=()=>add(600,420,100);document.querySelector("#remove").onclick=()=>{if(selected>=0){items.splice(selected,1);selected=Math.min(selected,items.length-1);sync();render()}};document.querySelector("#reset").onclick=()=>{items=[];selected=-1;if(!photo){add(315,566,80);add(870,566,85)}else{sync();render()}};
els.photo.addEventListener("change",()=>{const f=els.photo.files?.[0];if(!f)return;const token=++detectionToken;window.lastAutoDetection=undefined;const url=URL.createObjectURL(f),im=new Image();im.onload=()=>{photo=im;URL.revokeObjectURL(url);items=[];selected=-1;sync();render();runAutoDetection(im,token)};im.onerror=()=>{URL.revokeObjectURL(url);alert("Nie udało się wczytać pliku.")};im.src=url});
document.querySelector("#export").onclick=()=>{const old=selected;selected=-1;render();const a=document.createElement("a");a.download="felgi-studio-podglad.png";a.href=canvas.toDataURL("image/png");a.click();selected=old;render()};
window.addEventListener("keydown",e=>{if(selected<0||!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)||["INPUT","BUTTON"].includes(document.activeElement.tagName))return;e.preventDefault();const w=items[selected],n=e.shiftKey?10:2;w.x+=(e.key==="ArrowRight"?n:e.key==="ArrowLeft"?-n:0);w.y+=(e.key==="ArrowDown"?n:e.key==="ArrowUp"?-n:0);render()});
items=[{x:315,y:566,size:80,tilt:100,widthScale:85,angle:0,skew:0,type:0,archCut:-25,archCurve:30,brightness:100,contrast:100,warmth:0,shadow:40,edgeBlur:1,strokes:[]},{x:870,y:566,size:85,tilt:100,widthScale:85,angle:0,skew:0,type:0,archCut:-25,archCurve:30,brightness:100,contrast:100,warmth:0,shadow:40,edgeBlur:1,strokes:[]}];selected=0;sync();render();

// Kontrolki maski; maska działa wyłącznie na warstwie felgi.
document.querySelector("#maskMode").onclick=()=>{maskMode=!maskMode;const b=document.querySelector("#maskMode");b.setAttribute("aria-pressed",String(maskMode));b.textContent="Pędzel maski: "+(maskMode?"WŁ.":"WYŁ.");canvas.style.cursor=maskMode?"crosshair":"grab"};
document.querySelector("#undoMask").onclick=()=>{if(selected>=0){items[selected].strokes??=[];items[selected].strokes.pop();render()}};
document.querySelector("#clearMask").onclick=()=>{if(selected>=0){items[selected].strokes=[];render()}};
document.querySelector("#brushSize").oninput=()=>document.querySelector("#brushSizeVal").textContent=document.querySelector("#brushSize").value+" px";

async function runAutoDetection(image, token=detectionToken){
  const status=document.querySelector("#detectInfo");status.textContent="Analizuję zdjęcie lokalnie…";
  try{
    if(!await WheelDetector.ready(20000))throw Error("OpenCV.js nie załadowało się");
    if(token!==detectionToken||photo!==image)return;
    const result=WheelDetector.locate(image);
    if(token!==detectionToken||photo!==image)return;
    if(!result.ok){
      // In uncertain photos (3/4, occlusions) put two draggable rims in the bottom work area,
      // not on the bonnet, door, or a guessed pair of circles.
      items=[];add(170,744,48);add(1030,744,48);selected=-1;sync();render();
      status.textContent="Wykrycie niepewne — felgi czekają na dole kadru. Przeciągnij je na prawdziwe koła lub kliknij «Ustaw ręcznie».";
      window.lastAutoDetection=result;return
    }
    items=[];
    for(const wheel of result.wheels){
      add(wheel.x,wheel.y,wheel.radius);
      const w=items.at(-1);w.archCut=result.arch.cut;w.archCurve=result.arch.curve;w.archProfile=wheel.archProfile;w.widthScale=wheel.widthScale??85;w.tilt=wheel.tilt??100;w.angle=wheel.angle??0;w.tyreRadius=wheel.tyreRadius;
      // Treat confidence as relative Hough pairing heuristic, not a calibrated probability.
      w.autoDetected=true;
    }
    // Wybierz koło bliższe aparatowi (zazwyczaj większe): wartości perspektywy są od razu widoczne.
    selected=items[0].tyreRadius>=items[1].tyreRadius?0:1;sync();render();
    status.textContent="Znaleziono dwa koła i przybliżony łuk nadkola. Możesz poprawić pozycję, promień i maskę.";
    window.lastAutoDetection=result;
  }catch(e){if(token!==detectionToken)return;status.textContent="Automatyczne wykrycie niedostępne: "+e.message+". Ustaw koła ręcznie.";window.lastAutoDetection={ok:false,reason:e.message};}
}
document.querySelector("#redetect").onclick=()=>{if(!photo)return;const token=++detectionToken;items=[];selected=-1;sync();render();runAutoDetection(photo,token)};
document.querySelector("#manualPlacement").onclick=()=>{++detectionToken;items=[];selected=-1;sync();render();document.querySelector("#detectInfo").textContent="Tryb ręczny: kliknij oba środki kół na zdjęciu, potem dostrój maskę i rozmiar."};

// One-click examples: same-origin photographs, decoded and analysed in this browser, without uploads.
document.addEventListener("click",e=>{
  const button=e.target.closest("[data-example-src]");if(!button)return;
  const token=++detectionToken,im=new Image();
  button.disabled=true;
  document.querySelector("#detectInfo").textContent="Wczytuję wybrane zdjęcie testowe…";
  im.onload=()=>{button.disabled=false;photo=im;window.lastAutoDetection=undefined;items=[];selected=-1;sync();render();runAutoDetection(im,token);canvas.scrollIntoView({behavior:"smooth",block:"center"})};
  im.onerror=()=>{button.disabled=false;document.querySelector("#detectInfo").textContent="Nie udało się wczytać zdjęcia przykładowego."};
  im.src=button.dataset.exampleSrc;
});
