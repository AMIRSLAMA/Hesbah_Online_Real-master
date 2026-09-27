const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const [,, customer, machineId, daysArg] = process.argv;
const days = Number(daysArg || 365);
if (!customer || !machineId || !Number.isFinite(days) || days <= 0) {
  console.log('الاستخدام: node tools/create-license.js "اسم العميل" "MachineID" 365');
  process.exit(1);
}

const keyPath = path.join(__dirname, 'private-key.pem');
const publicPath = path.join(__dirname, 'public-key.pem');
if (!fs.existsSync(keyPath) || !fs.existsSync(publicPath)) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
  fs.writeFileSync(keyPath, privateKey.export({ type:'pkcs8', format:'pem' }));
  fs.writeFileSync(publicPath, publicKey.export({ type:'spki', format:'pem' }));
  console.log('تم إنشاء مفاتيح الترخيص لأول مرة. احتفظ بـ private-key.pem بسرية تامة.');
}

const privateKey = fs.readFileSync(keyPath, 'utf8');
const payload = {
  product: 'AmirCasher',
  customer,
  machineId,
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + days * 86400000).toISOString()
};
const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
const signer = crypto.createSign('RSA-SHA256');
signer.update(body); signer.end();
const sig = signer.sign(privateKey, 'base64url');

console.log('\n==============================');
console.log('AmirCasher Activation Code');
console.log('==============================');
console.log(body + '.' + sig);
console.log('==============================\n');
