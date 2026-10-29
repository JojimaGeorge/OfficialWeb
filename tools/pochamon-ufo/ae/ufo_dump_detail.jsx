/* 詳細コンポの全レイヤー（効果の数値と式）と、最前モモンガの口のパペットのピンのキー */
var LOG=[];
function log(s){ LOG.push(String(s)); var f=new File("C:/Users/spitz/dev/ai-illust/ae/ufo_dump3.log"); f.encoding="UTF-8"; f.open("w"); f.write(LOG.join("\n")); f.close(); }
function flat(s){ return String(s).split("\n").join(" ").split("\r").join(" "); }
function v2s(v){ if(v instanceof Array) return "["+v.join(", ")+"]"; return String(v); }
function dumpProp(pr, indent, maxKeys){
  var line=indent+pr.name+" ["+pr.matchName+"] = ";
  try{ line+=v2s(pr.value); }catch(e){ line+="?"; }
  try{ if(pr.numKeys>0){ line+="  keys("+pr.numKeys+"):"; for(var k=1;k<=pr.numKeys&&k<=maxKeys;k++){ line+=" t"+pr.keyTime(k).toFixed(3)+"="+v2s(pr.keyValue(k)); } } }catch(e){}
  try{ if(pr.expression&&pr.expression.length>0) line+="  式: "+flat(pr.expression); }catch(e){}
  log(line);
}
function walk(pg, indent, depth){
  if(depth>6) return;
  for(var i=1;i<=pg.numProperties;i++){
    var pr=pg.property(i);
    try{
      if(pr.propertyType==PropertyType.PROPERTY){ dumpProp(pr, indent, 12); }
      else { log(indent+"+ "+pr.name+" ["+pr.matchName+"] ("+pr.numProperties+")"); walk(pr, indent+"  ", depth+1); }
    }catch(e){ log(indent+"(err "+e+")"); }
  }
}
log("1 開始");
try{
  app.beginSuppressDialogs();
  app.open(new File("E:/イラスト/ぽちゃもん/1_アニメ/UFOキャッチャー/UFOキャッチャー.aep"));
  var p=app.project;
  var detail=null, front=null;
  for(var i=1;i<=p.numItems;i++){ var it=p.item(i); if(!(it instanceof CompItem)) continue; if(it.name=="詳細") detail=it; if(it.name=="最前モモンガ") front=it; }
  if(detail){
    log("=== コンポ 詳細 "+detail.width+"x"+detail.height+" "+detail.frameRate+"fps "+detail.duration.toFixed(2)+"秒 レイヤー"+detail.numLayers);
    for(var L=1;L<=detail.numLayers;L++){
      var lay=detail.layer(L);
      var src=""; try{ if(lay.source) src=lay.source.name; }catch(e){}
      var par=""; try{ if(lay.parent) par=" parent="+lay.parent.name; }catch(e){}
      var tm=""; try{ if(lay.timeRemapEnabled) tm=" timeRemap=ON"; }catch(e){}
      log("  ["+L+"] "+lay.name+(src!=""&&src!=lay.name?" (src "+src+")":"")+" enabled="+lay.enabled+" in="+lay.inPoint.toFixed(2)+" out="+lay.outPoint.toFixed(2)+" start="+lay.startTime.toFixed(2)+par+tm);
      try{ var tr=lay.property("ADBE Transform Group"); var names=["ADBE Anchor Point","ADBE Position","ADBE Scale","ADBE Rotate Z","ADBE Opacity"]; for(var n=0;n<names.length;n++){ var pr=tr.property(names[n]); if(pr) dumpProp(pr,"      ",30); } }catch(e){ log("      transform err "+e); }
      try{ var rm=lay.property("ADBE Time Remapping"); if(rm) dumpProp(rm,"      ",30); }catch(e){}
      try{ var ef=lay.property("ADBE Effect Parade"); if(ef&&ef.numProperties>0){ for(var e2=1;e2<=ef.numProperties;e2++){ var fx=ef.property(e2); log("      効果 "+fx.name+" ["+fx.matchName+"] enabled="+fx.enabled); for(var k=1;k<=fx.numProperties;k++){ try{ dumpProp(fx.property(k),"        "+k+" ",8); }catch(err){} } } } }catch(e){ log("      effect err "+e); }
    }
  } else log("詳細 が無い");
  if(front){
    log("=== 最前モモンガ の口（パペット）");
    for(var L2=1;L2<=front.numLayers;L2++){ var ly=front.layer(L2); if(ly.name.indexOf("口")<0) continue; var ef2=ly.property("ADBE Effect Parade"); for(var e3=1;e3<=ef2.numProperties;e3++){ var fx2=ef2.property(e3); log("  効果 "+fx2.name+" ["+fx2.matchName+"]"); walk(fx2,"    ",0); } }
  }
  app.endSuppressDialogs(false);
}catch(e){ log("エラー: "+e.toString()+" line "+e.line); }
log("=== DONE");
app.quit();
