// JavaScript Document

// 右クリック禁止
document.addEventListener("contextmenu", function (e) {
  e.preventDefault();
});

// ドラッグ禁止
window.addEventListener("DOMContentLoaded", function () {
  var images = document.getElementsByTagName("img");
  for (var i = 0; i < images.length; i++) {
    images[i].addEventListener("mousedown", function (e) {
      e.preventDefault();
    });
    images[i].addEventListener("dragstart", function (e) {
      e.preventDefault();
    });
  }
  $("#navi").load("parts/navi.html");
  $("#footer").load("parts/footer.html");
});

//スクロールエフェクト
const elementsToShow = document.querySelectorAll(".animation-element");
const config = {
  rootMargin: "-50px 0px -50px 0px",
  threshold: 0.2,
};

let observer = new IntersectionObserver(function (entries, observer) {
  entries.forEach(function (entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add("show");
      observer.unobserve(entry.target);
    }
  });
}, config);

elementsToShow.forEach(function (element) {
  observer.observe(element);
});

//テキストのカウントアップ+バーの設定
var bar = new ProgressBar.Line(splash_text, {
  //id名を指定
  easing: "easeInOut", //アニメーション効果linear、easeIn、easeOut、easeInOutが指定可能
  duration: 1500, //時間指定(1000＝1秒)
  strokeWidth: 1, //進捗ゲージの太さ
  color: "#990099", //進捗ゲージのカラー
  trailWidth: 1, //ゲージベースの線の太さ
  trailColor: "#FFFFFF", //ゲージベースの線のカラー
  text: {
    //テキストの形状を直接指定
    style: {
      //天地中央に配置
      position: "absolute",
      left: "50%",
      top: "80%",
      padding: "0",
      margin: "100px 0 0 0", //バーより下に配置
      transform: "translate(-50%,-50%)",
      "font-size": "1.5rem",
      color: "#990099",
    },
    autoStyleContainer: false, //自動付与のスタイルを切る
  },
  step: function (state, bar) {
    bar.setText(Math.round(bar.value() * 100) + " %"); //テキストの数値
  },
});

//アニメーションスタート
bar.animate(1.0, function () {
  //バーを描画する割合を指定します 1.0 なら100%まで描画します
  $("#splash_text").fadeOut(10); //フェイドアウトでローディングテキストを削除
  $(".loader_cover-up").addClass("coveranime"); //カバーが上に上がるクラス追加
  $(".loader_cover-down").addClass("coveranime"); //カバーが下に下がるクラス追加
  $("#splash").fadeOut(); //#splashエリアをフェードアウト
});
