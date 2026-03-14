// ゲーム状態
let playerDeck = [];
let cpuDeck = [];
let playerHand = [];
let cpuHand = [];
let roundCounter = 1;
let playerWins = 0;
let cpuWins = 0;
let currentCategory = '天使';
let currentPage = 1;
const cardsPerPage = 15;
let isGameStarted = false;

// DOM要素
const attributeDiagram = document.getElementById('attribute-diagram');
const startGameBtn = document.getElementById('start-game');
const cardSelectionElement = document.getElementById('card-selection');
const playerHandElement = document.getElementById('player-hand');
const playerFieldElement = document.getElementById('player-field');
const cpuFieldElement = document.getElementById('cpu-field');
const gameInfoElement = document.getElementById('game-info');
const selectionCountElement = document.createElement('div');
selectionCountElement.id = 'selection-count';
let selectionAreaElement;

// イベントリスナー
document.addEventListener('DOMContentLoaded', () => {
    startGameBtn.addEventListener('click', initGame);
    updateLogoSize();
    gameInfoElement.style.display = 'none';
});

// ロゴサイズを管理する関数
function updateLogoSize() {
		attributeDiagram.style.display = 'none';
    const logo = document.getElementById('game-logo');
    if (isGameStarted) {
        logo.classList.remove('title-screen');
        logo.classList.add('in-game');
    } else {
        logo.classList.remove('in-game');
        logo.classList.add('title-screen');
    }
}

// ゲーム初期化
function initGame() {
    playerDeck = [];
    cpuDeck = [];
    playerHand = [];
    cpuHand = [];
    roundCounter = 1;
    playerWins = 0;
    cpuWins = 0;
    currentCategory = '天使';
    currentPage = 1;
    isGameStarted = true;
    updateLogoSize();

    document.getElementById('field').innerHTML = '';
    document.getElementById('player-hand').innerHTML = '';
    gameInfoElement.style.display = 'none';

    showCardSelection();
}

// カード選択画面表示
function showCardSelection() {
	attributeDiagram.style.display = 'block';
    cardSelectionElement.style.display = 'block';
    cardSelectionElement.innerHTML = '';

    const instructionElement = document.createElement('div');
    instructionElement.id = 'selection-instruction';
    instructionElement.textContent = '好きなカードを5枚選ぶんや';
    cardSelectionElement.appendChild(instructionElement);

    createCategoryTabs();
    
    selectionAreaElement = document.createElement('div');
    selectionAreaElement.id = 'selection-area';
    cardSelectionElement.appendChild(selectionAreaElement);
    
    cardSelectionElement.appendChild(selectionCountElement);
    
    filterCardsByCategory(currentCategory);
    updateSelectionCount();
    startGameBtn.style.display = 'none';
}

// カテゴリタブ作成
function createCategoryTabs() {
    const tabContainer = document.createElement('div');
    tabContainer.className = 'category-tabs';
    const categories = ['天使', '悪魔', '成金'];

    categories.forEach(category => {
        const tab = document.createElement('button');
        tab.textContent = category;
        tab.addEventListener('click', () => {
            currentCategory = category;
            currentPage = 1;
            filterCardsByCategory(category);
        });
        if (category === currentCategory) {
            tab.classList.add('active');
        }
        tabContainer.appendChild(tab);
    });

    cardSelectionElement.appendChild(tabContainer);
}

