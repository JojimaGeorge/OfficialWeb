// JavaScript Document - すしだるまショップ

// ============================================
// 商品カタログデータ
// ============================================
var PRODUCTS = {
  'badge-kuji': {
    id: 'badge-kuji',
    name: 'ころころ缶バッジくじ',
    price: 200,
    emoji: '🎰',
    image: null,
    description: 'ガチャガチャ感覚で楽しめる缶バッジくじ！何が出るかはお楽しみ。',
    set: '3回セット ¥500',
    link: 'https://buy.stripe.com/test_3cI9AMa81b6cbsZbOs14400',
    specs: '直径 約56mm'
  },
  'sticker': {
    id: 'sticker',
    name: 'キラキラステッカー',
    price: 200,
    emoji: '✨',
    image: null,
    description: 'キラキラ素材のすしだるまステッカー。スマホやPCに貼ってね。',
    set: '4枚セット ¥500',
    link: '#',
    specs: '約 W70 × H70mm'
  },
  'acrylic-block': {
    id: 'acrylic-block',
    name: '肉厚！アクリルブロック',
    price: 600,
    emoji: '🧊',
    image: null,
    description: '存在感バツグンの肉厚アクリルブロック。デスクに飾るとかわいい。',
    set: null,
    link: '#',
    specs: '約 W70 × H70 × D20mm'
  },
  'postcard': {
    id: 'postcard',
    name: 'ぷりちーポストカード',
    price: 200,
    emoji: '🖼️',
    image: null,
    description: 'すしだるまたちの可愛いイラストポストカード。飾っても贈っても◎',
    set: '3枚セット ¥500',
    link: '#',
    specs: '約 W148 × H100mm'
  },
  'can-case': {
    id: 'can-case',
    name: 'もこもこ缶ケース',
    price: 1200,
    emoji: '🍣',
    image: null,
    description: 'もこもこ素材の缶ケース。小物入れやアクセサリーケースに。',
    set: null,
    badge: '限定',
    link: '#',
    specs: '約 W110 × H80 × D35mm'
  },
  'tote-bag': {
    id: 'tote-bag',
    name: 'ごきげんトートバッグ',
    price: 1800,
    emoji: '👜',
    image: null,
    description: 'たっぷり入るA4サイズのトートバッグ。お買い物にもお出かけにも。',
    set: null,
    badge: '旬',
    link: '#',
    specs: '約 W360 × H370 × D110mm（持ち手含まず）'
  },
  'acrylic-stand': {
    id: 'acrylic-stand',
    name: 'フレーム付きアクリルスタンドセット',
    price: 1400,
    emoji: '🖼️',
    image: null,
    description: 'フレーム付きで高級感のあるアクリルスタンド。推し活にも。',
    set: null,
    link: '#',
    specs: '約 H100 × W70mm（フレーム含む）'
  },
  'keychain-large': {
    id: 'keychain-large',
    name: 'アクリルキーホルダー（大）',
    price: 700,
    emoji: '🔑',
    image: null,
    description: '大きめサイズのアクリルキーホルダー。バッグにつけてアピール！',
    set: null,
    link: '#',
    specs: '約 H80 × W60mm'
  },
  'keychain-medium': {
    id: 'keychain-medium',
    name: 'アクリルキーホルダー（中）',
    price: 500,
    emoji: '🔑',
    image: null,
    description: 'ちょうどいいサイズのアクリルキーホルダー。鍵につけても◎',
    set: null,
    link: '#',
    specs: '約 H55 × W45mm'
  }
};


// ============================================
// 右クリック禁止
// ============================================
document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
});

// ============================================
// ドラッグ禁止
// ============================================
window.addEventListener('DOMContentLoaded', function() {
  var images = document.getElementsByTagName('img');
  for (var i = 0; i < images.length; i++) {
    images[i].addEventListener('mousedown', function(e) { e.preventDefault(); });
    images[i].addEventListener('dragstart', function(e) { e.preventDefault(); });
  }
});

