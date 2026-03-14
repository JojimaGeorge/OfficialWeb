// JavaScript Document

// DOMContentLoadedイベントを使用して、DOMが完全に読み込まれた後にスクリプトを実行
document.addEventListener('DOMContentLoaded', function() {
  // 左側から現れるアニメーション
  function checkElementVisibility() {
    var element = document.getElementById('profile-heading');
    if (element) {
      var elementPosition = element.getBoundingClientRect();
      var windowHeight = window.innerHeight;

      // 要素が画面内に入った時にアニメーションを開始
      if (elementPosition.top < windowHeight) {
        element.classList.add('slide-in-left');
      }
    }
  }

  // スクロールイベント時に要素の表示をチェック
  window.addEventListener('scroll', checkElementVisibility);

  // 初期表示時にも要素の表示をチェック
  checkElementVisibility();
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



 // 上下のスクロールでメニューの表示変動
var lastScrollTop = 0;
var wrappernavi = document.getElementById("wrappernavi");

window.addEventListener("scroll", function() {
  var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  if (scrollTop > lastScrollTop) {
    // 下方向にスクロールしている場合
    wrappernavi.classList.remove("show");
    wrappernavi.classList.add("hide");
  } else {
    // 上方向にスクロールしている場合
    wrappernavi.classList.remove("hide");
    wrappernavi.classList.add("show");
  }

  lastScrollTop = scrollTop;
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






//ボタンをクリックした際のアニメーションの設定
$(".openbtn1").click(function () {//ボタンがクリックされたら
  $(this).toggleClass('active');//ボタン自身に activeクラスを付与し
    $("#header").toggleClass('panelactive');//ヘッダーにpanelactiveクラスを付与
});
$("#g-navi li a").click(function () {//ナビゲーションのリンクがクリックされたら
    $(".openbtn1").removeClass('active');//ボタンの activeクラスを除去し
    $("#header").removeClass('panelactive');//ヘッダーのpanelactiveクラスも除去
});


//リンク先のidまでスムーススクロール
//※ページ内リンクを行わない場合は不必要なので削除してください
    $('#g-navi li a').click(function () {
  var elmHash = $(this).attr('href');
  var pos = $(elmHash).offset().top-0;
  $('body,html').animate({scrollTop: pos}, 1000);
  return false;
});



//ドロップダウンの設定を関数でまとめる
function mediaQueriesWin(){
	var width = $(window).width();
	if(width <= 768) {//横幅が768px以下の場合
		$(".has-child>a").off('click');	//has-childクラスがついたaタグのonイベントを複数登録を避ける為offにして一旦初期状態へ
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

// ページがリサイズされたら動かしたい場合の記述
$(window).resize(function() {
	mediaQueriesWin();/* ドロップダウンの関数を呼ぶ*/
});

// ページが読み込まれたらすぐに動かしたい場合の記述
$(window).on('load',function(){
	mediaQueriesWin();/* ドロップダウンの関数を呼ぶ*/
});



// 動きのきっかけの起点となるアニメーションの名前を定義
function BgFadeAnime(){

    // 背景色が伸びて出現（左から右）
	$('.bgLRextendTrigger').each(function(){ //bgLRextendTriggerというクラス名が
		var elemPos = $(this).offset().top-50;//要素より、50px上の
		var scroll = $(window).scrollTop();
		var windowHeight = $(window).height();
		if (scroll >= elemPos - windowHeight){
			$(this).addClass('bgLRextend');// 画面内に入ったらbgLRextendというクラス名を追記
		}else{
			$(this).removeClass('bgLRextend');// 画面外に出たらbgLRextendというクラス名を外す
		}
	});	

   // 文字列を囲う子要素
	$('.bgappearTrigger').each(function(){ //bgappearTriggerというクラス名が
		var elemPos = $(this).offset().top-50;//要素より、50px上の
		var scroll = $(window).scrollTop();
		var windowHeight = $(window).height();
		if (scroll >= elemPos - windowHeight){
			$(this).addClass('bgappear');// 画面内に入ったらbgappearというクラス名を追記
		}else{
			$(this).removeClass('bgappear');// 画面外に出たらbgappearというクラス名を外す
		}
	});		
}



// 画面をスクロールをしたら動かしたい場合の記述
	$(window).scroll(function (){
		BgFadeAnime();/* アニメーション用の関数を呼ぶ*/
	});// ここまで画面をスクロールをしたら動かしたい場合の記述

// 画面が読み込まれたらすぐに動かしたい場合の記述
	$(window).on('load', function(){
		BgFadeAnime();/* アニメーション用の関数を呼ぶ*/
	});// ここまで画面が読み込まれたらすぐに動かしたい場合の記述
	
//パララックス効果
const image = document.getElementsByClassName('thumbnail');
new simpleParallax(image, {
	  delay: 0.1, // スクロール止めてから動く秒数
	  transition: 'cubic-bezier(0,0,0,.1)',
      orientation: "right", // 動く方向
      scale: 1.3, // 動く大きさ
});


