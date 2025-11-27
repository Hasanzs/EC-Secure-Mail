import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, where, addDoc, serverTimestamp, getDocs, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// setLogLevel('debug'); // Uncomment jika perlu debugging mendalam

// --- Variabel Global Firebase dari Lingkungan Canvas ---
// PENTING: Gunakan variabel ini agar aplikasi berjalan di Canvas.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let app, db, auth;
let userId = null;
let userPrivateKey = null; // Kunci Privat disimpan di memori setelah dimuat
const BASE_POINT_G = BigInt("0x8979872349872349872349872349872349872349872349872349872349872349"); // Titik G disimulasikan sebagai BigInt

// Jika firebaseConfig kosong, jalankan dalam MOCK mode (localStorage) sehingga
// UI dapat diuji tanpa konfigurasi Firebase.
const IS_MOCK = Object.keys(firebaseConfig).length === 0;

// --- MOCK helpers (localStorage) ---
function savePrivateKeyMock(uid, privateKeyBigInt) {
    localStorage.setItem(`mock_pk_${uid}`, privateKeyBigInt.toString());
    const pub = scalarMultiply(privateKeyBigInt, BASE_POINT_G);
    localStorage.setItem(`mock_pub_${uid}`, pub.toString());
}

function loadPrivateKeyMock(uid) {
    const v = localStorage.getItem(`mock_pk_${uid}`);
    return v ? BigInt(v) : null;
}

function loadPublicKeyMock(uid) {
    const v = localStorage.getItem(`mock_pub_${uid}`);
    return v ? BigInt(v) : null;
}

function addMessageMock(recipientId, messageObj) {
    const key = `mock_inbox_${recipientId}`;
    const arr = JSON.parse(localStorage.getItem(key) || '[]');
    arr.push(messageObj);
    localStorage.setItem(key, JSON.stringify(arr));
}

function getInboxMock(uid) {
    return JSON.parse(localStorage.getItem(`mock_inbox_${uid}`) || '[]');
}

// --- SIMULASI KRIPTOGRAFI ELGAMAL (ECC Konseptual) ---

function generateRandomScalar() {
    return BigInt(Math.floor(Math.random() * 1e18)) * BigInt(Math.floor(Math.random() * 1e18)) * BigInt(Math.floor(Math.random() * 1e18));
}

function scalarMultiply(scalar, point) {
    // SIMULASI: Perkalian skalar (d * G atau k * P)
    return scalar * point;
}

function xorStrings(a, b) {
    let result = '';
    for (let i = 0; i < a.length; i++) {
        result += String.fromCharCode(a.charCodeAt(i) ^ b.charCodeAt(i % b.length));
    }
    return result;
}

function encryptMessage(message, recipientPublicKey) {
    const k = generateRandomScalar(); // Kunci Ephemeral
    const S = scalarMultiply(k, recipientPublicKey); // Shared Secret S = k * P_B
    const C1 = scalarMultiply(k, BASE_POINT_G); // C1 = k * G
    
    // Shared Secret Key (S_key) dari koordinat S (simulasi BigInt ke string)
    const S_key = S.toString(16).substring(0, message.length * 2); 
    
    const C2 = xorStrings(message, S_key); // C2 = M XOR S_key

    return { C1: C1, C2: C2 };
}

function decryptMessage(C1, C2, privateKey) {
    const S_prime = scalarMultiply(privateKey, C1); // Hitung Ulang S' = d_B * C1
    
    const S_prime_key = S_prime.toString(16).substring(0, C2.length); 
    
    const decryptedMessage = xorStrings(C2, S_prime_key);

    return decryptedMessage;
}

// --- FIREBASE DAN APLIKASI UTAMA ---

// Jalur penyimpanan Firestore
const getPrivateKeysRef = (uid) => doc(db, `artifacts/${appId}/users/${uid}/keys/private`);
const getPublicKeysRef = (uid) => doc(db, `artifacts/${appId}/public/data/keys/${uid}`);
const getInboxRef = (uid) => collection(db, `artifacts/${appId}/public/data/inbox/${uid}/messages`);

