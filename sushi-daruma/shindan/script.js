// すしだるま診断 スクリプト

// ページ読み込み時にパラメータを確認する関数
function checkURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const resultParam = urlParams.get('result');
    
    if (resultParam && results[resultParam]) {
        // 結果パラメータが存在し、有効な場合は直接結果を表示
        currentResultCharacter = resultParam;
        startScreen.classList.remove('active');
        showDirectResult(resultParam);
    }
}

// 直接結果を表示する関数
function showDirectResult(character) {
    const result = results[character];
    resultTitle.textContent = result.title;
    resultDescription.textContent = result.description;
    resultImage.src = result.image;
    resultImage.alt = result.title;
    resultImage.classList.add('floating');
    
    // シェアされた結果画面ではボタンを変更
    restartBtn.textContent = '診断をしてみる';
    // 「Xでシェア」ボタンを非表示
    document.querySelector('.share-buttons').style.display = 'none';
    
    resultScreen.classList.add('active');
}

// 結果の定義（7種類のすしだるま）
const results = {
    maguro: {
        title: "あなたは「まぐろ」タイプ！",
        description: "好奇心旺盛で、いつもパワフル全開！まわりを元気にする活力の源やで。困ってる人を見たら放っておけへんタイプで、チャレンジ精神も満点。どんな時も前向きなあなたは、周りの人を巻き込んで楽しい冒険に連れていくんやで。熱しやすいけど冷めにくい情熱の持ち主！",
        image: "img/maguro.png"
    },
    salmon: {
        title: "あなたは「サーモン」タイプ！",
        description: "細かいことにも気が利いて、周りのみんなをサポートするのが得意なんやな。おしゃれセンスも抜群で、いつも小奇麗にしてる。計画性があって頼りになるけど、柔軟性もあるバランス型。みんなに「あの人がおるから安心やわ〜」って思われてる縁の下の力持ちタイプやで！",
        image: "img/salmon.png"
    },
    amaebi: {
        title: "あなたは「あまえび」タイプ！",
        description: "太平洋のスーパーアイドル級の愛されキャラや！自分の魅力を知ってて、それを最大限に活かすのが上手。明るくて人を惹きつける不思議な魅力の持ち主。周りが自然と笑顔になるような、場を明るくする天性の才能があるんやで。困った時は甘えるのも上手なんやろな〜",
        image: "img/amaebi.png"
    },
    uni: {
        title: "あなたは「うに」タイプ！",
        description: "ちょっと変わった視点を持ってて、周りからは「天才かも？」って思われてるんとちゃう？何を考えてるか周りには分からへんけど、突然ええアイデアを出して周りをびっくりさせるタイプやな。独創的な発想と、人とは違う感性が最大の武器。ミステリアスな魅力の持ち主や！",
        image: "img/uni.png"
    },
    madako: {
        title: "あなたは「まだこ」タイプ！",
        description: "ちょっと泣き虫やけど、その繊細さが魅力的なんや！感受性豊かで、人の気持ちにすぐ共感できるタイプやな。実は誰よりもチャレンジ精神があって、怖いと思いながらも一歩踏み出す勇気を持ってる。弱さも見せられる強さがあるから、人から素直に応援されるんやで！",
        image: "img/madako.png"
    },
    hamachi: {
        title: "あなたは「はまち」タイプ！",
        description: "恥ずかしがり屋やけど、じつはユーモアのセンスが抜群なんやな！静かに見えても、親しくなるとお茶目な一面が飛び出すタイプ。控えめな性格やけど、実はしっかり周りを見てて、ちょうどええタイミングでみんなを和ませるんやで。信頼関係を大事にする、深い友情を育むタイプや！",
        image: "img/hamachi.png"
    },
    hotaruika: {
        title: "あなたは「ほたるいか総長」タイプ！",
        description: "一見厳しそうに見えるけど、実はめっちゃ情に厚い人情派！かつては恐れられてたかもしれんけど、実は仲間思いで面倒見が良すぎるんや。リーダーシップがあって、みんなの信頼も厚い。筋が通ってて、正義感が強い。熱い心で周りを守る、頼れる存在なんやで！",
        image: "img/hotaruika.png"
    }
};

