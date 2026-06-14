import { useState, useMemo, useEffect, useCallback } from "react";


const PARTICIPANTS = ["Kurt","Clint","Sidd","Jack","Jeff","Tony","Garrett","Jared","Sean","Clifford","Brad","Lucian","Hugh","Lien"];

// Normalize inconsistent picks from the sheet
const NORM = {
  "Mex":"Mexico","Swiss":"Switzerland","Turkey":"Turkiye","Türkiye":"Turkiye",
  "IC":"Ivory Coast","Ivory coast":"Ivory Coast","Ic":"Ivory Coast",
  "Can":"Canada","SK":"South Korea","Czech":"Czechia","Span":"Spain",
  "Draw":"Tie","draw":"Tie","TIE":"Tie","TIe":"Tie",
  "Argentia":"Argentina","Columbia":"Colombia","Congo":"Congo DR",
  "Bosnia":"Bosnia & Herz.","Bosnia & Herzegovina":"Bosnia & Herz.",
  "TB":"Garrett",
};
function norm(v) {
  if (!v) return "";
  const s = String(v).trim();
  return NORM[s] || s;
}

function parseCSV(csv) {
  const lines = csv.split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  // find header row - must contain both "match" and "result" to skip title rows
  let headerIdx = lines.findIndex(l =>
    l.toLowerCase().includes("match") && l.toLowerCase().includes("result")
  );
  if (headerIdx < 0) headerIdx = 0;
  // use the same quote-aware parser for headers as for data rows
  const headers = [];
  let _cur = "", _inQ = false;
  for (const ch of lines[headerIdx] + ",") {
    if (ch === '"') { _inQ = !_inQ; }
    else if (ch === ',' && !_inQ) { headers.push(_cur.trim()); _cur = ""; }
    else _cur += ch;
  }
  const resultCol = headers.findIndex(h => h.toLowerCase().includes("result"));
  // participant columns: everything after result col
  const participantCols = headers.slice(resultCol + 1).map(h => norm(h)).filter(Boolean);

  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const matches = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (days.some(d => line.startsWith(d))) continue;
    if (line.startsWith("📋")) continue;
    // parse CSV row handling commas inside values
    const cols = [];
    let cur = "", inQ = false;
    for (const ch of line + ",") {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    const matchName = norm(cols[0]);
    if (!matchName || !matchName.includes(" v ")) continue;
    const [home, away] = matchName.split(" v ");
    const result = norm(cols[resultCol]) || null;
    const picks = {};
    participantCols.forEach((p, pi) => {
      const val = norm(cols[resultCol + 1 + pi]);
      if (p) picks[p] = val || "";
    });
    // fill in any missing participants
    PARTICIPANTS.forEach(p => { if (!(p in picks)) picks[p] = ""; });
    matches.push({ m: matchName, h: home.trim(), a: away.trim(), result, picks });
  }
  return matches;
}

const AVATAR_BG=["#1B3A6B","#0F4C75","#1B4332","#7B2D00","#3C1642","#264653","#4A1942","#2D6A4F","#3D0C11","#1A1A2E","#1C3144","#4B3A00","#003D36","#3A003D"];
const AVATAR_FG=["#C8D8F0","#B8D8F8","#B8E8CC","#FFD8B8","#D8C8F0","#C0DCE8","#F0C8E8","#B8E8CC","#FFD0D4","#D0D0F0","#C0D4E8","#FFE8A0","#A0F0E0","#F0A0FF"];

function Avatar({name,size=36,index=0}){
  return(
    <div style={{width:size,height:size,borderRadius:"50%",background:AVATAR_BG[index%14],
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:size*0.36,fontWeight:700,color:AVATAR_FG[index%14],flexShrink:0}}>
      {name.slice(0,2).toUpperCase()}
    </div>
  );
}

function calcScores(matches){
  return PARTICIPANTS.map(p=>{
    let pts=0,correct=0,played=0;
    matches.forEach(m=>{if(!m.result)return;played++;if(m.picks[p]===m.result){pts++;correct++;}});
    return{name:p,pts,correct,played};
  }).sort((a,b)=>b.pts-a.pts);
}

