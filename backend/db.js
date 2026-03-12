const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');

// Initialize DB
let db = {
  users: {}, // uid -> { uid, phoneNumber, email, displayName, createdAt }
  friends: {} // uid -> { friendUid_1: friendObj, friendUid_2: friendObj ... }
};

if (fs.existsSync(DB_FILE)) {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    db = JSON.parse(data);
  } catch (err) {
    console.error("Error reading db.json, starting fresh", err);
  }
}

function saveDb() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function generateUid() {
  return "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
}

// User methods
function getUserByContact(contactInfo) {
  return Object.values(db.users).find(u => 
    u.phoneNumber === contactInfo || u.email === contactInfo
  );
}

function createUser(contactInfo) {
  const isEmail = contactInfo.includes('@');
  const uid = generateUid();
  const user = {
    uid,
    phoneNumber: isEmail ? null : contactInfo,
    email: isEmail ? contactInfo : null,
    displayName: contactInfo,
    createdAt: Date.now()
  };
  db.users[uid] = user;
  saveDb();
  return user;
}

function getOrCreateUser(contactInfo) {
  let user = getUserByContact(contactInfo);
  if (!user) {
    user = createUser(contactInfo);
  }
  return user;
}

// Friend methods
function addFriend(uid, contactInfo) {
  const friend = getUserByContact(contactInfo);
  if (!friend) {
    throw new Error("No user found with that phone or email.");
  }
  
  if (!db.friends[uid]) {
    db.friends[uid] = {};
  }
  
  db.friends[uid][friend.uid] = {
    uid: friend.uid,
    phoneNumber: friend.phoneNumber,
    email: friend.email,
    displayName: friend.displayName,
    addedAt: Date.now()
  };
  saveDb();
  return friend;
}

function getFriends(uid) {
  if (!db.friends[uid]) return [];
  return Object.values(db.friends[uid]);
}

module.exports = {
  getOrCreateUser,
  addFriend,
  getFriends,
  getUserByContact
};
