//デプロイURL
url =
  "https://script.google.com/macros/s/AKfycbxPZ-koubB5fP8kg1C4CfFYdk2_nRO20LE6sn25U0rg89h6aC-R99e1UFBkVjIeuA_i/exec";
window.onload = function () {
  console.log("window.onload");
  $.ajax({
    type: "GET",
    url: url,
    dataType: "json",
  })
    .done(function (res) {
      //'name', 'account', 'count'
      //クリエイター（赤）
      res.forEach(function (elem, index) {
        // elem.creatorname : クリエイター名
        // elem.acountname  : Xアカウント(@含む) 例 @JojimaGeorgeNFT
        // elem.acounturl   : XアカウントURL
        // elem.fileurl     : 画像ファイル(1MBまで) 対応ファイル：jpg・png・bmp・gif
        // elem.artname     : 作品名
        // elem.platform    : 販売プラットフォーム(その他は記載) 販売しないもあり
        // elem.money       :　販売価格(通貨単位含む)　例 0.03ETH、1,000円、0.005BTC 等
        // elem.url         :　販売ページURL
        // elem.startdate   : 販売開始日
        // elem.starttime   : 販売開始時
        // elem.postlink    : 宣伝ポストのリンク

        html = "";
        html += "<div class='art-box' ";
        html += " creatorname='" + elem.creatorname + "' ";
        html += " acountname='" + elem.acountname + "' ";
        html += " acounturl='" + elem.acounturl + "' ";
        html += " artname='" + elem.artname + "' ";
        html += " platform='" + elem.platform + "' ";
        html += " money='" + elem.money + "' ";
        html += " url='" + elem.url + "' ";
        html += " startdate='" + elem.startdate + "' ";
        html += " starttime='" + elem.starttime + "' ";
        html += " postlink='" + elem.postlink + "' ";
        html += ">";
        html += "     <img src='" + elem.fileurl + "'>";
        html += "</div>";
        $("#list-art").append(html);
      });
    })
    .fail(function (jqXHR, textStatus, errorThrown) {
      console.log("ajax通信に失敗しました");
      console.log("jqXHR          : " + jqXHR.status); // HTTPステータスが取得
      console.log("textStatus     : " + textStatus); // タイムアウト、パースエラー
      console.log("errorThrown    : " + errorThrown.message); // 例外情報
    });
};
function modalClose(id) {
  //------------------------------------------------------------
  //  モーダルウインドウ クローズ
  //------------------------------------------------------------
  document.getElementById(id).className = "modalBg modalBgClose";
}
function modalContactMintOpen(
  creatorname,
  acountname,
  acounturl,
  artname,
  platform,
  money,
  url,
  fileurl,
  startdate,
  starttime,
  postlink
) {
  $(".artimage").html("<img src='" + fileurl + "'>");
  html =
    creatorname +
    "(<a href='" +
    acounturl +
    "' target='blank'>" +
    acountname +
    "</a>)";
  $(".creatorname").html(html);
  $(".artname").html(artname);
  //Xの宣伝ポストリンク
  html = "";
  if (postlink != "") {
    html += "<a href='" + postlink + "' target='blank'>";
    html += "   Xのポストリンク";
    html += "</a>";
  }
  $(".artpost").html(html);
  platform_html = platform;
  sale_html = "";
  if (platform != "販売しない(HP掲載のみ)") {
    if (money != "") {
      platform_html += "：" + money;
    }
    if (url != "") {
      platform_html +=
        "<a href = '" + url + "' target='blank' class='sale-btn'>";
      platform_html += "   販売ページへ";
      platform_html += "</a>";
    }
    sale_html = "";
    sale_html += "販売開始日時：" + startdate + " " + starttime;
  }
  $(".platform").html(platform_html);
  $(".saleinfo").html(sale_html);

  document.getElementById("modalArtArea").className = "modalBg modalBgOpen";
}
$(document).on("click", ".art-box", function () {
  creatorname = $(this).attr("creatorname");
  acountname = $(this).attr("acountname");
  acounturl = $(this).attr("acounturl");
  artname = $(this).attr("artname");
  platform = $(this).attr("platform");
  money = $(this).attr("money");
  url = $(this).attr("url");
  fileurl = $(this).children("img").attr("src");
  startdate = $(this).attr("startdate");
  starttime = $(this).attr("starttime");
  postlink = $(this).attr("postlink");

  modalContactMintOpen(
    creatorname,
    acountname,
    acounturl,
    artname,
    platform,
    money,
    url,
    fileurl,
    startdate,
    starttime,
    postlink
  );
});
