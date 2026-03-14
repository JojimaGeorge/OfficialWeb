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



//テキストのカウントアップ+バーの設定
var bar = new ProgressBar.Line(splash_text, {//id名を指定
  easing: 'easeInOut',//アニメーション効果linear、easeIn、easeOut、easeInOutが指定可能
  duration: 1500,//時間指定(1000＝1秒)
  strokeWidth: 1,//進捗ゲージの太さ
  color: '#FFC13D',//進捗ゲージのカラー
  trailWidth: 1,//ゲージベースの線の太さ
  trailColor: '#FFFFFF',//ゲージベースの線のカラー
  text: {//テキストの形状を直接指定       
    style: {//天地中央に配置
      position: 'absolute',
      left: '50%',
      top: '80%',
      padding: '0',
      margin: '100px 0 0 0',//バーより下に配置
      transform:'translate(-50%,-50%)',
      'font-size':'1.5rem',
      color: '#FFAE00',
    },
    autoStyleContainer: false //自動付与のスタイルを切る
  },
  step: function(state, bar) {
    bar.setText(Math.round(bar.value() * 100) + ' %'); //テキストの数値
  }
});

//アニメーションスタート
bar.animate(1.0, function () {//バーを描画する割合を指定します 1.0 なら100%まで描画します
  $("#splash_text").fadeOut(10);//フェイドアウトでローディングテキストを削除
  $(".loader_cover-up").addClass("coveranime");//カバーが上に上がるクラス追加
  $(".loader_cover-down").addClass("coveranime");//カバーが下に下がるクラス追加
  $("#splash").fadeOut();//#splashエリアをフェードアウト
});


// ハンバーガーメニュー
$(function() {
  var $menu = $("#global-navi");
  var $btnGnavi = $(".btn-gnavi");

  $btnGnavi.on("click", function(e) {
    e.stopPropagation(); // ハンバーガーメニューのクリックイベントを親要素に伝播しないようにする

    var rightVal = 0;
    if ($(this).hasClass("open")) {
      rightVal = -300;
      $(this).removeClass("open");
      $(document).off("click.closeMenu");
    } else {
      $(this).addClass("open");
      $(document).on("click.closeMenu", function(e) {
        if (!$(e.target).closest($menu).length && !$(e.target).is($btnGnavi)) {
          $menu.animate(
            {
              right: -300
            },
            200
          );
          $btnGnavi.removeClass("open");
          $(document).off("click.closeMenu");
        }
      });
    }
    $menu.stop().animate(
      {
        right: rightVal
      },
      200
    );
  });

  // メニュー内の要素のクリックイベントを親要素に伝播させない
  $menu.on("click", function(e) {
    e.stopPropagation();
  });
});



//スクロールしたらナビゲーションの背景色を変更
var lastScrollTop = 0;

window.addEventListener("scroll", function(){
  var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  var windowWidth = window.innerWidth;

  if (scrollTop < lastScrollTop) {
    // 上方向にスクロールしている場合
    if (windowWidth <= 600) {
      // ウィンドウの幅が600ピクセル以下の場合は背景色を透明にする
      document.querySelector(".menu").style.background = "transparent";
    } else {
      // ウィンドウの幅が600ピクセルより大きい場合は背景色を変更する
      document.querySelector(".menu").style.background = "#FFFCF0";
    }
  } else {
    // 下方向にスクロールしている場合は常に背景色を透明にする
    document.querySelector(".menu").style.background = "transparent";
  }
  
  lastScrollTop = scrollTop;
});



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


// 要素をランダムに並び替える関数
function shuffleElements(parentElement) {
  var elements = Array.from(parentElement.children);
  elements.sort(function() { return Math.random() - 0.5; });
  elements.forEach(function(element) {
    parentElement.appendChild(element);
  });
}

// ページが読み込まれた後に実行する処理
window.addEventListener('DOMContentLoaded', function() {
  var container = document.querySelector('.nftcontainer');
  shuffleElements(container);
});

// スクロールしたら画像が横に移動する。
window.addEventListener('scroll', function() {
  var movingImage = document.getElementById('moving-image');
  var scrollPercentage = (document.documentElement.scrollTop + window.innerHeight) / document.documentElement.scrollHeight;

  movingImage.style.right = (100 - scrollPercentage * 100) + '%';
});


// 下までいったらフォローが表示
var followElement = document.querySelector('.follow');
var lastScrollTop = 0;

window.addEventListener('scroll', function() {
  var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  if (scrollTop > lastScrollTop) {
    // 下方向にスクロールしている場合
    followElement.classList.remove('show');
  } else {
    // 上方向にスクロールしている場合
    var windowHeight = window.innerHeight;
    var documentHeight = document.documentElement.scrollHeight;
    var scrollOffset = documentHeight - (scrollTop + windowHeight);

    if (scrollOffset <= 800) {
      // 一番下から800ピクセルに達した場合
      followElement.classList.add('show');
    }
  }

  lastScrollTop = scrollTop;
});


//スライドショー設定
	$('.slider').slick({
		autoplay: true,//自動的に動き出すか。初期値はfalse。
		infinite: true,//スライドをループさせるかどうか。初期値はtrue。
		speed: 500,//スライドのスピード。初期値は300。
		slidesToShow: 3,//スライドを画面に3枚見せる
		slidesToScroll: 1,//1回のスクロールで1枚の写真を移動して見せる
		prevArrow: '<div class="slick-prev"></div>',//矢印部分PreviewのHTMLを変更
		nextArrow: '<div class="slick-next"></div>',//矢印部分NextのHTMLを変更
		centerMode: true,//要素を中央ぞろえにする
		variableWidth: true,//幅の違う画像の高さを揃えて表示
		dots: true,//下部ドットナビゲーションの表示
	});


var reloadButton = document.getElementById('reload-button');
var reloadIcon = document.getElementById('reload-icon');

reloadButton.addEventListener('click', function() {
  reloadIcon.classList.add('rotate-animation');
  setTimeout(function() {
    location.reload();
  }, 800);
});

