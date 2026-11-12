// runemic.com/try: free image-to-text. A big drop zone opens a full-screen workspace (image | text, with a
// draggable divider); reading starts as soon as an image is chosen and the text streams in as it is written.
// Talks to api.runemic.com/v1/try, which counts free pages per visitor
// (a signed cookie on api.runemic.com) and per network. All text is set with textContent, never innerHTML.
(function () {
  "use strict";
  var tool = document.getElementById("tool");
  if (!tool) return;
  var API = tool.getAttribute("data-api") + "/v1/try";
  var CONSOLE = "https://console.runemic.com";
  var MAX = 4194304, MAX_IN = 25 * 1048576, TYPES = /^image\/(png|jpeg|webp|gif)$/; // big photos are shrunk before sending
  function $(id) { return document.getElementById(id); }
  var file = null, busy = false, remaining = null, open = true, lastText = "", lastFormat = "markdown";

  // interface text in the page's language; error codes from the server map to local messages
  var LANG = tool.getAttribute("data-lang") || "en";
  // Sign in here (the same sign-in as tools.runemic.com: an HttpOnly session cookie on api.runemic.com, made by
  // /v1/tools/signin, which comes back to this page). Signed in, /v1/try reads pages with the person's own credits
  // instead of the free pages. The console's own session is never sent here.
  var me = null, SIGNIN = API.replace(/\/v1\/try$/, "") + "/v1/tools/signin?next=" + encodeURIComponent(location.href.split("#")[0]);
  // signed in, when the credits run out
  var NOCREDITS = {
    en: "Not enough credits left.",
    fa: "اعتبار کافی ندارید.",
    ar: "رصيدك غير كافٍ.",
    ur: "آپ کے کریڈٹس کافی نہیں ہیں۔",
    hi: "आपके पास पर्याप्त क्रेडिट नहीं हैं।",
    ja: "クレジットが足りません。",
    ko: "크레딧이 부족합니다.",
    zh: "积分不足。",
    de: "Nicht genug Credits übrig.",
    ru: "Недостаточно кредитов.",
    es: "No te quedan créditos suficientes.",
    pt: "Créditos insuficientes.",
    fr: "Crédits insuffisants.",
    it: "Crediti insufficienti.",
    tr: "Yeterli krediniz yok.",
    vi: "Không đủ tín dụng.",
    id: "Kredit Anda tidak cukup.",
    he: "אין מספיק קרדיטים.",
  };
  function digits(set) { return function (n) { return String(n).replace(/\d/g, function (d) { return set[d]; }); }; }
  var D = { fa: digits("۰۱۲۳۴۵۶۷۸۹"), ur: digits("۰۱۲۳۴۵۶۷۸۹"), ar: digits("٠١٢٣٤٥٦٧٨٩") }[LANG] || function (n) { return String(n); };
  var TEXT = {
    en: {
      signin: "Sign in for 2,500 free credits", none: "No free pages left today.",
      inLeft: "You're signed in: ", inLink: "the playground gives you up to 500 pages a day (50 on day one)",
      type: "Use a PNG, JPEG, WebP or GIF image. PDFs are coming soon.",
      size: "That image is larger than 25 MB. Try a smaller photo or screenshot.",
      sample: "Couldn't load the sample. Please try again.", reading: "Reading…", run: "Read again",
      notext: "(No text found in this image.)", network: "Couldn't reach the server. Check your connection and try again.",
      paused: "The free tool is paused right now. You can still sign in to the console and use your free credits.",
      copied: "Copied", copy: "Copy", generic: "Something went wrong. Please try again.", pasted: "Pasted image", codes: {}
    },
    fa: {
      signin: "برای ۲٬۵۰۰ اعتبار رایگان وارد شوید", none: "صفحهٔ رایگان امروز شما تمام شده است.",
      inLeft: "شما وارد شده‌اید: ", inLink: "در محیط آزمایش تا ۵۰۰ صفحه در روز بخوانید (روز اول ۵۰)",
      type: "لطفاً یک تصویر PNG، JPEG، WebP یا GIF انتخاب کنید. پشتیبانی از PDF به‌زودی اضافه می‌شود.",
      size: "حجم این تصویر بیشتر از ۲۵ مگابایت است. یک عکس یا اسکرین‌شات کوچک‌تر امتحان کنید.",
      sample: "نمونه بارگذاری نشد. دوباره تلاش کنید.", reading: "در حال خواندن…", run: "خواندن دوباره",
      notext: "(در این تصویر متنی پیدا نشد.)", network: "اتصال به سرور برقرار نشد. اینترنت خود را بررسی کنید و دوباره تلاش کنید.",
      paused: "ابزار رایگان فعلاً متوقف است. می‌توانید وارد کنسول شوید و از اعتبار رایگان خود استفاده کنید.",
      copied: "کپی شد", copy: "کپی", generic: "مشکلی پیش آمد. دوباره تلاش کنید.", pasted: "تصویر چسبانده‌شده",
      codes: { try_limit: "صفحه‌های رایگان امروز شما تمام شده است.", capacity: "ظرفیت رایگان امروز تمام شده است. وارد شوید یا بعد از ساعت ۰۰:۰۰ UTC دوباره بیایید.",
               rate_limited: "درخواست‌ها زیاد است. یک دقیقه صبر کنید.", model_error: "مدل نتوانست این تصویر را بخواند. یک عکس واضح‌تر امتحان کنید.", model_timeout: "مدل‌ها الان شلوغ هستند و به‌موقع پاسخ ندادند. چند لحظه بعد دوباره تلاش کنید.",
               too_large: "این تصویر حتی پس از کوچک شدن بیشتر از ۴ مگابایت است.", unsupported_type: "لطفاً یک تصویر PNG، JPEG، WebP یا GIF انتخاب کنید.",
               unavailable: "ابزار رایگان فعلاً متوقف است." }
    },
    ar: {
      signin: "سجّل الدخول للحصول على ٢٬٥٠٠ وحدة رصيد مجانية", none: "لم تتبقَّ صفحات مجانية اليوم.",
      inLeft: "أنت مسجّل الدخول: ", inLink: "بيئة التجربة تمنحك حتى ٥٠٠ صفحة يوميًا (٥٠ في اليوم الأول)",
      type: "استخدم صورة PNG أو JPEG أو WebP أو GIF. دعم PDF قريبًا.",
      size: "حجم هذه الصورة أكبر من ٢٥ ميغابايت. جرّب صورة أو لقطة شاشة أصغر.",
      sample: "تعذّر تحميل المثال. حاول مرة أخرى.", reading: "جارٍ القراءة…", run: "اقرأ مجددًا",
      notext: "(لم يُعثر على نص في هذه الصورة.)", network: "تعذّر الاتصال بالخادم. تحقّق من اتصالك وحاول مرة أخرى.",
      paused: "الأداة المجانية متوقفة حاليًا. لا يزال بإمكانك تسجيل الدخول واستخدام رصيدك المجاني.",
      copied: "تم النسخ", copy: "نسخ", generic: "حدث خطأ ما. حاول مرة أخرى.", pasted: "صورة ملصقة",
      codes: { try_limit: "لقد استخدمت صفحاتك المجانية لهذا اليوم.", capacity: "نفدت السعة المجانية لهذا اليوم. سجّل الدخول أو عد بعد الساعة ٠٠:٠٠ بتوقيت UTC.",
               rate_limited: "طلبات كثيرة. انتظر دقيقة.", model_error: "لم يتمكن النموذج من قراءة هذه الصورة. جرّب صورة أوضح.", model_timeout: "النماذج مشغولة الآن ولم تستجب في الوقت المناسب. حاول مرة أخرى بعد لحظات.",
               too_large: "هذه الصورة أكبر من ٤ ميغابايت حتى بعد التصغير.", unsupported_type: "استخدم صورة PNG أو JPEG أو WebP أو GIF.",
               unavailable: "الأداة المجانية متوقفة حاليًا." }
    },
    ur: {
      signin: "۲٬۵۰۰ مفت کریڈٹس کے لیے سائن اِن کریں", none: "آج کوئی مفت صفحہ باقی نہیں۔",
      inLeft: "آپ سائن اِن ہیں: ", inLink: "playground میں روزانہ ۵۰۰ صفحات تک (پہلے دن ۵۰)",
      type: "PNG، JPEG، WebP یا GIF تصویر استعمال کریں۔ PDF جلد آ رہا ہے۔",
      size: "یہ تصویر ۲۵ MB سے بڑی ہے۔ چھوٹی تصویر یا اسکرین شاٹ آزمائیں۔",
      sample: "نمونہ لوڈ نہیں ہو سکا۔ دوبارہ کوشش کریں۔", reading: "پڑھا جا رہا ہے…", run: "دوبارہ پڑھیں",
      notext: "(اس تصویر میں کوئی متن نہیں ملا۔)", network: "سرور سے رابطہ نہیں ہو سکا۔ اپنا کنکشن دیکھیں اور دوبارہ کوشش کریں۔",
      paused: "مفت ٹول ابھی رکا ہوا ہے۔ آپ سائن اِن کر کے اپنے مفت کریڈٹس استعمال کر سکتے ہیں۔",
      copied: "کاپی ہو گیا", copy: "کاپی", generic: "کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔", pasted: "چسپاں کی گئی تصویر",
      codes: { try_limit: "آج کے آپ کے مفت صفحات ختم ہو گئے ہیں۔", capacity: "آج کی مفت گنجائش ختم ہو گئی ہے۔ سائن اِن کریں یا ۰۰:۰۰ UTC کے بعد دوبارہ آئیں۔",
               rate_limited: "بہت زیادہ درخواستیں۔ ایک منٹ انتظار کریں۔", model_error: "ماڈل یہ تصویر نہیں پڑھ سکا۔ زیادہ واضح تصویر آزمائیں۔", model_timeout: "ماڈلز ابھی مصروف ہیں اور وقت پر جواب نہیں دے سکے۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔",
               too_large: "چھوٹا کرنے کے بعد بھی یہ تصویر ۴ MB سے بڑی ہے۔", unsupported_type: "PNG، JPEG، WebP یا GIF تصویر استعمال کریں۔",
               unavailable: "مفت ٹول ابھی رکا ہوا ہے۔" }
    },
    hi: {
      signin: "2,500 मुफ़्त क्रेडिट के लिए साइन इन करें", none: "आज कोई मुफ़्त पेज नहीं बचा।",
      inLeft: "आप साइन इन हैं: ", inLink: "playground में हर दिन 500 पेज तक (पहले दिन 50)",
      type: "PNG, JPEG, WebP या GIF इमेज इस्तेमाल करें। PDF जल्द आ रहा है।",
      size: "यह इमेज 25 MB से बड़ी है। छोटी फ़ोटो या स्क्रीनशॉट आज़माएँ।",
      sample: "नमूना लोड नहीं हो सका। फिर कोशिश करें।", reading: "पढ़ा जा रहा है…", run: "फिर से पढ़ें",
      notext: "(इस इमेज में कोई टेक्स्ट नहीं मिला।)", network: "सर्वर से कनेक्ट नहीं हो सका। अपना कनेक्शन जाँचें और फिर कोशिश करें।",
      paused: "मुफ़्त टूल अभी रुका हुआ है। आप साइन इन करके अपना मुफ़्त क्रेडिट इस्तेमाल कर सकते हैं।",
      copied: "कॉपी हो गया", copy: "कॉपी", generic: "कुछ गड़बड़ हो गई। फिर कोशिश करें।", pasted: "चिपकाई गई इमेज",
      codes: { try_limit: "आज के आपके मुफ़्त पेज खत्म हो गए हैं।", capacity: "आज की मुफ़्त क्षमता खत्म हो गई है। साइन इन करें या 00:00 UTC के बाद फिर आएँ।",
               rate_limited: "बहुत ज़्यादा अनुरोध। एक मिनट रुकें।", model_error: "मॉडल यह इमेज नहीं पढ़ सका। ज़्यादा साफ़ फ़ोटो आज़माएँ।", model_timeout: "मॉडल अभी व्यस्त हैं और समय पर जवाब नहीं दे सके। थोड़ी देर बाद फिर कोशिश करें।",
               too_large: "छोटा करने के बाद भी यह इमेज 4 MB से बड़ी है।", unsupported_type: "PNG, JPEG, WebP या GIF इमेज इस्तेमाल करें।",
               unavailable: "मुफ़्त टूल अभी रुका हुआ है।" }
    },
    ja: {
      signin: "ログインして2,500クレジットを無料で受け取る", none: "今日の無料ページは残っていません。",
      inLeft: "ログイン済みです：", inLink: "プレイグラウンドなら1日500ページまで（初日は50ページ）",
      type: "PNG・JPEG・WebP・GIFの画像を使ってください。PDFには近日対応予定です。",
      size: "この画像は25 MBを超えています。小さい写真やスクリーンショットでお試しください。",
      sample: "サンプルを読み込めませんでした。もう一度お試しください。", reading: "読み取り中…", run: "もう一度読み取る",
      notext: "（この画像には文字が見つかりませんでした。）", network: "サーバーに接続できませんでした。接続を確認して、もう一度お試しください。",
      paused: "無料ツールは現在停止中です。コンソールにログインすれば、無料クレジットを使えます。",
      copied: "コピーしました", copy: "コピー", generic: "問題が発生しました。もう一度お試しください。", pasted: "貼り付けた画像",
      codes: { try_limit: "今日の無料ページを使い切りました。", capacity: "今日の無料枠は全体で上限に達しました。ログインするか、00:00 UTC 以降にもう一度お試しください。",
               rate_limited: "リクエストが多すぎます。1分ほどお待ちください。", model_error: "この画像を読み取れませんでした。より鮮明な写真でお試しください。", model_timeout: "モデルが混み合っていて、時間内に応答できませんでした。少し待ってからお試しください。",
               too_large: "縮小しても4 MBを超えています。", unsupported_type: "PNG・JPEG・WebP・GIFの画像を使ってください。",
               unavailable: "無料ツールは現在停止中です。" }
    },
    ko: {
      signin: "로그인하고 무료 크레딧 2,500개 받기", none: "오늘 남은 무료 페이지가 없습니다.",
      inLeft: "로그인 상태입니다: ", inLink: "플레이그라운드에서는 하루 500페이지까지 (첫날 50페이지)",
      type: "PNG, JPEG, WebP, GIF 이미지를 사용해 주세요. PDF는 곧 지원됩니다.",
      size: "이 이미지는 25 MB보다 큽니다. 더 작은 사진이나 스크린샷을 사용해 보세요.",
      sample: "예시를 불러오지 못했습니다. 다시 시도해 주세요.", reading: "읽는 중…", run: "다시 읽기",
      notext: "(이 이미지에서 텍스트를 찾지 못했습니다.)", network: "서버에 연결할 수 없습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
      paused: "무료 도구가 지금은 중지되어 있습니다. 콘솔에 로그인하면 무료 크레딧을 사용할 수 있습니다.",
      copied: "복사됨", copy: "복사", generic: "문제가 발생했습니다. 다시 시도해 주세요.", pasted: "붙여 넣은 이미지",
      codes: { try_limit: "오늘의 무료 페이지를 모두 사용했습니다.", capacity: "오늘의 전체 무료 한도가 소진되었습니다. 로그인하거나 00:00 UTC 이후에 다시 오세요.",
               rate_limited: "요청이 너무 많습니다. 1분만 기다려 주세요.", model_error: "이 이미지를 읽지 못했습니다. 더 선명한 사진으로 시도해 보세요.", model_timeout: "모델이 지금 바빠서 제때 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.",
               too_large: "줄인 뒤에도 이 이미지는 4 MB보다 큽니다.", unsupported_type: "PNG, JPEG, WebP, GIF 이미지를 사용해 주세요.",
               unavailable: "무료 도구가 지금은 중지되어 있습니다." }
    },
    zh: {
      signin: "登录即可获得2,500免费积分", none: "今天的免费页数已用完。",
      inLeft: "你已登录：", inLink: "在 playground 中每天最多500页（第一天50页）",
      type: "请使用 PNG、JPEG、WebP 或 GIF 图片。即将支持 PDF。",
      size: "这张图片超过 25 MB，请换一张较小的照片或截图。",
      sample: "示例加载失败，请重试。", reading: "正在识别…", run: "重新识别",
      notext: "（这张图片中没有找到文字。）", network: "无法连接服务器，请检查网络后重试。",
      paused: "免费工具目前已暂停。你仍可以登录控制台使用免费积分。",
      copied: "已复制", copy: "复制", generic: "出了点问题，请重试。", pasted: "粘贴的图片",
      codes: { try_limit: "你今天的免费页数已用完。", capacity: "今天的免费总额度已用完。请登录，或在 00:00 UTC 之后再来。",
               rate_limited: "请求过多，请稍等一分钟。", model_error: "模型无法识别这张图片，请换一张更清晰的照片。", model_timeout: "模型目前繁忙，未能及时响应，请稍后重试。",
               too_large: "压缩后这张图片仍超过 4 MB。", unsupported_type: "请使用 PNG、JPEG、WebP 或 GIF 图片。",
               unavailable: "免费工具目前已暂停。" }
    },
    de: {
      signin: "Anmelden und 2.500 kostenlose Credits erhalten", none: "Heute sind keine kostenlosen Seiten mehr übrig.",
      inLeft: "Sie sind angemeldet: ", inLink: "Im Playground bis zu 500 Seiten am Tag (am ersten Tag 50)",
      type: "Bitte ein PNG-, JPEG-, WebP- oder GIF-Bild verwenden. PDFs folgen bald.",
      size: "Dieses Bild ist größer als 25 MB. Versuchen Sie ein kleineres Foto oder einen Screenshot.",
      sample: "Das Beispiel konnte nicht geladen werden. Bitte erneut versuchen.", reading: "Wird gelesen…", run: "Erneut lesen",
      notext: "(In diesem Bild wurde kein Text gefunden.)", network: "Der Server ist nicht erreichbar. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
      paused: "Das kostenlose Werkzeug ist gerade pausiert. Sie können sich in der Konsole anmelden und Ihre kostenlosen Credits nutzen.",
      copied: "Kopiert", copy: "Kopieren", generic: "Etwas ist schiefgelaufen. Bitte erneut versuchen.", pasted: "Eingefügtes Bild",
      codes: { try_limit: "Ihre kostenlosen Seiten für heute sind aufgebraucht.", capacity: "Das kostenlose Tageskontingent ist ausgeschöpft. Melden Sie sich an oder kommen Sie nach 00:00 UTC wieder.",
               rate_limited: "Zu viele Anfragen. Bitte eine Minute warten.", model_error: "Das Modell konnte dieses Bild nicht lesen. Versuchen Sie ein schärferes Foto.", model_timeout: "Die Modelle sind gerade ausgelastet und haben nicht rechtzeitig geantwortet. Bitte gleich noch einmal versuchen.",
               too_large: "Das Bild ist auch verkleinert noch größer als 4 MB.", unsupported_type: "Bitte ein PNG-, JPEG-, WebP- oder GIF-Bild verwenden.",
               unavailable: "Das kostenlose Werkzeug ist gerade pausiert." }
    },
    ru: {
      signin: "Войдите и получите 2 500 бесплатных кредитов", none: "Бесплатные страницы на сегодня закончились.",
      inLeft: "Вы вошли в аккаунт: ", inLink: "в песочнице до 500 страниц в день (в первый день 50)",
      type: "Используйте изображение PNG, JPEG, WebP или GIF. Поддержка PDF скоро появится.",
      size: "Это изображение больше 25 МБ. Попробуйте фото или скриншот поменьше.",
      sample: "Не удалось загрузить пример. Попробуйте ещё раз.", reading: "Распознаём…", run: "Распознать снова",
      notext: "(На этом изображении текст не найден.)", network: "Не удалось связаться с сервером. Проверьте подключение и попробуйте снова.",
      paused: "Бесплатный инструмент сейчас приостановлен. Вы можете войти в консоль и использовать бесплатные кредиты.",
      copied: "Скопировано", copy: "Копировать", generic: "Что-то пошло не так. Попробуйте ещё раз.", pasted: "Вставленное изображение",
      codes: { try_limit: "Бесплатные страницы на сегодня закончились.", capacity: "Общий бесплатный лимит на сегодня исчерпан. Войдите или вернитесь после 00:00 UTC.",
               rate_limited: "Слишком много запросов. Подождите минуту.", model_error: "Модель не смогла прочитать это изображение. Попробуйте более чёткое фото.", model_timeout: "Модели сейчас перегружены и не ответили вовремя. Попробуйте чуть позже.",
               too_large: "Даже после уменьшения изображение больше 4 МБ.", unsupported_type: "Используйте изображение PNG, JPEG, WebP или GIF.",
               unavailable: "Бесплатный инструмент сейчас приостановлен." }
    },
    /* lang_new: start (written by build.py from lang_new.TEXT; edit it there) */
    es: {"signin": "Inicia sesión y recibe 2.500 créditos gratis", "none": "No te quedan páginas gratis hoy.", "inLeft": "Has iniciado sesión: ", "inLink": "En el playground, hasta 500 páginas al día (50 el primer día)", "type": "Usa una imagen PNG, JPEG, WebP o GIF. Los PDF llegarán pronto.", "size": "Esta imagen pesa más de 25 MB. Prueba con una foto más pequeña o una captura de pantalla.", "sample": "No se pudo cargar el ejemplo. Inténtalo de nuevo.", "reading": "Leyendo…", "run": "Leer de nuevo", "notext": "(No se encontró texto en esta imagen.)", "network": "No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.", "paused": "La herramienta gratuita está en pausa. Puedes iniciar sesión en la consola y usar tus créditos gratis.", "copied": "Copiado", "copy": "Copiar", "generic": "Algo salió mal. Inténtalo de nuevo.", "pasted": "Imagen pegada", "codes": {"try_limit": "Ya usaste las páginas gratis de hoy.", "capacity": "Se agotó el cupo gratuito de hoy. Inicia sesión o vuelve después de las 00:00 UTC.", "rate_limited": "Demasiadas solicitudes. Espera un minuto.", "model_error": "El modelo no pudo leer esta imagen. Prueba con una foto más nítida.", "model_timeout": "Los modelos están ocupados y no respondieron a tiempo. Inténtalo de nuevo en un momento.", "too_large": "Incluso reducida, esta imagen pesa más de 4 MB.", "unsupported_type": "Usa una imagen PNG, JPEG, WebP o GIF.", "unavailable": "La herramienta gratuita está en pausa."}},
    pt: {"signin": "Entre e receba 2.500 créditos grátis", "none": "Não restam páginas grátis hoje.", "inLeft": "Você está conectado: ", "inLink": "No playground, até 500 páginas por dia (50 no primeiro dia)", "type": "Use uma imagem PNG, JPEG, WebP ou GIF. PDFs em breve.", "size": "Esta imagem tem mais de 25 MB. Tente uma foto menor ou um print.", "sample": "Não foi possível carregar o exemplo. Tente de novo.", "reading": "Lendo…", "run": "Ler de novo", "notext": "(Nenhum texto encontrado nesta imagem.)", "network": "Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.", "paused": "A ferramenta grátis está pausada. Você pode entrar no console e usar seus créditos grátis.", "copied": "Copiado", "copy": "Copiar", "generic": "Algo deu errado. Tente de novo.", "pasted": "Imagem colada", "codes": {"try_limit": "Você já usou as páginas grátis de hoje.", "capacity": "A cota grátis de hoje acabou. Entre na sua conta ou volte depois das 00:00 UTC.", "rate_limited": "Muitas solicitações. Espere um minuto.", "model_error": "O modelo não conseguiu ler esta imagem. Tente uma foto mais nítida.", "model_timeout": "Os modelos estão ocupados e não responderam a tempo. Tente de novo daqui a pouco.", "too_large": "Mesmo reduzida, esta imagem tem mais de 4 MB.", "unsupported_type": "Use uma imagem PNG, JPEG, WebP ou GIF.", "unavailable": "A ferramenta grátis está pausada."}},
    fr: {"signin": "Connectez-vous et recevez 2 500 crédits gratuits", "none": "Il ne reste plus de pages gratuites aujourd'hui.", "inLeft": "Vous êtes connecté : ", "inLink": "Dans le playground, jusqu'à 500 pages par jour (50 le premier jour)", "type": "Utilisez une image PNG, JPEG, WebP ou GIF. Les PDF arrivent bientôt.", "size": "Cette image dépasse 25 Mo. Essayez une photo plus petite ou une capture d'écran.", "sample": "L'exemple n'a pas pu être chargé. Réessayez.", "reading": "Lecture…", "run": "Relire", "notext": "(Aucun texte trouvé dans cette image.)", "network": "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.", "paused": "L'outil gratuit est en pause. Vous pouvez vous connecter à la console et utiliser vos crédits gratuits.", "copied": "Copié", "copy": "Copier", "generic": "Un problème est survenu. Réessayez.", "pasted": "Image collée", "codes": {"try_limit": "Vous avez utilisé vos pages gratuites du jour.", "capacity": "Le quota gratuit du jour est épuisé. Connectez-vous ou revenez après 00:00 UTC.", "rate_limited": "Trop de requêtes. Patientez une minute.", "model_error": "Le modèle n'a pas pu lire cette image. Essayez une photo plus nette.", "model_timeout": "Les modèles sont occupés et n'ont pas répondu à temps. Réessayez dans un instant.", "too_large": "Même réduite, cette image dépasse 4 Mo.", "unsupported_type": "Utilisez une image PNG, JPEG, WebP ou GIF.", "unavailable": "L'outil gratuit est en pause."}},
    it: {"signin": "Accedi e ricevi 2.500 crediti gratuiti", "none": "Oggi non ti restano pagine gratuite.", "inLeft": "Hai effettuato l'accesso: ", "inLink": "Nel playground, fino a 500 pagine al giorno (50 il primo giorno)", "type": "Usa un'immagine PNG, JPEG, WebP o GIF. I PDF arriveranno presto.", "size": "Questa immagine supera i 25 MB. Prova con una foto più piccola o uno screenshot.", "sample": "Impossibile caricare l'esempio. Riprova.", "reading": "Lettura…", "run": "Leggi di nuovo", "notext": "(Nessun testo trovato in questa immagine.)", "network": "Impossibile raggiungere il server. Controlla la connessione e riprova.", "paused": "Lo strumento gratuito è in pausa. Puoi accedere alla console e usare i tuoi crediti gratuiti.", "copied": "Copiato", "copy": "Copia", "generic": "Qualcosa è andato storto. Riprova.", "pasted": "Immagine incollata", "codes": {"try_limit": "Hai usato le pagine gratuite di oggi.", "capacity": "La quota gratuita di oggi è esaurita. Accedi o torna dopo le 00:00 UTC.", "rate_limited": "Troppe richieste. Aspetta un minuto.", "model_error": "Il modello non è riuscito a leggere questa immagine. Prova con una foto più nitida.", "model_timeout": "I modelli sono occupati e non hanno risposto in tempo. Riprova tra poco.", "too_large": "Anche ridotta, questa immagine supera i 4 MB.", "unsupported_type": "Usa un'immagine PNG, JPEG, WebP o GIF.", "unavailable": "Lo strumento gratuito è in pausa."}},
    tr: {"signin": "Giriş yapın, 2.500 ücretsiz kredi alın", "none": "Bugün ücretsiz sayfanız kalmadı.", "inLeft": "Giriş yaptınız: ", "inLink": "Playground'da günde 500 sayfaya kadar (ilk gün 50)", "type": "Lütfen PNG, JPEG, WebP veya GIF resmi kullanın. PDF desteği yakında.", "size": "Bu resim 25 MB'tan büyük. Daha küçük bir fotoğraf ya da ekran görüntüsü deneyin.", "sample": "Örnek yüklenemedi. Lütfen tekrar deneyin.", "reading": "Okunuyor…", "run": "Yeniden oku", "notext": "(Bu resimde metin bulunamadı.)", "network": "Sunucuya bağlanılamadı. Bağlantınızı kontrol edip tekrar deneyin.", "paused": "Ücretsiz araç şu anda duraklatıldı. Konsola giriş yapıp ücretsiz kredilerinizi kullanabilirsiniz.", "copied": "Kopyalandı", "copy": "Kopyala", "generic": "Bir sorun oluştu. Lütfen tekrar deneyin.", "pasted": "Yapıştırılan resim", "codes": {"try_limit": "Bugünkü ücretsiz sayfalarınızı kullandınız.", "capacity": "Bugünkü toplam ücretsiz kota doldu. Giriş yapın ya da 00:00 UTC'den sonra tekrar gelin.", "rate_limited": "Çok fazla istek. Lütfen bir dakika bekleyin.", "model_error": "Model bu resmi okuyamadı. Daha net bir fotoğraf deneyin.", "model_timeout": "Modeller şu anda yoğun ve zamanında yanıt vermedi. Birazdan tekrar deneyin.", "too_large": "Küçültüldükten sonra bile bu resim 4 MB'tan büyük.", "unsupported_type": "Lütfen PNG, JPEG, WebP veya GIF resmi kullanın.", "unavailable": "Ücretsiz araç şu anda duraklatıldı."}},
    vi: {"signin": "Đăng nhập để nhận 2.500 tín dụng miễn phí", "none": "Hôm nay bạn đã hết trang miễn phí.", "inLeft": "Bạn đã đăng nhập: ", "inLink": "Trong playground, tối đa 500 trang mỗi ngày (50 trang ngày đầu)", "type": "Vui lòng dùng ảnh PNG, JPEG, WebP hoặc GIF. Sắp hỗ trợ PDF.", "size": "Ảnh này lớn hơn 25 MB. Hãy thử ảnh nhỏ hơn hoặc ảnh chụp màn hình.", "sample": "Không tải được ví dụ. Vui lòng thử lại.", "reading": "Đang đọc…", "run": "Đọc lại", "notext": "(Không tìm thấy chữ nào trong ảnh này.)", "network": "Không kết nối được máy chủ. Hãy kiểm tra kết nối và thử lại.", "paused": "Công cụ miễn phí đang tạm dừng. Bạn có thể đăng nhập bảng điều khiển và dùng tín dụng miễn phí.", "copied": "Đã sao chép", "copy": "Sao chép", "generic": "Đã có lỗi xảy ra. Vui lòng thử lại.", "pasted": "Ảnh đã dán", "codes": {"try_limit": "Bạn đã dùng hết trang miễn phí hôm nay.", "capacity": "Hạn mức miễn phí chung hôm nay đã hết. Hãy đăng nhập hoặc quay lại sau 00:00 UTC.", "rate_limited": "Quá nhiều yêu cầu. Vui lòng đợi một phút.", "model_error": "Mô hình không đọc được ảnh này. Hãy thử ảnh nét hơn.", "model_timeout": "Các mô hình đang bận và chưa trả lời kịp. Vui lòng thử lại sau giây lát.", "too_large": "Dù đã thu nhỏ, ảnh này vẫn lớn hơn 4 MB.", "unsupported_type": "Vui lòng dùng ảnh PNG, JPEG, WebP hoặc GIF.", "unavailable": "Công cụ miễn phí đang tạm dừng."}},
    id: {"signin": "Masuk dan dapatkan 2.500 kredit gratis", "none": "Halaman gratis Anda hari ini sudah habis.", "inLeft": "Anda sudah masuk: ", "inLink": "Di playground, hingga 500 halaman per hari (50 di hari pertama)", "type": "Gunakan gambar PNG, JPEG, WebP, atau GIF. PDF segera hadir.", "size": "Gambar ini lebih dari 25 MB. Coba foto yang lebih kecil atau screenshot.", "sample": "Contoh gagal dimuat. Silakan coba lagi.", "reading": "Membaca…", "run": "Baca ulang", "notext": "(Tidak ada teks yang ditemukan di gambar ini.)", "network": "Tidak bisa terhubung ke server. Periksa koneksi Anda lalu coba lagi.", "paused": "Alat gratis sedang dijeda. Anda bisa masuk ke konsol dan memakai kredit gratis Anda.", "copied": "Tersalin", "copy": "Salin", "generic": "Terjadi kesalahan. Silakan coba lagi.", "pasted": "Gambar yang ditempel", "codes": {"try_limit": "Halaman gratis Anda hari ini sudah habis.", "capacity": "Kuota gratis hari ini sudah habis. Masuk atau kembali setelah pukul 00:00 UTC.", "rate_limited": "Terlalu banyak permintaan. Tunggu sebentar.", "model_error": "Model tidak bisa membaca gambar ini. Coba foto yang lebih tajam.", "model_timeout": "Model sedang sibuk dan tidak sempat menjawab. Coba lagi sebentar lagi.", "too_large": "Setelah diperkecil pun, gambar ini masih lebih dari 4 MB.", "unsupported_type": "Gunakan gambar PNG, JPEG, WebP, atau GIF.", "unavailable": "Alat gratis sedang dijeda."}},
    he: {"signin": "היכנסו וקבלו 2,500 קרדיטים בחינם", "none": "לא נשארו היום עמודים בחינם.", "inLeft": "נכנסתם לחשבון: ", "inLink": "ב־playground עד 500 עמודים ביום (50 ביום הראשון)", "type": "השתמשו בתמונת PNG,‏ JPEG,‏ WebP או GIF. תמיכה ב־PDF בקרוב.", "size": "התמונה גדולה מ־25MB. נסו תמונה קטנה יותר או צילום מסך.", "sample": "לא הצלחנו לטעון את הדוגמה. נסו שוב.", "reading": "קורא…", "run": "קריאה מחדש", "notext": "(לא נמצא טקסט בתמונה הזו.)", "network": "אין חיבור לשרת. בדקו את החיבור ונסו שוב.", "paused": "הכלי החינמי מושהה כרגע. אפשר להיכנס לקונסולה ולהשתמש בקרדיטים החינמיים.", "copied": "הועתק", "copy": "העתקה", "generic": "משהו השתבש. נסו שוב.", "pasted": "תמונה מודבקת", "codes": {"try_limit": "העמודים החינמיים של היום נגמרו.", "capacity": "המכסה החינמית הכללית של היום נגמרה. היכנסו לחשבון או חזרו אחרי 00:00 UTC.", "rate_limited": "יותר מדי בקשות. המתינו דקה.", "model_error": "המודל לא הצליח לקרוא את התמונה. נסו תמונה חדה יותר.", "model_timeout": "המודלים עמוסים ולא ענו בזמן. נסו שוב בעוד רגע.", "too_large": "גם אחרי הקטנה התמונה גדולה מ־4MB.", "unsupported_type": "השתמשו בתמונת PNG,‏ JPEG,‏ WebP או GIF.", "unavailable": "הכלי החינמי מושהה כרגע."}},
    /* lang_new: end */
  };
  var T = TEXT[LANG] || TEXT.en;

  var ws = $("ws"), pane = document.querySelector(".ws__pane--txt"), split = $("ws-split"), out = $("try-out");
  var gateHome = document.querySelector(".tool-section > .note");

  function say(msg, kind) {
    ["try-status", "try-status-start"].forEach(function (id) { var s = $(id); s.textContent = msg || ""; s.setAttribute("data-kind", kind || ""); });
  }
  function refresh() { $("try-run").disabled = !file || busy || (!me && (!open || remaining === 0)); }
  function isOpen() { return !ws.hidden; }

  // ── pages left (shown on the start screen and in the workspace bar)
  function fillLeft(el, rem, limit) {
    el.textContent = "";
    function link(href, text) { var a = document.createElement("a"); a.href = href; a.textContent = text; el.appendChild(a); }
    // no running count of free pages (a small number puts people off): the limit only shows once it is reached,
    // with the way on (sign in for 2,500 free credits)
    if (me) {
      // signed in: pages simply use the person's credits; nothing to say here
    } else if (rem === 0) {
      el.textContent = T.none + " ";
      link(SIGNIN, T.signin);
    }
  }
  function placeGates() {
    [$("try-gate")].forEach(function (g) {
      if (isOpen()) $("ws-gates").appendChild(g); else gateHome.parentNode.insertBefore(g, gateHome);
    });
  }
  function showLeft(rem, limit) {
    remaining = rem;
    fillLeft($("try-left"), rem, limit);
    fillLeft($("ws-left"), rem, limit);
    $("try-gate").hidden = !(rem === 0 && !me);
    placeGates();
    refresh();
  }

  // ── formatted Markdown: the same rules as the console playground. Builds elements from text only, never HTML.
  function mk(tag, text) { var e = document.createElement(tag); if (text != null) e.textContent = text; return e; }
  function inline(parent, text) {
    var re = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
      var t = m[0];
      if (t[0] === "`") parent.appendChild(mk("code", t.slice(1, -1)));
      else if (t.slice(0, 2) === "**" || t.slice(0, 2) === "__") inline(parent.appendChild(mk("strong")), t.slice(2, -2));
      else inline(parent.appendChild(mk("em")), t.slice(1, -1));
      last = m.index + t.length;
    }
    if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
  }
  function cells(line) { return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return c.trim(); }); }
  function renderMd(root, src) {
    root.textContent = "";
    var lines = src.replace(/\r\n?/g, "\n").split("\n"), i = 0;
    function add(tag) { var e = mk(tag); e.setAttribute("dir", "auto"); root.appendChild(e); return e; }
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) { i++; continue; }
      var h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) { inline(add("h" + Math.min(4, h[1].length)), h[2]); i++; continue; }
      if (/^```/.test(line)) {
        var buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++; add("pre").appendChild(mk("code", buf.join("\n"))); continue;
      }
      if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { root.appendChild(mk("hr")); i++; continue; }
      if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        var table = add("table"), tr = mk("tr"), tbody = mk("tbody");
        cells(line).forEach(function (c) { inline(tr.appendChild(mk("th")), c); });
        table.appendChild(mk("thead")).appendChild(tr); table.appendChild(tbody); i += 2;
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          var r = mk("tr"); cells(lines[i]).forEach(function (c) { inline(r.appendChild(mk("td")), c); }); tbody.appendChild(r); i++;
        }
        continue;
      }
      var li = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
      if (li) {
        var list = add(/\d/.test(li[1]) ? "ol" : "ul");
        while (i < lines.length && (li = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/))) { inline(list.appendChild(mk("li")), li[2]); i++; }
        continue;
      }
      if (/^>\s?/.test(line)) {
        var q = add("blockquote"), first = true;
        while (i < lines.length && /^>\s?/.test(lines[i])) { if (!first) q.appendChild(mk("br")); inline(q, lines[i++].replace(/^>\s?/, "")); first = false; }
        continue;
      }
      var p = add("p"), f = true;
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*\||\s*([-*+]|\d+[.)])\s+|>)/.test(lines[i])) {
        if (!f) p.appendChild(mk("br"));
        inline(p, lines[i]); f = false; i++;
      }
      if (f) { inline(p, lines[i]); i++; }
    }
  }
  // Formatted / Markdown switch (shown for Markdown results)
  function showView(v) {
    $("try-md").hidden = v !== "md"; out.hidden = v === "md";
    Array.prototype.forEach.call($("try-view").querySelectorAll("button"), function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-v") === v)); });
  }
  $("try-view").addEventListener("click", function (e) { var b = e.target.closest("button[data-v]"); if (b) showView(b.getAttribute("data-v")); });
  function resetView() { $("try-view").hidden = true; $("try-md").hidden = true; out.hidden = false; }

  // ── the workspace
  var lastFocus = null;
  function openWs(name) {
    $("ws-name").textContent = name || "";
    if (!isOpen()) { lastFocus = document.activeElement; ws.hidden = false; document.body.classList.add("ws-open"); $("ws-close").focus(); }
    placeGates();
  }
  function closeWs() {
    if (!isOpen()) return;
    ws.hidden = true; document.body.classList.remove("ws-open");
    placeGates();
    if (lastFocus && lastFocus.focus) lastFocus.focus(); else $("drop").focus();
  }
  $("ws-close").addEventListener("click", closeWs);
  $("ws-new").addEventListener("click", function () { $("try-file").click(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen()) closeWs();
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") run();
  });
  // phones: one pane at a time
  function view(which) {
    ws.classList.toggle("ws--img", which === "img"); ws.classList.toggle("ws--txt", which !== "img");
    $("ws-tab-img").setAttribute("aria-selected", String(which === "img"));
    $("ws-tab-txt").setAttribute("aria-selected", String(which !== "img"));
  }
  $("ws-tab-img").addEventListener("click", function () { view("img"); });
  $("ws-tab-txt").addEventListener("click", function () { view("txt"); });
  view("txt");
  // click the page to zoom to full size, click again to fit
  $("try-preview").addEventListener("click", function () { this.parentNode.classList.toggle("is-zoomed"); });
  // the divider: drag with mouse, touch or pen; arrow keys move it too
  (function () {
    var d = $("ws-divider"), pct = 50;
    function set(p) { pct = Math.max(20, Math.min(80, p)); split.style.setProperty("--split", pct + "%"); d.setAttribute("aria-valuenow", String(Math.round(pct))); }
    d.addEventListener("pointerdown", function (e) { d.setPointerCapture(e.pointerId); d.classList.add("is-dragging"); e.preventDefault(); });
    d.addEventListener("pointermove", function (e) {
      if (!d.hasPointerCapture(e.pointerId)) return;
      var r = split.getBoundingClientRect(); set((e.clientX - r.left) / r.width * 100);
    });
    ["pointerup", "pointercancel"].forEach(function (t) { d.addEventListener(t, function () { d.classList.remove("is-dragging"); }); });
    d.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { set(pct - 5); e.preventDefault(); }
      if (e.key === "ArrowRight") { set(pct + 5); e.preventDefault(); }
    });
    d.addEventListener("dblclick", function () { set(50); });
  })();

  // ── choosing an image: it is prepared (scaled to 2000 px, compressed) at once and reading starts right away.
  // Nothing is uploaded before that: we don't store images.
  var MAXSIDE = 2000, SMALL = 1500000, prepared = null;
  function prepare(f, dataUrl) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, scale = Math.min(1, MAXSIDE / Math.max(w, h));
        if (scale === 1 && f.size <= SMALL && f.type !== "image/gif") return resolve(f);
        var c = document.createElement("canvas");
        c.width = Math.round(w * scale); c.height = Math.round(h * scale);
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { resolve(b && b.size < f.size ? new File([b], "page.jpg", { type: "image/jpeg" }) : f); }, "image/jpeg", 0.9);
      };
      img.onerror = function () { resolve(f); };
      img.src = dataUrl;
    });
  }
  function setFile(f, name) {
    if (!f) return;
    if (!TYPES.test(f.type)) { say(T.type, "error"); return; }
    if (f.size > MAX_IN) { say(T.size, "error"); return; }
    file = f;
    var img = $("try-preview");
    img.removeAttribute("src"); img.parentNode.classList.remove("is-zoomed");
    out.textContent = ""; out.classList.add("is-empty"); lastText = ""; resetView();
    $("try-copy").disabled = $("try-download").disabled = true;
    say("");
    openWs(name || f.name || "");
    prepared = new Promise(function (resolve) {
      var r = new FileReader();
      r.onload = function () { img.src = r.result; prepare(f, r.result).then(resolve); };
      r.onerror = function () { resolve(f); };
      r.readAsDataURL(f);
    });
    refresh();
    if (remaining === 0) { out.textContent = T.none; return; }
    if (open) run();
  }
  $("try-file").addEventListener("change", function (e) { setFile(e.target.files[0]); e.target.value = ""; });
  var drop = $("drop");
  ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("is-over"); }); });
  ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("is-over"); }); });
  // drop an image anywhere on the page
  var dropall = $("dropall"), depth = 0;
  function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") >= 0; }
  document.addEventListener("dragenter", function (e) { if (hasFiles(e)) { depth++; dropall.hidden = false; } });
  document.addEventListener("dragleave", function () { if (--depth <= 0) { depth = 0; dropall.hidden = true; } });
  document.addEventListener("dragover", function (e) { if (hasFiles(e)) e.preventDefault(); });
  document.addEventListener("drop", function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault(); depth = 0; dropall.hidden = true;
    if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
  });
  document.addEventListener("paste", function (e) {
    var items = (e.clipboardData && e.clipboardData.files) || [];
    if (items[0]) { e.preventDefault(); setFile(items[0], T.pasted); }
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-sample]"), function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-sample"), label = b.textContent.trim();
      fetch("/assets/samples/" + k + ".png").then(function (r) { return r.blob(); })
        .then(function (blob) { setFile(new File([blob], k + ".png", { type: "image/png" }), label); })
        .catch(function () { say(T.sample, "error"); });
    });
  });

  // reads a server-sent-events response: on(event, data) for each event; resolves when the stream ends
  function readEvents(res, on) {
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = "";
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) return;
        buf += dec.decode(r.value, { stream: true });
        var i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          var block = buf.slice(0, i), ev = "message", data = "";
          buf = buf.slice(i + 2);
          block.split("\n").forEach(function (l) {
            if (l.indexOf("event:") === 0) ev = l.slice(6).trim();
            else if (l.indexOf("data:") === 0) data += l.slice(5).trim();
          });
          if (data) { try { on(ev, JSON.parse(data)); } catch (e) { /* ignore a malformed event */ } }
        }
        return pump();
      });
    }
    return pump();
  }

  // ── reading
  function run() {
    if (!file || busy || !open || remaining === 0) return;
    busy = true; refresh();
    view("txt");
    var fmt = document.querySelector('input[name="try-format"]:checked').value;
    $("try-run").textContent = T.reading;
    $("try-copy").disabled = $("try-download").disabled = true;
    out.textContent = ""; out.classList.add("is-empty", "is-streaming"); resetView();
    say("");
    function fail(d) {
      out.classList.remove("is-streaming");
      var code = d.error && d.error.code;
      if (d.remaining != null) showLeft(d.remaining, d.limit);
      if (code === "try_limit" || code === "capacity") showLeft(0, d.limit);
      if (code === "insufficient_credits") return say(NOCREDITS[LANG] || NOCREDITS.en, "error");
      say((code && T.codes[code]) || (LANG === "en" && d.error && d.error.message) || T.generic, "error");
    }
    function finish(d) {
      lastText = d.text || ""; lastFormat = d.format || fmt;
      out.textContent = lastText || T.notext;
      out.classList.remove("is-empty", "is-streaming");
      $("try-copy").disabled = $("try-download").disabled = !lastText;
      if (lastText && lastFormat === "markdown") { renderMd($("try-md"), lastText); $("try-view").hidden = false; showView("md"); }
      if (d.remaining != null) showLeft(d.remaining, d.limit);
    }
    (prepared || Promise.resolve(file))
      .then(function (f) {
        if (f.size > MAX) throw { tooBig: true };
        var fd = new FormData();
        fd.append("file", f);
        fd.append("format", fmt);
        fd.append("stream", "true");
        return fetch(API, { method: "POST", body: fd, credentials: "include" });
      })
      .then(function (r) {
        if ((r.headers.get("Content-Type") || "").indexOf("text/event-stream") !== 0) {
          // refused before reading (limits, bad file …): a plain JSON answer
          return r.json().catch(function () { return {}; }).then(function (d) { if (r.ok && typeof d.text === "string") finish(d); else fail(d); });
        }
        var ended = false;
        return readEvents(r, function (ev, d) {
          if (ev === "delta") {
            var atEnd = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 60;
            if (out.classList.contains("is-empty")) { out.textContent = ""; out.classList.remove("is-empty"); }
            out.textContent += d.text;
            if (atEnd) pane.scrollTop = pane.scrollHeight;
          } else if (ev === "done") { ended = true; finish(d); }
          else if (ev === "error") { ended = true; fail(d); }
        }).then(function () { if (!ended) fail({}); });
      })
      .catch(function (e) { out.classList.remove("is-streaming"); say(e && e.tooBig ? T.size : T.network, "error"); })
      .then(function () { busy = false; $("try-run").textContent = T.run; refresh(); });
  }
  $("try-run").addEventListener("click", run);

  $("try-copy").addEventListener("click", function () {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(lastText).then(function () {
      var label = $("try-copy").querySelector("span");
      label.textContent = T.copied;
      setTimeout(function () { label.textContent = T.copy; }, 1500);
    });
  });
  $("try-download").addEventListener("click", function () {
    var a = document.createElement("a");
    var md = lastFormat === "markdown";
    a.href = "data:" + (md ? "text/markdown" : "text/plain") + ";charset=utf-8," + encodeURIComponent(lastText);
    a.download = "runemic-ocr." + (md ? "md" : "txt");
    document.body.appendChild(a); a.click(); a.remove();
  });

  // signed in here? else how many free pages are left (and whether the tool is on)
  function status() {
    return fetch(API, { credentials: "include" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        me = d.signed_in ? d.user : null;
        open = d.open !== false;
        say(!open && !me ? T.paused : "", !open && !me ? "error" : "");
        showLeft(me ? null : d.remaining, d.limit);
      })
      .catch(function () { /* the POST will report problems */ });
  }
  $("try-signin").href = SIGNIN;
  status();

  // a page dropped or chosen on the home page (home.js) is read here straight away
  try {
    var h = JSON.parse(sessionStorage.getItem("runemic-handoff") || "null");
    sessionStorage.removeItem("runemic-handoff");
    if (h && /^data:image\/[a-z+.-]+;base64,/.test(h.data)) {
      var bin = atob(h.data.split(",")[1]), u8 = new Uint8Array(bin.length);
      for (var k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
      setFile(new File([u8], h.name || "page", { type: h.type || "image/png" }), h.name);
    }
  } catch (e) { /* storage unavailable: nothing to pick up */ }
})();
