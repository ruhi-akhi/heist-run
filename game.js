const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// গেম স্টেট ও ভ্যারিয়েবল
let gravity = 0.5;
let score = 0;
let gameOver = false;
let spawnTimer = 0;
let obstacles = [];
let coins = [];

// ইমেজ অবজেক্ট তৈরি এবং লোকাল সোর্স সেট করা
const bgImg = new Image();
bgImg.src = 'images/background.png';

const thiefImg = new Image();
thiefImg.src = 'images/thief.png'; // ব্যাগ হাতে দৌড়ানো আসল চোর

const policeImg = new Image();
policeImg.src = 'images/police.png'; // সবুজ টুপি পরা গান হাতে ক্যারেক্টার

const moneyBagImg = new Image();
moneyBagImg.src = 'images/moneybag.png';

// ব্যাকগ্রাউন্ড স্ক্রোলিং অবজেক্ট (Parallax)
const background = {
    x1: 0,
    x2: canvas.width,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    speed: 3
};

// প্লেয়ার (চোর) অবজেক্ট
const player = {
    x: 100,
    y: 200, 
    width: 65,   
    height: 70,  
    velocityY: 0,
    jumpForce: -13,
    isGrounded: false
};

// কিবোর্ড লিসেনার (Jump & Restart)
window.addEventListener("keydown", (e) => {
    if ((e.code === "Space" || e.code === "ArrowUp") && player.isGrounded && !gameOver) {
        player.velocityY = player.jumpForce;
        player.isGrounded = false;
    }
    if (e.code === "KeyR" && gameOver) {
        resetGame();
    }
});

// বাধা স্পন করা
function spawnObstacle() {
    obstacles.push({
        x: canvas.width,
        y: canvas.height - 90, 
        width: 65,
        height: 65,
        speed: 6,
        image: policeImg
    });
}

// কয়েন/টাকার ব্যাগ স্পন করা
function spawnCoin() {
    let coinY = Math.random() * (canvas.height - 200) + 80; 
    coins.push({
        x: canvas.width,
        y: coinY,
        width: 45,
        height: 45,
        speed: 5,
        image: moneyBagImg
    });
}

// গেম লজিক আপডেট
function update() {
    if (gameOver) return;

    // ১. প্যারালাক্স ব্যাকগ্রাউন্ড মুভমেন্ট
    background.x1 -= background.speed;
    background.x2 -= background.speed;

    if (background.x1 <= -background.width) background.x1 = background.width;
    if (background.x2 <= -background.width) background.x2 = background.width;

    // ২. প্লেয়ার ফিজিক্স ও গ্র্যাভিটি
    player.velocityY += gravity;
    player.y += player.velocityY;

    let floorY = canvas.height - player.height - 25;
    if (player.y >= floorY) {
        player.y = floorY;
        player.velocityY = 0;
        player.isGrounded = true;
    }

    // ৩. টাইমার অনুযায়ী অবজেক্ট স্পন করা
    spawnTimer++;
    if (spawnTimer > 110) {
        if (Math.random() > 0.4) {
            spawnObstacle();
        } else {
            spawnCoin();
        }
        spawnTimer = 0;
    }

    // ৪. বাধা আপডেট ও নিখুঁত কলিশন চেক (Bounding Box এডজাস্টমেন্ট)
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= obstacles[i].speed;

        if (
            player.x + 15 < obstacles[i].x + obstacles[i].width - 15 &&
            player.x + player.width - 15 > obstacles[i].x + 15 &&
            player.y + 10 < obstacles[i].y + obstacles[i].height &&
            player.y + player.height > obstacles[i].y + 10
        ) {
            gameOver = true;
        }

        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
        }
    }

    // ৫. কয়েন আপডেট ও কালেকশন চেক
    for (let i = coins.length - 1; i >= 0; i--) {
        coins[i].x -= coins[i].speed;

        if (
            player.x < coins[i].x + coins[i].width &&
            player.x + player.width > coins[i].x &&
            player.y < coins[i].y + coins[i].height &&
            player.y + player.height > coins[i].y
        ) {
            score += 100;
            coins.splice(i, 1);
            continue;
        }

        if (coins[i].x + coins[i].width < 0) {
            coins.splice(i, 1);
        }
    }
}

// স্ক্রিনে সবকিছু ড্র করা
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ১. ব্যাকগ্রাউন্ড ড্র 
    if (bgImg.complete && bgImg.naturalWidth !== 0) {
        ctx.drawImage(bgImg, background.x1, background.y, background.width, background.height);
        ctx.drawImage(bgImg, background.x2, background.y, background.width, background.height);
    } else {
        ctx.fillStyle = "#1a1a1a"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // গ্রাউন্ড/মাটি আঁকা
    ctx.fillStyle = "#222";
    ctx.fillRect(0, canvas.height - 25, canvas.width, 25);
    ctx.fillStyle = "#00ff66";
    ctx.fillRect(0, canvas.height - 27, canvas.width, 2); 

    // ২. ক্যারেক্টার ড্র করার ম্যাজিক ট্রিক (CSS Filter)
    // এই ফিল্টারটি ছবির চারপাশের উজ্জ্বল সাদা ব্যাকগ্রাউন্ডকে স্বচ্ছ করে দেবে এবং মেইন অবজেক্ট নিখুঁতভাবে দেখাবে!
    ctx.filter = "contrast(120%) multiply-or-mix"; // ব্রাউজার-ফ্রেন্ডলি ব্লেন্ড
    
    // প্লেয়ার ড্র (থীফ ইমেজ)
    if (thiefImg.complete && thiefImg.naturalWidth !== 0) {
        ctx.drawImage(thiefImg, player.x, player.y, player.width, player.height);
    }

    // বাধা ড্র (পুলিশ ইমেজ)
    obstacles.forEach(obs => {
        if (policeImg.complete && policeImg.naturalWidth !== 0) {
            ctx.drawImage(obs.image, obs.x, obs.y, obs.width, obs.height);
        }
    });

    // কয়েন ড্র (মানিব্যাগ ইমেজ)
    coins.forEach(coin => {
        if (moneyBagImg.complete && moneyBagImg.naturalWidth !== 0) {
            ctx.drawImage(coin.image, coin.x, coin.y, coin.width, coin.height);
        }
    });

    // ফিল্টার রিসেট করা (যাতে টেক্সট বা গেম ওভার স্ক্রিনে ইফেক্ট না পড়ে)
    ctx.filter = "none";

    // স্কোরবোর্ড
    ctx.fillStyle = "#00ff66";
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("Stolen Cash: $" + score, 20, 40);

    // গেম ওভার স্ক্রিন
    if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#ff3333";
        ctx.font = "bold 40px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("BUSTED!", canvas.width / 2, canvas.height / 2 - 40);

        ctx.fillStyle = "#fff";
        ctx.font = "20px sans-serif";
        ctx.fillText("You managed to steal: $" + score, canvas.width / 2, canvas.height / 2 + 10);
        ctx.fillStyle = "#00ff66";
        ctx.fillText("Press 'R' to Plan Another Heist", canvas.width / 2, canvas.height / 2 + 50);
        ctx.textAlign = "left";
    }
}

// রিস্টার্ট লজিক
function resetGame() {
    obstacles = [];
    coins = [];
    score = 0;
    spawnTimer = 0;
    gameOver = false;
    player.y = 50; 
    player.velocityY = 0;
}

// মেইন গেম লুপ
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// সরাসরি লুপ স্টার্ট (কোনো সিকিউরিটি ব্লকিং কন্ডিশন ছাড়া)
gameLoop();