/* 最前モモンガ・目閉じ・全体 の3コンポだけ：レイヤー・変形のキー・効果の数値と式 */
var LOG=[];
function log(s){ LOG.push(String(s)); var f=new File("C:/Users/spitz/dev/ai-illust/ae/ufo_dump2.log"); f.encoding="UTF-8"; f.open("w"); f.write(LOG.join("\n")); f.close(); }
function flat(s){ return String(s).split("\n").join(" ").split("\r").join(" "); }
function v2s(v){ if(v instanceof Array) return "["+v.join(", ")+"]"; return String(v); }
function dumpProp(pr, indent, maxKeys){
  var line=indent+pr.name+" = ";
  try{ line+=v2s(pr.value); }catch(e){ line+="?"; }
  try{ if(pr.numKeys>0){ line+="  keys("+pr.numKeys+"):"; for(var k=1;k<=pr.numKeys&&k<=maxKeys;k++){ line+=" t"+pr.keyTime(k).toFixed(3)+"="+v2s(pr.keyValue(k)); } } }catch(e){}
  try{ if(pr.expression&&pr.expression.length>0) line+="  式: "+flat(pr.expression); }catch(e){}
  log(line);
}
log("1 開始");
try{
  app.beginSuppressDialogs();
  app.open(new File("E:/イラスト/ぽちゃもん/1_アニメ/UFOキャッチャー/UFOキャッチャー.aep"));
  var p=app.project;
  var want={"最前モモンガ":1,"目閉じ":1,"全体":1};
  for(var i=1;i<=p.numItems;i++){
    var it=p.item(i);
    if(!(it instanceof CompItem)) continue;
    if(!want[it.name]) continue;
    log("=== コンポ "+it.name+" "+it.width+"x"+it.height+" "+it.frameRate+"fps "+it.duration.toFixed(2)+"秒 レイヤー"+it.numLayers);
    for(var L=1;L<=it.numLayers;L++){
      var lay=it.layer(L);
      var src=""; try{ if(lay.source) src=lay.source.name; }catch(e){}
      var par=""; try{ if(lay.parent) par=" parent="+lay.parent.name; }catch(e){}
      log("  ["+L+"] "+lay.name+(src!=""&&src!=lay.name?" (src "+src+")":"")+" enabled="+lay.enabled+" in="+lay.inPoint.toFixed(2)+" out="+lay.outPoint.toFixed(2)+par);
      try{
        var tr=lay.property("ADBE Transform Group");
        var names=["ADBE Anchor Point","ADBE Position","ADBE Scale","ADBE Rotate Z","ADBE Opacity"];
        for(var n=0;n<names.length;n++){ var pr=tr.property(names[n]); if(pr) dumpProp(pr,"      ",40); }
      }catch(e){ log("      transform err "+e); }
      try{
        var ef=lay.property("ADBE Effect Parade");
        if(ef&&ef.numProperties>0){ for(var e2=1;e2<=ef.numProperties;e2++){ var fx=ef.property(e2); log("      効果 "+fx.name+" ["+fx.matchName+"] enabled="+fx.enabled);
          for(var k=1;k<=fx.numProperties;k++){ try{ dumpProp(fx.property(k),"        "+k+" ",8); }catch(err){} } } }
      }catch(e){ log("      effect err "+e); }
    }
  }
  try{ var c0=null; for(var j=1;j<=p.numItems;j++){ if(p.item(j) instanceof CompItem && p.item(j).name=="最前モモンガ"){ c0=p.item(j); break; } }
    if(c0){ log("saveFrameToPng: "+(typeof c0.saveFrameToPng)); var ri=p.renderQueue.items.add(c0); var om=ri.outputModule(1); var t=om.templates; var ns=[]; for(var q=0;q<t.length;q++) ns.push(String(t[q])); log("出力テンプレ: "+ns.join(" | ")); ri.remove(); }
  }catch(e){ log("templates err "+e); }
  app.endSuppressDialogs(false);
}catch(e){ log("エラー: "+e.toString()+" line "+e.line); }
log("=== DONE");
app.quit();
