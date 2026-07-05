/** Arabic privacy policy HTML for the الوسيط العقاري mobile app (Google Play). */
export function renderPrivacyPolicyHtml(contactEmail: string): string {
  const email = contactEmail || 'mhd7190@gmail.com';
  const lastUpdated = '11 يونيو 2026';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>سياسة الخصوصية — الوسيط العقاري</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --accent: #0d9488;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.75;
    }
    .wrap {
      max-width: 720px;
      margin: 0 auto;
      padding: 2rem 1.25rem 3rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2rem 1.5rem;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
    }
    h1 {
      margin: 0 0 0.5rem;
      font-size: 1.75rem;
      color: var(--accent);
    }
    .meta {
      color: var(--muted);
      font-size: 0.95rem;
      margin-bottom: 1.75rem;
    }
    h2 {
      margin: 1.75rem 0 0.75rem;
      font-size: 1.15rem;
    }
    p, li { color: var(--text); }
    ul { padding-right: 1.25rem; margin: 0.5rem 0 1rem; }
    a { color: var(--accent); }
    footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      color: var(--muted);
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <article class="card">
      <h1>سياسة الخصوصية</h1>
      <p class="meta">تطبيق <strong>الوسيط العقاري</strong> — آخر تحديث: ${lastUpdated}</p>

      <p>
        نحن في تطبيق <strong>الوسيط العقاري</strong> نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية.
        توضّح هذه السياسة نوع البيانات التي نجمعها، وكيف نستخدمها، ومع من نشاركها، وحقوقك المتعلقة بها.
      </p>

      <h2>1. من نحن</h2>
      <p>
        تطبيق <strong>الوسيط العقاري</strong> منصة عقارية تتيح للمستخدمين تصفّح العقارات،
        نشر الإعلانات، والتواصل مع الوسطاء والمعلنين.
        للاستفسارات المتعلقة بالخصوصية يمكنك التواصل معنا عبر البريد:
        <a href="mailto:${email}">${email}</a>
      </p>

      <h2>2. البيانات التي نجمعها</h2>
      <ul>
        <li><strong>بيانات الحساب:</strong> الاسم، رقم الهاتف، البريد الإلكتروني (إن وُجد)، وكلمة المرور (مخزّنة بشكل مشفّر).</li>
        <li><strong>بيانات الملف الشخصي:</strong> صورة الملف الشخصي (إن رفعتها).</li>
        <li><strong>بيانات العقارات:</strong> تفاصيل الإعلانات، الصور، الفيديوهات، الموقع (المدينة/المنطقة)، ووسائل التواصل المرتبطة بالإعلان.</li>
        <li><strong>بيانات الاستخدام:</strong> الطلبات العقارية، المفضّلة، الإبلاغات، وآخر ظهور للحساب.</li>
        <li><strong>بيانات الجهاز:</strong> معرّف الجهاز، نوع الجهاز، وتوكن الإشعارات (لإرسال تنبيهات التطبيق).</li>
        <li><strong>بيانات تقنية:</strong> معلومات المتصفح/التطبيق (مثل User-Agent) عند تسجيل الدخول لأغراض الأمان.</li>
      </ul>

      <h2>3. كيف نستخدم بياناتك</h2>
      <ul>
        <li>إنشاء حسابك وتسجيل دخولك وإدارة جلستك.</li>
        <li>عرض ونشر الإعلانات العقارية والطلبات.</li>
        <li>تمكين التواصل بين المستخدمين والوسطاء (مكالمة، واتساب، أو داخل التطبيق).</li>
        <li>إرسال إشعارات مهمة (مثل حالة الإعلان، الطلبات الجديدة، أو رسائل إدارية).</li>
        <li>تحسين أمان المنصة ومنع إساءة الاستخدام.</li>
        <li>الامتثال للمتطلبات القانونية عند الضرورة.</li>
      </ul>

      <h2>4. مشاركة البيانات</h2>
      <p>لا نبيع بياناتك الشخصية. قد نشارك البيانات في الحالات التالية فقط:</p>
      <ul>
        <li><strong>مع مزوّدي الخدمة:</strong> لاستضافة البيانات، تخزين الوسائط، وإرسال الإشعارات (مثل Supabase وFirebase Cloud Messaging).</li>
        <li><strong>مع مستخدمين آخرين:</strong> عند نشر إعلان أو طلب، تظهر بيانات التواصل التي تختار مشاركتها.</li>
        <li><strong>لأسباب قانونية:</strong> عند طلب جهة مختصة وفق الأنظمة المعمول بها.</li>
      </ul>

      <h2>5. تخزين البيانات والأمان</h2>
      <p>
        نخزّن البيانات على خوادم آمنة ونطبّق إجراءات تقنية وتنظيمية لحمايتها،
        بما في ذلك تشفير كلمات المرور واستخدام اتصالات آمنة (HTTPS).
        مع ذلك، لا يمكن ضمان أمان مطلق لأي نقل عبر الإنترنت.
      </p>

      <h2>6. مدة الاحتفاظ بالبيانات</h2>
      <p>
        نحتفظ ببياناتك طالما كان حسابك نشطًا أو حسب الحاجة لتقديم الخدمة.
        يمكنك طلب حذف حسابك، وسنعالج الطلب وفق سياساتنا والالتزامات القانونية.
      </p>

      <h2>7. حقوقك</h2>
      <ul>
        <li>الاطلاع على بياناتك وتحديثها من داخل التطبيق.</li>
        <li>طلب تصحيح أو حذف بياناتك عبر التواصل معنا.</li>
        <li>إلغاء الاشتراك في الإشعارات من إعدادات الجهاز أو التطبيق.</li>
      </ul>

      <h2>8. خصوصية الأطفال</h2>
      <p>
        التطبيق غير موجّه للأطفال دون 13 عامًا ولا نجمع عن قصد بيانات منهم.
        إذا علمنا بجمع بيانات طفل، سنحذفها فورًا.
      </p>

      <h2>9. التعديلات على هذه السياسة</h2>
      <p>
        قد نحدّث هذه السياسة من وقت لآخر. سننشر النسخة المحدّثة على هذه الصفحة
        مع تاريخ آخر تحديث. استمرارك في استخدام التطبيق بعد التحديث يعني موافقتك على السياسة المعدّلة.
      </p>

      <h2>10. التواصل معنا</h2>
      <p>
        لأي استفسار حول الخصوصية أو لطلبات البيانات، راسلنا على:
        <a href="mailto:${email}">${email}</a>
      </p>

      <footer>© الوسيط العقاري — جميع الحقوق محفوظة</footer>
    </article>
  </div>
</body>
</html>`;
}
