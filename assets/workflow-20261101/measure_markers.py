from pathlib import Path
from PIL import Image,ImageDraw
from collections import deque
import json,math
p=Path(__file__).parent;d=p/'downloads';out=p/'marker-measurements';out.mkdir(exist_ok=True)
rois=[(460,300,665,605),(270,145,566,580),(290,130,540,490),(365,315,765,590),(205,210,637,515),(198,160,633,460),(415,300,710,605),(205,145,637,580),(245,135,588,482)]
colors={'TL':(205,104,81),'TR':(224,188,86),'BL':(107,143,184),'BR':(165,125,176)}
rows=[]
for k,f in enumerate(sorted(d.glob('[0-9][0-9]-*.jpg'))):
 im=Image.open(f).convert('RGB');roi=rois[k];crop=im.crop(roi);pix=crop.load();W,H=crop.size;found={}
 for name,col in colors.items():
  mask=set()
  for y in range(H):
   for x in range(W):
    rgb=pix[x,y]
    if sum((rgb[c]-col[c])**2 for c in range(3))<=35**2:mask.add((x,y))
  comps=[]
  while mask:
   start=mask.pop();q=deque([start]);xs=[];ys=[]
   while q:
    x,y=q.popleft();xs.append(x);ys.append(y)
    for n in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)]:
     if n in mask:mask.remove(n);q.append(n)
   x0,x1,y0,y1=min(xs),max(xs),min(ys),max(ys);bw=x1-x0+1;bh=y1-y0+1
   if len(xs)>=35 and .6<=bw/bh<=1.6 and len(xs)/(bw*bh)>.4:comps.append({'box':[x0+roi[0],y0+roi[1],x1+roi[0],y1+roi[1]],'pixels':len(xs)})
  # Largest roughly square component in this artwork ROI; horizontal colourbars excluded by shape.
  found[name]=max(comps,key=lambda c:c['pixels']) if comps else None
 if all(found.values()):
  B={a:b['box'] for a,b in found.items()}
  # Marker outer edges identify the whole source-art bounds. Average opposing sides.
  w=((B['TR'][2]-B['TL'][0]+1)+(B['BR'][2]-B['BL'][0]+1))/2
  h=((B['BL'][3]-B['TL'][1]+1)+(B['BR'][3]-B['TR'][1]+1))/2
  expected=[2/3,1.5,1][k//3]
  row={'file':f.name,'manual_artwork_roi':list(roi),'markers':found,'projected_width_px':w,'projected_height_px':h,'projected_ratio':w/h,'source_ratio':expected,'relative_difference_percent':100*(w/h/expected-1),'method':'RGB distance <=35 to known corner-marker colours; 4-connected components, >=35pixels, bbox aspect0.6..1.6 and fill>0.4; largest remaining component per marker in manually bounded artwork ROI. Projected outer edge dimensions, no source-ratio fitting or perspective correction.'}
  dr=ImageDraw.Draw(crop)
  for n,b in B.items():
   box=[b[0]-roi[0],b[1]-roi[1],b[2]-roi[0],b[3]-roi[1]];dr.rectangle(box,outline='red',width=1);dr.text((box[0],box[1]),n,fill='red')
  crop.resize((crop.width*2,crop.height*2)).save(out/(f.stem+'-bounds.png'))
 else:row={'file':f.name,'markers':found,'measurement_incomplete':True}
 rows.append(row)
(p/'marker-ratios.json').write_text(json.dumps(rows,indent=2)+'\n')
for r in rows:print(r['file'][:2],r.get('projected_width_px'),r.get('projected_height_px'),round(r.get('projected_ratio',0),5),round(r.get('relative_difference_percent',0),2))
