"use strict";
// Offline OpenCV.js wheel detection. All image processing happens in the browser.
const WheelDetector = (() => {
  const MAX_W=650, CW=1200, CH=800;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function choosePair(candidates,w,h) {
    const pool=candidates.filter(c=>c.y>h*.58 && c.y<h*.94 && c.r>15 && c.r<76);
    let best=null;
    for(let i=0;i<pool.length;i++) for(let j=i+1;j<pool.length;j++){
      const l=pool[i].x<pool[j].x?pool[i]:pool[j],r=pool[i].x<pool[j].x?pool[j]:pool[i];
      const dx=r.x-l.x,dy=Math.abs(r.y-l.y);
      if(dx<w*.40||dx>w*.82||dy>Math.max(45,h*.15))continue;
      if(l.x<w*.07||r.x>w*.95)continue;
      const yavg=(l.y+r.y)/(2*h);
      // Preference for bottom-of-car wheels and a plausible long wheelbase, with similar y positions.
      const score=100
        -Math.abs(yavg-.80)*105
        -Math.abs(dx/w-.62)*60
        -dy/h*85
        -Math.abs(l.r-r.r)*.12
        -(l.index+r.index)*.28;
      if(!best||score>best.score)best={left:l,right:r,score};
    }
    return best;
  }
  // Edge-supported upper wheel-arch trace, approximate (not a semantic car-body segmentation).
  function estimateArch(edge,c,r,w,h){
    const fractions=[-.8,-.5,0,.5,.8];
    const points=[];let found=0;
    for(const fraction of fractions){
      const x=Math.round(c.x+fraction*r*.85);
      if(x<3||x>=w-3)return null;
      const ideal=c.y-r*Math.sqrt(1-fraction*fraction);
      const lo=Math.max(2,Math.round(ideal-r*.5)),hi=Math.min(h-3,Math.round(ideal+r*.5));
      let bestY=null,bestD=Infinity;
      for(let y=lo;y<=hi;y++)for(let xx=x-2;xx<=x+2;xx++){
        if(edge.data[y*w+xx]>0 && Math.abs(y-ideal)<bestD){bestY=y;bestD=Math.abs(y-ideal)}
      }
      if(bestY!==null)found++;
      const yy=bestY===null?ideal:bestY;
      points.push({x:fraction*.85,y:clamp((yy-c.y)/r,-1.25,-.32)});
    }
    // Smooth spikes conservatively while keeping measured arch curvature.
    if(found<3)return null;
    for(let i=1;i<points.length-1;i++){
      const neighbor=(points[i-1].y+points[i+1].y)/2;
      points[i].y=clamp(points[i].y,neighbor-.35,neighbor+.35);
    }
    return points;
  }
  function locate(img){
    if(typeof cv==="undefined"||typeof cv.Mat!=="function"||typeof cv.HoughCircles!=="function")throw Error("OpenCV.js nie jest jeszcze gotowe");
    const scale=Math.min(MAX_W/img.naturalWidth,1),w=Math.round(img.naturalWidth*scale),h=Math.round(img.naturalHeight*scale);
    const off=document.createElement("canvas");off.width=w;off.height=h;
    off.getContext("2d",{willReadFrequently:true}).drawImage(img,0,0,w,h);
    let src,gray,blur,circles,edges;
    try{
      src=cv.imread(off);gray=new cv.Mat();blur=new cv.Mat();circles=new cv.Mat();edges=new cv.Mat();
      cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray,blur,new cv.Size(7,7),1.5,1.5,cv.BORDER_DEFAULT);
      cv.Canny(blur,edges,50,130);
      const candidates=[];
      for(const threshold of [40,35,30]){
        cv.HoughCircles(blur,circles,cv.HOUGH_GRADIENT,1.2,Math.round(w*.18),110,threshold,Math.round(w*.029),Math.round(w*.11));
        const arr=circles.data32F;
        for(let i=0;i<arr.length;i+=3){
          const c={x:arr[i],y:arr[i+1],r:arr[i+2],index:candidates.length};
          if(!candidates.some(z=>Math.hypot(z.x-c.x,z.y-c.y)<w*.018))candidates.push(c);
        }
      }
      const pair=choosePair(candidates,w,h);
      if(!pair)return{ok:false,reason:"Nie znaleziono wiarygodnej pary kół",candidates:candidates.length};
      // Fit the full photo in the working 1200×800 canvas just like render().
      const s=Math.min(CW/img.naturalWidth,CH/img.naturalHeight);
      const leftPadding=(CW-img.naturalWidth*s)/2,topPadding=(CH-img.naturalHeight*s)/2;
      const dx=pair.right.x-pair.left.x;
      // Geometric wheel-rim radius estimate, kept conservative; wheel rims vary independently of tyre size.
      const radius=clamp(dx*.095,18,w*.085)*s/scale;
      const map=c=>({x:leftPadding+c.x*s/scale,y:topPadding+c.y*s/scale,radius,archProfile:estimateArch(edges,c,radius*scale/s,w,h)});
      return{ok:true,wheels:[map(pair.left),map(pair.right)],score:pair.score,candidates:candidates.length,debugCandidates:candidates.filter(c=>c.y>h*.58 && c.y<h*.94).map(c=>({x:Math.round(c.x),y:Math.round(c.y),r:Math.round(c.r),index:c.index})),
        arch:{cut:-18,curve:85,origin:"ellipse-approximation"},
        reason:"Okręgi Hougha i przybliżony profil nadkola z krawędzi Canny; możliwa korekta ręczna"};
    }finally{for(const m of [src,gray,blur,circles,edges])if(m)m.delete()}
  }
  function isReady(){return typeof cv!=="undefined" && typeof cv.Mat==="function" && typeof cv.HoughCircles==="function";}
  async function ready(timeout=12000){
    const start=Date.now();while(!isReady()&&Date.now()-start<timeout)await new Promise(r=>setTimeout(r,90));
    return isReady();
  }
  return{locate,isReady,ready};
})();