// 質問のデータベース
const questions = [
    {
        id: 1,
        text: "休日は何をして過ごすことが多い？",
        answers: [
            { text: "外に出かけて、アクティブに過ごす", points: { maguro: 2, salmon: 0, amaebi: 1, uni: 0, madako: 0, hamachi: 0, hotaruika: 1 } },
            { text: "おしゃれなカフェで、計画を立てたり読書したり", points: { maguro: 0, salmon: 2, amaebi: 1, uni: 1, madako: 0, hamachi: 0, hotaruika: 0 } },
            { text: "友達と集まってワイワイ盛り上がる", points: { maguro: 1, salmon: 0, amaebi: 2, uni: 0, madako: 0, hamachi: 0, hotaruika: 1 } },
            { text: "一人で没頭できる趣味や考え事をする", points: { maguro: 0, salmon: 0, amaebi: 0, uni: 2, madako: 1, hamachi: 1, hotaruika: 0 } }
        ]
    },
    {
        id: 2,
        text: "友達が悩みを相談してきたとき、あなたはどうする？",
        answers: [
            { text: "「大丈夫、一緒に解決しよう！」と明るく励ます", points: { maguro: 2, salmon: 0, amaebi: 1, uni: 0, madako: 0, hamachi: 0, hotaruika: 1 } },
            { text: "具体的なアドバイスと解決策を提案する", points: { maguro: 0, salmon: 2, amaebi: 0, uni: 1, madako: 0, hamachi: 0, hotaruika: 1 } },
            { text: "まずは相手の話をじっくり聞いて共感する", points: { maguro: 0, salmon: 1, amaebi: 0, uni: 0, madako: 2, hamachi: 1, hotaruika: 0 } },
            { text: "自分の経験を踏まえて、本音で話をする", points: { maguro: 1, salmon: 0, amaebi: 1, uni: 0, madako: 0, hamachi: 0, hotaruika: 2 } }
        ]
    },
    {
        id: 3,
        text: "新しいチャレンジに対して、あなたはどんな態度？",
        answers: [
            { text: "迷わず飛び込む！やってみないとわからない", points: { maguro: 2, salmon: 0, amaebi: 1, uni: 1, madako: 0, hamachi: 0, hotaruika: 0 } },
            { text: "事前にしっかり計画を立ててから挑戦する", points: { maguro: 0, salmon: 2, amaebi: 0, uni: 1, madako: 0, hamachi: 0, hotaruika: 1 } },
            { text: "ちょっと怖いけど、勇気を出して一歩踏み出す", points: { maguro: 0, salmon: 0, amaebi: 0, uni: 0, madako: 2, hamachi: 1, hotaruika: 1 } },
            { text: "自分のやり方で、じっくり考えてから行動する", points: { maguro: 0, salmon: 0, amaebi: 0, uni: 2, madako: 0, hamachi: 2, hotaruika: 0 } }
        ]
    },
    {
        id: 4,
        text: "グループでの立ち位置は？",
        answers: [
            { text: "みんなを引っ張るリーダー的存在", points: { maguro: 1, salmon: 1, amaebi: 0, uni: 0, madako: 0, hamachi: 0, hotaruika: 2 } },
            { text: "場を明るくするムードメーカー", points: { maguro: 2, salmon: 0, amaebi: 2, uni: 0, madako: 0, hamachi: 0, hotaruika: 0 } },
            { text: "裏方で支える縁の下の力持ち", points: { maguro: 0, salmon: 2, amaebi: 0, uni: 0, madako: 1, hamachi: 1, hotaruika: 0 } },
            { text: "静かに見守り、必要な時に意見する", points: { maguro: 0, salmon: 0, amaebi: 0, uni: 2, madako: 0, hamachi: 2, hotaruika: 1 } }
        ]
    },
    {
        id: 5,
        text: "困った時、どう対処することが多い？",
        answers: [
            { text: "ポジティブに考えて、自分で解決策を見つける", points: { maguro: 2, salmon: 1, amaebi: 0, uni: 1, madako: 0, hamachi: 0, hotaruika: 0 } },
            { text: "信頼できる人に相談して、一緒に考える", points: { maguro: 0, salmon: 1, amaebi: 1, uni: 0, madako: 2, hamachi: 0, hotaruika: 0 } },
            { text: "一度感情を出して、それから冷静に対処する", points: { maguro: 0, salmon: 0, amaebi: 0, uni: 0, madako: 2, hamachi: 0, hotaruika: 1 } },
            { text: "自分の経験と直感を信じて、毅然と対応する", points: { maguro: 0, salmon: 0, amaebi: 0, uni: 1, madako: 0, hamachi: 1, hotaruika: 2 } }
        ]
    }
];

