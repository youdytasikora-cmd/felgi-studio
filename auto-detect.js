"use strict";
// Felgi Studio: offline CV-only wheel detector. No requests or image uploads.
const WheelDetector=(()=>{
 const W=650,CW=1200,CH=800,clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 function estimateArch(edge,c,r,w,h){
  const fractions=[-.8,-.5,0,.5,.8],points=[];let found=0;
  for(const f of fractions){
   const x=Math.round(c.x+f*r*.85);if(x<3||x>=w-3)return null;
   const ideal=c.y-r*Math.sqrt(1-f*f),lo=Math.max(2,Math.round(ideal-r*.5)),hi=Math.min(h-3,Math.round(ideal+r*.5));
   let by=null,bd=Infinity;
   for(let y=lo;y<=hi;y++)for(let xx=x-2;xx<=x+2;xx++)if(edge.data[y*w+xx]>0&&Math.abs(y-ideal)<bd){bd=Math.abs(y-ideal);by=y}
   if(by!==null)found++;
   points.push({x:f*.85,y:clamp(((by===null?ideal:by)-c.y)/r,-1.25,-.32)});
  }
  if(found<3)return null;
  for(let i=1;i<points.length-1;i++){let avg=(points[i-1].y+points[i+1].y)/2;points[i].y=clamp(points[i].y,avg-.35,avg+.35)}
  return points;
 }
 function sampleBrightness(gray,c,r){
  const data=gray.data,w=gray.cols,h=gray.rows;let sum=0,n=0;
  for(let y=Math.max(0,Math.round(c.y-r*.55));y<Math.min(h,Math.round(c.y+r*.55));y+=2)
   for(let x=Math.max(0,Math.round(c.x-r*.55));x<Math.min(w,Math.round(c.x+r*.55));x+=2)
    if((x-c.x)**2+(y-c.y)**2<r*r*.30){sum+=data[y*w+x];n++}
  return n?sum/n:255;
 }
 function ellipseCandidates(gray,blur,edges){
  const mats=[{name:"dark",mask:new cv.Mat()},{name:"edge",mask:edges},{name:"adaptive",mask:new cv.Mat()}],output=[];
  try{
   cv.threshold(blur,mats[0].mask,85,255,cv.THRESH_BINARY_INV);
   cv.adaptiveThreshold(blur,mats[2].mask,255,cv.ADAPTIVE_THRESH_GAUSSIAN_C,cv.THRESH_BINARY_INV,31,5);
   for(const item of mats){
    const contours=new cv.MatVector(),hierarchy=new cv.Mat();
    try{
     cv.findContours(item.mask,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
     for(let k=0;k<contours.size();k++){
      const contour=contours.get(k);
      try{
       if(contour.rows<12)continue;
       const e=cv.fitEllipse(contour),x=e.center.x,y=e.center.y,a=Math.max(e.size.width,e.size.height)/2,b=Math.min(e.size.width,e.size.height)/2;
       if(!(b>13&&b<71&&a>17&&a<81&&a/b<3.3&&y>gray.rows*.29&&y<gray.rows*.94&&x>gray.cols*.025&&x<gray.cols*.97))continue;
       const area=cv.contourArea(contour),fill=area/(Math.PI*a*b);
       if(fill<.48||fill>1.4)continue;
       const data=gray.data,w=gray.cols,h=gray.rows,x1=Math.max(0,Math.floor(x-a*.65)),x2=Math.min(w,Math.ceil(x+a*.65)),y1=Math.max(0,Math.floor(y-b*.65)),y2=Math.min(h,Math.ceil(y+b*.65));
       let sum=0,sum2=0,count=0;
       for(let yy=y1;yy<y2;yy+=2)for(let xx=x1;xx<x2;xx+=2){const v=data[yy*w+xx];sum+=v;sum2+=v*v;count++}
       const std=Math.sqrt(Math.max(0,sum2/count-Math.pow(sum/count,2)));
       if(std<9)continue;
       const score=(item.name==="dark"?4:item.name==="edge"?3:2)+Math.min(4,fill*4)+Math.min(3,std/13)+Math.min(1,a/60);
       output.push({x,y,a,b,score,method:item.name});
      }finally{contour.delete()}
     }
    }finally{contours.delete();hierarchy.delete()}
   }
   output.sort((a,b)=>b.score-a.score);
   const unique=[];
   for(const c of output)if(!unique.some(t=>Math.hypot(c.x-t.x,c.y-t.y)<Math.max(13,Math.min(c.b,t.b)*.55)))unique.push(c);
   return unique.slice(0,55);
  }finally{mats[0].mask.delete();mats[2].mask.delete()}
 }
 function ellipsePair(candidates,w,h){
  let best=null;
  for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){
   const a=candidates[i],b=candidates[j],left=a.x<b.x?a:b,right=a.x<b.x?b:a;
   const dx=right.x-left.x,dy=Math.abs(right.y-left.y),ratio=Math.max(left.a,right.a)/Math.min(left.a,right.a);
   if(dx<=w*.17||dx>=w*.85||dy>=h*.32||ratio>=3)continue;
   // On 3/4 views the wheel nearest camera is larger and lower. Reject hood/body ellipses.
   if(dy>h*.08){
    const lower=left.y>right.y?left:right,upper=left.y>right.y?right:left;
    if(lower.a<upper.a*.96)continue;
   }
   if(dy>h*.1&&dx>w*.56)continue;
   const score=left.score+right.score-dy/h*6-Math.abs(dx/w-.58)*4+(left.y+right.y)/h*1.5;
   if(!best||score>best.score)best={left,right,score};
  }
  return best;
 }
 function houghFallback(gray,blur,photoAspect){
  const c=new cv.Mat(),all=[];
  try{
   for(const th of [40,35,30]){
    cv.HoughCircles(blur,c,cv.HOUGH_GRADIENT,1.2,Math.round(gray.cols*.18),110,th,Math.round(gray.cols*.029),Math.round(gray.cols*.11));
    for(let j=0;j<c.data32F.length;j+=3){
     const v={x:c.data32F[j],y:c.data32F[j+1],r:c.data32F[j+2],index:all.length};
     if(!all.some(z=>Math.hypot(v.x-z.x,v.y-z.y)<gray.cols*.018))all.push(v);
    }
   }
   const pool=all.filter(c=>c.y>gray.rows*(photoAspect>1.95?.57:.69)&&c.y<gray.rows*.94&&c.r>15&&c.r<76),w=gray.cols,h=gray.rows;
   let best=null;
   for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++){
    const l=pool[i].x<pool[j].x?pool[i]:pool[j],r=pool[i].x<pool[j].x?pool[j]:pool[i],dx=r.x-l.x,dy=Math.abs(r.y-l.y);
    if(dx<w*.4||dx>w*.82||dy>Math.min(75,h*(photoAspect>1.95?.18:.045))||(l.y+r.y)/(2*h)<.72||l.x<w*.07||r.x>w*.95)continue;
    // Avoid pale gravel/road and dark hood mistaken for two wheels.
    const L=sampleBrightness(gray,l,l.r),R=sampleBrightness(gray,r,r.r);
    if(L>=110||R>=110)continue;
    const score=100-Math.abs((l.y+r.y)/(2*h)-.8)*105-Math.abs(dx/w-.62)*60-dy/h*85-(l.index+r.index)*.28;
    if(!best||score>best.score)best={left:l,right:r,score};
   }
   return best;
  }finally{c.delete()}
 }
 function locate(img){
  if(typeof cv==="undefined"||typeof cv.Mat!=="function")throw Error("OpenCV.js niegotowe");
  const scale=Math.min(W/img.naturalWidth,1),w=Math.round(img.naturalWidth*scale),h=Math.round(img.naturalHeight*scale);
  const off=document.createElement("canvas");off.width=w;off.height=h;off.getContext("2d").drawImage(img,0,0,w,h);
  let source,gray,blur,edges;
  try{
   source=cv.imread(off);gray=new cv.Mat();blur=new cv.Mat();edges=new cv.Mat();
   cv.cvtColor(source,gray,cv.COLOR_RGBA2GRAY);
   cv.GaussianBlur(gray,blur,new cv.Size(5,5),1.2,1.2,cv.BORDER_DEFAULT);
   cv.Canny(blur,edges,45,120);
   const ellipses=ellipseCandidates(gray,blur,edges),pair=ellipsePair(ellipses,w,h);
   let method,chosen,confidence;
   if(pair&&pair.score>=20.3){chosen=[pair.left,pair.right];method="contour-ellipses";confidence=pair.score}
   else{
    const fallback=houghFallback(gray,blur,img.naturalWidth/img.naturalHeight);
    if(fallback){chosen=[fallback.left,fallback.right].map(c=>({x:c.x,y:c.y,a:c.r,b:c.r,method:"hough"}));method="validated-side-profile-hough";confidence=fallback.score}
   }
   if(!chosen)return{ok:false,needsManual:true,reason:"Wykrycie niepewne: nie będziemy nakładać felg na przypadkowe obszary. Przeciągnij felgi na koła.",candidates:ellipses.length,method:"safe-manual"};
   const s=Math.min(CW/img.naturalWidth,CH/img.naturalHeight),xPad=(CW-img.naturalWidth*s)/2,yPad=(CH-img.naturalHeight*s)/2;
   const wheels=chosen.map(c=>{
    const radius=c.a*s/scale;
    return{x:xPad+c.x*s/scale,y:yPad+c.y*s/scale,radius:clamp(radius,25,125),
      widthScale:Math.round(clamp(c.b/c.a*.98, .38,1)*100),
      archProfile:estimateArch(edges,c,c.a,w,h)};
   });
   return{ok:true,wheels,method,score:confidence,arch:{cut:-18,curve:85},reason:"Wykryto kontury opon (także elipsy) albo zweryfikowane koła boczne; dopasowanie można poprawić ręcznie."};
  }finally{for(const m of [source,gray,blur,edges])if(m)m.delete()}
 }
 function isReady(){return typeof cv!=="undefined"&&typeof cv.Mat==="function"&&typeof cv.findContours==="function"&&typeof cv.fitEllipse==="function"}
 async function ready(timeout=12000){const start=Date.now();while(!isReady()&&Date.now()-start<timeout)await new Promise(r=>setTimeout(r,90));return isReady()}
 return{locate,isReady,ready};
})();