// ============================================
// 通知バナー（URLパラメータで出し分け）
// ============================================
(function() {
  var params = new URLSearchParams(window.location.search);
  var area = document.getElementById('notification-area');
  if (!area) return;

  var message = null;
  var className = null;

  if (params.get('success') === 'true') {
    message = 'ご購入ありがとうございます！';
    className = 'notification-banner success-banner';
  } else if (params.get('canceled') === 'true') {
    message = 'お買い物を続けますか？';
    className = 'notification-banner cancel-banner';
  }

  if (message) {
    var banner = document.createElement('div');
    banner.className = className;
    banner.textContent = message;
    banner.title = 'クリックで閉じる';
    banner.addEventListener('click', function() { banner.remove(); });
    area.appendChild(banner);

    setTimeout(function() {
      banner.style.transition = 'opacity 0.6s';
      banner.style.opacity = '0';
      setTimeout(function() { banner.remove(); }, 600);
    }, 5000);
  }
})();

// ============================================
// ハンバーガーメニュー
// ============================================
$(function() {
  var $menu = $("#global-navi");
  var $btnGnavi = $(".btn-gnavi");

  $btnGnavi.on("click", function(e) {
    e.stopPropagation();
    var rightVal = 0;
    if ($(this).hasClass("open")) {
      rightVal = -300;
      $(this).removeClass("open");
      $(document).off("click.closeMenu");
    } else {
      $(this).addClass("open");
      $(document).on("click.closeMenu", function(e) {
        if (!$(e.target).closest($menu).length && !$(e.target).is($btnGnavi)) {
          $menu.animate({ right: -300 }, 200);
          $btnGnavi.removeClass("open");
          $(document).off("click.closeMenu");
        }
      });
    }
    $menu.stop().animate({ right: rightVal }, 200);
  });

  $menu.on("click", function(e) { e.stopPropagation(); });
});

// ============================================
// スクロールでナビ背景を切り替え
// ============================================
(function() {
  var lastScrollTop = 0;
  window.addEventListener("scroll", function() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var windowWidth = window.innerWidth;
    var menuEl = document.querySelector(".menu");
    if (!menuEl) return;

    if (scrollTop < lastScrollTop) {
      menuEl.style.background = (windowWidth <= 600) ? "transparent" : "#FFFCF0";
    } else {
      menuEl.style.background = "transparent";
    }
    lastScrollTop = scrollTop;
  });
})();

// ============================================
// スクロールアニメーション
// ============================================
(function() {
  var elementsToShow = document.querySelectorAll('.animation-element');
  if (elementsToShow.length === 0) return;
  var config = { rootMargin: '-50px 0px -50px 0px', threshold: 0.2 };

  var observer = new IntersectionObserver(function(entries, obs) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('show');
        obs.unobserve(entry.target);
      }
    });
  }, config);

  elementsToShow.forEach(function(el) { observer.observe(el); });
})();

// ============================================
// SOLD OUT トグル
// ============================================
window.addEventListener('DOMContentLoaded', function() {
  var soldoutCards = document.querySelectorAll('[data-soldout="true"]');
  soldoutCards.forEach(function(card) {
    card.style.opacity = '0.5';
    card.style.filter = 'grayscale(80%)';
    card.style.pointerEvents = 'none';
  });
});


// ============================================
// カート機能（共通）
// ============================================
var SushiCart = (function() {
  var STORAGE_KEY = 'sushidaruma_cart';

  function getCart() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }

  function addToCart(productId, qty) {
    var product = PRODUCTS[productId];
    if (!product) return [];
    var cart = getCart();
    var existing = null;
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === productId) { existing = cart[i]; break; }
    }
    if (existing) {
      existing.qty += qty;
    } else {
      cart.push({ id: product.id, name: product.name, price: product.price, link: product.link, qty: qty });
    }
    saveCart(cart);
    return cart;
  }

  function updateQty(id, delta) {
    var cart = getCart();
    for (var i = 0; i < cart.length; i++) {
      if (cart[i].id === id) {
        cart[i].qty += delta;
        if (cart[i].qty <= 0) cart.splice(i, 1);
        break;
      }
    }
    saveCart(cart);
    return cart;
  }

  function removeFromCart(id) {
    var cart = getCart().filter(function(item) { return item.id !== id; });
    saveCart(cart);
    return cart;
  }

  function getCount() {
    var cart = getCart();
    var count = 0;
    for (var i = 0; i < cart.length; i++) count += cart[i].qty;
    return count;
  }

  function getTotal() {
    var cart = getCart();
    var total = 0;
    for (var i = 0; i < cart.length; i++) total += cart[i].price * cart[i].qty;
    return total;
  }

  return { getCart: getCart, addToCart: addToCart, updateQty: updateQty, removeFromCart: removeFromCart, getCount: getCount, getTotal: getTotal };
})();


