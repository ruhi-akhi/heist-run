const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ক্যানভাসের সাইজ ফিক্সড
canvas.width = 800;
canvas.height = 400;

// গেম স্টেট ও ভ্যারিয়েবল
let gravity = 0.5;
let score = 0;
let gameOver = false;
let spawnTimer = 0;
let obstacles = [];
let coins = [];

// ইমেজ অবজেক্ট তৈরি করা (চোরের ইমেজটি .jpg ফরম্যাটে সেট করা হয়েছে)
const bgImg = new Image();
bgImg.src = './images/background.png';

const thiefImg = new Image();
thiefImg.src = './images/thief.png'; // এখানে .png থেকে .jpg করে দেওয়া হয়েছে

const policeImg = new Image();
policeImg.src = './images/police.png'; 

const moneyBagImg = new Image();
moneyBagImg.src = './images/moneybag.png';

// প্লেয়ার (চোর) অবজেক্ট - সাইজ ও পজিশন ফিক্সড
const player = {
    x: 80,
    y: 270, // সরাসরি মাটির ওপর সেট (400 - 90 - 40 = 270)
    width: 90,   
    height: 90,  
    velocityY: 0,
    jumpForce: -13,
    isGrounded: true
};

// ব্যাকগ্রাউন্ড স্ক্রোলিং অবজেক্ট
const background = {
    x1: 0,
    x2: canvas.width,
    y: 0,
    width: canvas.width,
    height: canvas.height,
    speed: 3
};

// কিবোর্ড লিসেনার
window.addEventListener("keydown", (e) => {
    if ((e.code === "Space" || e.code === "ArrowUp") && player.isGrounded && !gameOver) {
        player.velocityY = player.jumpForce;
        player.isGrounded = false;
    }
    if (e.code === "KeyR" && gameOver) {
        resetGame();
    }
});

// বাধা (পুলিশ) স্পন করা
function spawnObstacle() {
    let obsHeight = 75; 
    let obsWidth = 70; 
    obstacles.push({
        x: canvas.width,
        y: canvas.height - obsHeight - 40, 
        width: obsWidth,
        height: obsHeight,
        speed: 6,
        image: policeImg
    });
}

// টাকার ব্যাগ স্পন করা
function spawnCoin() {
    let coinY = Math.random() * (canvas.height - 220) + 60; 
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

    // ১. ব্যাকগ্রাউন্ড মুভমেন্ট
    background.x1 -= background.speed;
    background.x2 -= background.speed;

    if (background.x1 <= -background.width) background.x1 = background.width;
    if (background.x2 <= -background.width) background.x2 = background.width;

    // ২. প্লেয়ার ফিজিক্স ও গ্র্যাভিটি
    player.velocityY += gravity;
    player.y += player.velocityY;

    let floorY = canvas.height - player.height - 40;
    if (player.y >= floorY) {
        player.y = floorY;
        player.velocityY = 0;
        player.isGrounded = true;
    }

    // ৩. টাইমার অনুযায়ী অবজেক্ট স্পন
    spawnTimer++;
    if (spawnTimer > 115) {
        if (Math.random() > 0.4) {
            spawnObstacle();
        } else {
            spawnCoin();
        }
        spawnTimer = 0;
    }

    // ৪. বাধা (পুলিশ) আপডেট ও কলিশন
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= obstacles[i].speed;

        // কলিশন চেক
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

    // ৫. কয়েন আপডেট ও কালেকশন
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

// স্ক্রিনে ড্র করা
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ১. ব্যাকগ্রাউন্ড ড্র
    if (bgImg.complete && bgImg.naturalWidth !== 0) {
        ctx.drawImage(bgImg, background.x1, background.y, background.width, background.height);
        ctx.drawImage(bgImg, background.x2, background.y, background.width, background.height);
    } else {
        ctx.fillStyle = "#3aafde"; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // মাটি আঁকা
    ctx.fillStyle = "#222"; 
    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
    ctx.fillStyle = "#00ff66"; 
    ctx.fillRect(0, canvas.height - 42, canvas.width, 2); 

    // ২. অবজেক্ট ও ক্যারেক্টার ড্র করা
    
    // কয়েন/মানিব্যাগ ড্র
    coins.forEach(coin => {
        if (moneyBagImg.complete && moneyBagImg.naturalWidth !== 0) {
            ctx.drawImage(moneyBagImg, coin.x, coin.y, coin.width, coin.height);
        } else {
            ctx.fillStyle = "gold";
            ctx.fillRect(coin.x, coin.y, coin.width, coin.height);
        }
    });

    // বাধা (পুলিশ) ড্র
    obstacles.forEach(obs => {
        if (policeImg.complete && policeImg.naturalWidth !== 0) {
            ctx.drawImage(policeImg, obs.x, obs.y, obs.width, obs.height);
        } else {
            ctx.fillStyle = "red"; 
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        }
    });

    // প্লেয়ার (চোর) ড্র
    if (thiefImg.complete && thiefImg.naturalWidth !== 0) {
        ctx.drawImage(thiefImg, player.x, player.y, player.width, player.height);
    } else {
        // ইমেজ লোড হতে সমস্যা হলে ব্যাকআপ নীল বক্স দেখাবে
        ctx.fillStyle = "blue";
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

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
    player.velocityY = 0;
    player.y = 270; 
}

// মেইন গেম লুপ
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// গেম স্টার্ট
gameLoop();