// config.jsから設定を読み込む
const SCRIPT_URL = CONFIG.SCRIPT_URL;

// DOM要素
let canvas, ctx, infoPreviewCanvas, infoPreviewCtx;
let attributeSelect, partSelects, customizer, infoForm, nextBtn, backBtn, form;

// 現在の属性とパーツの状態
let currentAttribute = '';
let currentParts = {};

// パーツオプションの定義
const partOptions = {
    ac: ['1', '2', '3'],
    ha: ['1', '2', '3'],
    dr: ['1', '2', '3'],
    eb: ['1', '2', '3'],
    ey: ['1', '2', '3'],
    mo: ['1', '2', '3'],
    bo: ['1', '2', '3'],
    bg: ['1', '2', '3']
};

// パーツ名の定義
const partNames = {
    ac: 'アクセサリー',
    ha: '髪型',
    dr: '服',
    eb: 'まゆげ',
    ey: '目',
    mo: '口',
    bo: '素体',
    bg: '背景'
};

// DOMContentLoadedイベントリスナー
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded イベントが発火しました');
    initializeElements();
    setCanvasSize();
    setupEventListeners();
});

// DOM要素の初期化
function initializeElements() {
    canvas = document.getElementById('preview');
    ctx = canvas.getContext('2d');
    infoPreviewCanvas = document.getElementById('info-preview');
    infoPreviewCtx = infoPreviewCanvas.getContext('2d');
    attributeSelect = document.getElementById('attribute');
    customizer = document.getElementById('customizer');
    infoForm = document.getElementById('info-form');
    nextBtn = document.getElementById('next-btn');
    backBtn = document.getElementById('back-btn');
    form = document.getElementById('card-info-form');

    partSelects = {
        ac: document.getElementById('ac'),
        ha: document.getElementById('ha'),
        dr: document.getElementById('dr'),
        eb: document.getElementById('eb'),
        ey: document.getElementById('ey'),
        mo: document.getElementById('mo'),
        bo: document.getElementById('bo'),
        bg: document.getElementById('bg')
    };

    console.log('DOM要素が初期化されました');
}

// キャンバスサイズの設定
function setCanvasSize() {
    const size = Math.min(600, window.innerWidth - 40);
    canvas.width = size;
    canvas.height = size;
    infoPreviewCanvas.width = size;
    infoPreviewCanvas.height = size;
    updatePreview();
    console.log('キャンバスサイズが設定されました');
}

// イベントリスナーの設定
function setupEventListeners() {
    window.addEventListener('resize', setCanvasSize);
    attributeSelect.addEventListener('change', handleAttributeChange);
    Object.values(partSelects).forEach(select => {
        select.addEventListener('change', handlePartChange);
    });
    nextBtn.addEventListener('click', showInfoForm);
    backBtn.addEventListener('click', showCustomizer);
    form.addEventListener('submit', handleFormSubmit);
    console.log('イベントリスナーが設定されました');
}

// 属性変更のハンドラ
function handleAttributeChange(e) {
    currentAttribute = e.target.value;
    if (currentAttribute) {
        populatePartOptions(currentAttribute);
        currentParts = {};
        updatePreview();
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    console.log('属性が変更されました:', currentAttribute);
}

// パーツ変更のハンドラ
function handlePartChange(e) {
    if (e.target.value) {
        currentParts[e.target.id] = e.target.value;
    } else {
        delete currentParts[e.target.id];
    }
    updatePreview();
    console.log('パーツが変更されました:', e.target.id, e.target.value);
}

// パーツオプションの生成
function populatePartOptions(attribute) {
    Object.entries(partSelects).forEach(([part, select]) => {
        select.innerHTML = '<option value="">選んでや</option>';
        partOptions[part].forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = `${part}${option}`;
            optionElement.textContent = `${partNames[part]}${option}`;
            select.appendChild(optionElement);
        });
    });
    console.log('パーツオプションが生成されました');
}

// 画像の読み込み
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

