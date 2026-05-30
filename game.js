const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ক্যানভাস সাইজ
canvas.width = 800;
canvas.height = 400;

// গেম স্টেট ও ভ্যারিয়েবল
let gravity = 0.4;
let score = 0;
let gameOver = false;
let spawnTimer = 0;
let obstacles = [];
let coins = [];
let gameSpeed = 4;
let currentLevel = 1;

// লেভেল আপ ও পজ লজিক
let isLevelTransition = false;
let transitionTimer = 0; 
let transitionDuration = 600; 

// অডিও সেটআপ
const bgMusic = new Audio('./bg-music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.4;

const jumpSound = new Audio('./sounds/jump.mp3'); 
jumpSound.volume = 0.5;

const coinSound = new Audio('./sounds/coin.mp3'); 
coinSound.volume = 0.6;

const bustedSound = new Audio('./sounds/busted.mp3'); 
bustedSound.volume = 0.7;

// ইমেজ অবজেক্ট
const bgImg = new Image(); bgImg.src = './images/background.png';
const policeImg = new Image(); policeImg.src = './images/police.png'; 
const moneyBagImg = new Image(); moneyBagImg.src = './images/moneybag.png';
const thiefImg = new Image(); thiefImg.src = './images/thief.png'; 

// প্লেয়ার অবজেক্ট (চোর সামনে থাকবে, যাতে পুলিশ পেছন থেকে তাড়া করতে পারে)
const player = {
    x: 350, // চোরের ডিফল্ট পজিশন
    y: 270, 
    width: 90,   
    height: 90,   
    velocityY: 0,
    jumpForce: -10.5,
    isGrounded: true,
    jumpCount: 0, 
    maxJumps: 2,
    isDashing: false,
    dashTimer: 0,
    dashCooldown: 0
};

// ব্যাকগ্রাউন্ড স্ক্রোলিং
const background = {
    x1: 0, x2: -canvas.width, y: 0, 
    width: canvas.width, height: canvas.height
};

// কিবোর্ড লিসেনার
window.addEventListener("keydown", (e) => {
    if (gameOver || isLevelTransition) {
        if (e.code === "KeyR" && gameOver) resetGame();
        return; 
    }

    bgMusic.play().catch(err => console.log("Music play blocked."));

    // জাম্প লজিক
    if ((e.code === "Space" || e.code === "ArrowUp") && player.jumpCount < player.maxJumps) {
        player.velocityY = player.jumpForce;
        player.isGrounded = false;
        player.jumpCount++;
        jumpSound.currentTime = 0;
        jumpSound.play();
    }
    
    // ড্যাশ লজিক
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        if (player.dashCooldown === 0 && !player.isDashing) {
            player.isDashing = true;
            player.dashTimer = 15; 
            player.dashCooldown = 180; 
        }
    }
});

// 🚔 পুলিশ বাম দিক থেকে (পেছন থেকে) স্পন হবে
function spawnObstacle() {
    let obsHeight = 90;
    let obsWidth = 85; 
    let isSmartPolice = currentLevel >= 3 && Math.random() > 0.6;

    obstacles.push({
        x: -obsWidth, // বামের বাইরে থেকে আসবে
        y: canvas.height - obsHeight - 40, 
        width: obsWidth,
        height: obsHeight,
        speed: gameSpeed + (isSmartPolice ? 3 : 1.5), 
        isSmart: isSmartPolice,
        image: policeImg
    });
}

// 💰 কয়েন সামনে থেকে আসবে
function spawnCoin() {
    let coinY = Math.random() * (canvas.height - 220) + 60; 
    coins.push({
        x: canvas.width, 
        y: coinY,
        width: 45, height: 45,
        speed: gameSpeed, image: moneyBagImg
    });
}

