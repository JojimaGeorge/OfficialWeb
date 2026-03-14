var fullpage = (function() {
    var sections = document.getElementsByClassName('section');
    var currentSection = 0;
    var isAnimating = false;
    var paginationContainer = document.getElementById('pagination');

    function init() {
        document.addEventListener('wheel', scrollHandler);
        document.addEventListener('touchstart', touchStart);
        document.addEventListener('touchmove', touchMove);
        document.addEventListener('keydown', keydownHandler);
        createPagination();
        updateSection();
		animateTitle();
    }

    function createPagination() {
	
		// 既存のページネーションをクリア
    paginationContainer.innerHTML = '';
        for (var i = 0; i < sections.length; i++) {
            var dot = document.createElement('div');
            dot.className = 'pagination-dot';
            dot.addEventListener('click', function(index) {
                return function() {
                    if (!isAnimating) changeSection(index);
                }
            }(i));
            paginationContainer.appendChild(dot);
        }
    }

    function scrollHandler(e) {
        if (isAnimating) return;
        if (e.deltaY > 0 && currentSection < sections.length - 1) {
            nextSection();
        } else if (e.deltaY < 0 && currentSection > 0) {
            prevSection();
        }
    }

    var touchStartY = 0;
    function touchStart(e) {
        touchStartY = e.touches[0].clientY;
    }

    function touchMove(e) {
        if (isAnimating) return;
        var touchEndY = e.touches[0].clientY;

        if (touchStartY > touchEndY + 50 && currentSection < sections.length - 1) {
            nextSection();
        } else if (touchStartY < touchEndY - 50 && currentSection > 0) {
            prevSection();
        }
    }

    function keydownHandler(e) {
        if (isAnimating) return;
        if (e.key === 'ArrowDown' && currentSection < sections.length - 1) {
            nextSection();
        } else if (e.key === 'ArrowUp' && currentSection > 0) {
            prevSection();
        }
    }

    function nextSection() {
        if (currentSection < sections.length - 1) {
            changeSection(currentSection + 1);
        }
    }

    function prevSection() {
        if (currentSection > 0) {
            changeSection(currentSection - 1);
        }
    }

    function changeSection(index) {
        isAnimating = true;
        
        // 新しいセクションを表示
        sections[index].classList.add('active');
        paginationContainer.children[index].classList.add('active');
        
        // 少し遅らせて古いセクションを非表示にする
        setTimeout(function() {
            sections[currentSection].classList.remove('active');
            paginationContainer.children[currentSection].classList.remove('active');
            currentSection = index;
            
            setTimeout(function() {
                isAnimating = false;
            }, 100);
        }, 350); // 350ミリ秒の遅延を追加
    }

    function updateSection() {
        for (var i = 0; i < sections.length; i++) {
            sections[i].classList.remove('active');
            paginationContainer.children[i].classList.remove('active');
        }
        sections[currentSection].classList.add('active');
        paginationContainer.children[currentSection].classList.add('active');
    }

    return {
        init: init
    };
})();

document.addEventListener('DOMContentLoaded', fullpage.init);


// タイトルのアニメーション
function animateTitle() {
    var titleContainer = document.querySelector('.title-container');
    var mainTitleLetters = document.querySelectorAll('.main-title .letter');
    var subTitle = document.querySelector('.sub-title');

    function setSequentialDelay(elements) {
        elements.forEach((element, index) => {
            element.style.animationDelay = `${index * 0.05}s`;
        });
    }

    function animateLetter(letter, index) {
        setTimeout(() => {
            letter.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
            letter.style.transform = 'translateX(0)';
            letter.style.opacity = '1';
            letter.style.animationPlayState = 'running';
        }, index * 50);
    }

    // メインタイトルの文字アニメーション
    setSequentialDelay(mainTitleLetters);
    mainTitleLetters.forEach(animateLetter);

    setTimeout(() => {
        subTitle.style.transform = 'translateY(0)';
        subTitle.style.opacity = '1';
        
        // サブタイトルのテキストを保存
        var subTitleText = subTitle.textContent;
        subTitle.innerHTML = ''; // 内容をクリア
        
        // サブタイトルの各文字に順番にディレイを適用
        Array.from(subTitleText).forEach((char, index) => {
            var span = document.createElement('span');
            span.textContent = char;
            span.className = 'letter';
            subTitle.appendChild(span);
        });
        
        // サブタイトルの文字アニメーション
        var subTitleLetters = document.querySelectorAll('.sub-title .letter');
        setSequentialDelay(subTitleLetters);
        subTitleLetters.forEach(animateLetter);
        
        titleContainer.classList.add('animate');
    }, mainTitleLetters.length * 80 + 300);
}

// 背景のアニメーション
document.addEventListener('DOMContentLoaded', () => {
    const gradientBg = document.querySelector('.gradient-bg');
    const transitionBg = document.querySelector('.transition-bg');
    const bgImages = document.querySelectorAll('.bgimg li');
    let currentIndex = 0;

    // 全ての画像を非表示にする
    bgImages.forEach(img => {
        img.style.opacity = '0';
        img.style.transform = 'scale(1)';
    });

    // 3秒後にグラデーション背景をフェードアウトし、最初の画像を表示
    setTimeout(() => {
        gradientBg.style.opacity = '0';
        showImage(currentIndex);
    }, 300);

    // グラデーション背景のz-indexを下げて、画像が見えるようにする
    setTimeout(() => {
        gradientBg.style.zIndex = '-1';
    }, 4000);

    // 10秒ごとに背景画像を切り替える
    setInterval(() => {
        transitionBg.style.opacity = '1';
        setTimeout(() => {
            hideImage(currentIndex);
            currentIndex = (currentIndex + 1) % bgImages.length;
            showImage(currentIndex);
            setTimeout(() => {
                transitionBg.style.opacity = '0';
            }, 300);
        }, 300);
    }, 10000);

    function showImage(index) {
        bgImages[index].style.opacity = '1';
        bgImages[index].classList.add('active');
    }

    function hideImage(index) {
        bgImages[index].classList.remove('active');
        bgImages[index].style.opacity = '0';
        // アニメーション終了後にスケールをリセット
        setTimeout(() => {
            bgImages[index].style.transform = 'scale(1)';
        }, 500);
    }
});