async function initFirebase() {
    try {
        if (IS_MOCK) {
            console.warn('Firebase config not available. Running in MOCK mode (localStorage).');
            document.getElementById('status-message').textContent = 'INFO: Firebase config not available. Running in MOCK (localStorage).';
            // Generate a mock userId for testing
            userId = localStorage.getItem('mock_userid') || ('mock-' + Math.random().toString(36).substring(2,10));
            localStorage.setItem('mock_userid', userId);
            document.getElementById('current-user-id').textContent = userId;
            // Load or show keygen
            await checkAndLoadKeys();
            // Start simple polling to update inbox in mock mode
            setInterval(() => {
                try { listenForMessages(); } catch(e){/*ignore*/}
            }, 1500);
            return;
        }

        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        // Autentikasi
        if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
        } else {
            await signInAnonymously(auth);
        }

        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                document.getElementById('current-user-id').textContent = userId;
                checkAndLoadKeys();
            } else {
                document.getElementById('status-message').textContent = 'Autentikasi gagal.';
            }
        });
    } catch (error) {
        console.error("Gagal inisialisasi Firebase:", error);
        document.getElementById('status-message').textContent = `ERROR Inisialisasi: ${error.message}`;
    }
}

// --- MANAJEMEN KUNCI ---

async function checkAndLoadKeys() {
    const privateDocRef = getPrivateKeysRef(userId);

    try {
        if (IS_MOCK) {
            const v = loadPrivateKeyMock(userId);
            if (v) {
                userPrivateKey = BigInt(v);
                document.getElementById('key-status').textContent = 'Kunci Privat Dimuat (MOCK).';
                document.getElementById('key-status').classList.add('text-green-600');
                document.getElementById('keygen-view').classList.add('hidden');
                document.getElementById('messaging-view').classList.remove('hidden');
                listenForMessages();
            } else {
                document.getElementById('key-status').textContent = 'Belum ada Kunci. Silakan Buat Kunci.';
                document.getElementById('key-status').classList.remove('text-green-600');
                document.getElementById('keygen-view').classList.remove('hidden');
                document.getElementById('messaging-view').classList.add('hidden');
            }
            return;
        }

        const privateSnap = await getDoc(privateDocRef);
        
        if (privateSnap.exists()) {
            // Kunci ditemukan, muat ke memori
            userPrivateKey = BigInt(privateSnap.data().privateKey);
            document.getElementById('key-status').textContent = 'Kunci Privat Dimuat ke Memori.';
            document.getElementById('key-status').classList.add('text-green-600');
            document.getElementById('keygen-view').classList.add('hidden');
            document.getElementById('messaging-view').classList.remove('hidden');
            listenForMessages(); // Mulai mendengarkan pesan setelah kunci siap
        } else {
            // Kunci tidak ditemukan, tampilkan view Keygen
            document.getElementById('key-status').textContent = 'Belum ada Kunci. Silakan Buat Kunci.';
            document.getElementById('key-status').classList.remove('text-green-600');
            document.getElementById('keygen-view').classList.remove('hidden');
            document.getElementById('messaging-view').classList.add('hidden');
        }
    } catch (error) {
        console.error("Gagal memuat kunci:", error);
    }
}

async function handleKeyGeneration() {
    if (!userId) return;

    const privateKey = generateRandomScalar();
    const publicKey = scalarMultiply(privateKey, BASE_POINT_G);

    try {
        if (IS_MOCK) {
            savePrivateKeyMock(userId, privateKey);
            document.getElementById('status-message').textContent = 'Pasangan Kunci Berhasil Dibuat (MOCK) dan Disimpan di localStorage!';
            await checkAndLoadKeys();
        } else {
            // Simpan Kunci Privat (Private collection)
            await setDoc(getPrivateKeysRef(userId), {
                privateKey: privateKey.toString(),
                createdAt: serverTimestamp()
            });

            // Simpan Kunci Publik (Public collection)
            await setDoc(getPublicKeysRef(userId), {
                publicKey: publicKey.toString(),
                userId: userId,
                createdAt: serverTimestamp()
            });

            // Setelah berhasil, panggil ulang checkAndLoadKeys
            document.getElementById('status-message').textContent = 'Pasangan Kunci Berhasil Dibuat dan Disimpan di Firestore!';
            await checkAndLoadKeys(); 
        }

    } catch (error) {
        console.error("Gagal menyimpan kunci:", error);
        document.getElementById('status-message').textContent = `ERROR saat menyimpan kunci: ${error.message}`;
    }
}

