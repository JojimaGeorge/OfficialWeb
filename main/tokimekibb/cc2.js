/************************
 * 共通変数
*************************/
const resetPopup = document.getElementById("reset-popup");
const talkButton = document.getElementById("talk-button");
const babaImage = document.getElementById("baba-image");
const babaLoveImage = document.getElementById("babalove-image");
const downloadBabaLoveImage = document.getElementById("download-babalove-image");
const timeMessage = document.getElementById("time-message");
const titlePopup = document.getElementById("title-popup");
const descriptionPopup = document.getElementById("description-popup");
const nftPopup = document.getElementById("nft-popup");
const popup = document.getElementById("popup");
const popupDownload = document.getElementById("popup-download");


/************************
 * ホワイトアウトの設定
*************************/
const fadeOutEffect = () => {
    const whiteoutEffect = document.getElementById("whiteoutEffect");

    // ホワイトアウト用の要素を表示.
    whiteoutEffect.style.display = "block";

    setTimeout(() => {
        // 好感度をリセット.
        resetProgress();
    }, 2500);

    setTimeout(() => {
        // ホワイトアウト用の要素を非表示にする.
        whiteoutEffect.style.display = "none";
    }, 5000);

    // 最終クリック時刻をリセット.
    localStorage.removeItem("lastClickedTime");

    // 会話ボタンを有効にする.
    talkButton.disabled = false;
}

/************************
 * 森羅万象ボタン
*************************/
document.getElementById("confirm-reset-button").addEventListener("click", () => {
    fadeOutEffect();
    // 森羅万象のポップアップを非表示にする.
    resetPopup.classList.add("hidden");
});

/************************
 * リセットボタン
*************************/
document.getElementById("reset-button").addEventListener("click", () => {
    // 森羅万象のポップアップを表示.
    resetPopup.classList.remove("hidden");
});

/************************
 * 閉じるボタン
*************************/
document.getElementById("close-reset").addEventListener("click", () => {
    // 森羅万象のポップアップを非表示にする.
    resetPopup.classList.add("hidden");
});


/************************
 * 次へボタン
*************************/
document.getElementById("next-button").addEventListener("click", () => {
    // タイトル画面のポップアップを非表示にする.
    titlePopup.style.display = "none";
    // 遊び方画面のポップアップを表示する.
    descriptionPopup.style.display = "block";
});


/************************
 * はじめるボタン
*************************/
document.getElementById("start-button").addEventListener("click", () => {
    // タイトル画面のポップアップを非表示にする.
    titlePopup.style.display = "none";
    // 遊び方画面のポップアップを非表示にする.
    descriptionPopup.style.display = "none";
    // ゲームを開始.
    showImageAndPopup();
});


/************************
 * 会話ボタン
*************************/
talkButton.addEventListener("click", () => {
    // 最終クリック時間を取得.
    let lastClickedTime = localStorage.getItem("lastClickedTime");

    // 初回、または1時間経過していればクリック可能.
    if (lastClickedTime === null ||
        lastClickedTime !== null && new Date().getTime() - lastClickedTime > 3600000) {

        // 上限未満の場合.
        if (interactionCount < maxInteractions) {
            increaseProgress();
            interactionCount++;
            saveProgress(); // 好感度が更新されるたびに保存.
        }

        // 上限に達した場合
        if (interactionCount === maxInteractions) {
            // 最終会話時刻を保存.
            localStorage.setItem("lastClickedTime", new Date().getTime().toString());
            // interactionCountを初期化.
            interactionCount = 0;
        }
    } else {
        let pastTime = 3600000 - (new Date().getTime() - lastClickedTime); // 経過ミリビョウ.
        let enableTime = Math.floor(pastTime/1000/60) % 60;
        timeMessage.innerHTML = `${enableTime} 分後に来てちょうだい。<br>また会えるのが楽しみね。`;
    }
});


/************************
 * NFT発行ボタン

document.getElementById("download-button").addEventListener("click", () => {
    // NFT発行のポップアップを表示する.
    nftPopup.classList.remove("hidden");
});
*************************/

document.getElementById("download-button").addEventListener("click", () => {
    // 画像のパスを設定
    const imagePath = "images/trueend.png";
    
    // 新しいタブで画像を表示する
    const newTab = window.open(imagePath, "_blank");
    
    // ダウンロードのダイアログが表示されるようにする
    newTab.focus();
});








