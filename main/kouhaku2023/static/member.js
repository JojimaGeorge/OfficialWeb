//デプロイURL
url =
  "https://script.google.com/macros/s/AKfycbxIQS2X3HRQt5AvlKgOw3MKQmJ36aipkGMC1TxBKx7ABB3xHr-YydM_6V9LzBj-UyM/exec";
window.onload = function () {
  console.log("window.onload");
  data = {
    mode: "member",
  };
  $.ajax({
    type: "GET",
    url: url,
    data: data,
    dataType: "json",
  })
    .done(function (res) {
      //'name', 'account', 'count'
      //クリエイター（赤）
      res["creator_red"].forEach(function (elem, index) {
        account_url = "https://twitter.com/" + elem.account.replace("@", "");
        $("#list-creator-red").append(
          "<div><a href ='" +
            account_url +
            "' class='red-font member-name'>" +
            elem.name +
            "（" +
            elem.count +
            "）</a></div>"
        );
      });
      //クリエイター（白）
      res["creator_white"].forEach(function (elem, index) {
        account_url = "https://twitter.com/" + elem.account.replace("@", "");
        $("#list-creator-white").append(
          "<div><a href ='" +
            account_url +
            "' class='brown-font member-name'>" +
            elem.name +
            "（" +
            elem.count +
            "）</a></div>"
        );
      });
      //コレクター（赤）
      res["collector_red"].forEach(function (elem, index) {
        account_url = "https://twitter.com/" + elem.account.replace("@", "");
        $("#list-collector-red").append(
          "<div><a href ='" +
            account_url +
            "' class='red-font member-name'>" +
            elem.name +
            "（" +
            elem.count +
            "）</a></div>"
        );
      });
      //コレクター（白）
      res["collector_white"].forEach(function (elem, index) {
        account_url = "https://twitter.com/" + elem.account.replace("@", "");
        $("#list-collector-white").append(
          "<div><a href ='" +
            account_url +
            "' class='brown-font member-name'>" +
            elem.name +
            "（" +
            elem.count +
            "）</a></div>"
        );
      });
    })
    .fail(function (jqXHR, textStatus, errorThrown) {
      console.log("ajax通信に失敗しました");
      console.log("jqXHR          : " + jqXHR.status); // HTTPステータスが取得
      console.log("textStatus     : " + textStatus); // タイムアウト、パースエラー
      console.log("errorThrown    : " + errorThrown.message); // 例外情報
    });
};