// --- FUNGSI PENGIRIMAN PESAN ---

async function handleSendMessage() {
    const recipientId = document.getElementById('recipient-id').value.trim();
    const messageText = document.getElementById('message-body').value;
    const statusDiv = document.getElementById('send-status');

    if (!recipientId || !messageText || !userPrivateKey) {
        statusDiv.textContent = 'Pastikan ID Penerima, Pesan, dan Kunci Privat Anda sudah siap.';
        statusDiv.classList.add('text-red-600');
        return;
    }
    if (recipientId === userId) {
         statusDiv.textContent = 'Tidak bisa mengirim pesan ke diri sendiri.';
         statusDiv.classList.add('text-red-600');
        return;
    }

    statusDiv.textContent = '1. Mencari Kunci Publik Penerima...';
    statusDiv.classList.remove('text-red-600');
    try {
        let recipientPublicKey;
        if (IS_MOCK) {
            recipientPublicKey = loadPublicKeyMock(recipientId);
            if (!recipientPublicKey) {
                statusDiv.textContent = `ERROR: Kunci publik untuk ID ${recipientId} tidak ditemukan (MOCK).`;
                statusDiv.classList.add('text-red-600');
                return;
            }
        } else {
            // 1. Dapatkan Kunci Publik Penerima dari Firestore
            const publicSnap = await getDoc(getPublicKeysRef(recipientId));
            if (!publicSnap.exists()) {
                statusDiv.textContent = `ERROR: Kunci publik untuk ID ${recipientId} tidak ditemukan.`;
                statusDiv.classList.add('text-red-600');
                return;
            }
            recipientPublicKey = BigInt(publicSnap.data().publicKey);
        }

        // 2. Enkripsi Pesan menggunakan EC-ElGamal Konseptual
        statusDiv.textContent = '2. Melakukan Enkripsi (EC-ElGamal)...';
        const ciphertext = encryptMessage(messageText, recipientPublicKey);

        if (IS_MOCK) {
            // Simpan ke localStorage inbox penerima
            addMessageMock(recipientId, {
                senderId: userId,
                C1: ciphertext.C1.toString(),
                C2: ciphertext.C2,
                sentAt: Date.now()
            });
        } else {
            // 3. Simpan Ciphertext ke Inbox Penerima di Firestore
            const inboxRef = getInboxRef(recipientId);
            await addDoc(inboxRef, {
                senderId: userId,
                C1: ciphertext.C1.toString(), // Simpan BigInt sebagai String
                C2: ciphertext.C2,
                sentAt: serverTimestamp()
            });
        }

        statusDiv.textContent = '3. Pesan Terenkripsi Berhasil Dikirim!';
        statusDiv.classList.add('text-green-600');
        document.getElementById('message-body').value = ''; // Kosongkan pesan

    } catch (error) {
        console.error("Gagal mengirim pesan:", error);
        statusDiv.textContent = `ERROR saat mengirim: ${error.message}`;
        statusDiv.classList.add('text-red-600');
    }
}

// --- FUNGSI PENERIMA PESAN (INBOX) ---