// গেম লজিক আপডেট
function update() {
    if (gameOver) return;

    if (isLevelTransition) {
        transitionTimer--;
        if (transitionTimer <= 0) isLevelTransition = false; 
        return; 
    }

    // 🏃‍♂️ ড্যাশ টাইমার ও মুভমেন্ট লজিক
    if (player.isDashing) {
        player.x += 6; 
        player.dashTimer--;
        if (player.dashTimer <= 0) player.isDashing = false;
    } else if (player.isGrounded) { 
        // চোর যখন মাটিতে থাকবে, তখন আস্তে আস্তে তার নিজের জায়গা (৩৫০ পজিশনে) ফেরত আসবে
        if (player.x > 350) player.x -= 1.5;
        if (player.x < 350) player.x += 1.5; 
    }

    if (player.dashCooldown > 0) player.dashCooldown--;

    // লেভেল আপ চেক
    let checkLevel = 1 + Math.floor(score / 1000);
    if (checkLevel > currentLevel) {
        currentLevel = checkLevel;
        isLevelTransition = true;
        transitionTimer = transitionDuration; 
        gameSpeed = 4 + (currentLevel * 0.8); 
        return;
    }

    // ব্যাকগ্রাউন্ড মুভমেন্ট (কালো দাগ ছাড়া নিখুঁত স্ক্রোলিং)
    background.x1 += gameSpeed * 0.7;
    if (background.x1 >= background.width) {
        background.x1 = 0;
    }
    background.x2 = background.x1 - background.width + 1;

    // 🚀 প্লেয়ার ফিজিক্স ও সামনের দিকে জাম্প করার লজিক
    player.velocityY += gravity;
    player.y += player.velocityY;

    // চোর যদি শূন্যে থাকে (লাফ দেয়), তবে সে ডানে (সামনে) এগিয়ে যাবে
    if (!player.isGrounded && !player.isDashing) {
        if (player.x < 480) { 
            player.x += 2.5;  // লাফের সময় সামনে এগিয়ে যাওয়ার গতি
        }
    }

    let floorY = canvas.height - player.height - 40;
    if (player.y >= floorY) {
        player.y = floorY;
        player.velocityY = 0;
        player.isGrounded = true;
        player.jumpCount = 0; 
    }

    // অবজেক্ট স্পন টাইমার
    spawnTimer++;
    let spawnInterval = Math.max(50, 120 - (currentLevel * 6));
    if (spawnTimer > spawnInterval) {
        if (Math.random() > 0.4) spawnObstacle();
        else spawnCoin();
        spawnTimer = 0;
    }

    // 🚔 পুলিশ আপডেট (বাম থেকে ডানে তাড়া করবে)
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x += obstacles[i].speed; 

        if (obstacles[i].isSmart && obstacles[i].x < player.x && player.x - obstacles[i].x < 300) {
            obstacles[i].x += 1.2; 
        }

        // কলিশন চেক
        let padding = 25;
        if (
            player.x + padding < obstacles[i].x + obstacles[i].width - padding &&
            player.x + player.width - padding > obstacles[i].x + padding &&
            player.y + 20 < obstacles[i].y + obstacles[i].height &&
            player.y + player.height > obstacles[i].y + 20
        ) {
            gameOver = true;
            bgMusic.pause();
            bustedSound.play(); 
        }

        if (obstacles[i].x > canvas.width) obstacles.splice(i, 1);
    }

    // 💰 কয়েন আপডেট
    for (let i = coins.length - 1; i >= 0; i--) {
        coins[i].x -= coins[i].speed; 

        if (
            player.x < coins[i].x + coins[i].width &&
            player.x + player.width > coins[i].x &&
            player.y < coins[i].y + coins[i].height &&
            player.y + player.height > coins[i].y
        ) {
            score += 100;
            coinSound.currentTime = 0;
            coinSound.play(); 
            coins.splice(i, 1);
            continue;
        }
        if (coins[i].x + coins[i].width < 0) coins.splice(i, 1);
    }
}

// আলাদা ফাংশন চোর ও পুলিশ ড্র করার জন্য (লজিক সহজ রাখার জন্য)
function drawPlayer() {
    // চোরের ড্যাশ ইফেক্ট শ্যাডো
    if (player.isDashing) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = "cyan";
        ctx.fillRect(player.x - 20, player.y, player.width, player.height);
        ctx.restore();
    }

    // চোর আঁকা
    if (thiefImg.complete && thiefImg.naturalWidth !== 0) {
        ctx.drawImage(thiefImg, player.x, player.y, player.width, player.height);
    } else {
        ctx.fillStyle = "blue"; ctx.fillRect(player.x, player.y, player.width, player.height);
    }
}

function drawObstacles() {
    obstacles.forEach(obs => {
        if (policeImg.complete && policeImg.naturalWidth !== 0) {
            ctx.drawImage(policeImg, obs.x, obs.y, obs.width, obs.height);
        } else { 
            ctx.fillStyle = obs.isSmart ? "purple" : "red"; ctx.fillRect(obs.x, obs.y, obs.width, obs.height); 
        }
    });
}

