// JavaScript Document

// 右クリック禁止
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });

// ドラッグ禁止
  window.addEventListener('DOMContentLoaded', function() {
    var images = document.getElementsByTagName('img');
    for (var i = 0; i < images.length; i++) {
      images[i].addEventListener('mousedown', function(e) {
        e.preventDefault();
      });
      images[i].addEventListener('dragstart', function(e) {
        e.preventDefault();
      });
    }
  });

// スクロールで要素を表示
window.addEventListener('scroll', function() {
  var scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
  var profile = document.getElementById('profile');

  if (scrollPosition > 100) {
    profile.classList.remove('hidden');
  } else {
    profile.classList.add('hidden');
  }
});


// フォントサイズを計算して適用する関数
function adjustFontSize() {
  var text = document.getElementById('flexible-text');
  var sidebar = document.querySelector('.left-sidebar');
  var sidebarWidth = sidebar.offsetWidth;
  var fontSize = sidebarWidth / 3; // 適宜調整
  text.style.fontSize = fontSize + 'px';
}

// ページのロード時とウィンドウのリサイズ時にフォントサイズを調整
window.addEventListener('DOMContentLoaded', adjustFontSize);
window.addEventListener('resize', adjustFontSize);


// ページの高さに合わせて背景画像の高さを設定
document.getElementById("background").style.height = window.innerHeight + "px";
window.addEventListener("resize", function() {
	document.getElementById("background").style.height = window.innerHeight + "px";
});

//ドロップダウンの設定を関数でまとめる
function mediaQueriesWin(){
  var width = $(window).width();
  if(width <= 768) {//横幅が768px以下の場合
    $(".has-child>a").off('click'); //has-childクラスがついたaタグのonイベントを複数登録を避ける為offにして一旦初期状態へ
    $(".has-child>a").on('click', function() {//has-childクラスがついたaタグをクリックしたら
      var parentElem =  $(this).parent();// aタグから見た親要素の<li>を取得し
      $(parentElem).toggleClass('active');//矢印方向を変えるためのクラス名を付与して
      $(parentElem).children('ul').stop().slideToggle(500);//liの子要素のスライドを開閉させる※数字が大きくなるほどゆっくり開く
      return false;//リンクの無効化
    });
  }else{//横幅が768px以上の場合
    $(".has-child>a").off('click');//has-childクラスがついたaタグのonイベントをoff(無効)にし
    $(".has-child").removeClass('active');//activeクラスを削除
    $('.has-child').children('ul').css("display","");//スライドトグルで動作したdisplayも無効化にする
  }
}

//スクロールエフェクト
const elementsToShow = document.querySelectorAll('.campaign-info__left, .campaign-info__right, .single, .responsive-img, .animation-element');
const config = {
  rootMargin: '-50px 0px -50px 0px',
  threshold: 0.2
};

let observer = new IntersectionObserver(function(entries, observer) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting) {
      entry.target.classList.add('show');
      observer.unobserve(entry.target);
    }
  });
}, config);

elementsToShow.forEach(function(element) {
  observer.observe(element);
});