function listenForMessages() {
    if (!userId) return;
    const inboxList = document.getElementById('inbox-list');
    inboxList.innerHTML = ''; // Kosongkan inbox

    if (IS_MOCK) {
        const msgs = getInboxMock(userId).slice();
        msgs.sort((a,b) => (b.sentAt || 0) - (a.sentAt || 0));
        msgs.forEach(message => {
            const li = document.createElement('li');
            let decryptedText = 'Memuat Kunci...';
            let statusColor = 'bg-gray-100 border-gray-400';
            try {
                if (userPrivateKey) {
                    const C1 = BigInt(message.C1);
                    const C2 = message.C2;
                    decryptedText = decryptMessage(C1, C2, userPrivateKey);
                    statusColor = 'bg-green-100 border-green-400';
                } else {
                    decryptedText = 'Kunci privat belum siap. Pesan terenkripsi.';
                    statusColor = 'bg-yellow-100 border-yellow-400';
                }
            } catch (e) {
                console.error('Dekripsi gagal (MOCK):', e);
                statusColor = 'bg-red-100 border-red-400';
                decryptedText = `[ERROR DEKRIPSI: ${e.message}]`;
            }

            li.className = `p-4 mb-3 border rounded-lg shadow-sm ${statusColor}`;
            const sentAtText = message.sentAt ? new Date(message.sentAt).toLocaleTimeString() : 'Tunggu...';
            li.innerHTML = `
                <p class="font-bold text-lg text-gray-800">Dari: ${message.senderId}</p>
                <hr class="my-1 border-gray-300">
                <p class="text-sm text-gray-600">Dikirim: ${sentAtText}</p>
                <div class="mt-2 p-3 bg-white border border-dashed rounded">
                    <p class="font-mono text-xs text-gray-500 mb-1">Ciphertext (C1/C2): ${message.C1.substring(0, 30)}... / ${message.C2.substring(0, 20)}...</p>
                    <p class="font-semibold text-gray-900 mt-2">Pesan Asli (Dekripsi): <span class="text-blue-700">${decryptedText}</span></p>
                </div>
            `;
            inboxList.appendChild(li);
        });
        return;
    }

    const q = query(getInboxRef(userId));

    onSnapshot(q, (snapshot) => {
        const inboxList = document.getElementById('inbox-list');
        inboxList.innerHTML = ''; // Kosongkan inbox

        snapshot.docs.sort((a, b) => b.data().sentAt - a.data().sentAt) // Urutkan terbaru di atas
        .forEach(docSnapshot => {
            const message = docSnapshot.data();
            const li = document.createElement('li');
            
            let decryptedText = "Memuat Kunci...";
            let statusColor = "bg-gray-100 border-gray-400";
            
            try {
                 if (userPrivateKey) {
                    const C1 = BigInt(message.C1);
                    const C2 = message.C2;
                    
                    decryptedText = decryptMessage(C1, C2, userPrivateKey);
                    statusColor = "bg-green-100 border-green-400";
                } else {
                    decryptedText = "Kunci privat belum siap. Pesan terenkripsi.";
                    statusColor = "bg-yellow-100 border-yellow-400";
                }
            } catch (e) {
                console.error("Dekripsi gagal:", e);
                statusColor = "bg-red-100 border-red-400";
                decryptedText = `[ERROR DEKRIPSI: ${e.message}]`;
            }

            // Tampilkan pesan
            li.className = `p-4 mb-3 border rounded-lg shadow-sm ${statusColor}`;
            li.innerHTML = `
                <p class="font-bold text-lg text-gray-800">Dari: ${message.senderId}</p>
                <hr class="my-1 border-gray-300">
                <p class="text-sm text-gray-600">Dikirim: ${message.sentAt ? new Date(message.sentAt.toDate()).toLocaleTimeString() : 'Tunggu...'}</p>
                <div class="mt-2 p-3 bg-white border border-dashed rounded">
                    <p class="font-mono text-xs text-gray-500 mb-1">Ciphertext (C1/C2): ${message.C1.substring(0, 30)}... / ${message.C2.substring(0, 20)}...</p>
                    <p class="font-semibold text-gray-900 mt-2">Pesan Asli (Dekripsi): <span class="text-blue-700">${decryptedText}</span></p>
                </div>
            `;
            inboxList.appendChild(li);
        });
    }, (error) => {
        console.error("Gagal mendengarkan inbox:", error);
    });
}

// expose handlers to global scope so inline onclick attributes still work
window.handleKeyGeneration = handleKeyGeneration;
window.handleSendMessage = handleSendMessage;

// Inisialisasi
window.onload = initFirebase;