// 追加質問のデータベース（他の質問への回答によって表示するかどうかを決める）
const additionalQuestions = [
    {
        id: 6,
        text: "人を笑わせるのは得意？",
        condition: (answers) => answers[1] && (answers[1].points.amaebi > 0 || answers[1].points.maguro > 0), // 質問2でまぐろかあまえびに点数が入った場合
        answers: [
            { text: "得意！いつも周りを笑わせている", points: { maguro: 1, salmon: 0, amaebi: 2, uni: 0, madako: 0, hamachi: 0, hotaruika: 0 } },
            { text: "タイミングを見て、時々ジョークを言う", points: { maguro: 1, salmon: 0, amaebi: 0, uni: 0, madako: 0, hamachi: 2, hotaruika: 0 } },
            { text: "あんまり得意じゃないけど、笑いは大事にしてる", points: { maguro: 0, salmon: 1, amaebi: 0, uni: 0, madako: 1, hamachi: 0, hotaruika: 1 } },
            { text: "面白いことを言うより、聞き役の方が多い", points: { maguro: 0, salmon: 2, amaebi: 0, uni: 1, madako: 0, hamachi: 0, hotaruika: 0 } }
        ]
    },
    {
        id: 7,
        text: "何かを決める時、どんな基準で選ぶことが多い？",
        condition: (answers) => answers[2] && (answers[2].points.uni > 0 || answers[2].points.salmon > 0), // 質問3でうにかサーモンに点数が入った場合
        answers: [
            { text: "論理的に考えて、最適な選択をする", points: { maguro: 0, salmon: 1, amaebi: 0, uni: 2, madako: 0, hamachi: 0, hotaruika: 1 } },
            { text: "過去の経験や実績から判断する", points: { maguro: 0, salmon: 2, amaebi: 0, uni: 0, madako: 0, hamachi: 0, hotaruika: 1 } },
            { text: "直感や感覚を大事にする", points: { maguro: 1, salmon: 0, amaebi: 1, uni: 1, madako: 1, hamachi: 0, hotaruika: 0 } },
            { text: "周りの意見も参考にしながら考える", points: { maguro: 0, salmon: 1, amaebi: 0, uni: 0, madako: 0, hamachi: 2, hotaruika: 0 } }
        ]
    },
    {
        id: 8,
        text: "人間関係で最も大切にしていることは？",
        condition: (answers) => answers[3] && (answers[3].points.hotaruika > 0 || answers[3].points.hamachi > 0), // 質問4でほたるいかかはまちに点数が入った場合
        answers: [
            { text: "信頼関係と誠実さ", points: { maguro: 0, salmon: 1, amaebi: 0, uni: 0, madako: 0, hamachi: 1, hotaruika: 2 } },
            { text: "気遣いと思いやり", points: { maguro: 0, salmon: 2, amaebi: 0, uni: 0, madako: 1, hamachi: 1, hotaruika: 0 } },
            { text: "楽しさと共有する時間", points: { maguro: 2, salmon: 0, amaebi: 2, uni: 0, madako: 0, hamachi: 0, hotaruika: 0 } },
            { text: "お互いの成長と刺激", points: { maguro: 1, salmon: 0, amaebi: 0, uni: 2, madako: 0, hamachi: 0, hotaruika: 1 } }
        ]
    }
];

// 要素の参照を取得
const startScreen = document.getElementById('start-screen');
const questionScreen = document.getElementById('question-screen');
const resultScreen = document.getElementById('result-screen');
const startBtn = document.getElementById('start-btn');
const questionText = document.getElementById('question-text');
const answersContainer = document.getElementById('answers');
const progress = document.getElementById('progress');
const resultTitle = document.getElementById('result-title');
const resultDescription = document.getElementById('result-description');
const resultImage = document.getElementById('result-image');
const restartBtn = document.getElementById('restart-btn');
const twitterShareBtn = document.getElementById('twitter-share');

// 現在の質問インデックスと回答履歴
let currentQuestionIndex = 0;
let userAnswers = [];
let usedQuestionIds = [];
let questionQueue = [];
let currentResultCharacter = null; // 結果のキャラクターキーを保存する変数

// 診断スタート
startBtn.addEventListener('click', startQuiz);

// もう一度診断する
restartBtn.addEventListener('click', () => {
    resultScreen.classList.remove('active');
    startScreen.classList.add('active');
    resetQuiz();
});

// Twitterでシェア
twitterShareBtn.addEventListener('click', shareOnTwitter);

// 診断を開始する関数
function startQuiz() {
    startScreen.classList.remove('active');
    questionScreen.classList.add('active');
    resetQuiz();
    loadQuestion();
}

// 診断をリセットする関数
function resetQuiz() {
    currentQuestionIndex = 0;
    userAnswers = [];
    usedQuestionIds = [];
    questionQueue = [...questions]; // 基本質問をコピー
    
    // 共有から来た場合のボタンをリセット
    restartBtn.textContent = 'もう一度診断する';
    document.querySelector('.share-buttons').style.display = 'block';
}

