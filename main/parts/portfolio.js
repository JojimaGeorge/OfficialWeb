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




document.addEventListener('click', function(event) {
  if (event.target.tagName === 'IMG') {
    event.target.blur();
  }
});


//テキストのカウントアップ+バーの設定
var bar = new ProgressBar.Line(splash_text, {//id名を指定
  easing: 'easeInOut',//アニメーション効果linear、easeIn、easeOut、easeInOutが指定可能
  duration: 1000,//時間指定(1000＝1秒)
  strokeWidth: 0.5,//進捗ゲージの太さ
  color: '#FFFFFF',//進捗ゲージのカラー
  trailWidth: 0.2,//ゲージベースの線の太さ
  trailColor: '#403D66',//ゲージベースの線のカラー
  text: {//テキストの形状を直接指定       
    style: {//天地中央に配置
      position: 'absolute',
      left: '50%',
      top: '50%',
      padding: '0',
      margin: '-30px 0 0 0',//バーより上に配置
      transform:'translate(-50%,-50%)',
      'font-size':'1rem',
      color: '#fff',
    },
    autoStyleContainer: false //自動付与のスタイルを切る
  },
  step: function(state, bar) {
    bar.setText(Math.round(bar.value() * 100) + ' %'); //テキストの数値
  }
});

//アニメーションスタート
bar.animate(1.0, function () {//バーを描画する割合を指定します 1.0 なら100%まで描画します
  $("#splash").delay(500).fadeOut(800);//アニメーションが終わったら#splashエリアをフェードアウト
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


//メニューのスクロール表示
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



//ギャラリー設定

$(window).on('load',function(){	//画面遷移時にギャラリーの画像が被らないように、すべての読み込みが終わった後に実行する

//＝＝＝Muuriギャラリープラグイン設定
var grid = new Muuri('.grid', {

//アイテムの表示速度※オプション。入れなくても動作します
showDuration: 600,
showEasing: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
hideDuration: 600,
hideEasing: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
	
// アイテムの表示/非表示状態のスタイル※オプション。入れなくても動作します
  visibleStyles: {
    opacity: '1',
    transform: 'scale(1)'
  },
  hiddenStyles: {
    opacity: '0',
    transform: 'scale(0.5)'
  } 
});

//＝＝＝並び替えボタン設定
$('.sort-btn ul li').on('click',function(){//並び替えボタンをクリックしたら
	var className = $(this).attr("class")//クリックしたボタンのクラス名を取得
	className = className.split(' '); //「.sort-btn ul li」のクラス名を分割して配列にする

    //ボタンにクラス名activeがついている場合
	if($(this).hasClass("active")){	
		if(className[0] != "all"){							//ボタンのクラス名がallでなければ
			$(this).removeClass("active");					//activeクラスを消す
			var selectElms = $(".sort-btn ul li.active");	//ボタン内にactiveクラスがついている要素を全て取得
			if(selectElms.length == 0){						//取得した配列内にactiveクラスがついている要素がなければ
				$(".sort-btn ul li.all").addClass("active");//ボタンallにactiveを追加し
				grid.show('');								//ギャラリーの全ての画像を表示
			}else{
				filterDo();									//取得した配列内にactiveクラスがついている要素があれば並び替えを行う
			}
		}	
	}
    //ボタンにクラス名activeがついていない場合
    else{
		if(className[0] == "all"){							//ボタンのクラス名にallとついていたら
			$(".sort-btn ul li").removeClass("active");		//ボタンのli要素の全てのactiveを削除し
			$(this).addClass("active");						//allにactiveクラスを付与
			grid.show('');									//ギャラリーの全ての画像を表示
		}else{
			if($(".all").hasClass("active")){				//allクラス名にactiveクラスが付いていたら
				$(".sort-btn ul li.all").removeClass("active");//ボタンallのactiveクラスを消し
			}
			$(this).addClass("active");						//クリックしたチェックボックスへactiveクラスを付与
			filterDo();										//並び替えを行う
		}

	}
	
});

//＝＝＝画像の並び替え設定
function filterDo(){
	var selectElms = $(".sort-btn ul li.active");	//全てのボタンのactive要素を取得
	var selectElemAry = [];							//activeクラスがついているボタンのクラス名（sortXX）を保存する配列を定義
	$.each(selectElms, function(index, selectElm) {
		var className = $(this).attr("class")		//activeクラスがついている全てのボタンのクラス名（sortXX）を取得
		className = className.split(' ');			//ボタンのクラス名を分割して配列にし、
		selectElemAry.push("."+className[0]);		//selectElemAry配列に、チェックのついたクラス名（sortXX）を追加
	})
	str = selectElemAry.join(',');				//selectElemAry配列に追加されたクラス名をカンマ区切りでテキストにして
	grid.filter(str); 							//grid.filter(str);のstrに代入し、ボタンのクラス名と<li>につけられたクラス名が一致したら出現
}

});