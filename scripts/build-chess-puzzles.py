# Builds public/chess-puzzles from the public-domain (CC0) puzzle CSV (lichess_db_puzzle.csv.zst).
# Usage: pip install zstandard chess; download the .csv.zst to /tmp; python3 scripts/build-chess-puzzles.py
# Every included solution is checked move-by-move for legality while building.
import zstandard,io,csv,json,math,os,random,collections,chess
LEVELS=[("beginner","Beginner",0,1000),("easy","Easy",1000,1400),("medium","Medium",1400,1800),("hard","Hard",1800,2200),("expert","Expert",2200,4000)]
PER_LEVEL=80000; BIN=100; CHUNK=4000
r=zstandard.ZstdDecompressor().stream_reader(open('/tmp/lichess_db_puzzle.csv.zst','rb'))
rows=csv.reader(io.TextIOWrapper(r,encoding='utf-8')); next(rows)
bins=collections.defaultdict(list)
for x in rows:
    R,RD,P,N=int(x[3]),int(x[4]),int(x[5]),int(x[6])
    if RD>80 or P<88 or N<300: continue
    score=P*2+math.log10(N)*10-RD*0.3
    bins[R//BIN].append((score,x[0],x[1],x[2],R,x[7]))
out={}
for key,name,lo,hi in LEVELS:
    bl=[b for b in sorted(bins) if lo<=b*BIN<hi]
    # equal share per 100-pt bin, redistribute leftovers
    pools={b:sorted(bins[b],reverse=True) for b in bl}
    take={b:0 for b in bl}; left=PER_LEVEL
    while left>0:
        open_=[b for b in bl if take[b]<len(pools[b])]
        if not open_: break
        share=max(1,left//len(open_))
        for b in open_:
            t=min(share,len(pools[b])-take[b],left); take[b]+=t; left-=t
            if left<=0: break
    sel=[p for b in bl for p in pools[b][:take[b]]]
    out[key]=sel; print(key,len(sel),{b*BIN:take[b] for b in bl})
theme_count=collections.Counter(t for k in out for p in out[k] for t in p[5].split())
THEMES=[t for t,_ in theme_count.most_common()]
TI={t:i for i,t in enumerate(THEMES)}
dst=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','public','chess-puzzles'); __import__('shutil').rmtree(dst, ignore_errors=True); os.makedirs(dst)
manifest={"version":2,"themes":THEMES,"levels":[]}
bad=0; total=0
for key,name,lo,hi in LEVELS:
    sel=sorted(out[key],key=lambda p:(p[4],p[1]))
    chunks=[]; lt=collections.Counter()
    for ci in range(0,len(sel),CHUNK):
        part=sel[ci:ci+CHUNK]; arr=[]
        for s,pid,fen,moves,R,themes in part:
            # full legality check offline
            b=chess.Board(fen)
            for u in moves.split():
                m=chess.Move.from_uci(u)
                if m not in b.legal_moves: bad+=1; break
                b.push(m)
            f=fen.split(' '); arr.append([pid,' '.join(f[:4]),moves,R,[TI[t] for t in themes.split()]])
            lt.update(themes.split())
        fn=f"{key}-{ci//CHUNK:03d}.json"
        with open(f"{dst}/{fn}","w") as fh: json.dump(arr,fh,separators=(',',':'))
        tc=collections.Counter(i for a in arr for i in a[4])
        chunks.append({"f":fn,"n":len(arr),"min":part[0][4],"max":part[-1][4],"t":{str(k):v for k,v in sorted(tc.items())}})
    total+=len(sel)
    manifest["levels"].append({"id":key,"name":name,"stars":len(manifest["levels"])+1,"min":lo,"max":hi,"count":len(sel),"chunks":chunks,"themes":{TI[t]:c for t,c in lt.items()}})
with open(f"{dst}/manifest.json","w") as fh: json.dump(manifest,fh,separators=(',',':'))
print('total',total,'illegal',bad,'themes',len(THEMES))
