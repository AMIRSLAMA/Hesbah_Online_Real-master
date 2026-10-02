from pathlib import Path

p = Path(r".\online\public\index.html")
s = p.read_text(encoding="utf-8-sig")

marker = '    <!-- Invoices -->'

section = r'''
    <!-- Payment Settings -->
    <section class="card" id="paymentSettingsSection">

      <div class="toolbar">
        <h2>💳 إعدادات طرق الدفع</h2>
        <button onclick="loadPaymentSettings()">🔄 تحديث</button>
      </div>

      <p style="margin-top:0;color:#666">
        اختر طرق الدفع التي تريد إظهارها للعميل في صفحة الطلب.
      </p>

      <div style="display:grid;gap:12px">

        <div class="card">
          <label>
            <input type="checkbox" id="payCashEnabled">
            💵 دفع كاش عند الاستلام
          </label>
          <input
            id="payCashName"
            placeholder="اسم طريقة الدفع"
            style="margin-top:8px"
          >
        </div>

        <div class="card">
          <label>
            <input type="checkbox" id="payVodafoneEnabled">
            📱 Vodafone Cash
          </label>
          <input
            id="payVodafoneName"
            placeholder="اسم طريقة الدفع"
            style="margin-top:8px"
          >
          <input
            id="payVodafoneNumber"
            placeholder="رقم Vodafone Cash"
            style="margin-top:8px"
          >
        </div>

        <div class="card">
          <label>
            <input type="checkbox" id="payEtisalatEnabled">
            📱 Etisalat Cash
          </label>
          <input
            id="payEtisalatName"
            placeholder="اسم طريقة الدفع"
            style="margin-top:8px"
          >
          <input
            id="payEtisalatNumber"
            placeholder="رقم Etisalat Cash"
            style="margin-top:8px"
          >
        </div>

        <div class="card">
          <label>
            <input type="checkbox" id="payOrangeEnabled">
            📱 Orange Cash
          </label>
          <input
            id="payOrangeName"
            placeholder="اسم طريقة الدفع"
            style="margin-top:8px"
          >
          <input
            id="payOrangeNumber"
            placeholder="رقم Orange Cash"
            style="margin-top:8px"
          >
        </div>

        <div class="card">
          <label>
            <input type="checkbox" id="payWeEnabled">
            📱 WE Pay
          </label>
          <input
            id="payWeName"
            placeholder="اسم طريقة الدفع"
            style="margin-top:8px"
          >
          <input
            id="payWeNumber"
            placeholder="رقم WE Pay"
            style="margin-top:8px"
          >
        </div>

        <div class="card">
          <label>
            <input type="checkbox" id="payInstapayEnabled">
            🏦 InstaPay
          </label>
          <input
            id="payInstapayName"
            placeholder="اسم طريقة الدفع"
            style="margin-top:8px"
          >
          <input
            id="payInstapayAccount"
            placeholder="حساب / عنوان InstaPay"
            style="margin-top:8px"
          >
        </div>

        <div class="card">
          <label>
            <input type="checkbox" id="payCardEnabled">
            💳 Visa / Mastercard
          </label>
          <input
            id="payCardName"
            placeholder="اسم طريقة الدفع"
            style="margin-top:8px"
          >
          <input
            id="payCardProvider"
            placeholder="مزود خدمة الدفع"
            style="margin-top:8px"
          >
          <input
            id="payCardPublicKey"
            placeholder="Public Key"
            style="margin-top:8px"
          >
        </div>

        <button
          onclick="savePaymentSettings()"
          style="font-size:16px;padding:12px">
          💾 حفظ إعدادات الدفع
        </button>

        <div id="paymentSettingsMsg"></div>

      </div>

    </section>


'''

if marker not in s:
    raise SystemExit("لم يتم العثور على مكان قسم الفواتير")

if "id=\"paymentSettingsSection\"" in s:
    raise SystemExit("قسم إعدادات الدفع موجود بالفعل")

s = s.replace(marker, section + marker, 1)

p.write_text(s, encoding="utf-8-sig")
print("تمت إضافة قسم إعدادات الدفع إلى index.html بنجاح")