// カテゴリによるカードフィルタリング
function filterCardsByCategory(category) {
    const filteredCards = cardData.filter(card => card.attribute === category);
    renderCards(filteredCards);
    
    const tabs = document.querySelectorAll('.category-tabs button');
    tabs.forEach(tab => {
        if (tab.textContent === category) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}

// カード描画
function renderCards(cards) {
    selectionAreaElement.innerHTML = '';
    const startIndex = (currentPage - 1) * cardsPerPage;
    const endIndex = startIndex + cardsPerPage;
    const pageCards = cards.slice(startIndex, endIndex);

    pageCards.forEach(card => {
        const cardElement = createCardElement(card);
        cardElement.addEventListener('click', () => selectCard(card, cardElement));
        if (playerDeck.some(c => c.id === card.id)) {
            cardElement.classList.add('selected');
        }
        selectionAreaElement.appendChild(cardElement);
    });

    addPagination(cards);
}

// ページネーション追加
function addPagination(cards) {
    const paginationElement = document.createElement('div');
    paginationElement.className = 'pagination';
    const pageCount = Math.ceil(cards.length / cardsPerPage);

    const existingPagination = document.querySelector('.pagination');
    if (existingPagination) {
        existingPagination.remove();
    }

    for (let i = 1; i <= pageCount; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.addEventListener('click', () => {
            currentPage = i;
            renderCards(cards);
        });
        if (i === currentPage) {
            pageButton.classList.add('active');
        }
        paginationElement.appendChild(pageButton);
    }

    cardSelectionElement.appendChild(paginationElement);
}

// カード選択
function selectCard(card, cardElement) {
    if (playerDeck.length < 5 && !playerDeck.some(c => c.id === card.id)) {
        playerDeck.push(card);
        cardElement.classList.add('selected');
        if (playerDeck.length === 5) {
            startGame();
        }
    } else if (playerDeck.some(c => c.id === card.id)) {
        playerDeck = playerDeck.filter(c => c.id !== card.id);
        cardElement.classList.remove('selected');
    }
    updateSelectionCount();
}

// 選択カウント更新
function updateSelectionCount() {
    selectionCountElement.textContent = `選択したカード: ${playerDeck.length}/5`;
}

// カード要素作成
function createCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'card';
    cardElement.innerHTML = `
        <div class="card-image">
            <img src="${card.image}" alt="${card.name}">
        </div>
        <div class="card-name">${card.name}</div>
    `;
    return cardElement;
}

// ゲーム開始
function startGame() {
	attributeDiagram.style.display = 'block';
    cardSelectionElement.style.display = 'none';
    cpuDeck = _.sampleSize(cardData, 5);
    playerHand = [...playerDeck];
    cpuHand = [...cpuDeck];
    roundCounter = 1;
    playerWins = 0;
    cpuWins = 0;
    gameInfoElement.style.display = 'block';
    updateGameInfo();
    renderHands();
    updateLogoSize();
}

// 手札表示
function renderHands() {
    playerHandElement.innerHTML = '';
    playerHand.forEach(card => {
        const cardElement = createCardElement(card);
        cardElement.addEventListener('click', () => {
            playerHandElement.innerHTML = '';
            playCard(card);
        });
        playerHandElement.appendChild(cardElement);
    });
}

// カードをプレイ
async function playCard(playerCard) {
    const cpuCard = _.sample(cpuHand);
    
    const fieldElement = document.getElementById('field');
    fieldElement.innerHTML = '';
    
    const playerSide = createFieldSide(playerCard, '貴様', 'player-label');
    fieldElement.appendChild(playerSide);

    playerHand = playerHand.filter(c => c.id !== playerCard.id);
    cpuHand = cpuHand.filter(c => c.id !== cpuCard.id);

    // CPUのカードを作成するが、まだ表示しない
    const cpuSide = createFieldSide(cpuCard, 'ラスボス', 'cpu-label');
    cpuSide.style.opacity = '0';
    fieldElement.appendChild(cpuSide);

    // CPUのカードをフェードインさせる
    await new Promise(resolve => {
        setTimeout(() => {
            cpuSide.style.opacity = '1';
            cpuSide.querySelector('.card').classList.add('cpu-card-animate');
            resolve();
        }, 1000); // 1秒後にアニメーション開始
    });

    // アニメーション完了を待つ
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 結果を表示
    const result = determineWinner(playerCard, cpuCard);
    if (result === 'player') {
        playerWins++;
        showResult('勝利！', 'win');
    } else if (result === 'cpu') {
        cpuWins++;
        showResult('敗北...', 'lose');
    } else {
        showResult('引き分け', 'draw');
    }

    updateGameInfo();
    
    if (roundCounter >= 5) {
        setTimeout(endGame, 1500);
    } else {
        roundCounter++;
        renderHands();
    }
}

function createFieldSide(card, labelText, labelClass) {
    const sideElement = document.createElement('div');
    sideElement.className = 'field-side';

    const cardElement = createCardElement(card);
    
    const labelElement = document.createElement('div');
    labelElement.className = labelClass;
    labelElement.textContent = labelText;

    sideElement.appendChild(cardElement);
    sideElement.appendChild(labelElement);

    return sideElement;
}

// 勝敗判定
function determineWinner(playerCard, cpuCard) {
    if (playerCard.attribute === cpuCard.attribute) return 'draw';
    if (
        (playerCard.attribute === '天使' && cpuCard.attribute === '成金') ||
        (playerCard.attribute === '成金' && cpuCard.attribute === '悪魔') ||
        (playerCard.attribute === '悪魔' && cpuCard.attribute === '天使')
    ) {
        return 'player';
    }
    return 'cpu';
}

// 結果表示
function showResult(text, resultClass) {
    const resultElement = document.createElement('div');
    resultElement.textContent = text;
    resultElement.className = `result ${resultClass}`;
    document.body.appendChild(resultElement);
    
    setTimeout(() => {
        resultElement.remove();
    }, 1500);
}

// ゲーム情報更新
function updateGameInfo() {
    document.getElementById('round-counter').textContent = Math.min(roundCounter, 5);
    document.getElementById('player-wins').textContent = playerWins;
    document.getElementById('cpu-wins').textContent = cpuWins;
}

// ゲーム終了
function endGame() {
    let result;
    if (playerWins > cpuWins) {
        result = '貴様の勝ちだ';
    } else if (playerWins < cpuWins) {
        result = 'お前は負けた';
    } else {
        result = '勝負はおあずけよ';
    }
    alert(`遊びは終わった。\n${result}\nプレイヤー: ${playerWins}勝 - CPU: ${cpuWins}勝`);
    
    isGameStarted = false;
    updateLogoSize();
    gameInfoElement.style.display = 'none';

    startGameBtn.textContent = 'もう一度プレイ';
    startGameBtn.onclick = initGame;
    
    // ロゴコンテナの要素を取得
    const logoContainer = document.getElementById('logo-container');
    
	attributeDiagram.style.display = 'none';
	
    // 既存のボタンを削除（もし存在すれば）
    const existingButton = document.querySelector('#start-game');
    if (existingButton) {
        existingButton.remove();
    }
    
    // ロゴコンテナの後にボタンを挿入
    logoContainer.parentNode.insertBefore(startGameBtn, logoContainer.nextSibling);
    
    // ボタンを表示
    startGameBtn.style.display = 'block';
    
    // フィールドとプレイヤーの手札をクリア
    document.getElementById('field').innerHTML = '';
    playerHandElement.innerHTML = '';
}