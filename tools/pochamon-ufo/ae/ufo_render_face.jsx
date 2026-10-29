/* 右下の最前モモンガを、元の aep の「詳細」コンポ（タービュレントディスプレイス付き）から表情ごとのコマで書き出す
 * レンダーキューに1コマずつ積んで render()（同期）。他のレイヤーは非表示。出力は TIFF（アルファ付き）→ 後で PNG に直す */
var LOG=[];
function log(s){ LOG.push(String(s)); var f=new File("C:/Users/spitz/dev/ai-illust/ae/ufo_render_face2.log"); f.encoding="UTF-8"; f.open("w"); f.write(LOG.join("\n")); f.close(); }
function pad(n){ return (n<10?"0":"")+n; }
log("1 開始");
try{
  app.beginSuppressDialogs();
  app.open(new File("E:/イラスト/ぽちゃもん/1_アニメ/UFOキャッチャー/UFOキャッチャー.aep"));
  var p=app.project, detail=null;
  for(var i=1;i<=p.numItems;i++){ var it=p.item(i); if(it instanceof CompItem && it.name=="詳細"){ detail=it; break; } }
  if(!detail) throw new Error("詳細 が無い");
  for(var L=1;L<=detail.numLayers;L++){ var lay=detail.layer(L); lay.enabled=(lay.name=="最前モモンガ"); }
  log("2 他のレイヤーを隠した");
  var OUT="E:/イラスト/ぽちゃもん/1_アニメ/UFOキャッチャー/export_face/";
  var frames=[];
  for(var k=0;k<12;k++) frames.push(["open_"+pad(k), 2.0+k/6]);
  frames.push(["blink_half_a",1.433]); frames.push(["blink_closed_a",1.533]); frames.push(["blink_closed_b",1.70]); frames.push(["blink_half_b",1.80]);
  for(var k2=0;k2<9;k2++) frames.push(["grinin_"+pad(k2), 6.0+k2/30]);
  for(var k3=0;k3<12;k3++) frames.push(["grin_"+pad(k3), 9.0+k3/6]);
  frames.push(["gblink_half_a",8.5]); frames.push(["gblink_closed_a",8.6]); frames.push(["gblink_closed_b",8.767]); frames.push(["gblink_half_b",8.867]);
  for(var k4=0;k4<15;k4++) frames.push(["grinout_"+pad(k4), 13.9+k4/30]);
  var rq=p.renderQueue;
  while(rq.numItems>0){ rq.item(1).remove(); }
  var tmplName=null;
  var ri0=rq.items.add(detail); var tm=ri0.outputModule(1).templates; for(var t0=0;t0<tm.length;t0++){ var tn=String(tm[t0]); if(tn.indexOf("TIFF")>=0 && tn.indexOf("アルファ")>=0){ tmplName=tn; break; } } ri0.remove();
  log("3 テンプレ: "+tmplName+" コマ数 "+frames.length);
  var frameDur=1.0/detail.frameRate;
  for(var n=0;n<frames.length;n++){
    var name=frames[n][0], t=frames[n][1];
    var ri=rq.items.add(detail);
    ri.timeSpanStart=t; ri.timeSpanDuration=frameDur;
    var om=ri.outputModule(1);
    if(tmplName) om.applyTemplate(tmplName);
    om.file=new File(OUT+name+"_[#].tif");
  }
  log("4 キュー "+rq.numItems+"件 レンダー開始");
  rq.render();
  log("5 レンダー完了");
  app.endSuppressDialogs(false);
}catch(e){ log("エラー: "+e.toString()+" line "+e.line); }
log("=== DONE");
app.quit();
