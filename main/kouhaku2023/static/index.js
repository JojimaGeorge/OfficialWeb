//デプロイURL
url =
  "https://script.google.com/macros/s/AKfycbxIQS2X3HRQt5AvlKgOw3MKQmJ36aipkGMC1TxBKx7ABB3xHr-YydM_6V9LzBj-UyM/exec";
window.onload = function () {
  console.log("window.onload");
  data = {
    mode: "score",
  };
  $.ajax({
    type: "GET",
    url: url,
    data: data,
    dataType: "json",
  })
    .done(function (res) {
      console.log(res.score);
      //'name', 'account', 'count'
      $("#score-red").text(res.score[0]);
      $("#score-white").text(res.score[1]);
    })
    .fail(function (jqXHR, textStatus, errorThrown) {
      console.log("ajax通信に失敗しました");
      console.log("jqXHR          : " + jqXHR.status); // HTTPステータスが取得
      console.log("textStatus     : " + textStatus); // タイムアウト、パースエラー
      console.log("errorThrown    : " + errorThrown.message); // 例外情報
    });
};
