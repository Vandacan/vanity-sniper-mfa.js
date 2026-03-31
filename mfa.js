"use strict";
const http2 = require('http2');
const fs = require('fs');
const CONFIG = {
    token: "Hesap tokeni",
    password: "Hesap Sifresi",
    guildId: "Hangi sunucuya cekecek iseniz sunucu id"
};
const getHeaders = (method, path) => ({
    ':method': method,
    ':authority': 'canary.discord.com',
    ':scheme': 'https',
    ':path': path,
    'authorization': CONFIG.token,
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'x-super-properties': Buffer.from(JSON.stringify({
        os: "Windows",
        browser: "Chrome",
        device: "",
        browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        browser_version: "124.0.0.0",
        os_version: "10",
        release_channel: "canary",
        client_build_number: 295000
    })).toString('base64'),
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.9',
    'origin': 'https://canary.discord.com',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin'
});
async function runMfa() {
    return new Promise((resolve) => {
        const client = http2.connect('https://canary.discord.com', {
            minVersion: 'TLSv1.3',
            maxVersion: 'TLSv1.3',
            ciphers: 'TLS_AES_128_GCM_SHA256:TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256'
        });
        client.on('error', (err) => {
            resolve(false);
        });
        const req1 = client.request(getHeaders('PATCH', `/api/v9/guilds/${CONFIG.guildId}/vanity-url`));
        req1.on('response', (headers) => {
            let data = '';
            req1.on('data', (chunk) => { data += chunk; });
            req1.on('end', () => {
                if (data.includes('1015')) {
                    console.log('1015');
                    client.destroy();
                    return resolve(false);
                }
                try {
                    const res = JSON.parse(data);
                    if (res.mfa && res.mfa.ticket) {
                        const ticket = res.mfa.ticket;
                        const req2 = client.request(getHeaders('POST', '/api/v9/mfa/finish'));

                        req2.on('response', (h2) => {
                            let data2 = '';
                            req2.on('data', (c) => { data2 += c; });
                            req2.on('end', () => {
                                if (data2.includes('1015')) {
                                    console.log('1015');
                                    client.destroy();
                                    return resolve(false);
                                }
                                try {
                                    const finalRes = JSON.parse(data2);
                                    if (finalRes.token) {
                                        fs.writeFileSync('mfa.txt', finalRes.token);
                                        console.log('+');
                                        client.destroy();
                                        resolve(true);
                                    } else {
                                        console.log('-');
                                        client.destroy();
                                        resolve(false);
                                    }
                                } catch (e) {
                                    console.log('-');
                                    client.destroy();
                                    resolve(false);
                                }
                            });
                        });
                        req2.write(JSON.stringify({
                            ticket: ticket,
                            mfa_type: "password",
                            data: CONFIG.password.trim()
                        }));
                        req2.end();
                    } else {
                        console.log('-');
                        client.destroy();
                        resolve(false);
                    }
                } catch (e) {
                    console.log('-');
                    client.destroy();
                    resolve(false);
                }
            });
        });
        req1.write(JSON.stringify({ code: "" }));
        req1.end();
    });
}
async function start() {
    const ok = await runMfa();
    if (!ok) {
        setTimeout(start, 5000);
    } else {
        setTimeout(start, 240000);
    }
}
start();