// 画像を中央に描画
function drawImageCentered(ctx, img) {
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const x = (canvas.width - img.width * scale) / 2;
    const y = (canvas.height - img.height * scale) / 2;
    ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
}

// プレビューの更新
async function updatePreview() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!currentAttribute) return;

    const layers = ['bg', 'bo', 'mo', 'ey', 'eb', 'dr', 'ha', 'ac'];

    for (const layer of layers) {
        const imageSrc = `images/${currentAttribute}_${currentParts[layer] || `${layer}1`}.png`;
        try {
            const img = await loadImage(imageSrc);
            drawImageCentered(ctx, img);
        } catch (error) {
            console.error(`画像の読み込みに失敗しました: ${imageSrc}`, error);
            ctx.fillStyle = 'black';
            ctx.font = '20px Arial';
            ctx.fillText(`${imageSrc} が見つかりませんでした`, 10, 30);
        }
    }
    console.log('プレビューが更新されました');
}

// 情報入力フォームの表示
function showInfoForm() {
    customizer.classList.remove('active');
    customizer.classList.add('hidden');
    infoForm.classList.remove('hidden');
    infoForm.classList.add('active');
    updateInfoPreview();
    console.log('情報入力フォームが表示されました');
}

// サンプル文の表示
const sampleData = {
    'card-title': 'サンプルカード',
    'card-description': 'ばーばのサンプル説明文や。おもろいカードになるで！',
    'user-name': 'テスト太郎',
    'x-account': '@test_taro',
    'wallet-address': '0x1234567890abcdef1234567890abcdef12345678',
    'nft-link': 'https://example.com/nft'
};

let sampleMode = false;

document.getElementById('toggle-sample').addEventListener('click', function() {
    sampleMode = !sampleMode;
    const form = document.getElementById('card-info-form');
    
    for (const [id, value] of Object.entries(sampleData)) {
        const input = form.querySelector(`#${id}`);
        if (sampleMode) {
            input.value = value;
        } else {
            input.value = '';
        }
    }
});


// カスタマイザーの表示
function showCustomizer() {
    infoForm.classList.remove('active');
    infoForm.classList.add('hidden');
    customizer.classList.remove('hidden');
    customizer.classList.add('active');
    console.log('カスタマイザーが表示されました');
}

// 情報プレビューの更新
function updateInfoPreview() {
    infoPreviewCtx.clearRect(0, 0, infoPreviewCanvas.width, infoPreviewCanvas.height);
    infoPreviewCtx.drawImage(canvas, 0, 0);
    console.log('情報プレビューが更新されました');
}

// フォーム送信のハンドラ
function handleFormSubmit(e) {
    e.preventDefault();
    console.log('フォームが送信されました');

    const formData = new FormData(form);
    const cardInfo = Object.fromEntries(formData.entries());

    cardInfo.customization = JSON.stringify(currentParts);
    cardInfo.attribute = currentAttribute;
    cardInfo.imageData = canvas.toDataURL('image/png').split(',')[1];

    console.log('画像データのサイズ:', cardInfo.imageData.length);
    console.log('送信されるデータ:', cardInfo);

    alert('情報を送信中です。OKを押し、このままお待ちください…');

    fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(cardInfo),
        mode: 'no-cors',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(() => {
        console.log('データが送信されました');
        alert('情報が送信されました。カードNFTの制作をおこないます。完成後、連絡をしますのでお待ちくださいませ。');
        resetForm();
    })
    .catch(error => {
        console.error('Error:', error);
        alert('エラーが発生しました。もう一度お試しください。');
    });
}

// フォームのリセット
function resetForm() {
    form.reset();
    currentAttribute = '';
    currentParts = {};
    attributeSelect.value = '';
    Object.values(partSelects).forEach(select => select.innerHTML = '<option value="">選んでや</option>');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    infoPreviewCtx.clearRect(0, 0, infoPreviewCanvas.width, infoPreviewCanvas.height);
    showCustomizer();
    console.log('フォームがリセットされました');
}

console.log('cardcustom.js が読み込まれました');