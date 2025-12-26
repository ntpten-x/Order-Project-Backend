"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const BASE_URL = 'http://localhost:3000';
function testAuth() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Starting Auth Test...");
        // 1. Try to login as admin
        console.log("1. Logging in as admin...");
        try {
            const res = yield fetch(`${BASE_URL}/auth/login`, {
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
                const meRes = yield fetch(`${BASE_URL}/auth/me`, {
                    headers: {
                        'Cookie': cookie || ''
                    }
                });
                if (meRes.status === 200) {
                    const data = yield meRes.json();
                    console.log("✅ /auth/me Successful. User:", data.username);
                }
                else {
                    console.log("❌ /auth/me Failed:", meRes.status);
                }
            }
            else {
                console.log("❌ Admin Login Failed:", res.status, yield res.text());
            }
        }
        catch (e) {
            console.log("❌ Error connecting to server:", e);
        }
        // 3. Try login as banned user
        console.log("3. Logging in as banned user...");
        try {
            const res = yield fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'banned', password: 'password' })
            });
            if (res.status === 403) { // Expect 403 Account Disabled
                console.log("✅ Banned User Login Forbidden (Correct behavior)");
                console.log("Message:", yield res.json());
            }
            else {
                console.log("❌ Banned User Login Failed (Expected 403, got " + res.status + ")");
            }
        }
        catch (e) {
            console.log("❌ Error:", e);
        }
    });
}
testAuth();