// 質問を読み込む関数
function loadQuestion() {
    // 現在表示すべき質問を取得
    if (currentQuestionIndex >= questionQueue.length) {
        // すべての質問に回答した場合、結果を表示
        showResult();
        return;
    }

    const currentQuestion = questionQueue[currentQuestionIndex];
    usedQuestionIds.push(currentQuestion.id);

    // 質問テキストを表示
    questionText.textContent = currentQuestion.text;

    // 回答ボタンを生成
    answersContainer.innerHTML = '';
    currentQuestion.answers.forEach((answer, index) => {
        const button = document.createElement('button');
        button.classList.add('answer-btn');
        button.textContent = answer.text;
        button.addEventListener('click', () => selectAnswer(answer, currentQuestion.id));
        answersContainer.appendChild(button);
    });

    // プログレスバーを更新
    updateProgressBar();
}

// 回答を選択した時の処理
function selectAnswer(answer, questionId) {
    // 回答を保存
    userAnswers[questionId] = answer;
    
    // 次の質問へ進む前に、追加質問の条件をチェック
    checkAdditionalQuestions();
    
    // 次の質問へ
    currentQuestionIndex++;
    
    // アニメーション効果
    questionScreen.classList.remove('active');
    setTimeout(() => {
        questionScreen.classList.add('active');
        loadQuestion();
    }, 300);
}

// 追加質問の条件をチェックする関数
function checkAdditionalQuestions() {
    additionalQuestions.forEach(question => {
        // まだ使用されていない質問で、条件を満たすものを追加
        if (!usedQuestionIds.includes(question.id) && question.condition(userAnswers)) {
            // 次の質問として挿入（現在のインデックスの次に）
            questionQueue.splice(currentQuestionIndex + 1, 0, question);
        }
    });
}

// プログレスバーを更新する関数
function updateProgressBar() {
    // 最大8問（基本5問+追加3問）を想定
    const maxPossibleQuestions = 8;
    
    // 最後の質問の場合は常に100%表示
    if (currentQuestionIndex >= questionQueue.length - 1) {
        progress.style.width = '100%';
    } else {
        // 最初の質問（回答前）はバーを0%にする
        const progressPercentage = (currentQuestionIndex / maxPossibleQuestions) * 100;
        progress.style.width = `${Math.min(progressPercentage, 100)}%`;
    }
}

// 結果を表示する関数
function showResult() {
    // 各すしだるまキャラクターのポイントを集計
    const points = {
        maguro: 0,
        salmon: 0,
        amaebi: 0,
        uni: 0,
        madako: 0,
        hamachi: 0,
        hotaruika: 0
    };

    // ユーザーの回答からポイントを集計
    Object.values(userAnswers).forEach(answer => {
        if (answer && answer.points) {
            Object.entries(answer.points).forEach(([character, point]) => {
                points[character] += point;
            });
        }
    });

    // 最も高いポイントのキャラクターを見つける
    let maxPoints = 0;
    let resultCharacter = 'maguro'; // デフォルト

    Object.entries(points).forEach(([character, point]) => {
        if (point > maxPoints) {
            maxPoints = point;
            resultCharacter = character;
        }
    });

    // 結果のキャラクターキーを保存
    currentResultCharacter = resultCharacter;

    // 結果を表示
    const result = results[resultCharacter];
    resultTitle.textContent = result.title;
    resultDescription.textContent = result.description;
    resultImage.src = result.image;
    resultImage.alt = result.title;
    resultImage.classList.add('floating');

    // 結果画面を表示
    questionScreen.classList.remove('active');
    resultScreen.classList.add('active');
}

// Twitterでシェアする関数
function shareOnTwitter() {
    const resultTitle = document.getElementById('result-title').textContent;
    const resultChar = currentResultCharacter; // 結果のキャラクターキー
    const shareText = `すしだるま診断の結果: ${resultTitle} | あなたにぴったりのすしだるまを見つけよう！ #すしだるま診断`;
    const shareUrl = encodeURIComponent(`${window.location.href.split('?')[0]}?result=${resultChar}`);
    
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${shareUrl}`, '_blank');
}

// 画像のプリロード
function preloadImages() {
    Object.values(results).forEach(result => {
        const img = new Image();
        img.src = result.image;
    });
}

// ページ読み込み完了時に実行
window.addEventListener('DOMContentLoaded', function() {
    preloadImages();
    checkURLParams(); // URLパラメータをチェック
});