export default function App(){
  const [tab,setTab] = useState("standings");
  const [player,setPlayer] = useState(null);
  const [matchView,setMatchView] = useState("upcoming");
  const [matches,setMatches] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(null);
  const [lastUpdated,setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sheet");
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const csv = await res.text();
      const parsed = parseCSV(csv);
      if (!parsed.length) throw new Error("No match data found in sheet");
      setMatches(parsed);
      setLastUpdated(new Date());
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const scores = useMemo(() => calcScores(matches), [matches]);
  const played = useMemo(() => matches.filter(m => m.result), [matches]);
  const upcoming = useMemo(() => matches.filter(m => !m.result), [matches]);

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#F0F2F5",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",gap:16,fontFamily:"'Inter',system-ui,sans-serif"}}>
      <div style={{fontSize:48}}>⚽</div>
      <div style={{fontSize:16,fontWeight:700,color:"#1B3A6B"}}>Loading Pick'em…</div>
      <div style={{fontSize:12,color:"#9CA3AF"}}>Fetching latest data</div>
    </div>
  );

  if (error) return (
    <div style={{minHeight:"100vh",background:"#F0F2F5",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",gap:12,padding:24,fontFamily:"'Inter',system-ui,sans-serif",textAlign:"center"}}>
      <div style={{fontSize:40}}>⚠️</div>
      <div style={{fontSize:16,fontWeight:700,color:"#1A1F2E"}}>Couldn't load data</div>
      <div style={{fontSize:13,color:"#6B7280",maxWidth:280}}>{error}</div>
      <button onClick={fetchData} style={{marginTop:8,background:"#1B3A6B",color:"#fff",border:"none",
        borderRadius:10,padding:"10px 24px",fontWeight:700,fontSize:14,cursor:"pointer"}}>Try again</button>
    </div>
  );

  return(
    <div style={{background:"#F0F2F5",minHeight:"100vh",fontFamily:"'Inter',system-ui,sans-serif",maxWidth:480,margin:"0 auto"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .card{background:#fff;border-radius:16px;box-shadow:0 1px 4px rgba(0,0,0,0.07)}
        .tap{cursor:pointer;transition:transform 0.1s}.tap:active{transform:scale(0.97)}
        .filt{border:none;border-radius:99px;font-size:13px;font-weight:600;padding:7px 18px;cursor:pointer;font-family:inherit}
        .filt.on{background:#1B3A6B;color:#fff}.filt.off{background:#fff;color:#6B7280}
        .navbtn{background:none;border:none;cursor:pointer;flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 0;font-family:inherit}
        .backbtn{background:none;border:none;cursor:pointer;color:#1B3A6B;font-size:14px;font-weight:700;display:flex;align-items:center;gap:5px;padding:0;font-family:inherit;margin-bottom:16px}
      `}</style>

      {/* HEADER */}
      <div style={{background:"#1B3A6B",padding:"48px 20px 18px",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:3}}>World Cup 2026</div>
            <div style={{fontSize:22,fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>Pick'em Pool</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
            <div style={{background:"rgba(255,255,255,0.12)",borderRadius:12,padding:"8px 12px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:800,color:"#fff",lineHeight:1}}>{played.length}<span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>/{matches.length}</span></div>
              <div style={{fontSize:9,fontWeight:600,color:"rgba(255,255,255,0.4)",letterSpacing:"0.08em",marginTop:1}}>PLAYED</div>
            </div>
            <button onClick={fetchData} style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",
              fontSize:10,cursor:"pointer",fontWeight:600,fontFamily:"inherit"}}>↻ Refresh</button>
          </div>
        </div>
        <div style={{display:"flex",background:"rgba(255,255,255,0.1)",borderRadius:12,padding:4,gap:2}}>
          {[["standings","🏆","Standings"],["matches","⚽","Matches"],["grid","⊞","Grid"]].map(([key,icon,label])=>(
            <button key={key} onClick={()=>{setTab(key);setPlayer(null);}}
              style={{flex:1,border:"none",borderRadius:9,padding:"8px 4px",cursor:"pointer",
                background:tab===key?"#fff":"transparent",
                color:tab===key?"#1B3A6B":"rgba(255,255,255,0.65)",
                fontWeight:tab===key?700:500,fontSize:12,fontFamily:"inherit"}}>
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{padding:"16px 16px 100px"}}>

        {/* STANDINGS */}
        {tab==="standings"&&!player&&(
          <div>
            {scores.length>=3&&(
              <div style={{display:"flex",alignItems:"flex-end",gap:8,marginBottom:16}}>
                {[1,0,2].map((si,pi)=>{
                  const s=scores[si];const heights=[78,100,62];const medals=["🥇","🥈","🥉"];
                  return(
                    <div key={s.name} className="tap" onClick={()=>setPlayer(s.name)}
                      style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
                      <div style={{fontSize:18,marginBottom:5}}>{medals[si]}</div>
                      <Avatar name={s.name} size={40} index={PARTICIPANTS.indexOf(s.name)}/>
                      <div style={{fontSize:12,fontWeight:700,color:"#1B3A6B",margin:"5px 0 4px"}}>{s.name}</div>
                      <div style={{width:"100%",height:heights[pi],background:si===0?"#1B3A6B":"#E8EEF8",
                        borderRadius:"8px 8px 0 0",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:20,fontWeight:800,color:si===0?"#fff":"#1B3A6B"}}>{s.pts}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="card" style={{overflow:"hidden"}}>
              {scores.map((s,i)=>{
                const max=scores[0]?.pts||1;
                return(
                  <div key={s.name} className="tap" onClick={()=>setPlayer(s.name)}
                    style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",
                      borderBottom:i<scores.length-1?"1px solid #F0F2F5":"none"}}>
                    <div style={{width:22,textAlign:"center",fontSize:12,fontWeight:800,
                      color:i===0?"#C9A84C":i===1?"#8E9AAB":i===2?"#B87333":"#D1D5DB"}}>{i+1}</div>
                    <Avatar name={s.name} size={38} index={PARTICIPANTS.indexOf(s.name)}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#1A1F2E",marginBottom:5}}>{s.name}</div>
                      <div style={{height:4,background:"#F0F2F5",borderRadius:2}}>
                        <div style={{height:"100%",width:`${max>0?(s.pts/max)*100:0}%`,background:"#A0B4D6",borderRadius:2}}/>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:20,fontWeight:800,color:"#1B3A6B"}}>{s.pts}</div>
                      <div style={{fontSize:10,color:"#9CA3AF"}}>{s.correct}/{s.played}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {lastUpdated&&<div style={{textAlign:"center",padding:"8px",fontSize:10,color:"#C0C6CE"}}>Updated {lastUpdated.toLocaleTimeString()}</div>}
            <div style={{textAlign:"center",padding:"4px",fontSize:11,color:"#9CA3AF"}}>Tap any player to see their picks</div>
          </div>
        )}

        {/* PLAYER DETAIL */}
        {tab==="standings"&&player&&(()=>{
          const s=scores.find(x=>x.name===player);
          const rank=scores.findIndex(x=>x.name===player)+1;
          const idx=PARTICIPANTS.indexOf(player);
          return(
            <div>
              <button className="backbtn" onClick={()=>setPlayer(null)}>← Standings</button>
              <div className="card" style={{padding:"20px",marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:14}}>
                  <Avatar name={player} size={52} index={idx}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:20,fontWeight:800,color:"#1A1F2E"}}>{player}</div>
                    <div style={{fontSize:13,color:"#6B7280",marginTop:2}}>#{rank} of {PARTICIPANTS.length} players</div>
                  </div>
                  <div style={{background:"#1B3A6B",borderRadius:14,padding:"12px 16px",textAlign:"center"}}>
                    <div style={{fontSize:26,fontWeight:800,color:"#fff",lineHeight:1}}>{s.pts}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.5)",marginTop:2,letterSpacing:"0.06em"}}>PTS</div>
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:16}}>
                  {[["Correct",`${s.correct}/${s.played}`],["Accuracy",`${s.played>0?Math.round(s.correct/s.played*100):0}%`]].map(([label,val])=>(
                    <div key={label} style={{background:"#F8F9FB",borderRadius:12,padding:"12px 14px"}}>
                      <div style={{fontSize:10,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
                      <div style={{fontSize:22,fontWeight:800,color:"#1B3A6B",marginTop:4}}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
              {matches.length>0?(
                <>
                  {played.length>0&&(
                    <>
                      <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,paddingLeft:4}}>Results so far</div>
                      <div className="card" style={{overflow:"hidden",marginBottom:16}}>
                        {played.map((m,i)=>{
                          const pick=m.picks[player];const correct=pick===m.result;
                          return(
                            <div key={m.m} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
                              borderBottom:i<played.length-1?"1px solid #F0F2F5":"none"}}>
                              <div style={{width:26,height:26,borderRadius:"50%",flexShrink:0,
                                background:correct?"#D1FAE5":"#FEE2E2",display:"flex",alignItems:"center",justifyContent:"center",
                                fontSize:12,fontWeight:700,color:correct?"#059669":"#EF4444"}}>{correct?"✓":"✗"}</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:600,color:"#1A1F2E",marginBottom:2}}>{m.m}</div>
                                <div style={{fontSize:11,color:"#9CA3AF"}}>
                                  Picked: <span style={{fontWeight:600,color:correct?"#059669":"#EF4444"}}>{pick||"—"}</span>
                                  <span style={{color:"#D1D5DB"}}> · </span>
                                  Result: <span style={{fontWeight:600,color:"#374151"}}>{m.result}</span>
                                </div>
                              </div>
                              <div style={{fontSize:14,fontWeight:800,color:correct?"#059669":"#D1D5DB"}}>{correct?"+1":"—"}</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {upcoming.length>0&&(
                    <>
                      <div style={{fontSize:11,fontWeight:700,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,paddingLeft:4}}>Upcoming picks</div>
                      <div className="card" style={{overflow:"hidden"}}>
                        {upcoming.map((m,i)=>{
                          const pick=m.picks[player];
                          return(
                            <div key={m.m} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
                              borderBottom:i<upcoming.length-1?"1px solid #F0F2F5":"none"}}>
                              <div style={{width:26,height:26,borderRadius:"50%",flexShrink:0,
                                background:"#F0F2F5",display:"flex",alignItems:"center",justifyContent:"center",
                                fontSize:14}}>⏳</div>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:600,color:"#1A1F2E",marginBottom:2}}>{m.m}</div>
                                <div style={{fontSize:11,color:"#9CA3AF"}}>
                                  Picked: <span style={{fontWeight:600,color:"#1B3A6B"}}>{pick||"—"}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              ):(
                <div className="card" style={{padding:"32px 20px",textAlign:"center"}}>
                  <div style={{fontSize:32,marginBottom:12}}>⏳</div>
                  <div style={{fontSize:15,fontWeight:700,color:"#1A1F2E",marginBottom:6}}>No data yet</div>
                  <div style={{fontSize:13,color:"#9CA3AF"}}>Check back once games kick off</div>
                </div>
              )}
            </div>
          );
        })()}

        {/* MATCHES */}
        {tab==="matches"&&(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:16}}>
              {[["played","Played",played.length],["upcoming","Upcoming",upcoming.length]].map(([key,label,count])=>(
                <button key={key} className={`filt ${matchView===key?"on":"off"}`} onClick={()=>setMatchView(key)}>
                  {label} <span style={{opacity:0.6,fontSize:11}}>{count}</span>
                </button>
              ))}
            </div>
            {(matchView==="played"?played:upcoming).length===0?(
              <div className="card" style={{padding:"32px 20px",textAlign:"center"}}>
                <div style={{fontSize:32,marginBottom:12}}>{matchView==="played"?"⏳":"✅"}</div>
                <div style={{fontSize:15,fontWeight:700,color:"#1A1F2E"}}>
                  {matchView==="played"?"No results yet":"All games complete!"}
                </div>
              </div>
            ):(matchView==="played"?played:upcoming).map(m=>{
              const counts={};
              PARTICIPANTS.forEach(p=>{const pk=m.picks[p];if(pk)counts[pk]=(counts[pk]||0)+1;});
              return(
                <div key={m.m} className="card" style={{padding:"16px",marginBottom:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:m.result?14:0}}>
                    <div style={{flex:1,textAlign:"right",fontSize:15,fontWeight:700,color:m.result===m.h?"#1B3A6B":"#1A1F2E"}}>{m.h}</div>
                    <div style={{padding:"5px 10px",borderRadius:8,background:"#F0F2F5",minWidth:46,textAlign:"center",flexShrink:0}}>
                      {m.result
                        ?<span style={{fontSize:10,fontWeight:700,color:"#1B3A6B"}}>{m.result==="Tie"?"TIE":m.result===m.h?"W—L":"L—W"}</span>
                        :<span style={{fontSize:11,fontWeight:600,color:"#9CA3AF"}}>vs</span>}
                    </div>
                    <div style={{flex:1,fontSize:15,fontWeight:700,color:m.result===m.a?"#1B3A6B":"#1A1F2E"}}>{m.a}</div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:14}}>
                      {[m.h,"Tie",m.a].map(opt=>{
                        const count=counts[opt]||0;const win=opt===m.result;
                        return(
                          <div key={opt} style={{borderRadius:10,padding:"10px 6px",textAlign:"center",
                            background:win?"#EEF2FF":"#F8F9FB",border:`1.5px solid ${win?"#1B3A6B":"#E5E7EB"}`}}>
                            <div style={{fontSize:11,fontWeight:600,color:win?"#1B3A6B":"#6B7280",marginBottom:4,
                              whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                              {opt==="Tie"?"— Tie —":opt}
                            </div>
                            <div style={{fontSize:22,fontWeight:800,color:win?"#1B3A6B":"#9CA3AF",lineHeight:1.2}}>{count}</div>
                            <div style={{fontSize:10,color:win?"#4F6FAE":"#C0C6CE"}}>picks</div>
                          </div>
                        );
                      })}
                    </div>
                </div>
              );
            })}
          </div>
        )}

        {/* GRID */}
        {tab==="grid"&&(
          played.length===0?(
            <div className="card" style={{padding:"32px 20px",textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:12}}>⏳</div>
              <div style={{fontSize:15,fontWeight:700,color:"#1A1F2E",marginBottom:6}}>No results yet</div>
              <div style={{fontSize:13,color:"#9CA3AF"}}>The grid fills in as games are played</div>
            </div>
          ):(
            <div>
              <div style={{fontSize:11,color:"#9CA3AF",marginBottom:12}}>Played games · Scroll →</div>
              <div className="card" style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"collapse",fontSize:11,minWidth:600}}>
                  <thead>
                    <tr style={{background:"#F8F9FB"}}>
                      <th style={{padding:"10px 12px",textAlign:"left",color:"#6B7280",fontWeight:700,
                        position:"sticky",left:0,background:"#F8F9FB",whiteSpace:"nowrap",
                        borderBottom:"2px solid #E5E7EB",minWidth:120,zIndex:2}}>Match</th>
                      {scores.map(s=>(
                        <th key={s.name} style={{padding:"10px 5px",textAlign:"center",whiteSpace:"nowrap",
                          borderBottom:"2px solid #E5E7EB",color:"#6B7280",fontWeight:600,fontSize:10}}>
                          {s.name.slice(0,5)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {played.map((m,ri)=>(
                      <tr key={m.m} style={{background:ri%2===0?"#fff":"#FAFAFA"}}>
                        <td style={{padding:"7px 12px",fontWeight:500,color:"#374151",whiteSpace:"nowrap",
                          position:"sticky",left:0,background:ri%2===0?"#fff":"#FAFAFA",
                          borderBottom:"1px solid #F0F2F5",zIndex:1}}>
                          {m.h.split(" ")[0]} v {m.a.split(" ")[0]}
                        </td>
                        {scores.map(s=>{
                          const pick=m.picks[s.name];const ok=pick===m.result;
                          return(
                            <td key={s.name} style={{textAlign:"center",padding:"5px 3px",borderBottom:"1px solid #F0F2F5"}}>
                              <div style={{width:22,height:22,borderRadius:5,margin:"0 auto",
                                background:ok?"#D1FAE5":"#FEE2E2",display:"flex",alignItems:"center",justifyContent:"center",
                                fontSize:10,fontWeight:800,color:ok?"#059669":"#EF4444"}}>{ok?"✓":"✗"}</div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card" style={{marginTop:10,padding:"12px 16px"}}>
                <div style={{display:"flex",flexWrap:"wrap"}}>
                  {scores.map(s=>(
                    <div key={s.name} style={{width:`${100/scores.length}%`,textAlign:"center"}}>
                      <div style={{fontSize:9,fontWeight:700,color:"#6B7280"}}>{s.name.slice(0,5)}</div>
                      <div style={{fontSize:15,fontWeight:800,color:"#1B3A6B"}}>{s.pts}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* BOTTOM NAV */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
        width:"100%",maxWidth:480,background:"#fff",borderTop:"1px solid #E5E7EB",
        display:"flex",paddingBottom:8,zIndex:20}}>
        {[["standings","🏆","Standings"],["matches","⚽","Matches"],["grid","⊞","Grid"]].map(([key,icon,label])=>(
          <button key={key} className="navbtn" onClick={()=>{setTab(key);setPlayer(null);}}
            style={{color:tab===key?"#1B3A6B":"#9CA3AF"}}>
            <span style={{fontSize:20}}>{icon}</span>
            <span style={{fontSize:10,fontWeight:tab===key?700:500}}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
