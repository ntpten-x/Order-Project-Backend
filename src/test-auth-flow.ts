
const BASE_URL = 'http://localhost:3000';

async function testAuth() {
    console.log("Starting Auth Test...");

    // 1. Try to login as admin
    console.log("1. Logging in as admin...");
    try {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'password' })
        });

        if (res.status === 200) {
            console.log("✅ Admin Login Successful");
            const cookie = res.headers.get('set-cookie');
            console.log("Cookies received:", cookie ? "Yes" : "No");

            // 2. Try to access /auth/me
            console.log("2. Accessing /auth/me...");
            const meRes = await fetch(`${BASE_URL}/auth/me`, {
                headers: {
                    'Cookie': cookie || ''
                }
            });
            if (meRes.status === 200) {
                const data = await meRes.json();
                console.log("✅ /auth/me Successful. User:", data.username);
            } else {
                console.log("❌ /auth/me Failed:", meRes.status);
            }

        } else {
            console.log("❌ Admin Login Failed:", res.status, await res.text());
        }
    } catch (e) {
        console.log("❌ Error connecting to server:", e);
    }

    // 3. Try login as banned user
    console.log("3. Logging in as banned user...");
    try {
        const res = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'banned', password: 'password' })
        });

        if (res.status === 403) { // Expect 403 Account Disabled
            console.log("✅ Banned User Login Forbidden (Correct behavior)");
            console.log("Message:", await res.json());
        } else {
            console.log("❌ Banned User Login Failed (Expected 403, got " + res.status + ")");
        }

    } catch (e) {
        console.log("❌ Error:", e);
    }
}

testAuth();
