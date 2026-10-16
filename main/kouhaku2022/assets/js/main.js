// X（旧Twitter）の投稿埋め込みを描く。読み込めなくても blockquote 内のリンクは残る。
(function () {
  if (!document.querySelector('.twitter-tweet')) return;
  var s = document.createElement('script');
  s.src = 'https://platform.twitter.com/widgets.js';
  s.async = true;
  s.charset = 'utf-8';
  document.body.appendChild(s);
})();
