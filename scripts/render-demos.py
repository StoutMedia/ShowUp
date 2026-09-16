"""Render original, simplified side-view exercise diagrams as looping H.264 clips.
Requires Pillow and ffmpeg. No third-party exercise artwork is used.
"""
from PIL import Image, ImageDraw, ImageFont
import math, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'/'demos';OUT.mkdir(parents=True,exist_ok=True)
W,H,FPS,N=640,440,24,144
BG='#171b15';FG='#f2f5e9';ACC='#d7ff3f';MUT='#667058'
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13)
def mix(a,b,t):return tuple(x+(y-x)*t for x,y in zip(a,b))
def joint(a,b,l1,l2,sign=1):
 dx,dy=b[0]-a[0],b[1]-a[1];dist=max(.001,math.hypot(dx,dy));dist=min(dist,l1+l2-.01)
 z=(l1*l1-l2*l2+dist*dist)/(2*dist);h=math.sqrt(max(0,l1*l1-z*z));ux,uy=dx/math.hypot(dx,dy),dy/math.hypot(dx,dy)
 return(a[0]+ux*z-sign*uy*h,a[1]+uy*z+sign*ux*h)
def line(d,pts,color=FG,width=13):
 d.line(pts,fill=color,width=width,joint='curve')
 for x,y in pts:d.ellipse((x-width/2,y-width/2,x+width/2,y+width/2),fill=color)
def frame(kind,i):
 im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im);t=(1-math.cos(2*math.pi*i/N))/2
 d.text((24,18),'SHOW UP. / MOVEMENT DEMO',font=font,fill=ACC)
 d.text((24,43),'Simplified side view',font=small,fill='#b6bea8')
 d.line((70,374,570,374),fill=MUT,width=2)
 if kind in ['squat','squat-alt']:
  hip=mix((315,202),(245,304),t);shoulder=mix((315,107),(277,212),t);ankle=(330,361);knee=joint(hip,ankle,80,79,-1)
  line(d,[(209,319),(270,319)],MUT,10);line(d,[(215,320),(215,371)],MUT,7);line(d,[(265,320),(265,371)],MUT,7)
  hand=mix((374,187),(374,235),t) if kind=='squat' else mix((340,208),(330,306),t)
  elbow=joint(shoulder,hand,56,56,1)
  phase=('LOWER WITH CONTROL' if i<N/2 else 'STAND SMOOTHLY')
 elif kind in ['row','row-alt','press']:
  hip=(270,296);shoulder=(270,185);knee=(347,304);ankle=(367,360)
  line(d,[(231,310),(302,310)],MUT,10);line(d,[(245,310),(245,371)],MUT,7)
  if kind=='press':
   line(d,[(246,207),(246,300)],MUT,12)
   hand=mix((308,225),(380,209),t);elbow=joint(shoulder,hand,65,62,1)
   line(d,[(440,120),(440,365)],MUT,7);line(d,[(440,120),hand],MUT,5)
   phase='PRESS SMOOTHLY' if i<N/2 else 'RETURN WITH CONTROL'
  else:
   hand=mix((389,211),(285,244),t);elbow=joint(shoulder,hand,68,65,1)
   if kind=='row':
    line(d,[(495,162),(495,369)],MUT,8);d.rectangle((477,265,513,350),outline=MUT,width=3)
   else:
    line(d,[(495,230),(495,370)],MUT,6)
   line(d,[hand,(495,244)],ACC,3 if kind=='row' else 6)
   phase='DRAW ELBOWS BACK' if i<N/2 else 'RETURN WITH CONTROL'
 else:
  ankle=(255,360);theta=.2+.24*t;hip=(ankle[0]+math.sin(theta)*128,ankle[1]-math.cos(theta)*128);shoulder=(ankle[0]+math.sin(theta)*237,ankle[1]-math.cos(theta)*237);knee=mix(ankle,hip,.53);hand=(427,180);elbow=joint(shoulder,hand,69,67,1)
  line(d,[(439,95),(439,371)],MUT,10);phase='LOWER TOWARD WALL' if i<N/2 else 'PRESS AWAY'
 # A stable torso, connected limb segments, a clear handle, and a fixed foot position.
 line(d,[hip,knee,ankle],FG,17);line(d,[hip,shoulder],FG,23)
 neck=(shoulder[0]-1,shoulder[1]-17);line(d,[shoulder,neck],FG,13)
 head=(neck[0]+2,neck[1]-19);d.ellipse((head[0]-17,head[1]-19,head[0]+17,head[1]+19),fill=FG)
 line(d,[shoulder,elbow,hand],ACC,11);line(d,[(ankle[0]-8,369),(ankle[0]+23,369)],FG,10)
 d.ellipse((hand[0]-7,hand[1]-7,hand[0]+7,hand[1]+7),fill=ACC)
 d.text((24,399),phase,font=font,fill=ACC);d.text((476,401),'6 SEC / LOOP',font=small,fill='#b6bea8')
 return im
for kind in ['squat','squat-alt','row','row-alt','press','press-alt']:
 proc=subprocess.Popen(['ffmpeg','-y','-loglevel','error','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','slow','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/f'{kind}.mp4')],stdin=subprocess.PIPE)
 for i in range(N):proc.stdin.write(frame(kind,i).tobytes())
 proc.stdin.close()
 if proc.wait():raise RuntimeError(kind)
 frame(kind,0).save(OUT/f'{kind}.png')
# Contact sheet for checking the two extremes of every movement.
sheet=Image.new('RGB',(W*2,H*6),BG)
for row,kind in enumerate(['squat','squat-alt','row','row-alt','press','press-alt']):
 for col,i in enumerate([0,N//2]):sheet.paste(frame(kind,i),(col*W,row*H))
sheet.save('/tmp/showup-demo-review.png')