// স্ক্রিনে ড্র করা
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ১. ব্যাকগ্রাউন্ড ড্র
    if (bgImg.complete && bgImg.naturalWidth !== 0) {
        ctx.drawImage(bgImg, background.x1, 0, canvas.width, canvas.height);
        ctx.drawImage(bgImg, background.x2, 0, canvas.width, canvas.height);
    } else {
        ctx.fillStyle = "#3aafde"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // লেভেল কালার টিন্ট
    if (currentLevel > 1) {
        ctx.fillStyle = `rgba(255, 0, 0, ${Math.min(0.15, currentLevel * 0.03)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // মাটি আঁকা
    ctx.fillStyle = "#222"; ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
    ctx.fillStyle = "#00ff66"; ctx.fillRect(0, canvas.height - 42, canvas.width, 2); 

    // ২. কয়েন আঁকা
    coins.forEach(coin => {
        if (moneyBagImg.complete && moneyBagImg.naturalWidth !== 0) {
            ctx.drawImage(moneyBagImg, coin.x, coin.y, coin.width, coin.height);
        } else { 
            ctx.fillStyle = "gold"; ctx.fillRect(coin.x, coin.y, coin.width, coin.height); 
        }
    });

    // 🚔 ৩. ডাইনামিক লেয়ারিং (কে সামনে থাকবে তা X পজিশন দিয়ে নির্ধারণ)
    // যদি কোনো পুলিশ চোরের থেকে সামনে চলে যায়, তবে পুলিশ চোরের উপরে (সামনে) ড্র হবে। 
    // আর পুলিশ পেছনে থাকলে চোর পুলিশের উপরে ড্র হবে।
    let policeIsAhead = obstacles.some(obs => obs.x > player.x);

    if (policeIsAhead) {
        drawPlayer();     // চোর পেছনে, তাই আগে আঁকা হলো
        drawObstacles();  // পুলিশ সামনে, তাই পরে আঁকা হলো
    } else {
        drawObstacles();  // পুলিশ পেছনে, তাই আগে আঁকা হলো
        drawPlayer();     // চোর সামনে, তাই পরে আঁকা হলো
    }

    // UI এলিমেন্ট
    ctx.fillStyle = "#00ff66"; ctx.font = "bold 22px sans-serif";
    ctx.fillText("Stolen Cash: $" + score, 20, 40);
    
    ctx.fillStyle = "#ffcc00"; ctx.font = "bold 16px sans-serif";
    ctx.fillText("Wanted Level: " + "★".repeat(currentLevel), 20, 70);

    ctx.fillStyle = player.dashCooldown === 0 ? "#00ffff" : "#777";
    ctx.font = "14px sans-serif";
    ctx.fillText(player.dashCooldown === 0 ? "DASH READY (Shift)" : "Dash Cooldown...", 20, 95);

    // নেক্সট লেভেল ট্রানজিশন স্ক্রিন
    if (isLevelTransition) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.textAlign = "center";
        ctx.fillStyle = "#ffcc00";
        ctx.font = "bold 40px sans-serif";
        ctx.fillText(`WANTED LEVEL UP: LEVEL ${currentLevel}!`, canvas.width / 2, canvas.height / 2 - 30);

        ctx.fillStyle = "#fff";
        ctx.font = "20px sans-serif";
        ctx.fillText("The Police are reinforcing! Prepare yourself...", canvas.width / 2, canvas.height / 2 + 15);

        let secondsLeft = Math.ceil(transitionTimer / 60);
        ctx.fillStyle = "#ff3333";
        ctx.font = "bold 30px sans-serif";
        ctx.fillText(`Resuming Heist in: ${secondsLeft}s`, canvas.width / 2, canvas.height / 2 + 70);
        ctx.textAlign = "left";
    }

    // গেম ওভার স্ক্রিন
    if (gameOver) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.85)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ff3333"; ctx.font = "bold 50px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("BUSTED!", canvas.width / 2, canvas.height / 2 - 40);
        ctx.fillStyle = "#fff"; ctx.font = "22px sans-serif";
        ctx.fillText("You managed to steal: $" + score, canvas.width / 2, canvas.height / 2 + 10);
        ctx.fillStyle = "#00ff66"; ctx.fillText("Press 'R' to Plan Another Heist", canvas.width / 2, canvas.height / 2 + 60);
        ctx.textAlign = "left";
    }
}

// রিস্টার্ট লজিক
function resetGame() {
    obstacles = []; coins = []; score = 0; spawnTimer = 0; gameSpeed = 4; currentLevel = 1;
    gameOver = false; isLevelTransition = false; transitionTimer = 0;
    player.velocityY = 0; player.y = 270; player.x = 350; player.jumpCount = 0; player.dashCooldown = 0; player.isDashing = false;
    bgMusic.currentTime = 0; bgMusic.play().catch(err => console.log("Music play blocked."));
}

function gameLoop() {
    update(); draw(); requestAnimationFrame(gameLoop);
}

// গেম শুরু
gameLoop();