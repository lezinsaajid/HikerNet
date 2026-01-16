// import fetch from 'node-fetch'; // Native fetch in Node 18+

const BASE_URL = 'http://localhost:3000/api';
let tokenA = '', idA = '';
let tokenB = '', idB = '';
let postId = '';

async function register(name) {
    const randomSuffix = Math.floor(Math.random() * 10000);
    const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: `${name}${randomSuffix}`,
            email: `${name}${randomSuffix}@test.com`,
            password: 'password123'
        })
    });
    const data = await res.json();
    return res.ok ? { token: data.token, id: data.user._id, name: data.user.username } : null;
}

async function follow(followerToken, targetId) {
    console.log("2. Follow Action...");
    const res = await fetch(`${BASE_URL}/users/follow/${targetId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${followerToken}` }
    });
    const data = await res.json();
    console.log("   " + data.message);
}

async function createPost(token) {
    console.log("3. Creating Post...");
    const res = await fetch(`${BASE_URL}/posts/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            caption: "Hello World! This is my first hike post.",
            image: "https://example.com/hike.jpg"
        })
    });
    const data = await res.json();
    postId = data._id;
    console.log("   Post created:", data._id);
}

async function checkFeed(token) {
    console.log("4. Checking Feed...");
    const res = await fetch(`${BASE_URL}/posts/feed`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`   Feed has ${data.length} posts`);
    if (data.length > 0) {
        console.log("   First post caption:", data[0].caption);
    }
}

async function interact(token, pId) {
    console.log("5. Interacting (Like & Comment)...");

    // Like
    await fetch(`${BASE_URL}/posts/like/${pId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log("   Liked post");

    // Comment
    const res = await fetch(`${BASE_URL}/posts/comment/${pId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ text: "Great photo!" })
    });
    const data = await res.json();
    console.log("   Comment added. Total comments:", data.comments.length);
}

async function run() {
    try {
        console.log("1. Registering Users...");
        const userA = await register("alice");
        const userB = await register("bob");

        tokenA = userA.token; idA = userA.id;
        tokenB = userB.token; idB = userB.id;
        console.log(`   Registered ${userA.name} and ${userB.name}`);

        // Alice follows Bob
        await follow(tokenA, idB);

        // Bob posts
        await createPost(tokenB);

        // Alice checks feed
        await checkFeed(tokenA);

        // Alice likes and comments on Bob's post
        await interact(tokenA, postId);

    } catch (e) {
        console.error("Error:", e);
    }
}

run();