// ============================================
// カートUI（共通 — 両ページで使用）
// ============================================
(function() {
  var cartToggle = document.getElementById('cart-toggle');
  var cartBadge = document.getElementById('cart-badge');
  var cartDrawer = document.getElementById('cart-drawer');
  var cartOverlay = document.getElementById('cart-overlay');
  var cartClose = document.getElementById('cart-close');
  var cartItemsEl = document.getElementById('cart-items');
  var cartFooter = document.getElementById('cart-footer');
  var cartTotalPrice = document.getElementById('cart-total-price');

  if (!cartToggle) return;

  function updateBadge() {
    var count = SushiCart.getCount();
    if (count > 0) {
      cartBadge.textContent = count;
      cartBadge.style.display = '';
      cartBadge.classList.remove('pop');
      void cartBadge.offsetWidth;
      cartBadge.classList.add('pop');
    } else {
      cartBadge.style.display = 'none';
    }
  }

  function renderCart() {
    var cart = SushiCart.getCart();

    if (cart.length === 0) {
      cartItemsEl.innerHTML = '<p class="cart-empty">カートは空です</p>';
      cartFooter.style.display = 'none';
      return;
    }

    var html = '';
    for (var i = 0; i < cart.length; i++) {
      var item = cart[i];
      var subtotal = (item.price * item.qty).toLocaleString();
      var checkoutUrl = item.link && item.link !== '#'
        ? item.link + (item.link.indexOf('?') === -1 ? '?' : '&') + 'quantity=' + item.qty
        : '#';
      var checkoutDisabled = checkoutUrl === '#' ? ' style="opacity:0.4;pointer-events:none;"' : '';

      html += '<div class="cart-item">'
        + '<div class="cart-item-info">'
        + '<div class="cart-item-name">' + item.name + '</div>'
        + '<div class="cart-item-price">¥' + subtotal + '<span class="cart-item-unit">（¥' + item.price.toLocaleString() + ' × ' + item.qty + '）</span></div>'
        + '<div class="cart-item-qty">'
        + '<button type="button" data-id="' + item.id + '" data-delta="-1">−</button>'
        + '<span>' + item.qty + '</span>'
        + '<button type="button" data-id="' + item.id + '" data-delta="1">＋</button>'
        + '</div>'
        + '<a href="' + checkoutUrl + '" class="cart-item-checkout"' + checkoutDisabled + '>この商品を購入する</a>'
        + '</div>'
        + '<button type="button" class="cart-item-remove" data-remove="' + item.id + '" title="削除">&times;</button>'
        + '</div>';
    }

    cartItemsEl.innerHTML = html;
    cartTotalPrice.textContent = '¥' + SushiCart.getTotal().toLocaleString();
    cartFooter.style.display = '';

    // 数量ボタン
    var qtyBtns = cartItemsEl.querySelectorAll('.cart-item-qty button');
    for (var j = 0; j < qtyBtns.length; j++) {
      qtyBtns[j].addEventListener('click', function() {
        SushiCart.updateQty(this.getAttribute('data-id'), parseInt(this.getAttribute('data-delta'), 10));
        renderCart();
        updateBadge();
      });
    }

    // 削除ボタン
    var removeBtns = cartItemsEl.querySelectorAll('.cart-item-remove');
    for (var k = 0; k < removeBtns.length; k++) {
      removeBtns[k].addEventListener('click', function() {
        SushiCart.removeFromCart(this.getAttribute('data-remove'));
        renderCart();
        updateBadge();
      });
    }
  }

  function openDrawer() {
    renderCart();
    cartDrawer.classList.add('open');
    cartOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    cartDrawer.classList.remove('open');
    cartOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  cartToggle.addEventListener('click', openDrawer);
  cartClose.addEventListener('click', closeDrawer);
  cartOverlay.addEventListener('click', closeDrawer);

  // グローバルに公開（商品詳細ページから呼ぶ）
  window.CartUI = { updateBadge: updateBadge, openDrawer: openDrawer };

  updateBadge();
})();


// ============================================
// 商品詳細ページの初期化
// ============================================
(function() {
  var imageEl = document.getElementById('product-image');
  var infoEl = document.getElementById('product-info');
  if (!imageEl || !infoEl) return; // 商品詳細ページでない場合はスキップ

  var params = new URLSearchParams(window.location.search);
  var productId = params.get('id');
  var product = PRODUCTS[productId];

  if (!product) {
    infoEl.innerHTML = '<p style="padding:40px;text-align:center;color:#999;">商品が見つかりませんでした。</p>';
    return;
  }

  // ページタイトル更新
  document.title = product.name + ' | すしだるまショップ';

  // 画像エリア
  if (product.image) {
    imageEl.innerHTML = '<img src="' + product.image + '" alt="' + product.name + '">';
  } else {
    imageEl.innerHTML = '<span class="product-detail-emoji">' + product.emoji + '</span>';
  }

  // バッジ
  var badgeHtml = '';
  if (product.badge) {
    badgeHtml = '<span class="detail-badge">' + product.badge + '</span>';
  }

  // セット情報
  var setHtml = '';
  if (product.set) {
    setHtml = '<p class="detail-set">' + product.set + '</p>';
  }

  // 決済リンク
  var hasLink = product.link && product.link !== '#';

  // 情報エリア
  infoEl.innerHTML = badgeHtml
    + '<h1 class="detail-name">' + product.name + '</h1>'
    + '<p class="detail-price"><span class="detail-yen">¥' + product.price.toLocaleString() + '</span><span class="detail-tax">（税込）</span></p>'
    + setHtml
    + '<p class="detail-description">' + product.description + '</p>'
    + (product.specs ? '<p class="detail-specs">サイズ（約）：' + product.specs + '</p>' : '')
    + '<div class="detail-qty-row">'
    + '  <label for="qty-select">数量</label>'
    + '  <select id="qty-select" class="detail-qty-select">'
    + '    <option value="1">1</option>'
    + '    <option value="2">2</option>'
    + '    <option value="3">3</option>'
    + '    <option value="4">4</option>'
    + '    <option value="5">5</option>'
    + '  </select>'
    + '</div>'
    + '<button type="button" id="detail-add-cart" class="detail-btn detail-btn-cart">カートに入れる</button>'
    + '<button type="button" id="detail-buy-now" class="detail-btn detail-btn-buy"' + (hasLink ? '' : ' disabled') + '>今すぐ買う</button>';


  // カートに入れる → モーダル表示
  var modalOverlay = document.getElementById('cart-modal-overlay');
  var modalProduct = document.getElementById('cart-modal-product');
  var modalView = document.getElementById('cart-modal-view');
  var modalContinue = document.getElementById('cart-modal-continue');

  function closeModal() {
    if (modalOverlay) modalOverlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  document.getElementById('detail-add-cart').addEventListener('click', function() {
    var qty = parseInt(document.getElementById('qty-select').value, 10);
    SushiCart.addToCart(productId, qty);
    if (window.CartUI) window.CartUI.updateBadge();

    // モーダル表示（チェックマークアニメーションリセット）
    if (modalOverlay && modalProduct) {
      modalProduct.textContent = product.name + ' × ' + qty;
      // SVGアニメーションをリセット
      var svgEl = modalOverlay.querySelector('.checkmark-svg');
      if (svgEl) {
        var clone = svgEl.cloneNode(true);
        svgEl.parentNode.replaceChild(clone, svgEl);
      }
      modalOverlay.classList.remove('show');
      void modalOverlay.offsetWidth; // reflow
      modalOverlay.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
  });

  if (modalView) {
    modalView.addEventListener('click', function() {
      closeModal();
      if (window.CartUI) window.CartUI.openDrawer();
    });
  }

  if (modalContinue) {
    modalContinue.addEventListener('click', closeModal);
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', function(e) {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // 今すぐ買う
  document.getElementById('detail-buy-now').addEventListener('click', function() {
    if (!hasLink) return;
    var qty = parseInt(document.getElementById('qty-select').value, 10);
    var url = product.link + (product.link.indexOf('?') === -1 ? '?' : '&') + 'quantity=' + qty;
    window.location.href = url;
  });

})();
