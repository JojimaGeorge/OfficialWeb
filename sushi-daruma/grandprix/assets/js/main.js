// 画面に入った部品（class="fade"）を一度だけ、2秒かけて浮かび上がらせる（STUDIO 版の出現の動き）。
// 透明にするのは html に js の目印がある時だけなので、JS が動かない環境でも中身は見える。
(function () {
  var items = document.querySelectorAll('.fade');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-shown'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-shown');
      io.unobserve(entry.target);
    });
  });
  items.forEach(function (el) { io.observe(el); });
})();
