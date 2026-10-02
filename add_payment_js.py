from pathlib import Path

p = Path(r".\online\public\app.js")
s = p.read_text(encoding="utf-8-sig")

code = r'''

async function loadPaymentSettings() {
  try {
    const d = await api('/api/public/payment-methods');
    const p = d.payment || {};

    $('payCashEnabled').checked = !!p.cash?.enabled;
    $('payCashName').value = p.cash?.name || '';

    $('payVodafoneEnabled').checked = !!p.vodafoneCash?.enabled;
    $('payVodafoneName').value = p.vodafoneCash?.name || '';
    $('payVodafoneNumber').value = p.vodafoneCash?.number || '';

    $('payEtisalatEnabled').checked = !!p.etisalatCash?.enabled;
    $('payEtisalatName').value = p.etisalatCash?.name || '';
    $('payEtisalatNumber').value = p.etisalatCash?.number || '';

    $('payOrangeEnabled').checked = !!p.orangeCash?.enabled;
    $('payOrangeName').value = p.orangeCash?.name || '';
    $('payOrangeNumber').value = p.orangeCash?.number || '';

    $('payWeEnabled').checked = !!p.wePay?.enabled;
    $('payWeName').value = p.wePay?.name || '';
    $('payWeNumber').value = p.wePay?.number || '';

    $('payInstapayEnabled').checked = !!p.instapay?.enabled;
    $('payInstapayName').value = p.instapay?.name || '';
    $('payInstapayAccount').value = p.instapay?.account || '';

    $('payCardEnabled').checked = !!p.card?.enabled;
    $('payCardName').value = p.card?.name || '';
    $('payCardProvider').value = p.card?.provider || '';
    $('payCardPublicKey').value = p.card?.publicKey || '';

  } catch (e) {
    $('paymentSettingsMsg').textContent =
      e.message || 'حدث خطأ أثناء تحميل إعدادات الدفع';
  }
}

async function savePaymentSettings() {
  const msg = $('paymentSettingsMsg');

  try {
    msg.textContent = 'جاري حفظ إعدادات الدفع...';

    await api('/api/payment-settings', {
      method: 'PUT',
      body: JSON.stringify({
        cash: {
          enabled: $('payCashEnabled').checked,
          name: $('payCashName').value.trim()
        },

        vodafoneCash: {
          enabled: $('payVodafoneEnabled').checked,
          name: $('payVodafoneName').value.trim(),
          number: $('payVodafoneNumber').value.trim()
        },

        etisalatCash: {
          enabled: $('payEtisalatEnabled').checked,
          name: $('payEtisalatName').value.trim(),
          number: $('payEtisalatNumber').value.trim()
        },

        orangeCash: {
          enabled: $('payOrangeEnabled').checked,
          name: $('payOrangeName').value.trim(),
          number: $('payOrangeNumber').value.trim()
        },

        wePay: {
          enabled: $('payWeEnabled').checked,
          name: $('payWeName').value.trim(),
          number: $('payWeNumber').value.trim()
        },

        instapay: {
          enabled: $('payInstapayEnabled').checked,
          name: $('payInstapayName').value.trim(),
          account: $('payInstapayAccount').value.trim()
        },

        card: {
          enabled: $('payCardEnabled').checked,
          name: $('payCardName').value.trim(),
          provider: $('payCardProvider').value.trim(),
          publicKey: $('payCardPublicKey').value.trim()
        }
      })
    });

    msg.textContent = '✅ تم حفظ إعدادات الدفع بنجاح';

  } catch (e) {
    msg.textContent =
      '❌ ' + (e.message || 'حدث خطأ أثناء حفظ إعدادات الدفع');
  }
}
'''

if "async function loadPaymentSettings()" in s:
    raise SystemExit("وظائف إعدادات الدفع موجودة بالفعل")

s = s.rstrip() + code + "\n"

p.write_text(s, encoding="utf-8-sig")
print("تمت إضافة وظائف إعدادات الدفع إلى app.js بنجاح")