/************************
 * ミントサイト遷移ボタン
*************************/
document.getElementById("nft-issue-button").addEventListener("click", () => {
    // ポップアップを非表示にする.
    nftPopup.classList.add("hidden");

    // 指定したURLに移動する.
    window.open("https://www.0xspread.com/0x5Fb3901E/dd102fa6-06a8-4656-aef2-5cf9f9b9c29a", "_blank");
});


/****************************
 * ゲームの状態を保持する変数
*****************************/
let progress = 0;
const maxProgress = 100;
const imageCount = 5;
let interactionCount = 0;
const maxInteractions = 10; // 話しかけられる上限回数.
let isInitialPopup = true;
let isFirstLoad = true;
let popupTimeout; // ポップアップのタイムアウトを管理する変数.


/************************
 * 好感度
*************************/
let progressBar = document.getElementById("progress-bar");

// プログレスバーを更新.
const updateProgressBar = () => {
    const progressPercentage = (progress / 100) * 100;
    progressBar.style.width = `${progressPercentage}%`;
}

// 好感度をローカルストレージに保存.
const saveProgress = () => {
    localStorage.setItem("progress", progress.toString());
    updateProgressBar(); // バーに好感度を反映.
}

// 好感度をローカルストレージから読み込む.
window.onload = () => {
    if (isFirstLoad) {
        isFirstLoad = false;

        // タイトル画面のポップアップを表示.
        titlePopup.style.display = "flex";

        // ローカルストレージから好感度を読み込む.
        const savedProgress = localStorage.getItem("progress");
        if (savedProgress !== null) {
            // ローカルストレージに好感度が保存されている場合、読み込んで初期化.
            progress = parseInt(savedProgress, 10);
        } else {
            // ローカルストレージに保存された好感度がない場合、初期値で初期化.
            progress = 0;
        }

        // バーに好感度を反映.
        updateProgressBar();

        // ゲームを開始.
        showImageAndPopup();
    }
};


// 好感度をリセットする.
const resetProgress = () => {
    progress = 0;
    interactionCount = 0;
    updateProgressBar();
    // ローカルストレージから好感度の値を削除.
    localStorage.removeItem("progress");
}


// 好感度の進行状況を更新する関数.
const increaseProgress = () => {
    if (progress < maxProgress) {
        progress += 2;
        showImageAndPopup();
        if (isInitialPopup) {
            isInitialPopup = false;
        }
    }


    if (progress >= maxProgress) {
        // 好感度が100に達した場合の処理を追加.
        talkButton.disabled = false;
        showCongratulationsPopup();
    }
    progressBar.style.width = progress + "%";
}


/*****************
 * ゲーム部分
*****************/

// 画像ファイル名のプレフィックスとインデックスマップの初期化.
const imagePrefix = "baba";
const imageIndexMap = {
    morning: 1,
    afternoon: 2,
    evening: 3,
    night1: 4,
    night2: 5,
};


// 画像ファイル名のプレフィックスとインデックスマップの初期化（好感度に応じた画像）.
const loveImagePrefix = "babalove";
const loveImageIndexMap = {
    1: [1, 2, 3],
    2: [1, 2, 3],
    3: [1, 2, 3],
    4: [1, 2, 3],
    5: [1, 2, 3],
    6: "loveforever",
};

