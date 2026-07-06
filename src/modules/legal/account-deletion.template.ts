/** Arabic account-deletion instructions page for الوسيط العقاري (Google Play requirement). */
export function renderAccountDeletionHtml(contactEmail: string): string {
  const email = contactEmail || 'mhd7190@gmail.com';
  const lastUpdated = '6 يوليو 2026';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>حذف الحساب — الوسيط العقاري</title>
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
    ol, ul { padding-right: 1.25rem; margin: 0.5rem 0 1rem; }
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
      <h1>حذف الحساب والبيانات</h1>
      <p class="meta">تطبيق <strong>الوسيط العقاري</strong> — آخر تحديث: ${lastUpdated}</p>

      <p>
        توضّح هذه الصفحة كيفية طلب حذف حسابك في تطبيق <strong>الوسيط العقاري</strong>
        والبيانات المرتبطة به.
      </p>

      <h2>الحذف من داخل التطبيق</h2>
      <ol>
        <li>افتح تطبيق <strong>الوسيط العقاري</strong> وسجّل الدخول إلى حسابك.</li>
        <li>انتقل إلى <strong>الملف الشخصي</strong>.</li>
        <li>اختر <strong>حذف الحساب</strong>.</li>
        <li>أكّد العملية. سيُحذف حسابك وبياناتك المرتبطة به بشكل نهائي.</li>
      </ol>

      <h2>الحذف عبر البريد الإلكتروني</h2>
      <p>
        إذا تعذّر عليك الوصول إلى التطبيق، أرسل طلبًا من البريد الإلكتروني المسجّل في حسابك إلى
        <a href="mailto:${email}?subject=طلب%20حذف%20الحساب">${email}</a>
        مع كتابة <strong>«طلب حذف الحساب»</strong> في العنوان. سنتحقق من هويتك وننفّذ الحذف
        خلال مدة أقصاها 30 يومًا.
      </p>

      <h2>البيانات التي تُحذف</h2>
      <ul>
        <li>بيانات الحساب: الاسم، رقم الهاتف، البريد الإلكتروني، وكلمة المرور.</li>
        <li>صورة الملف الشخصي.</li>
        <li>إعلاناتك العقارية وطلباتك والمفضّلة.</li>
        <li>توكن الإشعارات ومعرّف الجهاز المرتبط بحسابك.</li>
      </ul>

      <h2>البيانات التي قد نحتفظ بها</h2>
      <p>
        قد نحتفظ بحدٍّ أدنى من السجلات (مثل سجلات المعاملات أو البلاغات) للمدة التي تفرضها
        الالتزامات القانونية والأمنية، ثم تُحذف. لا تُستخدم هذه السجلات لأي غرض آخر.
      </p>

      <h2>التواصل معنا</h2>
      <p>
        لأي استفسار حول حذف الحساب أو البيانات، راسلنا على:
        <a href="mailto:${email}">${email}</a>
      </p>

      <footer>© الوسيط العقاري — جميع الحقوق محفوظة</footer>
    </article>
  </div>
</body>
</html>`;
}