// 画像とポップアップメッセージを表示する関数.
const showImageAndPopup = () => {
    const imageIndex = Math.ceil(progress / (maxProgress / imageCount));
    const currentHour = new Date().getHours();
    let timePeriod;

    if (currentHour >= 6 && currentHour < 12) {
        timePeriod = "morning";
        timeMessage.innerHTML = "ばーばは朝食のパンをかじって走っている。<br>ぶつかって出会い始めよう。";
    } else if (currentHour >= 12 && currentHour < 16) {
        timePeriod = "afternoon";
        timeMessage.innerHTML = "ばーばはキラキラビーチでお誘い待ちだ。<br>ナンパの用意はできているか？";
    } else if (currentHour >= 16 && currentHour < 19) {
        timePeriod = "evening";
        timeMessage.innerHTML = "ばーばは夕日と一緒に君を待っている。<br>燃えるような言葉を投げかけよう。";
    } else if (currentHour >= 19 && currentHour < 23) {
        timePeriod = "night1";
        timeMessage.innerHTML = "ばーばはナイトビーチで恋焦がれている。<br>夜のお誘いをしてみよう。";
    } else {
        timePeriod = "night2";
        timeMessage.innerHTML = "ばーばはぐっすり就寝中だ。<br>耳元で愛言葉を囁やこう。。";
    }

    const imageFilename = `images/${imagePrefix}${imageIndexMap[timePeriod]}.png`;

// 画像の読み込みが完了したら表示するためのイベントリスナーを追加.
babaImage.addEventListener("load", () => {
    // 画像を表示する.
    babaImage.style.display = "block";
    babaImage.style.margin = "0 auto"; // 画像を中央揃えにする

    if (!isInitialPopup || interactionCount > 0) {
        let popupMessage = document.getElementById("popup-message");

        popup.classList.remove("hidden");
        const loveImageList = loveImageIndexMap[imageIndex];
        const randomIndex = Math.floor(Math.random() * loveImageList.length);
        const randomLoveImage = loveImageList[randomIndex];
        babaLoveImage.src = `images/${loveImagePrefix}${imageIndex}_${randomLoveImage}.png`;
        babaLoveImage.style.display = "block";
        babaLoveImage.style.margin = "0 auto";

        if (progress % 20 === 0) {
            popupMessage.textContent = "やったね！ばーばのトゥンク味が増しました。";
            popupMessage.style.fontSize = "20px"; // フォントサイズを20ピクセルに設定
        } else if (progress !== maxProgress) {
            // 通常の好感度上昇時のポップアップ表示.
            popupMessage.textContent = "好感度が上がりました！";

            // 画面をタップしたときのイベントリスナーを追加.
            popup.addEventListener("click", () => {
                popup.classList.add("hidden");
                babaLoveImage.style.display = "none";
            });

            // "X" を表示する要素を作成し、スタイルを設定
            const xElement = document.createElement("div");
            xElement.textContent = "Ｘ";
            xElement.style.position = "absolute";
            xElement.style.top = "5px";
            xElement.style.right = "5px";
            xElement.style.padding = "5px 10px";
            xElement.style.color = "white"; // テキストの色
            xElement.style.backgroundColor = "pink"; // 背景色
            xElement.style.borderRadius = "5%"; // 角丸
            xElement.style.fontWeight = "bold";
            xElement.style.cursor = "pointer"; // カーソルをポインター表示に設定

            // 画像の親要素に "X" の要素を追加
            babaLoveImage.parentElement.appendChild(xElement);
        }
    }
});


    // 画像を非表示にする.
    babaImage.style.display = "none";

    // 画像の読み込みを開始.
    babaImage.src = imageFilename;
}


/*****************************************************
 * おめでとうポップアップを表示する
*****************************************************/
const showCongratulationsPopup = () => {
    document.getElementById("congratulations-message").innerHTML =
        `<p>おめでとう！時は満ちた。<br>さあ。誓いのキッスをしよう。</p>`;
    popupDownload.classList.remove("hidden");
    downloadBabaLoveImage.src = "images/trueend.png";
    downloadBabaLoveImage.style.display = "block";
    document.getElementById("close-button").addEventListener("click", () => {
        popupDownload.classList.add("hidden");
        downloadBabaLoveImage.style.display = "none";
    });
}

/*****************************************************
 * ページを離れる際にポップアップのタイムアウトをクリアする
*****************************************************/
window.onbeforeunload = () => {
    clearTimeout(popupTimeout);
};


/********************************
 * ツイート内容の編集。「\n」が改行
********************************/
const tweetText = "ばーばとスウィートタイムを過ごしているよ！\n時間帯によって色とりどりの笑顔を見せる彼女。君も今すぐラヴ・ゲーム🫶\n\n#ときめきサマー\n#8月8日はばーばの日\n";
const encodedTweetText = encodeURIComponent(tweetText);
const url = "https://twitter.com/JojimaGeorgeNFT/status/1688671359688187904";

const twitterShareURL = `https://twitter.com/intent/tweet?url=${url}&text=${encodedTweetText}`;

const twitterShareLink = document.getElementById("twitter-share-link");
twitterShareLink.href = twitterShareURL;

